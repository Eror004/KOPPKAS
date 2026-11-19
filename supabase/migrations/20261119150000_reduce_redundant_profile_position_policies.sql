-- Reduce redundant permissive SELECT/UPDATE policies without changing effective access.
begin;

-- The authenticated read policy already covers all active organization roles.
-- Keep Secretary write access, but avoid a FOR ALL policy that also grants SELECT.
drop policy if exists "positions_manage_secretary" on public.organization_positions;

create policy "positions_insert_secretary" on public.organization_positions
for insert to authenticated
with check (app_private.has_any_role(array['sekretaris']::public.app_role[]));

create policy "positions_update_secretary" on public.organization_positions
for update to authenticated
using (app_private.has_any_role(array['sekretaris']::public.app_role[]))
with check (app_private.has_any_role(array['sekretaris']::public.app_role[]));

create policy "positions_delete_secretary" on public.organization_positions
for delete to authenticated
using (app_private.has_any_role(array['sekretaris']::public.app_role[]));

-- Ketua/Wakil already receive full profile visibility through
-- profiles_read_self_or_leadership. Replace the FOR ALL manager policy with
-- command-specific write policies and combine self/manager UPDATE access.
drop policy if exists "profiles_manage_ketua" on public.profiles;
drop policy if exists "profiles_update_self_non_privileged" on public.profiles;

create policy "profiles_insert_ketua" on public.profiles
for insert to authenticated
with check (app_private.has_any_role(array['ketua_pemuda']::public.app_role[]));

create policy "profiles_update_self_or_ketua" on public.profiles
for update to authenticated
using (
  id = (select auth.uid())
  or app_private.has_any_role(array['ketua_pemuda']::public.app_role[])
)
with check (
  (
    id = (select auth.uid())
    and role is not distinct from app_private.current_app_role()
    and is_active = true
  )
  or app_private.has_any_role(array['ketua_pemuda']::public.app_role[])
);

create policy "profiles_delete_ketua" on public.profiles
for delete to authenticated
using (app_private.has_any_role(array['ketua_pemuda']::public.app_role[]));

commit;
