-- AimRoutine Tracker Cloud V7.0 (PREPARATION ONLY; not applied until Supabase project exists)
-- Every row is owned by its authenticated user, enforced by PostgreSQL RLS.
-- Keep local browser data until a round-trip sync is verified. Never use service_role in browser.

begin;

create table if not exists public.aim_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint aim_profiles_object check (jsonb_typeof(profile)='object'),
  constraint aim_profiles_size check (octet_length(profile::text) <= 16384)
);

create table if not exists public.aim_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  weekly_goal smallint not null default 3,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint aim_weekly_goal_range check (weekly_goal between 1 and 14),
  constraint aim_settings_object check (jsonb_typeof(settings)='object'),
  constraint aim_settings_size check (octet_length(settings::text) <= 16384)
);

create table if not exists public.aim_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id,session_id),
  constraint aim_session_id_length check (char_length(session_id) between 1 and 100),
  constraint aim_session_object check (jsonb_typeof(payload)='object'),
  constraint aim_session_size check (octet_length(payload::text) <= 16384),
  constraint aim_session_key_match check (payload->>'id' = session_id)
);

create table if not exists public.aim_presets (
  user_id uuid not null references auth.users(id) on delete cascade,
  preset_id text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id,preset_id),
  constraint aim_preset_id_length check (char_length(preset_id) between 1 and 100),
  constraint aim_preset_object check (jsonb_typeof(payload)='object'),
  constraint aim_preset_size check (octet_length(payload::text) <= 32768),
  constraint aim_preset_key_match check (payload->>'id' = preset_id)
);

create index if not exists aim_sessions_by_user_updated on public.aim_sessions (user_id, updated_at desc);
create index if not exists aim_presets_by_user_updated on public.aim_presets (user_id, updated_at desc);

alter table public.aim_profiles enable row level security;
alter table public.aim_preferences enable row level security;
alter table public.aim_sessions enable row level security;
alter table public.aim_presets enable row level security;

-- Data API access is opt-in for signed-in users only; RLS enforces row ownership.
revoke all on table public.aim_profiles from public, anon, authenticated;
revoke all on table public.aim_preferences from public, anon, authenticated;
revoke all on table public.aim_sessions from public, anon, authenticated;
revoke all on table public.aim_presets from public, anon, authenticated;
grant select, insert, update, delete on table public.aim_profiles to authenticated;
grant select, insert, update, delete on table public.aim_preferences to authenticated;
grant select, insert, update, delete on table public.aim_sessions to authenticated;
grant select, insert, update, delete on table public.aim_presets to authenticated;

create policy "profile_owner_only" on public.aim_profiles
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "preferences_owner_only" on public.aim_preferences
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "sessions_owner_only" on public.aim_sessions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "presets_owner_only" on public.aim_presets
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

comment on table public.aim_profiles is 'Per-user browser AIM player profile; not a public leaderboard.';
comment on table public.aim_preferences is 'Per-user weekly goal and local-compatible settings; no Riot tokens.';
comment on table public.aim_sessions is 'Per-user manually entered AIM training history; soft deletion supports safe synchronization.';
comment on table public.aim_presets is 'Per-user editable AIM routines; soft deletion supports safe synchronization.';

commit;
