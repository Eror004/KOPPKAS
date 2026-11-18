-- KOPPKAS revision 021: rate-limit anonymous public contact submissions by hashed client IP.
begin;

create table public.public_contact_rate_limits (
  ip_hash text primary key check (ip_hash ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  blocked_until timestamptz
);

alter table public.public_contact_rate_limits enable row level security;
revoke all on public.public_contact_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on public.public_contact_rate_limits to service_role;

create or replace function public.consume_public_contact_rate_limit(p_ip_hash text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_count integer;
  current_blocked_until timestamptz;
begin
  if p_ip_hash is null or p_ip_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid rate-limit key' using errcode = '22023';
  end if;

  delete from public.public_contact_rate_limits
  where window_started_at < now() - interval '1 day';

  insert into public.public_contact_rate_limits (ip_hash, window_started_at, request_count, blocked_until)
  values (p_ip_hash, now(), 1, null)
  on conflict (ip_hash) do update
  set request_count = case
        when public.public_contact_rate_limits.window_started_at <= now() - interval '10 minutes' then 1
        else public.public_contact_rate_limits.request_count + 1
      end,
      window_started_at = case
        when public.public_contact_rate_limits.window_started_at <= now() - interval '10 minutes' then now()
        else public.public_contact_rate_limits.window_started_at
      end,
      blocked_until = case
        when public.public_contact_rate_limits.window_started_at <= now() - interval '10 minutes' then null
        when public.public_contact_rate_limits.request_count + 1 >= 6 then now() + interval '10 minutes'
        else public.public_contact_rate_limits.blocked_until
      end
  returning request_count, blocked_until
  into current_count, current_blocked_until;

  return current_count <= 5
    and (current_blocked_until is null or current_blocked_until <= now());
end
$$;

revoke all on function public.consume_public_contact_rate_limit(text) from public, anon, authenticated;
grant execute on function public.consume_public_contact_rate_limit(text) to service_role;

commit;
