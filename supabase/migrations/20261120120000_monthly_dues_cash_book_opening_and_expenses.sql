-- KOPPKAS: immutable October 2026 cash opening balance and append-only monthly cash expenses.
-- Prepared on the isolated backend PR branch. Do not apply until migration history is reconciled.
begin;

create table public.monthly_dues_cash_opening_balances (
  dues_month date primary key check (extract(day from dues_month) = 1),
  amount numeric(15,2) not null check (amount >= 0),
  source_description text not null check (char_length(trim(source_description)) between 2 and 240),
  created_at timestamptz not null default now()
);

alter table public.monthly_dues_cash_opening_balances enable row level security;
create policy "monthly_dues_cash_opening_read_finance_roles"
on public.monthly_dues_cash_opening_balances
for select to authenticated
using (app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','bendahara']::public.app_role[]));
grant select on public.monthly_dues_cash_opening_balances to authenticated;

-- This is a historical opening record, not an iuran payment or a general-ledger entry.
insert into public.monthly_dues_cash_opening_balances (dues_month, amount, source_description)
values (
  date '2026-10-01',
  205000.00,
  'Saldo awal historis UANG KAS BULANAN Oktober 2026; dana organisasi yang telah tersedia sebelum KOPPKAS digunakan.'
)
on conflict (dues_month) do nothing;

create or replace function app_private.prevent_monthly_dues_cash_opening_mutation()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  raise exception 'Historical monthly dues cash opening balances are immutable'
    using errcode = '55000';
end;
$function$;

revoke all on function app_private.prevent_monthly_dues_cash_opening_mutation() from public, anon, authenticated;
create trigger monthly_dues_cash_opening_immutable
before update or delete on public.monthly_dues_cash_opening_balances
for each row execute function app_private.prevent_monthly_dues_cash_opening_mutation();

create table public.monthly_dues_cash_expenses (
  id uuid primary key default gen_random_uuid(),
  dues_month date not null check (extract(day from dues_month) = 1),
  amount numeric(15,2) not null check (amount > 0 and amount <= 9999999999999.99),
  description text not null check (char_length(trim(description)) between 2 and 240),
  spent_at timestamptz not null,
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now(),
  check (date_trunc('month', spent_at at time zone 'Asia/Jakarta')::date = dues_month)
);

create index monthly_dues_cash_expenses_period_idx
  on public.monthly_dues_cash_expenses (dues_month, spent_at desc, id);

alter table public.monthly_dues_cash_expenses enable row level security;
create policy "monthly_dues_cash_expenses_read_finance_roles"
on public.monthly_dues_cash_expenses
for select to authenticated
using (app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','bendahara']::public.app_role[]));
grant select on public.monthly_dues_cash_expenses to authenticated;
revoke insert, update, delete on public.monthly_dues_cash_expenses from anon, authenticated;

create or replace function app_private.prevent_monthly_dues_cash_expense_mutation()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  raise exception 'Monthly dues cash expense history is append-only'
    using errcode = '55000';
end;
$function$;

revoke all on function app_private.prevent_monthly_dues_cash_expense_mutation() from public, anon, authenticated;
create trigger monthly_dues_cash_expense_immutable
before update or delete on public.monthly_dues_cash_expenses
for each row execute function app_private.prevent_monthly_dues_cash_expense_mutation();

create or replace function public.record_monthly_dues_cash_expense(
  p_dues_month date,
  p_amount numeric,
  p_description text,
  p_spent_at timestamptz,
  p_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_expense_id uuid;
  v_existing public.monthly_dues_cash_expenses%rowtype;
  v_description text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not app_private.has_any_role(array[
    'ketua_pemuda','wakil_ketua_pemuda','bendahara'
  ]::public.app_role[]) then
    raise exception 'Not authorized to record monthly dues cash expenses' using errcode = '42501';
  end if;

  v_description := pg_catalog.btrim(p_description);
  if p_dues_month is null or extract(day from p_dues_month) <> 1
     or p_spent_at is null
     or pg_catalog.date_trunc('month', p_spent_at at time zone 'Asia/Jakarta')::date <> p_dues_month then
    raise exception 'Expense date must belong to the selected monthly book' using errcode = '22023';
  end if;

  if p_amount is null or p_amount <= 0 or p_amount > 9999999999999.99 then
    raise exception 'Expense amount must be positive and within supported range' using errcode = '22023';
  end if;

  if v_description is null or pg_catalog.char_length(v_description) not between 2 and 240 then
    raise exception 'Expense description must contain 2 to 240 characters' using errcode = '22023';
  end if;

  if p_idempotency_key is null then
    raise exception 'Idempotency key is required' using errcode = '22023';
  end if;

  select * into v_existing
  from public.monthly_dues_cash_expenses
  where idempotency_key = p_idempotency_key;

  if found then
    if v_existing.dues_month <> p_dues_month
       or v_existing.amount <> p_amount
       or v_existing.description <> v_description
       or v_existing.spent_at <> p_spent_at
       or v_existing.recorded_by <> auth.uid() then
      raise exception 'Idempotency key was already used with different expense data' using errcode = '22023';
    end if;
    return v_existing.id;
  end if;

  insert into public.monthly_dues_cash_expenses (
    dues_month, amount, description, spent_at, recorded_by, idempotency_key
  ) values (
    p_dues_month, p_amount, v_description, p_spent_at, auth.uid(), p_idempotency_key
  )
  on conflict (idempotency_key) do nothing
  returning id into v_expense_id;

  if v_expense_id is null then
    select * into v_existing
    from public.monthly_dues_cash_expenses
    where idempotency_key = p_idempotency_key;

    if not found
       or v_existing.dues_month <> p_dues_month
       or v_existing.amount <> p_amount
       or v_existing.description <> v_description
       or v_existing.spent_at <> p_spent_at
       or v_existing.recorded_by <> auth.uid() then
      raise exception 'Expense idempotency conflict could not be resolved' using errcode = '40001';
    end if;

    v_expense_id := v_existing.id;
  end if;

  return v_expense_id;
end;
$function$;

revoke all on function public.record_monthly_dues_cash_expense(date,numeric,text,timestamptz,uuid) from public, anon;
grant execute on function public.record_monthly_dues_cash_expense(date,numeric,text,timestamptz,uuid) to authenticated;

-- Month-specific cash position: October starts at the immutable Rp205,000 record.
-- Each later month carries forward the previous month's closing cash balance.
create or replace view public.monthly_dues_cash_book_summary
with (security_invoker = true)
as
with months as (
  select generate_series(
    date '2026-10-01',
    greatest(
      date_trunc('month', now() at time zone 'Asia/Jakarta')::date,
      coalesce((select max(dues_month) from public.monthly_dues), date '2026-10-01'),
      coalesce((select max(dues_month) from public.monthly_dues_cash_expenses), date '2026-10-01')
    ),
    interval '1 month'
  )::date as dues_month
),
income as (
  select md.dues_month, coalesce(sum(p.amount), 0)::numeric(15,2) as income_amount
  from public.monthly_dues md
  left join public.monthly_dues_payments p on p.monthly_dues_id = md.id
  group by md.dues_month
),
expenses as (
  select dues_month, coalesce(sum(amount), 0)::numeric(15,2) as expense_amount
  from public.monthly_dues_cash_expenses
  group by dues_month
),
periods as (
  select
    m.dues_month,
    coalesce(o.amount, 0)::numeric(15,2) as seeded_opening,
    coalesce(i.income_amount, 0)::numeric(15,2) as income_amount,
    coalesce(e.expense_amount, 0)::numeric(15,2) as expense_amount
  from months m
  left join public.monthly_dues_cash_opening_balances o on o.dues_month = m.dues_month
  left join income i on i.dues_month = m.dues_month
  left join expenses e on e.dues_month = m.dues_month
),
running as (
  select
    dues_month,
    (select coalesce(sum(amount), 0) from public.monthly_dues_cash_opening_balances
      where dues_month <= periods.dues_month)
      + coalesce(sum(income_amount - expense_amount) over (
          order by dues_month rows between unbounded preceding and 1 preceding
        ), 0)::numeric(15,2) as opening_balance,
    income_amount,
    expense_amount
  from periods
)
select
  dues_month,
  opening_balance::numeric(15,2) as opening_balance,
  income_amount,
  expense_amount,
  (opening_balance + income_amount - expense_amount)::numeric(15,2) as closing_balance
from running;

grant select on public.monthly_dues_cash_book_summary to authenticated;

create or replace view public.monthly_dues_cash_book_movements
with (security_invoker = true)
as
select
  'opening:' || o.dues_month::text as movement_key,
  null::uuid as transaction_id,
  o.dues_month,
  (o.dues_month::timestamp at time zone 'Asia/Jakarta') as occurred_at,
  'saldo_awal'::text as movement_type,
  'Saldo awal historis'::text as description,
  o.amount,
  null::uuid as recorded_by,
  'Saldo awal historis organisasi'::text as note,
  true as immutable
from public.monthly_dues_cash_opening_balances o

union all

select
  'payment:' || p.id::text,
  p.id,
  md.dues_month,
  p.paid_at,
  'pemasukan_iuran'::text,
  'Pembayaran uang kas bulanan'::text,
  p.amount,
  p.recorded_by,
  p.note,
  true
from public.monthly_dues_payments p
join public.monthly_dues md on md.id = p.monthly_dues_id

union all

select
  'expense:' || e.id::text,
  e.id,
  e.dues_month,
  e.spent_at,
  'pengeluaran'::text,
  e.description,
  e.amount,
  e.recorded_by,
  null::text,
  true
from public.monthly_dues_cash_expenses e;

grant select on public.monthly_dues_cash_book_movements to authenticated;

comment on table public.monthly_dues_cash_opening_balances is
  'Immutable historical opening cash balances for each monthly dues book. October 2026 is seeded at Rp205,000.';
comment on table public.monthly_dues_cash_expenses is
  'Append-only monthly dues cash expenses. Corrections require a separate compensating entry, never update or delete.';
comment on view public.monthly_dues_cash_book_summary is
  'Monthly cash summary with October 2026 historical opening balance, actual dues inflows, expenses, and carried-forward closing cash.';
comment on view public.monthly_dues_cash_book_movements is
  'Unified read-only movements for opening balance, dues payments, and recorded expenses.';

commit;
