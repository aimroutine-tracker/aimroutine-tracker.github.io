\set ON_ERROR_STOP on
-- This file runs ONLY against an isolated PostgreSQL CI service.
-- It does not connect to hosted Supabase, use user data or require secrets.
create role anon;
create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable
as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated,anon;
grant execute on function auth.uid() to authenticated,anon;
-- Hosted Supabase gives anon these helper privileges, while postgres does not
-- have GRANT OPTION on its internal auth schema. Mirror that contract in CI.

create table public.aim_sessions(
  user_id uuid not null, session_id text not null,
  payload jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  primary key(user_id,session_id)
);
create table public.aim_presets(
  user_id uuid not null, preset_id text not null,
  payload jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  primary key(user_id,preset_id)
);
create table public.aim_profiles(
  user_id uuid primary key,
  profile jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table public.aim_preferences(
  user_id uuid primary key, weekly_goal integer not null default 3,
  settings jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now()
);
grant select,insert,update,delete on
  public.aim_sessions,public.aim_presets,public.aim_profiles,public.aim_preferences
to authenticated;
alter table public.aim_sessions enable row level security;
alter table public.aim_presets enable row level security;
alter table public.aim_profiles enable row level security;
alter table public.aim_preferences enable row level security;
create policy owner_sessions on public.aim_sessions for all to authenticated
 using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy owner_presets on public.aim_presets for all to authenticated
 using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy owner_profiles on public.aim_profiles for all to authenticated
 using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy owner_preferences on public.aim_preferences for all to authenticated
 using (auth.uid()=user_id) with check (auth.uid()=user_id);

-- Two synthetic identities, never real users.
insert into public.aim_sessions values
 ('11111111-1111-4111-8111-111111111111','qa-A'),
 ('22222222-2222-4222-8222-222222222222','qa-B');
insert into public.aim_presets values
 ('11111111-1111-4111-8111-111111111111','qa-preset-A'),
 ('22222222-2222-4222-8222-222222222222','qa-preset-B');
insert into public.aim_profiles(user_id) values
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222');

-- This is the migration committed on the V3 feature branch.
\i supabase/migrations/20261111210933_reset_expected_uid.sql

-- The new destructive RPC must not be executable by anonymous clients.
do $test$
begin
 if has_function_privilege('anon','public.aim_reset_my_progress_for_user(uuid)','EXECUTE') then
  raise exception 'Anonymous role unexpectedly has reset EXECUTE';
 end if;
 if not has_function_privilege('authenticated','public.aim_reset_my_progress_for_user(uuid)','EXECUTE') then
  raise exception 'Authenticated role cannot invoke its own reset RPC';
 end if;
end
$test$;

-- Test that a B JWT cannot reset the expected A account.
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
do $test$
declare err text;
begin
 begin
  perform public.aim_reset_my_progress_for_user('11111111-1111-4111-8111-111111111111'::uuid);
  raise exception 'Wrong-user reset unexpectedly succeeded';
 exception when sqlstate '42501' then
  get stacked diagnostics err=message_text;
  if err<>'account_mismatch' then
    raise exception 'Unexpected mismatch rejection: %',err;
  end if;
 end;
end
$test$;
reset role;

do $test$
begin
 if (select count(*) from public.aim_sessions)<>2 or
    (select count(*) from public.aim_presets)<>2 or
    (select count(*) from public.aim_profiles)<>2 then
   raise exception 'Mismatched JWT modified an account';
 end if;
end
$test$;

-- Test that missing authentication is rejected too.
set role authenticated;
select set_config('request.jwt.claim.sub','',false);
do $test$
declare err text;
begin
 begin
  perform public.aim_reset_my_progress_for_user('11111111-1111-4111-8111-111111111111'::uuid);
  raise exception 'Guest reset unexpectedly succeeded';
 exception when sqlstate '28000' then
  get stacked diagnostics err=message_text;
  if err<>'authentication_required' then
    raise exception 'Unexpected guest rejection: %',err;
  end if;
 end;
end
$test$;
reset role;

-- Prove true transaction atomicity. The preference-reset insert deliberately
-- fails AFTER sessions, presets and profiles are deleted inside the function.
-- PostgreSQL must roll back ALL of those deletions as one subtransaction.
create function public.qa_block_reset_marker() returns trigger language plpgsql
as $qa$
begin
 if new.user_id='11111111-1111-4111-8111-111111111111'::uuid then
  raise exception 'synthetic_preference_error';
 end if;
 return new;
end
$qa$;
create trigger qa_block_reset_marker before insert or update on public.aim_preferences
 for each row execute function public.qa_block_reset_marker();

set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
do $test$
declare err text;
begin
 begin
  perform public.aim_reset_my_progress_for_user('11111111-1111-4111-8111-111111111111'::uuid);
  raise exception 'Reset unexpectedly succeeded after preference failure';
 exception when others then
  get stacked diagnostics err=message_text;
  if err<>'synthetic_preference_error' then
   raise exception 'Unexpected atomicity rejection: %',err;
  end if;
 end;
end
$test$;
reset role;
drop trigger qa_block_reset_marker on public.aim_preferences;
drop function public.qa_block_reset_marker();

do $test$
begin
 if (select count(*) from public.aim_sessions)<>2 or
    (select count(*) from public.aim_presets)<>2 or
    (select count(*) from public.aim_profiles)<>2 or
    (select count(*) from public.aim_preferences)<>0
 then raise exception 'Failed reset did not roll back all changed training tables'; end if;
end
$test$;

-- A JWT + expected A should delete ONLY A and persist its reset marker.
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select public.aim_reset_my_progress_for_user('11111111-1111-4111-8111-111111111111'::uuid);
reset role;

do $test$
begin
 if (select count(*) from public.aim_sessions where user_id='11111111-1111-4111-8111-111111111111')<>0
  or (select count(*) from public.aim_presets where user_id='11111111-1111-4111-8111-111111111111')<>0
  or (select count(*) from public.aim_profiles where user_id='11111111-1111-4111-8111-111111111111')<>0
 then raise exception 'A reset did not remove all A training rows'; end if;
 if (select count(*) from public.aim_sessions where user_id='22222222-2222-4222-8222-222222222222')<>1
  or (select count(*) from public.aim_presets where user_id='22222222-2222-4222-8222-222222222222')<>1
  or (select count(*) from public.aim_profiles where user_id='22222222-2222-4222-8222-222222222222')<>1
 then raise exception 'A reset altered B data'; end if;
 if (select count(*) from public.aim_preferences where user_id='11111111-1111-4111-8111-111111111111'
     and weekly_goal=3 and settings->>'reset_at' is not null)<>1
 then raise exception 'A reset marker was not persisted'; end if;
end
$test$;
\echo 'PASS: isolated PostgreSQL A/B bound reset, grant isolation, full atomic rollback, guest rejection and reset cursor'
