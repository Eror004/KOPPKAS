-- KOPPKAS revision 009: carry forward the closed October 2026 balance without double-counting income
begin;

create table public.general_ledger_opening_balances (
  id uuid primary key default gen_random_uuid(),
  as_of_date date not null unique,
  amount numeric(15,2) not null check (amount >= 0),
  source_description text not null,
  created_at timestamptz not null default now()
);

alter table public.general_ledger_opening_balances enable row level security;

create policy "opening_balance_read_finance_roles" on public.general_ledger_opening_balances
for select to authenticated
using (app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','bendahara']::public.app_role[]));

grant select on public.general_ledger_opening_balances to authenticated;

insert into public.general_ledger_opening_balances (as_of_date, amount, source_description)
values (
  date '2026-11-01',
  205000.00,
  'Saldo penutup BUKU BULAN OKTOBER 2026; menjadi saldo awal November 2026 dan bukan pemasukan baru.'
)
on conflict (as_of_date) do nothing;

create or replace view public.general_ledger_balance
with (security_invoker = true)
as
with opening as (
  select as_of_date, amount
  from public.general_ledger_opening_balances
  order by as_of_date desc
  limit 1
),
movement as (
  select coalesce(sum(
    case
      when direction in ('masuk','transfer_masuk') then amount
      else -amount
    end
  ), 0)::numeric(15,2) as net_amount
  from public.general_ledger_entries gle
  where gle.occurred_at >= (
    select (opening.as_of_date::timestamp at time zone 'Asia/Jakarta') from opening
  )
)
select (
  coalesce((select amount from opening), 0)
  + (select net_amount from movement)
)::numeric(15,2) as balance;

grant select on public.general_ledger_balance to authenticated;

commit;
