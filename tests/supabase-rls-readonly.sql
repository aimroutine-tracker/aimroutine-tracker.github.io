-- AimRoutine Tracker V3 — read-only RLS and grants verification.
-- Run from a privileged Supabase SQL editor / MCP connection; never from the web app.
-- Does not read any user payloads, create users, or mutate tables.
-- This is a synthetic-user isolation smoke test, NOT a substitute for two real accounts.

-- 1. Anonymous credentials must have NO direct table CRUD privileges.
SELECT c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       has_table_privilege('anon', c.oid, 'SELECT') AS anon_can_select,
       has_table_privilege('anon', c.oid, 'INSERT') AS anon_can_insert,
       has_table_privilege('anon', c.oid, 'UPDATE') AS anon_can_update,
       has_table_privilege('anon', c.oid, 'DELETE') AS anon_can_delete
  FROM pg_class c
  JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public'
   AND c.relname IN ('aim_profiles','aim_preferences','aim_presets','aim_sessions')
 ORDER BY c.relname;

-- 2. Impersonate a synthetic authenticated JWT inside a READ ONLY transaction.
-- The transaction rolls back immediately, restoring the original connection role.
BEGIN READ ONLY;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',
                  '00000000-0000-4000-8000-000000000000', true);
SELECT current_user AS effective_role,
       auth.uid() AS synthetic_uid,
       (SELECT COUNT(*) FROM public.aim_profiles) AS visible_profiles,
       (SELECT COUNT(*) FROM public.aim_preferences) AS visible_preferences,
       (SELECT COUNT(*) FROM public.aim_presets) AS visible_presets,
       (SELECT COUNT(*) FROM public.aim_sessions) AS visible_sessions;
ROLLBACK;

-- Expected 2026-11-09:
-- anon_can_select/insert/update/delete = FALSE for all four tables
-- RLS enabled = TRUE for all four tables
-- effective_role = authenticated; auth.uid() = synthetic UUID above
-- all four visible_* counts = 0
-- CAUTION: A synthetic zero-row test does NOT prove that two real accounts are
-- separated correctly during writes or reads. Verify with disposable accounts.
