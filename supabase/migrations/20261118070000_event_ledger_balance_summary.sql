-- KOPPKAS revision 015: provide an all-time event ledger aggregate for dashboards.
begin;

create or replace view public.event_ledger_balance_summary
with (security_invoker = true)
as
select
  coalesce(sum(case when direction = 'masuk' then amount else 0 end), 0)::numeric(15,2) as total_in,
  coalesce(sum(case when direction = 'keluar' then amount else 0 end), 0)::numeric(15,2) as total_out,
  coalesce(sum(case when direction = 'masuk' then amount else -amount end), 0)::numeric(15,2) as net_balance,
  count(*)::bigint as transaction_count
from public.event_ledger_entries;

grant select on public.event_ledger_balance_summary to authenticated;

commit;
