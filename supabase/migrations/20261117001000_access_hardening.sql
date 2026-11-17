-- KOPPKAS revision 010: tighten exposed-table access and archive/approval invariants
begin;

-- Public schema tables remain protected even when no API grants are present.
alter table public.letter_year_sequences enable row level security;
revoke all on public.letter_year_sequences from anon, authenticated;

-- Member removal is a reasoned archive, never a silent hard delete.
alter table public.members add column archive_reason text;
alter table public.members
  add constraint members_archive_reason_required
  check (archived_at is null or nullif(trim(archive_reason), '') is not null);
drop policy if exists "members_delete_secretary" on public.members;
revoke delete on public.members from authenticated;

-- Only manual transactions can be inserted directly. Automated sources are trigger/RPC-owned.
alter table public.general_ledger_entries
  add constraint general_ledger_source_type_allowed
  check (source_type in ('manual', 'monthly_dues_payment', 'event_surplus_transfer'));

drop policy if exists "general_ledger_insert_finance_roles" on public.general_ledger_entries;
create policy "general_ledger_insert_manual_finance_roles" on public.general_ledger_entries
for insert to authenticated
with check (
  source_type = 'manual'
  and created_by = (select auth.uid())
  and app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','bendahara']::public.app_role[])
);

-- Announcements can be created by authorized dashboard roles, but only owners and
-- designated administrators can edit them. Publishing is a separate controlled action.
drop policy if exists "announcements_manage_authenticated" on public.announcements;
create policy "announcements_insert_active_roles" on public.announcements
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and app_private.current_app_role() is not null
  and is_published = false
);
create policy "announcements_update_owner_or_admin" on public.announcements
for update to authenticated
using (
  created_by = (select auth.uid())
  or app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','sekretaris']::public.app_role[])
)
with check (
  created_by = (select auth.uid())
  or app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','sekretaris']::public.app_role[])
);
create policy "announcements_delete_admin" on public.announcements
for delete to authenticated
using (app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','sekretaris']::public.app_role[]));

-- Media metadata follows ownership rules; actual Storage object policies are configured separately.
drop policy if exists "media_manage_authenticated" on public.media_assets;
create policy "media_insert_active_roles" on public.media_assets
for insert to authenticated
with check (uploaded_by = (select auth.uid()) and app_private.current_app_role() is not null);
create policy "media_update_owner_or_admin" on public.media_assets
for update to authenticated
using (
  uploaded_by = (select auth.uid())
  or app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','sekretaris']::public.app_role[])
)
with check (
  uploaded_by = (select auth.uid())
  or app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','sekretaris']::public.app_role[])
);
create policy "media_delete_admin" on public.media_assets
for delete to authenticated
using (app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','sekretaris']::public.app_role[]));

-- Notification recipients may only update their own read timestamp.
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

commit;
