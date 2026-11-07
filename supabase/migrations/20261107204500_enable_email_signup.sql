-- Release email signup after production Turnstile negative test on 2026-11-07.
-- Supabase Auth enforces CAPTCHA and email confirmation, independent of this hook.
-- Keep the Before User Created hook installed; reject all other new providers.
create or replace function public.aim_beta_signup_gate(event jsonb)
returns jsonb
language plpgsql
set search_path = 'pg_catalog'
as $function$
declare
  provider text := lower(coalesce(event->'user'->'app_metadata'->>'provider',''));
begin
  if provider in ('email','google') then
    return '{}'::jsonb;
  end if;
  return pg_catalog.jsonb_build_object(
    'error',pg_catalog.jsonb_build_object(
      'http_code',403,
      'message','This signup provider is not available.'
    )
  );
end;
$function$;
