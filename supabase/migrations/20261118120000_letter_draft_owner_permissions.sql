-- KOPPKAS revision 020: allow owners to manage their own official-letter drafts.
begin;

drop policy if exists "letters_update_leadership_secretary" on public.official_letters;
create policy "letters_update_owner_or_leadership" on public.official_letters
for update to authenticated
using (
  created_by = (select auth.uid())
  or app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda']::public.app_role[])
  or (category = 'umum' and app_private.current_app_role() = 'sekretaris')
)
with check (
  created_by = (select auth.uid())
  or app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda']::public.app_role[])
  or (category = 'umum' and app_private.current_app_role() = 'sekretaris')
);

create or replace function app_private.guard_letter_owner_and_category()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare role_now public.app_role;
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'Official letter creator is immutable'
      using errcode = '42501';
  end if;

  role_now := app_private.current_app_role();
  if old.status = 'draft' and new.category is distinct from old.category then
    if new.category = 'keuangan' and role_now is distinct from 'bendahara' then
      raise exception 'Only Bendahara may manage financial letters'
        using errcode = '42501';
    end if;
    if new.category = 'umum' and (
      role_now is null or role_now not in (
        'ketua_pemuda','wakil_ketua_pemuda','sekretaris','ketua_rw_01','ketua_rt_01'
      )
    ) then
      raise exception 'Role is not authorized for general letters'
        using errcode = '42501';
    end if;
  end if;

  return new;
end
$$;

drop trigger if exists guard_letter_owner_and_category on public.official_letters;
create trigger guard_letter_owner_and_category
before update on public.official_letters
for each row execute procedure app_private.guard_letter_owner_and_category();

revoke all on function app_private.guard_letter_owner_and_category() from public, anon, authenticated;

commit;
