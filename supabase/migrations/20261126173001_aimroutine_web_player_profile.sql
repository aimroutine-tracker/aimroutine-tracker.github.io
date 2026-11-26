begin;

-- Keep the next revision per account even when cloud reset removes the profile.
-- An open editor with an earlier revision cannot replace a newly restored profile.
lock table public.aim_account_player_profiles in share row exclusive mode;
create table aim_windows_private.player_profile_revisions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision integer not null check (revision > 0)
);
insert into aim_windows_private.player_profile_revisions (user_id, revision)
select user_id, revision from public.aim_account_player_profiles;
revoke all on aim_windows_private.player_profile_revisions from public, anon, authenticated;
grant select, insert, update on aim_windows_private.player_profile_revisions to service_role;

-- Both public entry points hold the same per-account advisory lock before invoking it.
create function aim_windows_private.apply_player_profile(owner_id uuid, expected_revision integer, replacement jsonb)
returns jsonb language plpgsql security invoker set search_path = pg_catalog
as $fn$
declare
  saved public.aim_account_player_profiles%rowtype;
  next_revision integer;
begin
  select * into saved from public.aim_account_player_profiles where user_id = owner_id;
  if replacement is not null then
    if expected_revision is distinct from coalesce(saved.revision,0) then
      return jsonb_build_object('error','profile_changed');
    end if;
    if saved.profile is distinct from replacement then
      insert into aim_windows_private.player_profile_revisions as counter(user_id,revision)
        values(owner_id,coalesce(saved.revision,0)+1)
        on conflict(user_id) do update set revision=greatest(counter.revision+1,excluded.revision)
        returning revision into next_revision;
      insert into public.aim_account_player_profiles(user_id,profile,revision)
        values(owner_id,replacement,next_revision)
        on conflict(user_id) do update set profile=excluded.profile,revision=excluded.revision
        returning * into saved;
    end if;
  end if;
  return jsonb_build_object('accountId',owner_id,'profile',saved.profile,'revision',coalesce(saved.revision,0));
end
$fn$;
revoke all on function aim_windows_private.apply_player_profile(uuid,integer,jsonb) from public, anon, authenticated;
grant execute on function aim_windows_private.apply_player_profile(uuid,integer,jsonb) to service_role;

create or replace function public.aim_windows_player_profile(device_digest text, expected_revision integer, replacement jsonb)
returns jsonb language plpgsql security invoker set search_path = pg_catalog
as $fn$
declare
  device aim_windows_private.devices%rowtype;
  owner_id uuid;
begin
  -- Use the account lock before the device row lock, as in account reset.
  select user_id into owner_id from aim_windows_private.devices where digest = device_digest and revoked_at is null;
  if not found then return jsonb_build_object('error','device_not_linked'); end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text,49306));
  select * into device from aim_windows_private.devices where digest = device_digest and revoked_at is null for update;
  if not found then return jsonb_build_object('error','device_revoked'); end if;
  return aim_windows_private.apply_player_profile(device.user_id,expected_revision,replacement);
end
$fn$;

-- Only the Edge Function's service role can submit a verified Auth user ID.
create function public.aim_web_player_profile(verified_owner uuid, expected_revision integer, replacement jsonb)
returns jsonb language plpgsql security invoker set search_path = pg_catalog
as $fn$
begin
  perform pg_advisory_xact_lock(hashtextextended(verified_owner::text,49306));
  return aim_windows_private.apply_player_profile(verified_owner,expected_revision,replacement);
end
$fn$;
revoke all on function public.aim_web_player_profile(uuid,integer,jsonb) from public, anon, authenticated;
grant execute on function public.aim_web_player_profile(uuid,integer,jsonb) to service_role;

commit;
