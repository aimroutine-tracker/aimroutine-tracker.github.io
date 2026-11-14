\set ON_ERROR_STOP on
-- Synthetic end-to-end contract for V3's account-bound atomic PATCH RPC.
-- Runs ONLY in the ephemeral PostgreSQL CI service, never hosted Supabase.
-- The baseline suite created A/B roles, tested account reset, and left A with
-- a valid reset cursor. B must remain isolated.
do $assert$
begin
 if has_function_privilege('anon',
  'public.aim_apply_progress_for_user(uuid,text,jsonb,jsonb,text[],jsonb,smallint)',
  'EXECUTE') then
  raise exception 'Anonymous user may call progress patch';
 end if;
 if not has_function_privilege('authenticated',
  'public.aim_apply_progress_for_user(uuid,text,jsonb,jsonb,text[],jsonb,smallint)',
  'EXECUTE') then
  raise exception 'Authenticated role missing progress patch access';
 end if;
end
$assert$;

select settings->>'reset_at' as qa_cursor
from public.aim_preferences
where user_id='11111111-1111-4111-8111-111111111111'
\gset

-- Atomic new sessions, preset, profile and weekly goal for account A.
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select public.aim_apply_progress_for_user(
 '11111111-1111-4111-8111-111111111111', :'qa_cursor',
 '[{"id":"qa-atomic-session","scenario":"Aim Lab"}]'::jsonb,
 '[{"id":"qa-atomic-preset","name":"Training"}]'::jsonb,
 array[]::text[],
 '{"profile":{"nickname":"SyntheticA"}}'::jsonb,
 5::smallint
);
reset role;

do $assert$
begin
 if not exists(select 1 from public.aim_sessions
  where user_id='11111111-1111-4111-8111-111111111111'
    and session_id='qa-atomic-session') then
  raise exception 'New A session missing';
 end if;
 if not exists(select 1 from public.aim_presets
  where user_id='11111111-1111-4111-8111-111111111111'
    and preset_id='qa-atomic-preset') then
  raise exception 'New A preset missing';
 end if;
 if (select profile->'profile'->>'nickname' from public.aim_profiles
   where user_id='11111111-1111-4111-8111-111111111111')<>'SyntheticA'
  then raise exception 'A profile was not saved'; end if;
 if (select weekly_goal from public.aim_preferences
   where user_id='11111111-1111-4111-8111-111111111111')<>5
  then raise exception 'A weekly goal missing'; end if;
end
$assert$;

-- First writer wins for immutable sessions and immutable preset IDs.
-- Favorites removed by the user become tombstones, not stale reinsertions.
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select public.aim_apply_progress_for_user(
 '11111111-1111-4111-8111-111111111111', :'qa_cursor',
 '[{"id":"qa-atomic-session","scenario":"Modified should not win"}]'::jsonb,
 '[{"id":"qa-atomic-preset","name":"Modified should not win"}]'::jsonb,
 array['qa-atomic-preset']::text[],
 null,null
);
reset role;

do $assert$
begin
 if (select payload->>'scenario' from public.aim_sessions
   where user_id='11111111-1111-4111-8111-111111111111'
    and session_id='qa-atomic-session')<>'Aim Lab'
 then raise exception 'Concurrent session updated an immutable record'; end if;
 if not exists(select 1 from public.aim_presets
   where user_id='11111111-1111-4111-8111-111111111111'
    and preset_id='qa-atomic-preset' and deleted_at is not null)
 then raise exception 'Preset delete did not make an authoritative tombstone'; end if;
end
$assert$;

-- A stale marker after reset must reject ALL rows in the batch.
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select public.aim_reset_my_progress_for_user('11111111-1111-4111-8111-111111111111');
do $assert$
declare msg text;
begin
 begin
  perform public.aim_apply_progress_for_user(
   '11111111-1111-4111-8111-111111111111',
   :'qa_cursor',
   '[{"id":"should-not-revive"}]'::jsonb,
   '[{"id":"should-not-revive-preset"}]'::jsonb,
   array[]::text[],null,6::smallint
  );
  raise exception 'Stale atomic patch was accepted';
 exception when sqlstate '40001' then
  get stacked diagnostics msg=message_text;
  if msg<>'stale_reset_cursor' then
   raise exception 'Unexpected stale error: %',msg;
  end if;
 end;
end
$assert$;
reset role;

do $assert$
begin
 if exists(select 1 from public.aim_sessions
     where user_id='11111111-1111-4111-8111-111111111111')
  or exists(select 1 from public.aim_presets
     where user_id='11111111-1111-4111-8111-111111111111')
 then raise exception 'Post-reset data reappeared'; end if;
 if (select weekly_goal from public.aim_preferences
   where user_id='11111111-1111-4111-8111-111111111111')<>3
 then raise exception 'Stale write changed the weekly goal'; end if;
 if (select count(*) from public.aim_sessions
   where user_id='22222222-2222-4222-8222-222222222222')<>1
 then raise exception 'B sessions changed'; end if;
end
$assert$;

-- Verify owner-bound authorization is checked BEFORE any writes.
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
do $assert$
declare msg text;
begin
 begin
  perform public.aim_apply_progress_for_user(
   '11111111-1111-4111-8111-111111111111', null,
   '[{"id":"injected-from-b"}]'::jsonb,'[]'::jsonb,
   array[]::text[],null,null
  );
  raise exception 'B token illegally wrote A';
 exception when sqlstate '42501' then
  get stacked diagnostics msg=message_text;
  if msg<>'account_mismatch' then raise exception 'Unexpected identity error'; end if;
 end;
end
$assert$;
reset role;

-- Malformed profile must roll back a preceding valid session insert.
select settings->>'reset_at' as qa_new_cursor
from public.aim_preferences
where user_id='11111111-1111-4111-8111-111111111111'
\gset
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
do $assert$
declare msg text;
begin
 begin
  perform public.aim_apply_progress_for_user(
   '11111111-1111-4111-8111-111111111111', :'qa_new_cursor',
   '[{"id":"must-roll-back"}]'::jsonb,'[]'::jsonb,
   array[]::text[],'[1,2]'::jsonb,null
  );
  raise exception 'Invalid profile payload accepted';
 exception when sqlstate '22023' then
  get stacked diagnostics msg=message_text;
  if msg<>'invalid_profile_payload' then raise exception 'Unexpected validation error: %',msg; end if;
 end;
end
$assert$;
reset role;
do $assert$
begin
 if exists(select 1 from public.aim_sessions
    where user_id='11111111-1111-4111-8111-111111111111'
    and session_id='must-roll-back')
 then raise exception 'RPC was not fully transactional'; end if;
end
$assert$;
\echo 'PASS: atomic V3 PATCH RPC enforces A/B ownership, reset epochs, immutable IDs, preset tombstones and full rollback'
