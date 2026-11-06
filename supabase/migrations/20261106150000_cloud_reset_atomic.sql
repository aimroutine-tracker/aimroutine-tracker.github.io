-- Atomic, RLS-preserving deletion of current user's training data.
-- The reset marker prevents offline devices re-uploading old sessions after a wipe.
-- SECURITY INVOKER keeps the four existing owner-only RLS policies enforced.
begin;

create or replace function public.aim_reset_my_progress()
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

  delete from public.aim_sessions where user_id=actor_id;
  delete from public.aim_presets where user_id=actor_id;
  delete from public.aim_profiles where user_id=actor_id;

  -- Keep only a non-training per-account reset marker in preferences.
  insert into public.aim_preferences as p
    (user_id,weekly_goal,settings,updated_at)
  values
    (actor_id,3,pg_catalog.jsonb_build_object(
      'format','aimroutine-web-v2','reset_at',reset_marker
    ),pg_catalog.now())
  on conflict (user_id) do update
    set weekly_goal=excluded.weekly_goal,
        settings=excluded.settings,
        updated_at=excluded.updated_at;

  return reset_marker;
end
$function$;

revoke all on function public.aim_reset_my_progress() from public, anon;
grant execute on function public.aim_reset_my_progress() to authenticated;
comment on function public.aim_reset_my_progress() is
  'Atomically delete only the current authenticated user training rows and record a cloud reset cursor so offline devices cannot resurrect deleted history.';

commit;
