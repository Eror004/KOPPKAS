-- KOPPKAS revision 012: index foreign-key columns for predictable joins and deletes.
begin;

create index if not exists activity_logs_actor_id_idx on public.activity_logs(actor_id);
create index if not exists announcements_created_by_idx on public.announcements(created_by);
create index if not exists event_committee_member_id_idx on public.event_committee(member_id);
create index if not exists event_ledger_entries_created_by_idx on public.event_ledger_entries(created_by);
create index if not exists event_ledger_entries_event_id_idx on public.event_ledger_entries(event_id);
create index if not exists event_surplus_transfers_approved_by_idx on public.event_surplus_transfers(approved_by);
create index if not exists events_approved_by_idx on public.events(approved_by);
create index if not exists events_cancelled_by_idx on public.events(cancelled_by);
create index if not exists events_created_by_idx on public.events(created_by);
create index if not exists events_final_report_approved_by_idx on public.events(final_report_approved_by);
create index if not exists general_ledger_entries_created_by_idx on public.general_ledger_entries(created_by);
create index if not exists inbox_replies_author_id_idx on public.inbox_replies(author_id);
create index if not exists inbox_replies_message_id_idx on public.inbox_replies(message_id);
create index if not exists media_assets_uploaded_by_idx on public.media_assets(uploaded_by);
create index if not exists members_created_by_idx on public.members(created_by);
create index if not exists monthly_dues_payments_recorded_by_idx on public.monthly_dues_payments(recorded_by);
create index if not exists official_letters_approved_by_idx on public.official_letters(approved_by);
create index if not exists official_letters_cancelled_by_idx on public.official_letters(cancelled_by);
create index if not exists official_letters_created_by_idx on public.official_letters(created_by);
create index if not exists organization_positions_member_id_idx on public.organization_positions(member_id);
create index if not exists public_messages_assigned_to_idx on public.public_messages(assigned_to);

commit;
