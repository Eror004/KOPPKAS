-- KOPPKAS revision 024: activate private organization document storage with role-scoped access.
begin;

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
) values (
  'koppkas-documents',
  'koppkas-documents',
  false,
  26214400,
  array['image/jpeg','image/png','image/webp','application/pdf','video/mp4']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "koppkas_docs_read_media_roles" on storage.objects;
create policy "koppkas_docs_read_media_roles" on storage.objects
for select to authenticated
using (
  bucket_id = 'koppkas-documents'
  and app_private.has_any_role(array[
    'ketua_pemuda','wakil_ketua_pemuda','sekretaris','ketua_rw_01','ketua_rt_01'
  ]::public.app_role[])
);

drop policy if exists "koppkas_docs_insert_media_roles" on storage.objects;
create policy "koppkas_docs_insert_media_roles" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'koppkas-documents'
  and app_private.has_any_role(array[
    'ketua_pemuda','wakil_ketua_pemuda','sekretaris','ketua_rw_01','ketua_rt_01'
  ]::public.app_role[])
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "koppkas_docs_update_owner_or_admin" on storage.objects;
create policy "koppkas_docs_update_owner_or_admin" on storage.objects
for update to authenticated
using (
  bucket_id = 'koppkas-documents'
  and (
    ((storage.foldername(name))[1] = (select auth.uid())::text and app_private.current_app_role() is not null)
    or app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','sekretaris']::public.app_role[])
  )
)
with check (
  bucket_id = 'koppkas-documents'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','sekretaris']::public.app_role[])
  )
);

drop policy if exists "koppkas_docs_delete_owner_or_admin" on storage.objects;
create policy "koppkas_docs_delete_owner_or_admin" on storage.objects
for delete to authenticated
using (
  bucket_id = 'koppkas-documents'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','sekretaris']::public.app_role[])
  )
);

drop policy if exists "media_internal_read" on public.media_assets;
create policy "media_internal_read" on public.media_assets
for select to authenticated
using (
  visibility = 'internal'
  and app_private.has_any_role(array[
    'ketua_pemuda','wakil_ketua_pemuda','sekretaris','ketua_rw_01','ketua_rt_01'
  ]::public.app_role[])
);

drop policy if exists "media_insert_active_roles" on public.media_assets;
create policy "media_insert_active_roles" on public.media_assets
for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and app_private.has_any_role(array[
    'ketua_pemuda','wakil_ketua_pemuda','sekretaris','ketua_rw_01','ketua_rt_01'
  ]::public.app_role[])
  and visibility = 'internal'
);

drop policy if exists "media_update_owner_or_admin" on public.media_assets;
create policy "media_update_owner_or_admin" on public.media_assets
for update to authenticated
using (
  visibility = 'internal'
  and (
    (uploaded_by = (select auth.uid()) and app_private.current_app_role() is not null)
    or app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','sekretaris']::public.app_role[])
  )
)
with check (
  visibility = 'internal'
  and (
    uploaded_by = (select auth.uid())
    or app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','sekretaris']::public.app_role[])
  )
);

commit;
