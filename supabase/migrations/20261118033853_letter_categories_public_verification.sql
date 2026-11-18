-- KOPPKAS revision 007: public verification and letter category authorization
begin;

alter table public.official_letters
  add column category text not null default 'umum'
  check (category in ('umum', 'keuangan'));

drop policy if exists "letters_create_allowed_roles" on public.official_letters;
create policy "letters_create_by_category" on public.official_letters
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (
    (category = 'umum' and app_private.has_any_role(array[
      'ketua_pemuda','wakil_ketua_pemuda','sekretaris','ketua_rw_01','ketua_rt_01'
    ]::public.app_role[]))
    or
    (category = 'keuangan' and app_private.has_any_role(array['bendahara']::public.app_role[]))
  )
);

create policy "letters_public_verify_published" on public.official_letters
for select to anon
using (status = 'terbit');

grant select on public.official_letters to anon;

commit;
