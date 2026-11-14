-- Account-bound V3 training progress reset.
-- Generated using Supabase CLI 3.1.0 (migration new reset_expected_uid),
-- GitHub Actions run 43100627883. NOT applied to hosted Supabase.
-- Deployment order: migrate first, verify JWT A/B mismatch, then publish V3.
-- Legacy no-argument RPC remains for deployed V2 clients until retirement.
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

  -- Serialize reset RPCs for the same account at transaction scope.
  -- A future atomic V3 write RPC MUST acquire this exact advisory lock
  -- BEFORE checking the reset cursor and writing any account rows.
  -- IMPORTANT: legacy/direct PostgREST table writes do NOT take this lock.
  -- Therefore this alone does not guarantee cross-device reset atomicity.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(expected_uid::text, 27012026::bigint)
  );

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
