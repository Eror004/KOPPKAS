-- Restrict general-letter Secretary updates to the draft submission workflow.
-- Owners retain the separate letters_update_own_draft policy; leadership retains full workflow control.
begin;

drop policy if exists "letters_update_owner_or_leadership" on public.official_letters;

create policy "letters_update_owner_or_leadership" on public.official_letters
for update to authenticated
using (
  app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda']::public.app_role[])
  or (
    category = 'umum'
    and app_private.current_app_role() = 'sekretaris'
    and status = 'draft'
  )
)
with check (
  app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda']::public.app_role[])
  or (
    category = 'umum'
    and app_private.current_app_role() = 'sekretaris'
    and status in ('draft', 'menunggu_persetujuan')
  )
);

commit;
