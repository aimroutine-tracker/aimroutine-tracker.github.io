-- Optional server-side signup gate to keep email signup closed during beta
-- while preserving existing email logins and Google OAuth signups.
-- IMPORTANT: This function does nothing until the owner enables it as the
-- "Before User Created" Postgres Auth Hook in Supabase Authentication > Hooks.
begin;

create or replace function public.aim_beta_signup_gate(event jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $hook$
declare
  provider text := lower(coalesce(event->'user'->'app_metadata'->>'provider',''));
begin
  -- Existing users signing in do not trigger Before User Created.
  -- Google OAuth is the only currently permitted *new* identity during beta.
  if provider = 'google' then
    return '{}'::jsonb;
  end if;

  -- Fail closed for email, phone, anonymous, and unexpected provider values.
  return pg_catalog.jsonb_build_object(
    'error',pg_catalog.jsonb_build_object(
      'http_code',403,
      'message','New email registrations are not available yet.'
    )
  );
end
$hook$;

revoke all on function public.aim_beta_signup_gate(jsonb) from public,anon,authenticated;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.aim_beta_signup_gate(jsonb) to supabase_auth_admin;
comment on function public.aim_beta_signup_gate(jsonb) is
  'Optional beta signup policy: allow new Google users, reject new email/other users. Requires explicit Supabase Auth Hooks activation; existing sign-ins are unchanged.';

commit;
