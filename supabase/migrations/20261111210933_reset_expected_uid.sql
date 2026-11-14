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
  reset_marker text;
  prior_reset_time timestamptz;
  marker_clock timestamptz;
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

  -- A second reset in the same millisecond must still produce a DISTINCT,
  -- strictly increasing reset cursor, or an offline device could miss it.
  -- Generate the cursor AFTER acquiring the per-account transaction lock.
  -- Malformed legacy settings must not prevent the owner deleting their data.
  begin
    select nullif(settings->>'reset_at','')::timestamptz
      into prior_reset_time
      from public.aim_preferences
      where user_id=expected_uid;
  exception when invalid_datetime_format or datetime_field_overflow then
    prior_reset_time := null;
  end;
  marker_clock := pg_catalog.clock_timestamp();
  if prior_reset_time is not null
     and prior_reset_time >= pg_catalog.date_trunc('milliseconds',marker_clock) then
    marker_clock := prior_reset_time + interval '1 millisecond';
  end if;
  reset_marker := pg_catalog.to_char(
    marker_clock at time zone 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
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


-- A V3 write must participate in the exact same account transaction lock as
-- the reset. This is intentionally part of the NOT-YET-DEPLOYED V3 migration.
-- V2 clients writing directly through REST do not participate in this lock:
-- retire/block old direct writes before claiming full cross-device atomicity.
create or replace function public.aim_apply_progress_for_user(
  expected_uid uuid,
  expected_reset_at text,
  new_sessions jsonb,
  new_presets jsonb,
  deleted_preset_ids text[],
  new_profile jsonb,
  new_weekly_goal smallint
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog
as $write$
declare
  actor_id uuid := auth.uid();
  current_reset_at text;
  row_value jsonb;
  record_id text;
begin
  if actor_id is null then
    raise exception 'authentication_required' using errcode='28000';
  end if;
  if expected_uid is null or actor_id is distinct from expected_uid then
    raise exception 'account_mismatch' using errcode='42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(expected_uid::text, 27012026::bigint)
  );
  select settings->>'reset_at' into current_reset_at
    from public.aim_preferences where user_id=expected_uid;
  if current_reset_at is distinct from expected_reset_at then
    raise exception 'stale_reset_cursor' using errcode='40001';
  end if;

  if new_sessions is null or pg_catalog.jsonb_typeof(new_sessions)<>'array'
    or pg_catalog.jsonb_array_length(new_sessions)>80
    or new_presets is null or pg_catalog.jsonb_typeof(new_presets)<>'array'
    or pg_catalog.jsonb_array_length(new_presets)>80
    or deleted_preset_ids is null
    or pg_catalog.array_length(deleted_preset_ids,1)>100 then
    raise exception 'invalid_progress_batch' using errcode='22023';
  end if;

  for row_value in select value from pg_catalog.jsonb_array_elements(new_sessions)
  loop
    record_id:=row_value->>'id';
    if pg_catalog.jsonb_typeof(row_value)<>'object'
      or record_id is null or pg_catalog.char_length(record_id) not between 1 and 100
      or pg_catalog.octet_length(row_value::text)>16384 then
      raise exception 'invalid_session_payload' using errcode='22023';
    end if;
    insert into public.aim_sessions(user_id,session_id,payload)
      values(expected_uid,record_id,row_value)
      on conflict(user_id,session_id) do nothing;
  end loop;

  for row_value in select value from pg_catalog.jsonb_array_elements(new_presets)
  loop
    record_id:=row_value->>'id';
    if pg_catalog.jsonb_typeof(row_value)<>'object'
      or record_id is null or pg_catalog.char_length(record_id) not between 1 and 100
      or pg_catalog.octet_length(row_value::text)>32768 then
      raise exception 'invalid_preset_payload' using errcode='22023';
    end if;
    insert into public.aim_presets(user_id,preset_id,payload)
      values(expected_uid,record_id,row_value)
      on conflict(user_id,preset_id) do nothing;
  end loop;

  if pg_catalog.coalesce(pg_catalog.array_length(deleted_preset_ids,1),0)>0 then
    update public.aim_presets set deleted_at=pg_catalog.clock_timestamp()
      where user_id=expected_uid and preset_id=any(deleted_preset_ids)
        and deleted_at is null;
  end if;

  if new_profile is not null then
    if pg_catalog.jsonb_typeof(new_profile)<>'object'
       or pg_catalog.octet_length(new_profile::text)>16384 then
      raise exception 'invalid_profile_payload' using errcode='22023';
    end if;
    insert into public.aim_profiles(user_id,profile)
      values(expected_uid,new_profile)
      on conflict(user_id) do update set
        profile=excluded.profile, updated_at=pg_catalog.now();
  end if;

  if new_weekly_goal is not null then
    if new_weekly_goal not between 1 and 14 then
      raise exception 'invalid_weekly_goal' using errcode='22023';
    end if;
    insert into public.aim_preferences(user_id,weekly_goal,settings)
      values(expected_uid,new_weekly_goal,
        case when current_reset_at is null
          then pg_catalog.jsonb_build_object('format','aimroutine-web-v2')
          else pg_catalog.jsonb_build_object(
            'format','aimroutine-web-v2','reset_at',current_reset_at)
        end)
      on conflict(user_id) do update set
        weekly_goal=excluded.weekly_goal,
        settings=excluded.settings,
        updated_at=pg_catalog.now();
  end if;
end
$write$;

revoke all on function public.aim_apply_progress_for_user(
  uuid,text,jsonb,jsonb,text[],jsonb,smallint
) from public,anon;
grant execute on function public.aim_apply_progress_for_user(
  uuid,text,jsonb,jsonb,text[],jsonb,smallint
) to authenticated;

comment on function public.aim_apply_progress_for_user(
  uuid,text,jsonb,jsonb,text[],jsonb,smallint
) is 'Atomic, account-bound batch writes checked against the server reset epoch. RLS remains in effect.';

commit;
