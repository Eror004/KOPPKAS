-- KOPPKAS revision 030: remove superseded permissive RLS policies.
-- PostgreSQL permissive policies are OR-combined. Leaving the older broad
-- policies in place would silently widen access beyond revision 029.
begin;

-- Announcement policies: keep only the role-scoped policies from revision 029.
drop policy if exists "announcements_insert_active_roles" on public.announcements;
drop policy if exists "announcements_update_owner_or_admin" on public.announcements;
drop policy if exists "announcements_delete_admin" on public.announcements;

-- Media policies: keep only the role-scoped policies from revision 029.
drop policy if exists "media_insert_active_roles" on public.media_assets;
drop policy if exists "media_update_owner_or_admin" on public.media_assets;
drop policy if exists "media_delete_admin" on public.media_assets;

commit;
