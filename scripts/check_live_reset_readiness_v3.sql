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
rpc_checks AS (
 SELECT
  EXISTS(SELECT 1 FROM reset_rpc) AS rpc_installed,
  COALESCE((SELECT NOT prosecdef FROM reset_rpc),FALSE) AS rpc_security_invoker,
  COALESCE((SELECT NOT pg_catalog.has_function_privilege('anon',oid,'EXECUTE') FROM reset_rpc),FALSE) AS rpc_anon_denied,
  COALESCE((SELECT pg_catalog.has_function_privilege('authenticated',oid,'EXECUTE') FROM reset_rpc),FALSE) AS rpc_authenticated_execute,
  COALESCE((SELECT source LIKE '%actor_id is distinct from expected_uid%'
                   AND source LIKE '%auth.uid()%'
                   AND source LIKE '%where user_id=expected_uid%'
            FROM reset_rpc),FALSE) AS rpc_owner_guard_present
),
table_checks AS (
 SELECT
  e.name,
  COALESCE(c.relrowsecurity,FALSE) AS rls_enabled,
  COALESCE(NOT pg_catalog.has_table_privilege('anon',c.oid,'SELECT'),FALSE) AS anon_select_denied,
  COALESCE(pg_catalog.has_table_privilege('authenticated',c.oid,'SELECT'),FALSE)
   AND COALESCE(pg_catalog.has_table_privilege('authenticated',c.oid,'INSERT'),FALSE)
   AND COALESCE(pg_catalog.has_table_privilege('authenticated',c.oid,'UPDATE'),FALSE)
   AND COALESCE(pg_catalog.has_table_privilege('authenticated',c.oid,'DELETE'),FALSE) AS authenticated_crud_granted,
  EXISTS(
   SELECT 1 FROM pg_catalog.pg_policies pol
   WHERE pol.schemaname='public' AND pol.tablename=e.name
     AND pol.cmd='ALL'
     AND pg_catalog.position('auth.uid()' IN pol.qual)>0
     AND pg_catalog.position('user_id' IN pol.qual)>0
     AND pg_catalog.position('auth.uid()' IN pol.with_check)>0
     AND pg_catalog.position('user_id' IN pol.with_check)>0
  ) AS owner_policy_both_directions
 FROM expected_tables e
 LEFT JOIN pg_catalog.pg_class c
  ON c.oid=pg_catalog.to_regclass('public.'||e.name)
),
table_summary AS (
 SELECT COUNT(*)=4
  AND COALESCE(BOOL_AND(
   rls_enabled AND anon_select_denied AND authenticated_crud_granted
   AND owner_policy_both_directions
  ),FALSE) AS four_owner_only_tables
 FROM table_checks
)
SELECT pg_catalog.jsonb_build_object(
 'ready_for_private_qa',
  r.rpc_installed AND r.rpc_security_invoker AND r.rpc_anon_denied
  AND r.rpc_authenticated_execute AND r.rpc_owner_guard_present
  AND t.four_owner_only_tables,
 'rpc_installed',r.rpc_installed,
 'rpc_security_invoker',r.rpc_security_invoker,
 'rpc_anon_denied',r.rpc_anon_denied,
 'rpc_authenticated_execute',r.rpc_authenticated_execute,
 'rpc_owner_guard_present',r.rpc_owner_guard_present,
 'four_owner_only_tables',t.four_owner_only_tables,
 'note','Metadata checks only; still requires disposable A/B and Google end-to-end testing'
) AS readiness_report
FROM rpc_checks r CROSS JOIN table_summary t;
