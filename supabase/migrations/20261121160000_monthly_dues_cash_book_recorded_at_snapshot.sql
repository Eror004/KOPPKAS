-- Add an immutable insertion-time column so paginated movement reads can pin a snapshot.
-- occurred_at remains the business event time and may be backdated for expenses.
begin;

create or replace view public.monthly_dues_cash_book_movements
with (security_invoker = true)
as
with all_movements as (
  select '0:opening:' || s.dues_month::text as movement_key, null::uuid as transaction_id,
    s.dues_month, (s.dues_month::timestamp at time zone 'Asia/Jakarta') as occurred_at,
    'saldo_awal'::text as movement_type, 'Saldo awal'::text as description,
    s.opening_balance as amount, null::uuid as recorded_by, null::text as note, true as immutable,
    coalesce(o.created_at, period.opened_at) as recorded_at
  from public.monthly_dues_cash_book_summary s
  join public.monthly_dues_periods period on period.dues_month = s.dues_month
  left join public.monthly_dues_cash_opening_balances o on o.dues_month = s.dues_month
  union all
  select '1:payment:' || p.id::text, p.id, md.dues_month, p.paid_at,
    'pemasukan_iuran'::text, coalesce(p.member_name_snapshot, 'Nama tidak tersimpan saat transaksi')::text,
    p.amount, p.recorded_by, p.note, true, p.created_at
  from public.monthly_dues_payments p
  join public.monthly_dues md on md.id = p.monthly_dues_id
  join public.monthly_dues_periods period on period.dues_month = md.dues_month
  union all
  select '2:expense:' || e.id::text, e.id, e.dues_month, e.spent_at,
    'pengeluaran'::text, e.description, e.amount, e.recorded_by, null::text, true, e.created_at
  from public.monthly_dues_cash_expenses e
  join public.monthly_dues_periods period on period.dues_month = e.dues_month
)
select * from all_movements
where (select app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','bendahara']::public.app_role[]));

revoke all on public.monthly_dues_cash_book_movements from public, anon;
grant select on public.monthly_dues_cash_book_movements to authenticated;

comment on view public.monthly_dues_cash_book_movements is
  'Finance-role-only immutable movement projection. recorded_at is the database insertion timestamp used as the stable pagination high-water mark; occurred_at remains the event timestamp and may be backdated.';

commit;
