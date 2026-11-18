-- KOPPKAS revision 029: align announcement and media RLS with role permissions.
begin;

drop policy if exists "announcements_manage_authenticated" on public.announcements;
drop policy if exists "media_manage_authenticated" on public.media_assets;

-- Announcement creation is available to Ketua, Wakil, Sekretaris, Ketua RW and Ketua RT.
create policy "announcements_insert_authorized_roles" on public.announcements
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and app_private.has_any_role(array[
    'ketua_pemuda','wakil_ketua_pemuda','sekretaris','ketua_rw_01','ketua_rt_01'
  ]::public.app_role[])
);

-- RW/RT manage their own announcements; core leadership and Sekretaris can
-- update organizational announcements across creators.
create policy "announcements_update_owners_and_core" on public.announcements
for update to authenticated
using (
  app_private.has_any_role(array[
    'ketua_pemuda','wakil_ketua_pemuda','sekretaris','ketua_rw_01','ketua_rt_01'
  ]::public.app_role[])
  and (
    created_by = (select auth.uid())
    or app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','sekretaris']::public.app_role[])
  )
)
with check (
  app_private.has_any_role(array[
    'ketua_pemuda','wakil_ketua_pemuda','sekretaris','ketua_rw_01','ketua_rt_01'
  ]::public.app_role[])
  and (
    created_by = (select auth.uid())
    or app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','sekretaris']::public.app_role[])
  )
);

-- Only Ketua Pemuda has delete permission for announcements.
create policy "announcements_delete_ketua" on public.announcements
for delete to authenticated
using (app_private.has_any_role(array['ketua_pemuda']::public.app_role[]));

create policy "media_insert_authorized_roles" on public.media_assets
for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and app_private.has_any_role(array[
    'ketua_pemuda','wakil_ketua_pemuda','sekretaris','ketua_rw_01','ketua_rt_01'
  ]::public.app_role[])
);

-- RW/RT can update their own media. Ketua, Wakil and Sekretaris can manage
-- organizational media across creators.
create policy "media_update_owners_and_core" on public.media_assets
for update to authenticated
using (
  app_private.has_any_role(array[
    'ketua_pemuda','wakil_ketua_pemuda','sekretaris','ketua_rw_01','ketua_rt_01'
  ]::public.app_role[])
  and (
    uploaded_by = (select auth.uid())
    or app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','sekretaris']::public.app_role[])
  )
)
with check (
  app_private.has_any_role(array[
    'ketua_pemuda','wakil_ketua_pemuda','sekretaris','ketua_rw_01','ketua_rt_01'
  ]::public.app_role[])
  and (
    uploaded_by = (select auth.uid())
    or app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','sekretaris']::public.app_role[])
  )
);

-- Media deletion is reserved for Ketua Pemuda.
create policy "media_delete_ketua" on public.media_assets
for delete to authenticated
using (app_private.has_any_role(array['ketua_pemuda']::public.app_role[]));

commit;
