-- KOPPKAS: server-enforced 24-hour sessions and a maximum of three concurrent devices.
-- Session rows are revoked using the same auth.sessions deletion primitive used by Supabase Auth logout.
begin;

create table public.app_device_sessions (
  session_id uuid primary key references auth.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_label text not null default 'Perangkat tidak dikenal'
    check (char_length(device_label) between 1 and 100),
  user_agent text check (user_agent is null or char_length(user_agent) <= 512),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index app_device_sessions_user_last_seen_idx
  on public.app_device_sessions (user_id, last_seen_at desc);

alter table public.app_device_sessions enable row level security;
revoke all on public.app_device_sessions from public, anon, authenticated;
grant select, insert, update, delete on public.app_device_sessions to service_role;

create or replace function public.register_current_app_session(
  p_device_label text default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  v_created_at timestamptz;
  v_not_after timestamptz;
  v_other_active integer := 0;
  v_device_label text := left(coalesce(nullif(btrim(p_device_label), ''), 'Perangkat tidak dikenal'), 100);
  v_user_agent text := left(nullif(p_user_agent, ''), 512);
begin
  if v_user_id is null or v_session_id is null then
    return jsonb_build_object('allowed', false, 'reason', 'unauthenticated');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text, 8241));

  select s.created_at, s.not_after
    into v_created_at, v_not_after
  from auth.sessions as s
  where s.id = v_session_id
    and s.user_id = v_user_id
  for update;

  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'session_missing');
  end if;

  v_created_at := coalesce(v_created_at, pg_catalog.now());

  if v_created_at + interval '24 hours' <= pg_catalog.now()
    or (v_not_after is not null and v_not_after <= pg_catalog.now()) then
    delete from auth.sessions where id = v_session_id and user_id = v_user_id;
    return jsonb_build_object('allowed', false, 'reason', 'session_expired');
  end if;

  -- Persist the 24-hour ceiling in Supabase Auth itself; refreshing a token
  -- must never extend the session lifetime.
  update auth.sessions
  set not_after = least(
    coalesce(not_after, v_created_at + interval '24 hours'),
    v_created_at + interval '24 hours'
  )
  where id = v_session_id
    and user_id = v_user_id;

  select count(*)::integer
    into v_other_active
  from auth.sessions as s
  where s.user_id = v_user_id
    and s.id <> v_session_id
    and coalesce(s.created_at, pg_catalog.now()) + interval '24 hours' > pg_catalog.now()
    and (s.not_after is null or s.not_after > pg_catalog.now());

  if v_other_active >= 3 then
    -- The fourth/newest login is rejected. Existing three sessions stay intact.
    delete from auth.sessions where id = v_session_id and user_id = v_user_id;
    return jsonb_build_object(
      'allowed', false,
      'reason', 'device_limit',
      'max_devices', 3,
      'active_devices', v_other_active
    );
  end if;

  insert into public.app_device_sessions (
    session_id, user_id, device_label, user_agent, first_seen_at, last_seen_at
  ) values (
    v_session_id, v_user_id, v_device_label, v_user_agent, v_created_at, pg_catalog.now()
  )
  on conflict (session_id) do update
    set device_label = excluded.device_label,
        user_agent = excluded.user_agent,
        last_seen_at = pg_catalog.now();

  return jsonb_build_object(
    'allowed', true,
    'max_devices', 3,
    'active_devices', v_other_active + 1,
    'expires_at', v_created_at + interval '24 hours'
  );
end;
$$;

create or replace function public.get_my_app_sessions()
returns table (
  session_id uuid,
  device_label text,
  created_at timestamptz,
  last_seen_at timestamptz,
  is_current boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_current_session_id uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  -- Expired sessions are no longer usable; remove them instead of displaying stale devices.
  delete from auth.sessions as s
  where s.user_id = v_user_id
    and (
      coalesce(s.created_at, pg_catalog.now()) + interval '24 hours' <= pg_catalog.now()
      or (s.not_after is not null and s.not_after <= pg_catalog.now())
    );

  return query
  select
    s.id,
    coalesce(d.device_label, 'Perangkat belum dikenali'),
    s.created_at,
    coalesce(d.last_seen_at, s.updated_at, s.created_at),
    s.id = v_current_session_id
  from auth.sessions as s
  left join public.app_device_sessions as d
    on d.session_id = s.id
   and d.user_id = v_user_id
  where s.user_id = v_user_id
    and coalesce(s.created_at, pg_catalog.now()) + interval '24 hours' > pg_catalog.now()
    and (s.not_after is null or s.not_after > pg_catalog.now())
  order by s.created_at desc;
end;
$$;

create or replace function public.revoke_my_app_session(p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_current_session_id uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  v_deleted integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_session_id is null or p_session_id = v_current_session_id then
    return false;
  end if;

  delete from auth.sessions
  where id = p_session_id
    and user_id = v_user_id;
  get diagnostics v_deleted = row_count;

  if v_deleted > 0 then
    insert into public.activity_logs (
      actor_id, action, resource_type, resource_id, metadata
    ) values (
      v_user_id, 'session_revoked', 'auth_session', p_session_id,
      jsonb_build_object('scope', 'single_device')
    );
  end if;

  return v_deleted > 0;
end;
$$;

create or replace function public.revoke_other_app_sessions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_current_session_id uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  v_deleted integer := 0;
begin
  if v_user_id is null or v_current_session_id is null then
    raise exception 'Authentication required';
  end if;

  delete from auth.sessions
  where user_id = v_user_id
    and id <> v_current_session_id;
  get diagnostics v_deleted = row_count;

  if v_deleted > 0 then
    insert into public.activity_logs (
      actor_id, action, resource_type, resource_id, metadata
    ) values (
      v_user_id, 'sessions_revoked', 'auth_user', v_user_id,
      jsonb_build_object('scope', 'all_other_devices', 'revoked_count', v_deleted)
    );
  end if;

  return v_deleted;
end;
$$;

create or replace function public.revoke_user_app_sessions(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role text;
  v_actor_active boolean;
  v_deleted integer := 0;
begin
  if v_actor_id is null or p_user_id is null or p_user_id = v_actor_id then
    raise exception 'Invalid session revocation target';
  end if;

  select p.role, p.is_active
    into v_actor_role, v_actor_active
  from public.profiles as p
  where p.id = v_actor_id;

  if v_actor_role is distinct from 'ketua_pemuda' or v_actor_active is distinct from true then
    raise exception 'Only an active Ketua Pemuda can revoke another account sessions';
  end if;

  delete from auth.sessions where user_id = p_user_id;
  get diagnostics v_deleted = row_count;

  if v_deleted > 0 then
    insert into public.activity_logs (
      actor_id, action, resource_type, resource_id, metadata
    ) values (
      v_actor_id, 'sessions_revoked', 'auth_user', p_user_id,
      jsonb_build_object('scope', 'account_security_admin', 'revoked_count', v_deleted)
    );
  end if;

  return v_deleted;
end;
$$;

revoke all on function public.register_current_app_session(text, text) from public, anon;
revoke all on function public.get_my_app_sessions() from public, anon;
revoke all on function public.revoke_my_app_session(uuid) from public, anon;
revoke all on function public.revoke_other_app_sessions() from public, anon;
revoke all on function public.revoke_user_app_sessions(uuid) from public, anon;

grant execute on function public.register_current_app_session(text, text) to authenticated;
grant execute on function public.get_my_app_sessions() to authenticated;
grant execute on function public.revoke_my_app_session(uuid) to authenticated;
grant execute on function public.revoke_other_app_sessions() to authenticated;
grant execute on function public.revoke_user_app_sessions(uuid) to authenticated;

comment on table public.app_device_sessions is
  'Private device metadata for authenticated app sessions. Raw IP addresses and geolocation are intentionally not stored.';
comment on function public.register_current_app_session(text, text) is
  'Enforces a 24-hour session lifetime and a maximum of three concurrent sessions per user. A fourth/new login is rejected without removing the existing three.';
comment on function public.get_my_app_sessions() is
  'Returns only the current user active devices and removes expired session rows.';
comment on function public.revoke_my_app_session(uuid) is
  'Revokes one other device session belonging to the authenticated user.';
comment on function public.revoke_other_app_sessions() is
  'Revokes all other device sessions for the authenticated user while keeping the current session.';
comment on function public.revoke_user_app_sessions(uuid) is
  'Allows an active Ketua Pemuda to revoke all sessions of another account.';

commit;
