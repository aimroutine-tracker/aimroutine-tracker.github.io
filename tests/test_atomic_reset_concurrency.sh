#!/usr/bin/env bash
# TRUE two-connection PostgreSQL concurrency test for a QA-only write RPC.
# Never use this file against a hosted or production database.
set -euo pipefail
if [[ "${PGHOST:-}" != '127.0.0.1' || "${PGDATABASE:-}" != 'aimroutine_qa' ]]; then
  echo 'REFUSED: this test requires the isolated localhost aimroutine_qa database' >&2
  exit 1
fi
A='11111111-1111-4111-8111-111111111111'
B='22222222-2222-4222-8222-222222222222'
tmpdir="$(mktemp -d)"
child=''
cleanup(){
  if [[ -n "$child" ]] && kill -0 "$child" 2>/dev/null; then kill "$child" || :; wait "$child" || :; fi
  rm -rf "$tmpdir"
}
trap cleanup EXIT
db(){ psql -X -qAt -v ON_ERROR_STOP=1 -c "$1"; }
wait_for_other_advisory_lock(){
  local locks i
  for i in $(seq 1 100); do
    locks="$(db "select count(*) from pg_locks where locktype='advisory' and granted and pid<>pg_backend_pid()")"
    if [[ "$locks" -ge 1 ]]; then return 0; fi
    sleep 0.05
  done
  echo 'QA transaction did not acquire advisory lock' >&2
  return 1
}
assert_count(){
  local got
  got="$(db "$1")"
  if [[ "$got" != "$2" ]]; then echo "FAILED: expected count $2, got $got" >&2; exit 1; fi
}
start_cursor="$(db "select settings->>'reset_at' from public.aim_preferences where user_id='$A'::uuid")"
if [[ ! "$start_cursor" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T ]]; then
  echo 'Missing isolated A reset marker' >&2
  exit 1
fi
# Scenario 1: writer obtains the account lock, writes an uncommitted session,
# and stays in its transaction while the reset tries to acquire the SAME lock.
# The reset must execute later and remove that session.
psql -X -qAt -v ON_ERROR_STOP=1 >"$tmpdir/writer.log" 2>&1 <<SQL &
begin;
set role authenticated;
select set_config('request.jwt.claim.sub','$A',true);
select public.qa_guarded_session_insert('$A'::uuid,'$start_cursor','qa-write-before-reset');
select pg_sleep(1.4);
commit;
SQL
child=$!
wait_for_other_advisory_lock
db "begin; set role authenticated;
select set_config('request.jwt.claim.sub','$A',true);
select public.aim_reset_my_progress_for_user('$A'::uuid); commit;" >/dev/null
wait "$child"
child=''
assert_count "select count(*) from public.aim_sessions where user_id='$A'::uuid" '0'
assert_count "select count(*) from public.aim_sessions where user_id='$B'::uuid" '1'
echo 'PASS: writer-first transaction committed then reset deleted its session'

# Scenario 2: reset obtains the lock and holds the transaction OPEN.
# A stale writer cannot bypass that in-flight reset and must be rejected
# when it acquires the lock after the reset commits.
stale_cursor="$(db "select settings->>'reset_at' from public.aim_preferences where user_id='$A'::uuid")"
psql -X -qAt -v ON_ERROR_STOP=1 >"$tmpdir/reset.log" 2>&1 <<SQL &
begin;
set role authenticated;
select set_config('request.jwt.claim.sub','$A',true);
select public.aim_reset_my_progress_for_user('$A'::uuid);
select pg_sleep(1.4);
commit;
SQL
child=$!
wait_for_other_advisory_lock
if psql -X -qAt -v ON_ERROR_STOP=1 >"$tmpdir/stale.log" 2>&1 <<SQL
begin;
set role authenticated;
select set_config('request.jwt.claim.sub','$A',true);
select public.qa_guarded_session_insert('$A'::uuid,'$stale_cursor','qa-obsolete-after-reset');
commit;
SQL
then
  echo 'FAILED: stale post-reset writer was accepted' >&2
  exit 1
fi
if ! grep -q 'stale_reset_cursor' "$tmpdir/stale.log"; then
  echo 'FAILED: unexpected stale writer error (not cursor mismatch)' >&2
  cat "$tmpdir/stale.log" >&2
  exit 1
fi
wait "$child"
child=''
assert_count "select count(*) from public.aim_sessions where user_id='$A'::uuid" '0'
assert_count "select count(*) from public.aim_sessions where user_id='$B'::uuid" '1'
echo 'PASS: reset-first concurrent transaction rejects stale writes; B remains untouched'
