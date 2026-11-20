-- KOPPKAS: explicitly opened monthly dues periods with a continuously carried cash balance.
-- October 2026 is the first period. Future periods exist only after an authorized
-- officer explicitly opens the immediately following month.
begin;

create table public.monthly_dues_periods (
  dues_month date primary key check (extract(day from dues_month) = 1),
  opened_at timestamptz not null default now(),
  opened_by uuid references public.profiles(id) on delete restrict
);

alter table public.monthly_dues_periods enable row level security;
create policy "monthly_dues_periods_read_finance_roles"
on public.monthly_dues_periods for select to authenticated
using (app_private.has_any_role(array[
  'ketua_pemuda','wakil_ketua_pemuda','bendahara','sekretaris'
]::public.app_role[]));
grant select on public.monthly_dues_periods to authenticated;

-- The first book is seeded exactly once. This does not create an iuran payment
-- and does not post a second entry to the general KEUANGAN ledger.
insert into public.monthly_dues_periods (dues_month, opened_by)
values (date '2026-10-01', null)
on conflict (dues_month) do nothing;

create or replace function public.open_monthly_dues_period(p_dues_month date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_latest_month date;
  v_previous_closing numeric(15,2);
  v_register_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not app_private.has_any_role(array[
    'ketua_pemuda','wakil_ketua_pemuda','bendahara'
  ]::public.app_role[]) then
    raise exception 'Not authorized to open a monthly dues period' using errcode = '42501';
  end if;
  if p_dues_month is null or extract(day from p_dues_month) <> 1 then
    raise exception 'Period must be the first day of a month' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('koppkas-monthly-dues-period-open', 0)
  );

  select max(dues_month) into v_latest_month
  from public.monthly_dues_periods;

  if exists (
    select 1 from public.monthly_dues_periods where dues_month = p_dues_month
  ) then
    raise exception 'This monthly dues period is already open' using errcode = '23505';
  end if;

  if v_latest_month is null or p_dues_month <> (v_latest_month + interval '1 month')::date then
    raise exception 'Only the month immediately following the latest opened period can be opened' using errcode = '22023';
  end if;

  select closing_balance into v_previous_closing
  from public.monthly_dues_cash_book_summary
  where dues_month = v_latest_month;

  if v_previous_closing is null then
    raise exception 'Previous period cash balance is unavailable' using errcode = 'P0002';
  end if;

  insert into public.monthly_dues_periods (dues_month, opened_by)
  values (p_dues_month, auth.uid());

  insert into public.monthly_dues (member_id, dues_month, reference_amount)
  select m.id, p_dues_month, 10000
  from public.members m
  where m.archived_at is null
  on conflict (member_id, dues_month) do nothing;

  get diagnostics v_register_count = row_count;

  return jsonb_build_object(
    'dues_month', p_dues_month,
    'opening_balance', v_previous_closing,
    'register_count', v_register_count
  );
end;
$function$;

revoke all on function public.open_monthly_dues_period(date) from public, anon;
grant execute on function public.open_monthly_dues_period(date) to authenticated;

-- Register creation is only permitted for an explicitly opened period.
create or replace function public.ensure_monthly_dues_for_member(
  p_member_id uuid,
  p_dues_month date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare v_dues_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not app_private.has_any_role(array[
    'ketua_pemuda','wakil_ketua_pemuda','bendahara','sekretaris'
  ]::public.app_role[]) then
    raise exception 'Not authorized to prepare a monthly dues register' using errcode = '42501';
  end if;
  if p_member_id is null or p_dues_month is null
     or extract(day from p_dues_month) <> 1 then
    raise exception 'A member and first day of a month are required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.monthly_dues_periods where dues_month = p_dues_month) then
    raise exception 'Monthly dues period has not been opened' using errcode = '22023';
  end if;
  if not exists (select 1 from public.members where id = p_member_id and archived_at is null) then
    raise exception 'Active member not found' using errcode = 'P0002';
  end if;

  insert into public.monthly_dues (member_id, dues_month, reference_amount)
  values (p_member_id, p_dues_month, 10000)
  on conflict (member_id, dues_month) do nothing
  returning id into v_dues_id;

  if v_dues_id is null then
    select id into v_dues_id from public.monthly_dues
    where member_id = p_member_id and dues_month = p_dues_month;
  end if;
  return v_dues_id;
end;
$function$;

revoke all on function public.ensure_monthly_dues_for_member(uuid, date) from public, anon;
grant execute on function public.ensure_monthly_dues_for_member(uuid, date) to authenticated;

-- New member creation from the dues workflow is also period-gated and atomic.
create or replace function public.create_member_and_monthly_dues_safe(
  p_full_name text,
  p_dues_month date,
  p_confirm_same_name boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_member_id uuid;
  v_dues_id uuid;
  v_matches jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not app_private.has_any_role(array[
    'ketua_pemuda','wakil_ketua_pemuda','bendahara','sekretaris'
  ]::public.app_role[]) then
    raise exception 'Not authorized to add a member from monthly dues' using errcode = '42501';
  end if;
  if p_full_name is null or char_length(trim(p_full_name)) not between 2 and 120 then
    raise exception 'Name must contain 2 to 120 characters' using errcode = '22023';
  end if;
  if p_dues_month is null or extract(day from p_dues_month) <> 1
     or not exists (select 1 from public.monthly_dues_periods where dues_month = p_dues_month) then
    raise exception 'Monthly dues period has not been opened' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(pg_catalog.lower(pg_catalog.btrim(p_full_name)), 0)
  );

  select coalesce(jsonb_agg(
    jsonb_build_object('id', candidate.id, 'full_name', candidate.full_name)
    order by candidate.full_name, candidate.id
  ), '[]'::jsonb)
  into v_matches
  from (
    select id, full_name from public.members
    where archived_at is null
      and pg_catalog.lower(pg_catalog.btrim(full_name)) = pg_catalog.lower(pg_catalog.btrim(p_full_name))
    order by id
  ) candidate;

  if jsonb_array_length(v_matches) > 0 and not coalesce(p_confirm_same_name, false) then
    return jsonb_build_object('status', 'duplicate_candidates', 'matches', v_matches);
  end if;

  insert into public.members (full_name, gender, created_by)
  values (pg_catalog.btrim(p_full_name), null, auth.uid())
  returning id into v_member_id;

  insert into public.monthly_dues (member_id, dues_month, reference_amount)
  values (v_member_id, p_dues_month, 10000)
  returning id into v_dues_id;

  return jsonb_build_object(
    'status', 'created',
    'member_id', v_member_id,
    'monthly_dues_id', v_dues_id,
    'full_name', pg_catalog.btrim(p_full_name)
  );
end;
$function$;

revoke all on function public.create_member_and_monthly_dues_safe(text, date, boolean) from public, anon;
grant execute on function public.create_member_and_monthly_dues_safe(text, date, boolean) to authenticated;

-- Payments cannot be written to a month that has not been opened.
create or replace function public.record_monthly_dues_payment(
  p_monthly_dues_id uuid,
  p_amount numeric,
  p_idempotency_key uuid,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_payment_id uuid;
  v_existing public.monthly_dues_payments%rowtype;
  v_month date;
  v_note text := nullif(pg_catalog.btrim(p_note), '');
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not app_private.has_any_role(array[
    'ketua_pemuda','wakil_ketua_pemuda','bendahara','sekretaris'
  ]::public.app_role[]) then
    raise exception 'Not authorized to record monthly dues' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 9999999999999.99 then
    raise exception 'Payment amount must be positive and within supported range' using errcode = '22023';
  end if;
  if p_idempotency_key is null or pg_catalog.char_length(coalesce(v_note, '')) > 500 then
    raise exception 'Payment idempotency key or note is invalid' using errcode = '22023';
  end if;

  select md.dues_month into v_month
  from public.monthly_dues md
  where md.id = p_monthly_dues_id;

  if v_month is null then
    raise exception 'Monthly dues record not found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.monthly_dues_periods where dues_month = v_month) then
    raise exception 'Monthly dues period has not been opened' using errcode = '22023';
  end if;

  select * into v_existing from public.monthly_dues_payments
  where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.recorded_by is distinct from auth.uid()
       or v_existing.monthly_dues_id <> p_monthly_dues_id
       or v_existing.amount <> p_amount
       or coalesce(v_existing.note, '') <> coalesce(v_note, '') then
      raise exception 'Idempotency key was already used with different payment data' using errcode = '22023';
    end if;
    return v_existing.id;
  end if;

  insert into public.monthly_dues_payments (
    monthly_dues_id, amount, recorded_by, note, idempotency_key
  ) values (
    p_monthly_dues_id, p_amount, auth.uid(), v_note, p_idempotency_key
  )
  on conflict (idempotency_key) do nothing
  returning id into v_payment_id;

  if v_payment_id is null then
    select * into v_existing from public.monthly_dues_payments
    where idempotency_key = p_idempotency_key;
    if not found
       or v_existing.recorded_by is distinct from auth.uid()
       or v_existing.monthly_dues_id <> p_monthly_dues_id
       or v_existing.amount <> p_amount
       or coalesce(v_existing.note, '') <> coalesce(v_note, '') then
      raise exception 'Payment idempotency conflict could not be resolved' using errcode = '40001';
    end if;
    v_payment_id := v_existing.id;
  end if;
  return v_payment_id;
end;
$function$;

revoke all on function public.record_monthly_dues_payment(uuid,numeric,uuid,text) from public, anon;
grant execute on function public.record_monthly_dues_payment(uuid,numeric,uuid,text) to authenticated;

-- Prevent expense records from being inserted into a month that was never opened.
create or replace function app_private.require_open_monthly_dues_period_for_expense()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if not exists (
    select 1 from public.monthly_dues_periods
    where dues_month = new.dues_month
  ) then
    raise exception 'Monthly dues period has not been opened' using errcode = '22023';
  end if;
  return new;
end;
$function$;

revoke all on function app_private.require_open_monthly_dues_period_for_expense() from public, anon, authenticated;
create trigger monthly_dues_cash_expense_requires_open_period
before insert on public.monthly_dues_cash_expenses
for each row execute function app_private.require_open_monthly_dues_period_for_expense();

-- Only explicitly opened periods appear. Each opening is derived from the previous
-- period's closing cash position, so later historical corrections remain consistent.
create or replace view public.monthly_dues_cash_book_summary
with (security_invoker = true)
as
with period_movements as (
  select
    p.dues_month,
    case when p.dues_month = date '2026-10-01'
      then coalesce((select amount from public.monthly_dues_cash_opening_balances
        where dues_month = date '2026-10-01'), 0)
      else 0 end::numeric(15,2) as seed_amount,
    coalesce(i.income_amount, 0)::numeric(15,2) as income_amount,
    coalesce(e.expense_amount, 0)::numeric(15,2) as expense_amount
  from public.monthly_dues_periods p
  left join (
    select md.dues_month, sum(pay.amount)::numeric(15,2) as income_amount
    from public.monthly_dues md
    join public.monthly_dues_periods opened on opened.dues_month = md.dues_month
    join public.monthly_dues_payments pay on pay.monthly_dues_id = md.id
    group by md.dues_month
  ) i on i.dues_month = p.dues_month
  left join (
    select ex.dues_month, sum(ex.amount)::numeric(15,2) as expense_amount
    from public.monthly_dues_cash_expenses ex
    join public.monthly_dues_periods opened on opened.dues_month = ex.dues_month
    group by ex.dues_month
  ) e on e.dues_month = p.dues_month
),
running as (
  select
    dues_month,
    (select coalesce(sum(seed_amount), 0) from period_movements) as total_seed,
    coalesce(sum(income_amount - expense_amount) over (
      order by dues_month rows between unbounded preceding and 1 preceding
    ), 0)::numeric(15,2) as prior_net,
    income_amount,
    expense_amount,
    (select coalesce(sum(seed_amount), 0) from period_movements)
      + coalesce(sum(income_amount - expense_amount) over (
          order by dues_month rows between unbounded preceding and current row
        ), 0)::numeric(15,2) as closing_balance
  from period_movements
)
select
  dues_month,
  (total_seed + prior_net)::numeric(15,2) as opening_balance,
  income_amount,
  expense_amount,
  closing_balance
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
join public.monthly_dues_periods period on period.dues_month = o.dues_month

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
join public.monthly_dues_periods period on period.dues_month = md.dues_month

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
from public.monthly_dues_cash_expenses e
join public.monthly_dues_periods period on period.dues_month = e.dues_month;

grant select on public.monthly_dues_cash_book_movements to authenticated;

comment on table public.monthly_dues_periods is
  'A month appears in UANG KAS BULANAN only after an authorized officer explicitly opens it. October 2026 is the seeded first period.';
comment on function public.open_monthly_dues_period(date) is
  'Explicitly opens only the month immediately following the latest opened period and creates that period register for all active members.';
comment on view public.monthly_dues_cash_book_summary is
  'Shows explicitly opened periods only; opening balance is the prior opened period closing balance, with October 2026 seeded at Rp205,000.';

commit;
