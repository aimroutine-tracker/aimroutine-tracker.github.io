-- AIM: require nickname on email signup, including direct Auth API calls.
-- OAuth Google remains allowed, with mandatory nickname onboarding on the site.
-- This is user-editable display data, not an authorization claim.
create or replace function public.aim_beta_signup_gate(event jsonb)
returns jsonb
language plpgsql
set search_path to 'pg_catalog'
as $function$
declare
  provider text := pg_catalog.lower(coalesce(event->'user'->'app_metadata'->>'provider',''));
  nickname text := coalesce(event->'user'->'user_metadata'->>'aim_username','');
begin
  if provider = 'email' and nickname !~ '^[A-Za-z0-9][A-Za-z0-9_-]{2,23}$' then
    return pg_catalog.jsonb_build_object(
      'error',pg_catalog.jsonb_build_object(
        'http_code',422,
        'message','Un pseudo de 3 a 24 caracteres (lettres, chiffres, _ et -) est obligatoire.'
      )
    );
  end if;
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
