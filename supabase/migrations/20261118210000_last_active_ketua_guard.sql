-- KOPPKAS revision 028: serialize changes that could remove the last active Ketua.
begin;

create or replace function app_private.guard_last_active_ketua()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare active_ketua_count integer;
begin
  if old.role = 'ketua_pemuda'
     and old.is_active = true
     and (new.role is distinct from 'ketua_pemuda' or new.is_active is distinct from true) then
    -- Serialize concurrent demotions/deactivations so two requests cannot
    -- both observe a second active Ketua and remove the final active account.
    perform pg_catalog.pg_advisory_xact_lock(74102820261118::bigint);

    select count(*)::integer
      into active_ketua_count
    from public.profiles
    where role = 'ketua_pemuda'
      and is_active = true;

    if active_ketua_count <= 1 then
      raise exception 'At least one active Ketua Pemuda account must remain'
        using errcode = '23514';
    end if;
  end if;

  return new;
end
$$;

drop trigger if exists guard_last_active_ketua on public.profiles;
create trigger guard_last_active_ketua
before update of role, is_active on public.profiles
for each row execute procedure app_private.guard_last_active_ketua();

revoke all on function app_private.guard_last_active_ketua() from public, anon, authenticated;

commit;
