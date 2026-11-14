-- REVIEW-ONLY PROPOSAL. NOT A Supabase migration. DO NOT APPLY TO HOSTED
-- OR PRODUCTION UNTIL THE V3 client, base RPC migration, staged rollout and
-- disposable A/B tests have been approved by the site owner.
--
-- Security rationale: V3 reset and atomic write RPCs are currently
-- SECURITY INVOKER, so signed-in V2 users also have direct REST table-write
-- grants and can bypass the V3 account reset lock. Removing grants without
-- changing the RPC function role would break V3 too.
--
-- Here the two RPCs become SECURITY DEFINER owned by a *dedicated*
-- NOLOGIN, NOBYPASSRLS role. This is NOT a privileged postgres-owned
-- SECURITY DEFINER. The dedicated role cannot log in or bypass RLS and
-- receives only table CRUD needed for the four progress tables. Its RLS
-- policies still require auth.uid() = user_id. The endpoint functions
-- independently verify expected_uid equals the authenticated JWT owner,
-- pin their search_path to pg_catalog, use the same account advisory lock
-- and refuse stale reset cursors. authenticated retains SELECT but loses
-- all direct writes (and any TRUNCATE/TRIGGER table privileges).
--
-- Run only as reviewed role-managing migration after confirming there is
-- NO existing role named aim_cloud_writer, the V3 RPCs are installed, and
-- that the anon role does not have direct write privileges on progress tables.
-- ROLE MEMBERSHIP MATTERS: aim_cloud_writer inherits anon (one direction
-- only), never the reverse. This is necessary on Supabase hosted, where
-- postgres cannot grant usage on auth schema directly.
begin;

do $cutover_preflight$
begin
 if exists(select 1 from pg_catalog.pg_roles
   where rolname='aim_cloud_writer')
 then raise exception 'aim_cloud_writer already exists: manual role audit required'; end if;
 if not pg_catalog.has_schema_privilege('anon','auth','USAGE')
   or not pg_catalog.has_function_privilege('anon','auth.uid()','EXECUTE')
 then raise exception 'Hosted Supabase auth privileges for anon must be reviewed'; end if;
 -- The helper inheritance should not bring unrelated direct write power.
 -- If anon is ever granted writes to public tables, manual role redesign is
 -- necessary before this cutover. Never rely on it without a fresh ACL audit.
 if pg_catalog.has_schema_privilege('anon','public','CREATE')
  or exists (
   select 1 from pg_catalog.pg_class c
   join pg_catalog.pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relkind in ('r','p')
     and (pg_catalog.has_table_privilege('anon',c.oid,'INSERT')
       or pg_catalog.has_table_privilege('anon',c.oid,'UPDATE')
       or pg_catalog.has_table_privilege('anon',c.oid,'DELETE')
       or pg_catalog.has_table_privilege('anon',c.oid,'TRUNCATE')
       or pg_catalog.has_table_privilege('anon',c.oid,'TRIGGER')
       or pg_catalog.has_table_privilege('anon',c.oid,'REFERENCES'))
  )
 then raise exception 'anon has unrelated public write powers: audit required'; end if;
 -- Writer inherits anon. An anonymous or PUBLIC RLS policy on these same
 -- tables would be OR-combined with writer owner policies. Reject it instead
 -- of assuming it is restrictive.
 if exists (
  select 1 from pg_catalog.pg_policies
  where schemaname='public'
    and tablename in ('aim_sessions','aim_presets','aim_profiles','aim_preferences')
    and ('anon'=any(roles) or 'public'=any(roles))
 )
 then raise exception 'Anonymous or PUBLIC RLS policy must be reviewed before writer cutover'; end if;
 if pg_catalog.to_regprocedure('public.aim_reset_my_progress_for_user(uuid)') is null
 or pg_catalog.to_regprocedure(
  'public.aim_apply_progress_for_user(uuid,text,jsonb,jsonb,text[],jsonb,smallint)'
 ) is null
 then raise exception 'V3 reset and atomic write RPCs must be installed before cutover'; end if;
end
$cutover_preflight$;

-- On hosted Supabase, postgres may NOT GRANT on schema auth or on
-- auth.uid(), both owned by internal roles. The existing anon role already
-- has USAGE/EXECUTE. Writer inherits those permissions as a MEMBER of anon;
-- anon is NEVER a member of writer, so anonymous API calls gain no writes.
-- Preflight below verifies this privilege contract before changing grants.
create role aim_cloud_writer nologin nobypassrls inherit;
grant anon to aim_cloud_writer;
grant usage on schema public to aim_cloud_writer;
grant select,insert,update,delete on
 public.aim_sessions,public.aim_presets,
 public.aim_profiles,public.aim_preferences
 to aim_cloud_writer;

-- This role is not a table owner; RLS therefore applies to every write.
create policy aim_writer_sessions_v3 on public.aim_sessions
 for all to aim_cloud_writer
 using ((select auth.uid()) = user_id)
 with check ((select auth.uid()) = user_id);
create policy aim_writer_presets_v3 on public.aim_presets
 for all to aim_cloud_writer
 using ((select auth.uid()) = user_id)
 with check ((select auth.uid()) = user_id);
create policy aim_writer_profiles_v3 on public.aim_profiles
 for all to aim_cloud_writer
 using ((select auth.uid()) = user_id)
 with check ((select auth.uid()) = user_id);
create policy aim_writer_preferences_v3 on public.aim_preferences
 for all to aim_cloud_writer
 using ((select auth.uid()) = user_id)
 with check ((select auth.uid()) = user_id);

-- PostgreSQL requires schema CREATE privilege for the new function owner.
-- It is granted temporarily and revoked in this same transaction.
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

revoke all on function public.aim_reset_my_progress_for_user(uuid)
 from public,anon;
revoke all on function public.aim_apply_progress_for_user(
 uuid,text,jsonb,jsonb,text[],jsonb,smallint)
 from public,anon;
grant execute on function public.aim_reset_my_progress_for_user(uuid)
 to authenticated;
grant execute on function public.aim_apply_progress_for_user(
 uuid,text,jsonb,jsonb,text[],jsonb,smallint)
 to authenticated;

-- RLS DOES NOT PROTECT TRUNCATE. Revoke ALL direct table privileges,
-- then restore only RLS-protected SELECT for signed-in V3 readers.
revoke all on
 public.aim_sessions,public.aim_presets,
 public.aim_profiles,public.aim_preferences
 from public,anon,authenticated;
grant select on
 public.aim_sessions,public.aim_presets,
 public.aim_profiles,public.aim_preferences
 to authenticated;

-- Fail the migration transaction if the trusted role bypasses RLS,
-- if a signed-in role can still mutate tables, or if either public RPC
-- is running under the wrong security context.
do $cutover_verify$
declare
 t regclass;
 role_oid oid;
begin
 select oid into role_oid from pg_catalog.pg_roles
  where rolname='aim_cloud_writer'
    and not rolcanlogin and not rolbypassrls
    and not rolsuper and not rolcreaterole and rolinherit;
 if role_oid is null then raise exception 'Writer role privileges are unsafe'; end if;
 if not pg_catalog.pg_has_role('aim_cloud_writer','anon','USAGE')
 or not pg_catalog.has_schema_privilege('aim_cloud_writer','auth','USAGE')
 or not pg_catalog.has_function_privilege('aim_cloud_writer','auth.uid()','EXECUTE')
 then raise exception 'Writer did not inherit required hosted auth helpers'; end if;
 if pg_catalog.pg_has_role('authenticated','aim_cloud_writer','MEMBER')
 or pg_catalog.pg_has_role('anon','aim_cloud_writer','MEMBER')
 or pg_catalog.pg_has_role('authenticator','aim_cloud_writer','MEMBER')
 then raise exception 'API roles must not inherit dedicated writer identity'; end if;
 foreach t in array array[
  'public.aim_sessions'::regclass,
  'public.aim_presets'::regclass,
  'public.aim_profiles'::regclass,
  'public.aim_preferences'::regclass
 ] loop
  if not pg_catalog.has_table_privilege('authenticated',t,'SELECT')
   or pg_catalog.has_table_privilege('authenticated',t,'INSERT')
   or pg_catalog.has_table_privilege('authenticated',t,'UPDATE')
   or pg_catalog.has_table_privilege('authenticated',t,'DELETE')
   or pg_catalog.has_table_privilege('authenticated',t,'TRUNCATE')
   or pg_catalog.has_table_privilege('authenticated',t,'TRIGGER')
  then raise exception 'Unsafe direct API privilege on %',t; end if;
  if not pg_catalog.has_table_privilege('aim_cloud_writer',t,'SELECT')
   or not pg_catalog.has_table_privilege('aim_cloud_writer',t,'INSERT')
   or not pg_catalog.has_table_privilege('aim_cloud_writer',t,'UPDATE')
   or not pg_catalog.has_table_privilege('aim_cloud_writer',t,'DELETE')
  then raise exception 'Dedicated writer lacks table permissions on %',t; end if;
  if exists(select 1 from pg_catalog.pg_class
    where oid=t and (relowner=role_oid or not relrowsecurity))
  then raise exception 'Writer owns table or RLS is disabled: %',t; end if;
 end loop;
 if exists(select 1 from pg_catalog.pg_proc
   where oid in (
    'public.aim_reset_my_progress_for_user(uuid)'::regprocedure,
    'public.aim_apply_progress_for_user(uuid,text,jsonb,jsonb,text[],jsonb,smallint)'::regprocedure)
   and (proowner<>role_oid or not prosecdef))
 then raise exception 'V3 function owner or definer security is incorrect'; end if;
end
$cutover_verify$;

commit;
