\set ON_ERROR_STOP on
-- CI-ONLY proof of an atomic guarded-write protocol after the account-bound
-- reset migration is installed in an ephemeral PostgreSQL database.
-- This function is deliberately named qa_* and is NOT a production migration.
-- The published/V3 clients still use direct REST upserts; DO NOT claim that
-- this proof already protects their writes.
--
-- A reset RPC and a future guarded write both take the exact same transaction
-- advisory lock before any mutation, then compare the last reset cursor.
-- Such writes are ordered either BEFORE reset (and get deleted) or AFTER reset
-- (and must present the new cursor). The SQL statements themselves are atomic.

create or replace function public.qa_guarded_session_insert(
  expected_uid uuid,
  expected_reset_at text,
  new_session_id text
)
returns void
language plpgsql
security invoker
set search_path=pg_catalog
as $guarded$
declare
  actor_id uuid := auth.uid();
  actual_reset_at text;
begin
  if actor_id is null then
    raise exception 'authentication_required' using errcode='28000';
  end if;
  if expected_uid is null or actor_id is distinct from expected_uid then
    raise exception 'account_mismatch' using errcode='42501';
  end if;

  -- Exact same bigint advisory key as the account-bound deletion migration.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(expected_uid::text, 27012026::bigint)
  );
  select settings->>'reset_at'
    into actual_reset_at
    from public.aim_preferences
    where user_id=expected_uid;

  if actual_reset_at is distinct from expected_reset_at then
    raise exception 'stale_reset_cursor' using errcode='40001';
  end if;
  if pg_catalog.length(new_session_id) not between 1 and 100 then
    raise exception 'invalid_session_id' using errcode='22023';
  end if;
  insert into public.aim_sessions(user_id,session_id)
    values (expected_uid,new_session_id)
    on conflict (user_id,session_id) do nothing;
end
$guarded$;
revoke all on function public.qa_guarded_session_insert(uuid,text,text)
  from public,anon;
grant execute on function public.qa_guarded_session_insert(uuid,text,text)
  to authenticated;

create or replace function public.qa_assert_stale_reset(
  expected_uid uuid,
  old_cursor text
)
returns void
language plpgsql
security invoker
set search_path=pg_catalog
as $test$
declare error_message text;
begin
  begin
    perform public.qa_guarded_session_insert(
      expected_uid,old_cursor,'stale-reinsertion-must-fail'
    );
    raise exception 'stale writer unexpectedly succeeded';
  exception when sqlstate '40001' then
    get stacked diagnostics error_message=message_text;
    if error_message<>'stale_reset_cursor' then
      raise exception 'unexpected stale rejection: %',error_message;
    end if;
  end;
end
$test$;
revoke all on function public.qa_assert_stale_reset(uuid,text)
  from public,anon;
grant execute on function public.qa_assert_stale_reset(uuid,text)
  to authenticated;

-- B still owns its one synthetic session. The prior suite reset A once.
select settings->>'reset_at' as reset_a_before
from public.aim_preferences
where user_id='11111111-1111-4111-8111-111111111111'
\gset
set role authenticated;
select set_config('request.jwt.claim.sub',
 '11111111-1111-4111-8111-111111111111',false);
select public.qa_guarded_session_insert(
 '11111111-1111-4111-8111-111111111111',
 :'reset_a_before','session-before-reset'
);
reset role;

do $test$
begin
 if (select count(*) from public.aim_sessions
     where user_id='11111111-1111-4111-8111-111111111111')<>1
 then raise exception 'Guarded upload with a current cursor failed'; end if;
end
$test$;

-- Use a deterministic pause so the current migration's millisecond marker
-- changes between these synthetic sequential tests. That is NOT a guarantee
-- about back-to-back production resets.
select pg_sleep(0.020);
set role authenticated;
select set_config('request.jwt.claim.sub',
 '11111111-1111-4111-8111-111111111111',false);
select public.aim_reset_my_progress_for_user(
 '11111111-1111-4111-8111-111111111111'
);
select public.qa_assert_stale_reset(
 '11111111-1111-4111-8111-111111111111',
 :'reset_a_before'
);
reset role;

-- The stale write was rejected and cannot recreate the just-deleted session.
do $test$
begin
 if exists(select 1 from public.aim_sessions
   where user_id='11111111-1111-4111-8111-111111111111')
 then raise exception 'Stale post-reset writer restored A data'; end if;
 if (select count(*) from public.aim_sessions
   where user_id='22222222-2222-4222-8222-222222222222')<>1
 then raise exception 'B data was touched by A reset'; end if;
end
$test$;

select settings->>'reset_at' as reset_a_after
from public.aim_preferences
where user_id='11111111-1111-4111-8111-111111111111'
\gset

set role authenticated;
select set_config('request.jwt.claim.sub',
 '11111111-1111-4111-8111-111111111111',false);
select public.qa_guarded_session_insert(
 '11111111-1111-4111-8111-111111111111',
 :'reset_a_after','session-after-reset'
);
reset role;

-- A B token may never use this RPC to write A's account.
set role authenticated;
select set_config('request.jwt.claim.sub',
 '22222222-2222-4222-8222-222222222222',false);
do $test$
declare message text;
begin
 begin
  perform public.qa_guarded_session_insert(
   '11111111-1111-4111-8111-111111111111',null,'inject-a-from-b'
  );
  raise exception 'B illegally wrote A';
 exception when sqlstate '42501' then
  get stacked diagnostics message=message_text;
  if message<>'account_mismatch' then
   raise exception 'Unexpected cross-account rejection: %',message;
  end if;
 end;
end
$test$;
reset role;

do $test$
begin
 if (select count(*) from public.aim_sessions where
     user_id='11111111-1111-4111-8111-111111111111'
     and session_id='session-after-reset')<>1
 then raise exception 'New epoch writer cannot save fresh A session'; end if;
 if exists(select 1 from public.aim_sessions where
     session_id in ('session-before-reset','stale-reinsertion-must-fail','inject-a-from-b'))
 then raise exception 'Obsolete/cross-account sessions appeared'; end if;
 if (select count(*) from public.aim_sessions where
     user_id='22222222-2222-4222-8222-222222222222')<>1
 then raise exception 'B data changed'; end if;
end
$test$;

-- QA helper functions intentionally exist only on disposable PostgreSQL CI.
\echo 'PASS: guarded-write prototype rejects stale post-reset sessions and cross-account writes in isolated PostgreSQL'
