-- Index unindexed event/profile foreign keys reported by Supabase Performance Advisor.
-- These indexes support joins and parent-row updates/deletes without changing RLS behavior.
begin;

create index if not exists event_financial_reports_submitted_by_idx
  on public.event_financial_reports (submitted_by);

create index if not exists events_committee_chair_profile_id_idx
  on public.events (committee_chair_profile_id);

create index if not exists events_final_report_by_idx
  on public.events (final_report_by);

create index if not exists events_financial_report_by_idx
  on public.events (financial_report_by);

commit;
