-- KOPPKAS revision 030: align private storage mutation policies with media permissions.
begin;

drop policy if exists "koppkas_docs_update_owner_or_admin" on storage.objects;
create policy "koppkas_docs_update_owner_or_admin" on storage.objects
for update to authenticated
using (
  bucket_id = 'koppkas-documents'
  and app_private.has_any_role(array[
    'ketua_pemuda','wakil_ketua_pemuda','sekretaris','ketua_rw_01','ketua_rt_01'
  ]::public.app_role[])
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','sekretaris']::public.app_role[])
  )
)
with check (
  bucket_id = 'koppkas-documents'
  and app_private.has_any_role(array[
    'ketua_pemuda','wakil_ketua_pemuda','sekretaris','ketua_rw_01','ketua_rt_01'
  ]::public.app_role[])
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','sekretaris']::public.app_role[])
  )
);

-- Only Ketua Pemuda can delete documentation assets, matching media.delete.
drop policy if exists "koppkas_docs_delete_owner_or_admin" on storage.objects;
create policy "koppkas_docs_delete_ketua" on storage.objects
for delete to authenticated
using (
  bucket_id = 'koppkas-documents'
  and app_private.has_any_role(array['ketua_pemuda']::public.app_role[])
);

commit;
