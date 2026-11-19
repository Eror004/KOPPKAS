-- KOPPKAS: enforce the approved six-account organizational limit at the database boundary.
-- Counts all profiles, including inactive accounts. Existing account rows are never modified.
begin;

create or replace function public.enforce_koppkas_account_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('koppkas_account_limit', 0)
  );

  select count(*)::integer
    into v_account_count
  from public.profiles;

  if v_account_count >= 6 then
    raise exception using
      errcode = 'check_violation',
      message = 'KOPPKAS supports a maximum of six organizational accounts.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_koppkas_account_limit() from public, anon, authenticated;

drop trigger if exists profiles_enforce_koppkas_account_limit on public.profiles;
create trigger profiles_enforce_koppkas_account_limit
before insert on public.profiles
for each row execute function public.enforce_koppkas_account_limit();

comment on function public.enforce_koppkas_account_limit() is
  'Prevents creating more than six KOPPKAS organizational accounts, counting active and inactive profiles.';

commit;
