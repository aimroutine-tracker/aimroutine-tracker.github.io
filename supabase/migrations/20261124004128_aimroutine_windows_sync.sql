begin;

create schema if not exists aim_windows_private;
revoke all on schema aim_windows_private from public, anon, authenticated;
grant usage on schema aim_windows_private to service_role;

create table aim_windows_private.devices (
  id uuid primary key default gen_random_uuid(),
  digest text not null unique check (digest ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_label text not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  revoked_at timestamptz,
  results jsonb not null default '[]'::jsonb
    check (jsonb_typeof(results) = 'array' and jsonb_array_length(results) <= 100000)
);
create index aim_windows_devices_user_id on aim_windows_private.devices(user_id);
alter table aim_windows_private.devices enable row level security;
revoke all on table aim_windows_private.devices from public, anon, authenticated;
grant select, insert, update on aim_windows_private.devices to service_role;
grant select on public.aim_sessions to service_role;

comment on table aim_windows_private.devices is
  'Service-only Windows pairing and latest per-device snapshot. Revocation clears the snapshot and retains the digest to prevent challenge replay. Account deletion cascades.';

-- The Edge Function authenticates the account or proves possession of a device
-- secret before invoking this service-only function. Scope every owner read/write
-- explicitly because service_role bypasses RLS.
create function public.aim_windows_operation(operation text, args jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
declare
  actor_id uuid := (args->>'uid')::uuid;
  device_id uuid := (args->>'id')::uuid;
  device_digest text := args->>'digest';
  device aim_windows_private.devices%rowtype;
  page_offset integer := coalesce((args->>'offset')::integer,0);
  page_size constant integer := 50;
  page_rows jsonb;
  next_offset integer;
  replacement jsonb := nullif(args->'results','null'::jsonb);
  uploaded integer := 0;
  sync_time timestamptz;
  account jsonb;
begin
  if operation = 'approve' then
    -- Serialize resets and approvals for this account. Unique digest protects
    -- against approvals of one challenge by concurrent different accounts.
    perform pg_advisory_xact_lock(hashtextextended(actor_id::text,49306));
    if exists (select 1 from aim_windows_private.devices where digest=device_digest) then
      return jsonb_build_object('error','challenge_already_used');
    end if;
    if (select count(*) from aim_windows_private.devices
         where user_id=actor_id and revoked_at is null) >= 20 then
      return jsonb_build_object('error','device_limit');
    end if;
    insert into aim_windows_private.devices(digest,user_id,account_label)
      values(device_digest,actor_id,args->>'label')
      on conflict (digest) do nothing;
    if not found then
      return jsonb_build_object('error','challenge_already_used');
    end if;
    return jsonb_build_object('ok',true);
  end if;

  if operation = 'devices' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',d.id,'createdAt',d.created_at,'updatedAt',d.updated_at,
      'resultCount',jsonb_array_length(d.results)
    ) order by d.created_at desc,d.id),'[]'::jsonb)
    into page_rows
    from aim_windows_private.devices d
    where d.user_id=actor_id and d.revoked_at is null;
    return jsonb_build_object('devices',page_rows);
  end if;

  if operation = 'results' then
    select d.* into device from aim_windows_private.devices d
    where d.id=device_id and d.user_id=actor_id and d.revoked_at is null;
    if not found then return jsonb_build_object('error','device_not_found'); end if;
    select coalesce(jsonb_agg(row.payload order by row.ordinal),'[]'::jsonb) into page_rows
    from (
      select payload,ordinal from jsonb_array_elements(device.results)
        with ordinality as item(payload,ordinal)
      limit page_size offset page_offset
    ) row;
    if jsonb_array_length(device.results)>page_offset+page_size then
      next_offset := page_offset+page_size;
    end if;
    return jsonb_build_object('results',page_rows,'nextOffset',next_offset);
  end if;

  if operation = 'revoke' then
    update aim_windows_private.devices d
    set revoked_at=clock_timestamp(),results='[]'::jsonb,account_label=''
    where d.id=device_id and d.user_id=actor_id and d.revoked_at is null;
    if not found then return jsonb_build_object('error','device_not_found'); end if;
    return jsonb_build_object('ok',true);
  end if;

  if operation = 'disconnect' then
    update aim_windows_private.devices d
    set revoked_at=clock_timestamp(),results='[]'::jsonb,account_label=''
    where d.digest=device_digest and d.revoked_at is null;
    return jsonb_build_object('ok',true);
  end if;

  if operation = 'status' or operation = 'sync' then
    -- Lock the pairing before reading an account or replacing a snapshot.
    -- Concurrent revoke/reset rechecks the row or clears it after the write.
    select d.* into device from aim_windows_private.devices d
    where d.digest=device_digest for update;
    if not found then return jsonb_build_object('state','pending'); end if;
    if device.revoked_at is not null then return jsonb_build_object('state','revoked'); end if;
    account := jsonb_build_object('id',device.user_id,'label',device.account_label);
    if operation = 'status' then return jsonb_build_object('state','linked','account',account); end if;

    sync_time := clock_timestamp();
    if replacement is not null then
      uploaded := jsonb_array_length(replacement);
      update aim_windows_private.devices d set results=replacement,updated_at=sync_time
      where d.id=device.id;
    end if;
    select coalesce(jsonb_agg(s.payload order by s.session_id)
      filter(where s.position<=page_size),'[]'::jsonb),
      case when count(*)>page_size then page_offset+page_size end
    into page_rows,next_offset
    from (
      select page.*,row_number() over(order by page.session_id) as position
      from (
        select payload,session_id
        from public.aim_sessions
        where user_id=device.user_id and deleted_at is null
        order by session_id limit page_size+1 offset page_offset
      ) page
    ) s;
    return jsonb_build_object('state','linked','account',account,'syncedAt',sync_time,
      'uploaded',uploaded,'sessions',page_rows,'nextOffset',next_offset);
  end if;

  raise exception 'Unknown Windows data operation' using errcode='22023';
end
$function$;

revoke all on function public.aim_windows_operation(text,jsonb) from public, anon, authenticated;
grant execute on function public.aim_windows_operation(text,jsonb) to service_role;

-- Use a private trigger so the existing RLS-preserving reset RPC can wipe
-- Windows devices in the same transaction without giving browsers table access.
create function aim_windows_private.reset_devices()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  if new.settings->>'reset_at' is null then return new; end if;
  if tg_op='UPDATE' then
    if (old.settings->>'reset_at') is not distinct from (new.settings->>'reset_at') then
      return new;
    end if;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,49306));
  update aim_windows_private.devices
  set revoked_at=clock_timestamp(),results='[]'::jsonb,account_label=''
  where user_id=new.user_id and revoked_at is null;
  return new;
end
$function$;

revoke all on function aim_windows_private.reset_devices() from public, anon, authenticated;
create trigger aim_windows_reset_devices
  after insert or update of settings on public.aim_preferences
  for each row execute function aim_windows_private.reset_devices();

commit;
