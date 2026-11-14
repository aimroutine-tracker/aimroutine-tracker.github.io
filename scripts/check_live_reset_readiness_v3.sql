-- AimRoutine V3 - READ-ONLY hosted Supabase reset readiness check.
-- Run in the Supabase SQL editor AFTER the proposed migration is reviewed.
-- Queries catalog metadata only: no user IDs, tokens, sessions, preferences,
-- test accounts, data reads, writes, authentication changes or migrations.
-- This check is not a replacement for two real disposable accounts and
-- user-confirmed release. false is expected BEFORE migration is applied.
WITH expected_tables(name) AS (
 VALUES ('aim_sessions'),('aim_presets'),('aim_profiles'),('aim_preferences')
),
reset_rpc AS (
 SELECT p.oid,p.prosecdef,pg_catalog.lower(pg_catalog.pg_get_functiondef(p.oid)) AS source
 FROM pg_catalog.pg_proc p
 WHERE p.oid=pg_catalog.to_regprocedure('public.aim_reset_my_progress_for_user(uuid)')
),
write_rpc AS (
 SELECT p.oid,p.prosecdef,
   pg_catalog.lower(pg_catalog.pg_get_functiondef(p.oid)) AS source
 FROM pg_catalog.pg_proc p
 WHERE p.oid=pg_catalog.to_regprocedure(
  'public.aim_apply_progress_for_user(uuid,text,jsonb,jsonb,text[],jsonb,smallint)')
),
write_checks AS (
 SELECT
  EXISTS(SELECT 1 FROM write_rpc) AS write_rpc_installed,
  COALESCE((SELECT NOT prosecdef FROM write_rpc),FALSE) AS write_rpc_security_invoker,
  COALESCE((SELECT NOT pg_catalog.has_function_privilege('anon',oid,'EXECUTE') FROM write_rpc),FALSE) AS write_rpc_anon_denied,
  COALESCE((SELECT pg_catalog.has_function_privilege('authenticated',oid,'EXECUTE') FROM write_rpc),FALSE) AS write_rpc_authenticated_execute,
  COALESCE((SELECT
     source LIKE '%stale_reset_cursor%'
     AND source LIKE '%pg_advisory_xact_lock%'
     AND source LIKE '%hashtextextended%'
     AND source LIKE '%actor_id is distinct from expected_uid%'
     AND source LIKE '%current_reset_at is distinct from expected_reset_at%'
   FROM write_rpc),FALSE) AS write_rpc_owner_epoch_guard
),
rpc_checks AS (
 SELECT
  EXISTS(SELECT 1 FROM reset_rpc) AS rpc_installed,
  COALESCE((SELECT NOT prosecdef FROM reset_rpc),FALSE) AS rpc_security_invoker,
  COALESCE((SELECT NOT pg_catalog.has_function_privilege('anon',oid,'EXECUTE') FROM reset_rpc),FALSE) AS rpc_anon_denied,
  COALESCE((SELECT pg_catalog.has_function_privilege('authenticated',oid,'EXECUTE') FROM reset_rpc),FALSE) AS rpc_authenticated_execute,
  COALESCE((SELECT source ~ 'actor_id[[:space:]]+is[[:space:]]+distinct[[:space:]]+from[[:space:]]+expected_uid'
                   AND source LIKE '%auth.uid()%'
                   AND source ~ 'where[[:space:]]+user_id[[:space:]]*=[[:space:]]*expected_uid'
            FROM reset_rpc),FALSE) AS rpc_owner_guard_present
),
table_checks AS (
 SELECT
  e.name,
  COALESCE(c.relrowsecurity,FALSE) AS rls_enabled,
  (COALESCE(NOT pg_catalog.has_table_privilege('anon',c.oid,'SELECT'),FALSE)
   AND COALESCE(NOT pg_catalog.has_table_privilege('anon',c.oid,'INSERT'),FALSE)
   AND COALESCE(NOT pg_catalog.has_table_privilege('anon',c.oid,'UPDATE'),FALSE)
   AND COALESCE(NOT pg_catalog.has_table_privilege('anon',c.oid,'DELETE'),FALSE)) AS anon_crud_denied,
  COALESCE(pg_catalog.has_table_privilege('authenticated',c.oid,'SELECT'),FALSE)
   AND COALESCE(pg_catalog.has_table_privilege('authenticated',c.oid,'INSERT'),FALSE)
   AND COALESCE(pg_catalog.has_table_privilege('authenticated',c.oid,'UPDATE'),FALSE)
   AND COALESCE(pg_catalog.has_table_privilege('authenticated',c.oid,'DELETE'),FALSE) AS authenticated_crud_granted,
  EXISTS(
   SELECT 1 FROM pg_catalog.pg_policies pol
   WHERE pol.schemaname='public' AND pol.tablename=e.name
     AND pol.cmd='ALL' AND 'authenticated'=ANY(pol.roles)
     AND pg_catalog.strpos(pol.qual,'auth.uid()')>0
     AND pg_catalog.strpos(pol.qual,'user_id')>0
     AND pg_catalog.strpos(pol.with_check,'auth.uid()')>0
     AND pg_catalog.strpos(pol.with_check,'user_id')>0
  ) AS owner_policy_both_directions
 FROM expected_tables e
 LEFT JOIN pg_catalog.pg_class c
  ON c.oid=pg_catalog.to_regclass('public.'||e.name)
),
table_summary AS (
 SELECT COUNT(*)=4
  AND COALESCE(BOOL_AND(
   rls_enabled AND anon_crud_denied AND authenticated_crud_granted
   AND owner_policy_both_directions
  ),FALSE) AS four_owner_only_tables
 FROM table_checks
)
SELECT pg_catalog.jsonb_build_object(
 'ready_for_private_qa',
  r.rpc_installed AND r.rpc_security_invoker AND r.rpc_anon_denied
  AND r.rpc_authenticated_execute AND r.rpc_owner_guard_present
  AND w.write_rpc_installed AND w.write_rpc_security_invoker
  AND w.write_rpc_anon_denied AND w.write_rpc_authenticated_execute
  AND w.write_rpc_owner_epoch_guard AND t.four_owner_only_tables,
 'rpc_installed',r.rpc_installed,
 'rpc_security_invoker',r.rpc_security_invoker,
 'rpc_anon_denied',r.rpc_anon_denied,
 'rpc_authenticated_execute',r.rpc_authenticated_execute,
 'rpc_owner_guard_present',r.rpc_owner_guard_present,
 'write_rpc_installed',w.write_rpc_installed,
 'write_rpc_security_invoker',w.write_rpc_security_invoker,
 'write_rpc_anon_denied',w.write_rpc_anon_denied,
 'write_rpc_authenticated_execute',w.write_rpc_authenticated_execute,
 'write_rpc_owner_epoch_guard',w.write_rpc_owner_epoch_guard,
 'four_owner_only_tables',t.four_owner_only_tables,
 'note','Catalog readiness only; direct REST clients still bypass guarded write RPC. Requires V2 cutover, disposable A/B, Google and multi-device tests before release'
) AS readiness_report
FROM rpc_checks r CROSS JOIN write_checks w CROSS JOIN table_summary t;
