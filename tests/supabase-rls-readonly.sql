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


-- 3. Verify policy *structure*, not merely the absence of rows under one synthetic ID.
-- All four tables require a policy for authenticated users with owner constraints
-- in BOTH USING and WITH CHECK; grants alone do not enforce row ownership.
SELECT c.relname AS table_name,
       COALESCE(bool_or(p.cmd='ALL'
         AND 'authenticated'::name = ANY(p.roles)
         AND p.qual LIKE '%auth.uid%'
         AND p.qual LIKE '%user_id%'
         AND p.with_check LIKE '%auth.uid%'
         AND p.with_check LIKE '%user_id%'),false) AS owner_read_and_write_guard,
       count(p.policyname) AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
LEFT JOIN pg_policies p ON p.schemaname=n.nspname AND p.tablename=c.relname
WHERE n.nspname='public' AND c.relname IN
 ('aim_profiles','aim_preferences','aim_presets','aim_sessions')
GROUP BY c.relname
ORDER BY c.relname;

-- 4. Ensure the cloud reset function cannot be executed anonymously or bypass RLS.
-- SECURITY INVOKER + EXECUTE only for authenticated users is the intended model.
SELECT p.proname,
       NOT p.prosecdef AS security_invoker,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS signed_in_can_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='aim_reset_my_progress';

-- Expected when verified 2026-11-10:
-- Four owner_read_and_write_guard = TRUE.
-- aim_reset_my_progress: security_invoker TRUE; anon_can_execute FALSE;
-- signed_in_can_execute TRUE.
-- This structural check must be repeated after a policy/function migration.
-- It is NOT a replacement for real end-to-end tests on isolated accounts.
