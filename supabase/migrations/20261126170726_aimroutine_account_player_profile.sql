begin;

-- The browser can read only the signed-in owner's profile. Windows writes
-- through the verified device, never using an account ID supplied by a client.
create table public.aim_account_player_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile jsonb not null check (jsonb_typeof(profile) = 'object' and octet_length(profile::text) <= 108000),
  revision integer not null default 1 check (revision > 0)
);
alter table public.aim_account_player_profiles enable row level security;
revoke all on public.aim_account_player_profiles from public, anon, authenticated;
grant select on public.aim_account_player_profiles to authenticated;
grant select, insert, update, delete on public.aim_account_player_profiles to service_role;
create policy player_profile_read_own on public.aim_account_player_profiles
  for select to authenticated using ((select auth.uid()) = user_id);

create function public.aim_windows_player_profile(device_digest text, expected_revision integer, replacement jsonb)
returns jsonb language plpgsql security invoker set search_path = pg_catalog
as $fn$
declare
  device aim_windows_private.devices%rowtype;
  saved public.aim_account_player_profiles%rowtype;
  owner_id uuid;
begin
  -- Use the same lock order as cloud reset: account first, device second.
  select user_id into owner_id from aim_windows_private.devices where digest = device_digest and revoked_at is null;
  if not found then return jsonb_build_object('error','device_not_linked'); end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text,49306));
  select * into device from aim_windows_private.devices where digest = device_digest and revoked_at is null for update;
  if not found then return jsonb_build_object('error','device_revoked'); end if;
  select * into saved from public.aim_account_player_profiles where user_id = device.user_id;
  if replacement is not null then
    if expected_revision is distinct from coalesce(saved.revision,0) then
      return jsonb_build_object('error','profile_changed');
    end if;
    if saved.profile is distinct from replacement then
      insert into public.aim_account_player_profiles as current_profile(user_id,profile)
        values(device.user_id,replacement)
        on conflict(user_id) do update set profile=excluded.profile,revision=current_profile.revision+1
        returning * into saved;
    end if;
  end if;
  return jsonb_build_object('accountId',device.user_id,'profile',saved.profile,'revision',coalesce(saved.revision,0));
end
$fn$;
revoke all on function public.aim_windows_player_profile(text,integer,jsonb) from public, anon, authenticated;
grant execute on function public.aim_windows_player_profile(text,integer,jsonb) to service_role;

-- Remove account profile data with the existing cloud reset, in the same transaction.
create function aim_windows_private.reset_player_profile()
returns trigger language plpgsql security definer set search_path = pg_catalog
as $fn$
begin
  if new.settings->>'reset_at' is null then return new; end if;
  if tg_op = 'UPDATE' then
    if (old.settings->>'reset_at') is not distinct from (new.settings->>'reset_at') then return new; end if;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,49306));
  delete from public.aim_account_player_profiles where user_id = new.user_id;
  return new;
end
$fn$;
revoke all on function aim_windows_private.reset_player_profile() from public, anon, authenticated;
create trigger aim_windows_reset_player_profile after insert or update of settings on public.aim_preferences
  for each row execute function aim_windows_private.reset_player_profile();

commit;
