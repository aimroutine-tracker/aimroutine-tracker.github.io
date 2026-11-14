\set ON_ERROR_STOP on
-- ISOLATED POSTGRESQL ONLY. Experimental V3 role cutover, not a hosted migration.
-- Run AFTER tests/account-bound-reset-postgres.sql and the V3 atomic RPC tests.
-- The current V3 functions are SECURITY INVOKER and require direct authenticated
-- table grants. This prototype verifies a possible permission separation:
-- callable SECURITY DEFINER functions owned by a NOLOGIN, NOBYPASSRLS role,
-- authenticated can SELECT its own rows but cannot mutate tables through REST.
--
-- Do NOT apply in hosted Supabase until rollout of V2 legacy clients is approved.
begin;

create role aim_cloud_writer nologin nobypassrls noinherit;
grant usage on schema public,auth to aim_cloud_writer;
grant execute on function auth.uid() to aim_cloud_writer;
grant select,insert,update,delete on
  public.aim_sessions,public.aim_presets,
  public.aim_profiles,public.aim_preferences
  to aim_cloud_writer;

create policy qa_writer_sessions on public.aim_sessions
  for all to aim_cloud_writer
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy qa_writer_presets on public.aim_presets
  for all to aim_cloud_writer
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy qa_writer_profiles on public.aim_profiles
  for all to aim_cloud_writer
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy qa_writer_preferences on public.aim_preferences
  for all to aim_cloud_writer
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- The function owner must possess CREATE temporarily to accept ownership.
-- This permission is revoked after the two functions have been transferred.
grant create on schema public to aim_cloud_writer;
alter function public.aim_reset_my_progress_for_user(uuid)
  owner to aim_cloud_writer;
alter function public.aim_apply_progress_for_user(
  uuid,text,jsonb,jsonb,text[],jsonb,smallint)
  owner to aim_cloud_writer;
revoke create on schema public from aim_cloud_writer;
alter function public.aim_reset_my_progress_for_user(uuid) security definer;
alter function public.aim_apply_progress_for_user(
  uuid,text,jsonb,jsonb,text[],jsonb,smallint) security definer;

-- Removing *all* privileges also removes TRUNCATE, REFERENCES and TRIGGER,
-- which RLS alone does not secure. Signed-in users retain SELECT under RLS.
revoke all on
  public.aim_sessions,public.aim_presets,
  public.aim_profiles,public.aim_preferences
  from public,anon,authenticated;
grant select on
  public.aim_sessions,public.aim_presets,
  public.aim_profiles,public.aim_preferences
  to authenticated;
commit;

-- Prevent a privileged function from executing under a RLS-bypass account.
do $check$
declare r record;
begin
 select rolcanlogin,rolbypassrls,rolsuper,rolcreaterole
 into r from pg_roles where rolname='aim_cloud_writer';
 if not found or r.rolcanlogin or r.rolbypassrls or r.rolsuper or r.rolcreaterole
 then raise exception 'Dedicated write role is privileged or login-capable'; end if;
 if exists(select 1 from pg_class
   where oid in('public.aim_sessions'::regclass,'public.aim_presets'::regclass,
     'public.aim_profiles'::regclass,'public.aim_preferences'::regclass)
   and relowner=(select oid from pg_roles where rolname='aim_cloud_writer'))
 then raise exception 'Dedicated function role owns a protected table'; end if;
 if exists(select 1 from pg_proc
   where oid in(
    'public.aim_reset_my_progress_for_user(uuid)'::regprocedure,
    'public.aim_apply_progress_for_user(uuid,text,jsonb,jsonb,text[],jsonb,smallint)'::regprocedure)
    and (not prosecdef or proowner<>(select oid from pg_roles where rolname='aim_cloud_writer')))
 then raise exception 'Functions not restricted to trusted RLS writer'; end if;
end
$check$;

do $check$
declare tbl regclass;
begin
 foreach tbl in array array[
  'public.aim_sessions'::regclass,'public.aim_presets'::regclass,
  'public.aim_profiles'::regclass,'public.aim_preferences'::regclass
 ] loop
  if not has_table_privilege('authenticated',tbl,'SELECT')
    or has_table_privilege('authenticated',tbl,'INSERT')
    or has_table_privilege('authenticated',tbl,'UPDATE')
    or has_table_privilege('authenticated',tbl,'DELETE')
    or has_table_privilege('authenticated',tbl,'TRUNCATE')
    or has_table_privilege('authenticated',tbl,'TRIGGER')
  then raise exception 'Direct REST table mutation privileges remain: %',tbl; end if;
  if not has_table_privilege('aim_cloud_writer',tbl,'SELECT,INSERT,UPDATE,DELETE')
  then raise exception 'Dedicated writer is unable to apply RPC writes: %',tbl; end if;
 end loop;
end
$check$;

-- Simulate the already-deployed V2 caller: SELECT remains available but
-- direct mutations must be denied even for a valid signed-in owner.
set role authenticated;
select set_config('request.jwt.claim.sub',
 '11111111-1111-4111-8111-111111111111',false);
do $test$
declare message text;
begin
 begin
  insert into public.aim_sessions(user_id,session_id)
    values ('11111111-1111-4111-8111-111111111111','legacy-must-fail');
  raise exception 'A V2 direct INSERT unexpectedly worked';
 exception when sqlstate '42501' then null;
 end;
 begin
  update public.aim_preferences set weekly_goal=9
   where user_id='11111111-1111-4111-8111-111111111111';
  raise exception 'A V2 direct UPDATE unexpectedly worked';
 exception when sqlstate '42501' then null;
 end;
 begin
  delete from public.aim_presets
   where user_id='11111111-1111-4111-8111-111111111111';
  raise exception 'A V2 direct DELETE unexpectedly worked';
 exception when sqlstate '42501' then null;
 end;
end
$test$;
reset role;

-- The supported V3 route continues to write for its own uid, including
-- after the no-login function role was granted only RLS-scoped table rights.
select settings->>'reset_at' as qa_epoch
 from public.aim_preferences
 where user_id='11111111-1111-4111-8111-111111111111'
\gset
set role authenticated;
select set_config('request.jwt.claim.sub',
 '11111111-1111-4111-8111-111111111111',false);
select public.aim_apply_progress_for_user(
 '11111111-1111-4111-8111-111111111111'::uuid,
 :'qa_epoch',
 '[{"id":"v3-after-role-cutover"}]'::jsonb,
 '[{"id":"v3-preset-after-cutover"}]'::jsonb,
 array[]::text[], '{"training":"safe"}'::jsonb,5::smallint
);
reset role;

-- B should not be able to read or affect A, including via definer RPC.
set role authenticated;
select set_config('request.jwt.claim.sub',
 '22222222-2222-4222-8222-222222222222',false);
do $test$
declare message text;
begin
 if exists(select 1 from public.aim_sessions
     where user_id='11111111-1111-4111-8111-111111111111')
 then raise exception 'Signed-in B can read A sessions'; end if;
 begin
  perform public.aim_reset_my_progress_for_user(
   '11111111-1111-4111-8111-111111111111'::uuid
  );
  raise exception 'B reset A through definer';
 exception when sqlstate '42501' then
  get stacked diagnostics message=message_text;
  if message<>'account_mismatch' then
   raise exception 'Unexpected definer-owner rejection: %',message; end if;
 end;
end
$test$;
reset role;

do $check$
begin
 if not exists(select 1 from public.aim_sessions
   where user_id='11111111-1111-4111-8111-111111111111'
     and session_id='v3-after-role-cutover')
 then raise exception 'Trusted V3 RPC failed to save A session'; end if;
 if (select count(*) from public.aim_sessions
   where user_id='22222222-2222-4222-8222-222222222222')<>1
 then raise exception 'B changed during V3 write'; end if;
 if exists(select 1 from public.aim_sessions
   where session_id='legacy-must-fail')
 then raise exception 'Legacy client inserted without permission'; end if;
end
$check$;

\echo 'PASS: isolated V2 REST write cutoff blocks legacy writes while protected V3 RPC and account RLS remain functional'
