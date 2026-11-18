-- AIMROUTINE V3 / PROPOSITION NON APPLIQUEE A SUPABASE.
-- This file is a reviewed SQL proposal, NOT a Supabase migration and NOT public
-- browser code. Deploy only after a private disposable-account A/B test.
--
-- Migration sequence:
-- 1. Generate a NEW migration with `supabase migration new reset_expected_uid`.
-- 2. Copy this statement into the generated migration, review privileges/RLS,
--    and apply it to a staging database; do not change production yet.
-- 3. After staging tests, migrate the new RPC to production BEFORE any V3
--    client uses it. Existing V2 clients may still call the legacy no-arg RPC.
-- 4. V3 client must call ONLY the new name with {expected_uid: verifiedUid},
--    failing closed if the new function is unavailable. Never fallback.
-- 5. Once all legacy clients are retired, revoke EXECUTE and then remove the
--    obsolete public.aim_reset_my_progress() function in a separate migration.
-- New unique name avoids PostgREST function-overloading ambiguity.
begin;

create or replace function public.aim_reset_my_progress_for_user(expected_uid uuid)
returns text
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
declare
  actor_id uuid := auth.uid();
  reset_marker text := pg_catalog.to_char(
    pg_catalog.clock_timestamp() at time zone 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
  );
begin
  if actor_id is null then
    raise exception 'authentication_required' using errcode='28000';
  end if;

  -- Critical security gate: the authenticated JWT identity must equal the
  -- owner that originally requested deletion. A late token switch from A to
  -- B must NEVER erase B when the client is still expecting A.
  if expected_uid is null or actor_id is distinct from expected_uid then
    raise exception 'account_mismatch' using errcode='42501';
  end if;

  delete from public.aim_sessions where user_id=expected_uid;
  delete from public.aim_presets where user_id=expected_uid;
  delete from public.aim_profiles where user_id=expected_uid;

  insert into public.aim_preferences as p
    (user_id,weekly_goal,settings,updated_at)
  values
    (expected_uid,3,pg_catalog.jsonb_build_object(
      'format','aimroutine-web-v2','reset_at',reset_marker
    ),pg_catalog.now())
  on conflict (user_id) do update
    set weekly_goal=excluded.weekly_goal,
        settings=excluded.settings,
        updated_at=excluded.updated_at;

  return reset_marker;
end
$function$;

revoke all on function public.aim_reset_my_progress_for_user(uuid)
  from public, anon;
grant execute on function public.aim_reset_my_progress_for_user(uuid)
  to authenticated;

comment on function public.aim_reset_my_progress_for_user(uuid) is
  'Atomically delete caller-owned training progress only when requested UID matches auth.uid(), preserving RLS and a reset cursor.';

commit;
