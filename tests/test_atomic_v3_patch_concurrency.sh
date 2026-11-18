#!/usr/bin/env bash
# Two live PostgreSQL connections exercising the ACTUAL V3 guarded PATCH RPC.
# CI-only; never connect this script to hosted Supabase or real user accounts.
set -euo pipefail
if [[ "${PGHOST:-}" != '127.0.0.1' || "${PGDATABASE:-}" != 'aimroutine_qa' ]]; then
 echo 'REFUSED: isolated localhost aimroutine_qa PostgreSQL only' >&2; exit 1
fi
A='11111111-1111-4111-8111-111111111111'
B='22222222-2222-4222-8222-222222222222'
tmp="$(mktemp -d)"
child=''
cleanup(){
 if [[ -n "$child" ]] && kill -0 "$child" 2>/dev/null; then kill "$child" || :; wait "$child" || :; fi
 rm -rf "$tmp"
}
trap cleanup EXIT
db(){ psql -X -qAt -v ON_ERROR_STOP=1 -c "$1"; }
await_lock(){
 local n held
 for n in $(seq 1 120); do
  held="$(db "select count(*) from pg_locks where locktype='advisory' and granted and pid<>pg_backend_pid()")"
  if [[ "$held" -ge 1 ]]; then return 0; fi
  sleep 0.05
 done
 echo 'Timed out waiting for isolated V3 transaction advisory lock' >&2
 return 1
}
assert_sql(){
 local observed
 observed="$(db "$1")"
 if [[ "$observed" != "$2" ]];then
  echo "FAILED: expected '$2', observed '$observed'" >&2; exit 1
 fi
}
cursor="$(db "select settings->>'reset_at' from public.aim_preferences where user_id='$A'::uuid")"
[[ "$cursor" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T ]] || { echo 'No A reset epoch' >&2; exit 1; }

# V3 write wins account lock FIRST; reset must follow it and delete all data.
psql -X -qAt -v ON_ERROR_STOP=1 >"$tmp/writer.log" 2>&1 <<SQL &
begin;
set role authenticated;
select set_config('request.jwt.claim.sub','$A',true);
select public.aim_apply_progress_for_user(
 '$A'::uuid,'$cursor',
 '[{"id":"v3-writer-before-reset"}]'::jsonb,
 '[{"id":"v3-preset-before-reset"}]'::jsonb,
 array[]::text[],
 '{"profile":{"nickname":"WillBeCleared"}}'::jsonb,7::smallint
);
select pg_sleep(1.4);
commit;
SQL
child=$!
await_lock
db "begin;set role authenticated;select set_config('request.jwt.claim.sub','$A',true);
select public.aim_reset_my_progress_for_user('$A'::uuid);commit;" >/dev/null
wait "$child";child=''
assert_sql "select count(*) from public.aim_sessions where user_id='$A'::uuid" 0
assert_sql "select count(*) from public.aim_presets where user_id='$A'::uuid" 0
assert_sql "select count(*) from public.aim_profiles where user_id='$A'::uuid" 0
assert_sql "select weekly_goal from public.aim_preferences where user_id='$A'::uuid" 3
assert_sql "select count(*) from public.aim_sessions where user_id='$B'::uuid" 1
echo 'PASS: V3 writer-first transaction followed by reset clears all four A data categories'

# Reset wins account lock FIRST; outdated write must reject as one atomic RPC.
stale="$(db "select settings->>'reset_at' from public.aim_preferences where user_id='$A'::uuid")"
psql -X -qAt -v ON_ERROR_STOP=1 >"$tmp/reset.log" 2>&1 <<SQL &
begin;
set role authenticated;
select set_config('request.jwt.claim.sub','$A',true);
select public.aim_reset_my_progress_for_user('$A'::uuid);
select pg_sleep(1.4);
commit;
SQL
child=$!
await_lock
if psql -X -qAt -v ON_ERROR_STOP=1 >"$tmp/stale.log" 2>&1 <<SQL
begin;
set role authenticated;
select set_config('request.jwt.claim.sub','$A',true);
select public.aim_apply_progress_for_user(
 '$A'::uuid,'$stale',
 '[{"id":"v3-stale-session"}]'::jsonb,
 '[{"id":"v3-stale-preset"}]'::jsonb,
 array[]::text[],
 '{"profile":{"nickname":"ShouldNotAppear"}}'::jsonb,8::smallint
);
commit;
SQL
then
 echo 'FAILED: stale V3 batch unexpectedly committed after reset' >&2;exit 1
fi
if ! grep -q 'stale_reset_cursor' "$tmp/stale.log"; then
 echo 'FAILED: V3 batch failed for a reason other than reset epoch' >&2
 cat "$tmp/stale.log" >&2
 exit 1
fi
wait "$child";child=''
assert_sql "select count(*) from public.aim_sessions where user_id='$A'::uuid" 0
assert_sql "select count(*) from public.aim_presets where user_id='$A'::uuid" 0
assert_sql "select count(*) from public.aim_profiles where user_id='$A'::uuid" 0
assert_sql "select weekly_goal from public.aim_preferences where user_id='$A'::uuid" 3
assert_sql "select count(*) from public.aim_sessions where user_id='$B'::uuid" 1
echo 'PASS: V3 reset-first transaction rejects stale sessions presets profile and goal atomically'
