-- KOPPKAS: dues-only period aggregates for the four monthly-dues operating roles.
-- SECURITY INVOKER preserves the underlying period, register, and payment RLS.
begin;

create or replace view public.monthly_dues_period_totals
with (security_invoker = true)
as
with period_totals as (
  select
    dues_month,
    count(*)::integer as member_count,
    count(*) filter (where payment_status = 'lunas')::integer as paid_member_count,
    count(*) filter (where payment_status = 'belum_bayar')::integer as unpaid_member_count,
    coalesce(sum(paid_amount), 0)::numeric(15,2) as total_paid_amount,
    coalesce(sum(reference_amount), 0)::numeric(15,2) as total_reference_amount,
    coalesce(sum(remaining_amount), 0)::numeric(15,2) as total_remaining_amount
  from public.monthly_dues_summary
  group by dues_month
)
select
  p.dues_month,
  p.status,
  p.data_status,
  case when p.data_status = 'historical_empty' then null
       else coalesce(t.member_count, 0) end::integer as member_count,
  case when p.data_status = 'historical_empty' then null
       else coalesce(t.paid_member_count, 0) end::integer as paid_member_count,
  case when p.data_status = 'historical_empty' then null
       else coalesce(t.unpaid_member_count, 0) end::integer as unpaid_member_count,
  case when p.data_status = 'historical_empty' then null
       else coalesce(t.total_paid_amount, 0) end::numeric(15,2) as total_paid_amount,
  case when p.data_status = 'historical_empty' then null
       else coalesce(t.total_reference_amount, 0) end::numeric(15,2) as total_reference_amount,
  case when p.data_status = 'historical_empty' then null
       else coalesce(t.total_remaining_amount, 0) end::numeric(15,2) as total_remaining_amount
from public.monthly_dues_periods p
left join period_totals t on t.dues_month = p.dues_month
where app_private.has_any_role(array[
  'ketua_pemuda','wakil_ketua_pemuda','bendahara','sekretaris'
]::public.app_role[]);

revoke all on public.monthly_dues_period_totals from public, anon;
grant select on public.monthly_dues_period_totals to authenticated;

comment on view public.monthly_dues_period_totals is
  'Dues-only aggregate for Ketua Pemuda, Wakil Ketua Pemuda, Bendahara, and Sekretaris. SECURITY INVOKER preserves source RLS. Available empty books return zero totals; historical_empty books return NULL metrics. This is not the cash-book balance.';

commit;
