-- KOPPKAS revision 017: progressive password verification lockout.
begin;

create table public.login_protection_attempts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  requires_admin_unlock boolean not null default false,
  last_failed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.login_protection_attempts enable row level security;
create policy "login_protection_auth_admin_manage" on public.login_protection_attempts
for all to supabase_auth_admin using (true) with check (true);
revoke all on public.login_protection_attempts from public, anon, authenticated;
grant usage on schema public to supabase_auth_admin;
grant all on public.login_protection_attempts to supabase_auth_admin;
grant all on public.login_protection_attempts to service_role;

create or replace function public.hook_password_verification_attempt(event jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  target_user_id uuid;
  password_valid boolean;
  attempt_row public.login_protection_attempts%rowtype;
  next_attempt_count integer;
begin
  begin
    target_user_id := nullif(event->>'user_id', '')::uuid;
  exception when invalid_text_representation then
    return jsonb_build_object('decision', 'continue');
  end;

  if target_user_id is null then
    return jsonb_build_object('decision', 'continue');
  end if;

  password_valid := coalesce((event->>'valid')::boolean, false);

  -- Serialize attempts per account so concurrent requests cannot skip thresholds.
  perform pg_advisory_xact_lock(hashtextextended(target_user_id::text, 0));

  select *
    into attempt_row
  from public.login_protection_attempts
  where user_id = target_user_id
  for update;

  if found and attempt_row.requires_admin_unlock then
    return jsonb_build_object(
      'decision', 'reject',
      'message', 'Akun memerlukan verifikasi tambahan. Hubungi Ketua Pemuda.',
      'should_logout_user', false
    );
  end if;

  if found and attempt_row.locked_until is not null and attempt_row.locked_until > now() then
    return jsonb_build_object(
      'decision', 'reject',
      'message', 'Terlalu banyak percobaan. Akun dikunci sementara selama 15 menit atau 1 jam sesuai tingkat pelanggaran.',
      'should_logout_user', false
    );
  end if;

  if password_valid then
    delete from public.login_protection_attempts where user_id = target_user_id;
    return jsonb_build_object('decision', 'continue');
  end if;

  if not found then
    insert into public.login_protection_attempts (
      user_id, failed_attempts, last_failed_at, updated_at
    ) values (
      target_user_id, 1, now(), now()
    );
    next_attempt_count := 1;
  else
    next_attempt_count := attempt_row.failed_attempts + 1;
    update public.login_protection_attempts
    set failed_attempts = next_attempt_count,
        locked_until = case
          when next_attempt_count >= 10 then now() + interval '1 hour'
          when next_attempt_count >= 5 then now() + interval '15 minutes'
          else null
        end,
        requires_admin_unlock = next_attempt_count >= 10,
        last_failed_at = now(),
        updated_at = now()
    where user_id = target_user_id;
  end if;

  if next_attempt_count >= 10 then
    return jsonb_build_object(
      'decision', 'reject',
      'message', 'Akun dikunci 1 jam dan memerlukan verifikasi tambahan oleh Ketua Pemuda.',
      'should_logout_user', false
    );
  elsif next_attempt_count >= 5 then
    return jsonb_build_object(
      'decision', 'reject',
      'message', 'Terlalu banyak percobaan password. Coba lagi setelah 15 menit.',
      'should_logout_user', false
    );
  end if;

  return jsonb_build_object('decision', 'continue');
end
$$;

revoke all on function public.hook_password_verification_attempt(jsonb) from public, anon, authenticated;
grant execute on function public.hook_password_verification_attempt(jsonb) to supabase_auth_admin;

comment on table public.login_protection_attempts is
  'Internal Supabase Auth hook state. Not accessible through the public client API.';
comment on function public.hook_password_verification_attempt(jsonb) is
  'Progressive password sign-in lockout: 5 failures = 15 minutes; 10 failures = 1 hour and Ketua admin unlock required.';

commit;
