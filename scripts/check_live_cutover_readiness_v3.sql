-- READ ONLY catalog-only audit of the V3 permission cutover.
-- The proposal is NOT installed in hosted Supabase. This query must therefore
-- return ready_for_atomic_cutover=false until explicit migration and QA.
-- It reads NO user records, user ids, passwords or training progress.
with roles as (
 select oid,rolcanlogin,rolbypassrls,rolsuper,rolcreaterole,rolinherit
 from pg_catalog.pg_roles where rolname='aim_cloud_writer'
),
role_ok as (
 select exists(select 1 from roles
   where not rolcanlogin and not rolbypassrls and not rolsuper
     and not rolcreaterole and rolinherit)
   and exists(select 1 from roles)
   and coalesce((select not pg_catalog.pg_has_role('authenticated'::regrole,oid,'MEMBER') from roles),false)
   and coalesce((select not pg_catalog.pg_has_role('anon'::regrole,oid,'MEMBER') from roles),false)
   and coalesce((select not pg_catalog.pg_has_role('authenticator'::regrole,oid,'MEMBER') from roles),false)
   and coalesce((select pg_catalog.pg_has_role(oid,'anon'::regrole,'USAGE') from roles),false)
   and coalesce((select pg_catalog.has_schema_privilege(oid,'auth','USAGE') from roles),false)
   and coalesce((select pg_catalog.has_function_privilege(oid,'auth.uid()','EXECUTE') from roles),false)
   and coalesce((select not pg_catalog.has_schema_privilege(oid,'public','CREATE') from roles),false)
 as trusted_role_ok
),
expected(name) as (
 values ('aim_sessions'),('aim_presets'),('aim_profiles'),('aim_preferences')
),
table_checks as (
 select
  e.name,
  coalesce(c.relrowsecurity,false)
   and coalesce(c.relowner is distinct from r.oid,false)
   and coalesce(pg_catalog.has_table_privilege('authenticated',c.oid,'SELECT'),false)
   and coalesce(not pg_catalog.has_table_privilege('authenticated',c.oid,'INSERT'),false)
   and coalesce(not pg_catalog.has_table_privilege('authenticated',c.oid,'UPDATE'),false)
   and coalesce(not pg_catalog.has_table_privilege('authenticated',c.oid,'DELETE'),false)
   and coalesce(not pg_catalog.has_table_privilege('authenticated',c.oid,'TRUNCATE'),false)
   and coalesce(not pg_catalog.has_table_privilege('authenticated',c.oid,'TRIGGER'),false)
   and coalesce(not pg_catalog.has_table_privilege('authenticated',c.oid,'REFERENCES'),false)
   and coalesce(pg_catalog.has_table_privilege(r.oid,c.oid,'SELECT'),false)
   and coalesce(pg_catalog.has_table_privilege(r.oid,c.oid,'INSERT'),false)
   and coalesce(pg_catalog.has_table_privilege(r.oid,c.oid,'UPDATE'),false)
   and coalesce(pg_catalog.has_table_privilege(r.oid,c.oid,'DELETE'),false)
   and exists (
     select 1 from pg_catalog.pg_policies pol
     where pol.schemaname='public' and pol.tablename=e.name
       and pol.cmd='ALL'
       and 'aim_cloud_writer'=any(pol.roles)
       and pg_catalog.strpos(pol.qual,'auth.uid()')>0
       and pg_catalog.strpos(pol.qual,'user_id')>0
       and pg_catalog.strpos(pol.with_check,'auth.uid()')>0
       and pg_catalog.strpos(pol.with_check,'user_id')>0
   )
  as rls_readonly_and_writer_ok
 from expected e
 left join pg_catalog.pg_class c
   on c.oid=pg_catalog.to_regclass('public.'||e.name)
 left join roles r on true
),
functions as (
 select p.oid,p.prosecdef,p.proowner,p.proconfig,p.proname
 from pg_catalog.pg_proc p
 where p.oid in(
  pg_catalog.to_regprocedure('public.aim_reset_my_progress_for_user(uuid)'),
  pg_catalog.to_regprocedure(
   'public.aim_apply_progress_for_user(uuid,text,jsonb,jsonb,text[],jsonb,smallint)')
 )
),
function_checks as (
 select
  count(*)=2
  and coalesce(bool_and(
   p.prosecdef
   and p.proowner=r.oid
   and coalesce(p.proconfig @> array['search_path=pg_catalog']::text[],false)
   and not pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')
   and pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')
  ),false) as both_rpc_owners_and_grants_safe
 from functions p cross join roles r
),
tables_ok as (
 select count(*)=4
  and coalesce(bool_and(rls_readonly_and_writer_ok),false)
  as four_tables_restricted
 from table_checks
)
select pg_catalog.jsonb_build_object(
 'ready_for_atomic_cutover',
   roles.trusted_role_ok
   and tbls.four_tables_restricted
   and funcs.both_rpc_owners_and_grants_safe,
 'trusted_role_ok',roles.trusted_role_ok,
 'four_tables_restricted',tbls.four_tables_restricted,
 'both_rpc_owners_and_grants_safe',funcs.both_rpc_owners_and_grants_safe,
 'note','Read-only database permissions preflight only; does not prove disposable A/B E2E, legacy-client upgrade or visual approval'
) as permission_report
from role_ok roles cross join tables_ok tbls cross join function_checks funcs;
