-- KOPPKAS: Jakarta monthly lifecycle, strict write boundary, idempotent retry,
-- and immutable transaction-time receipt identity snapshots. Review-only migration.
begin;

alter table public.monthly_dues_payments
  add column member_name_snapshot text,
  add column recorder_name_snapshot text;

comment on column public.monthly_dues_payments.member_name_snapshot is
  'Member name captured when the payment is recorded; NULL for legacy rows without a historical snapshot.';
comment on column public.monthly_dues_payments.recorder_name_snapshot is
  'Recorder name captured when the payment is recorded; NULL for legacy rows without a historical snapshot.';

alter table public.monthly_dues_periods
  add column status text not null default 'closed',
  add column data_status text not null default 'available',
  add column opened_effective_at timestamptz,
  add column opened_processed_at timestamptz,
  add column closed_effective_at timestamptz,
  add column closed_processed_at timestamptz,
  add constraint monthly_dues_periods_status_check check (status in ('active','closed')),
  add constraint monthly_dues_periods_data_status_check check (data_status in ('available','historical_empty')),
  add constraint monthly_dues_periods_closure_pair_check
    check ((closed_effective_at is null) = (closed_processed_at is null));

do $migration$
declare
  v_now timestamptz := clock_timestamp();
  v_month date := pg_catalog.date_trunc('month', v_now at time zone 'Asia/Jakarta')::date;
begin
  if exists (select 1 from public.monthly_dues_periods where dues_month > v_month) then
    raise exception 'A future monthly dues period exists; lifecycle migration requires owner review'
      using errcode = '55000';
  end if;
  update public.monthly_dues_periods p
  set status = case when p.dues_month = v_month then 'active' else 'closed' end,
      data_status = 'available',
      opened_effective_at = p.dues_month::timestamp at time zone 'Asia/Jakarta',
      opened_processed_at = p.opened_at,
      closed_effective_at = case when p.dues_month < v_month
        then (p.dues_month + interval '1 month')::date::timestamp at time zone 'Asia/Jakarta' end,
      closed_processed_at = case when p.dues_month < v_month then v_now end;
end;
$migration$;

alter table public.monthly_dues_periods
  alter column opened_effective_at set not null,
  alter column opened_processed_at set not null;

create unique index monthly_dues_periods_one_active_idx
  on public.monthly_dues_periods(status) where status = 'active';

-- Fast path does not serialize ordinary requests. If the current month is absent,
-- the advisory lock serializes creation/rollover and the clock is recaptured after it.
create or replace function app_private.ensure_current_monthly_dues_period()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_now timestamptz;
  v_month date;
  v_latest date;
  v_loop_month date;
  v_period public.monthly_dues_periods%rowtype;
begin
  v_now := clock_timestamp();
  v_month := pg_catalog.date_trunc('month', v_now at time zone 'Asia/Jakarta')::date;
  select * into v_period from public.monthly_dues_periods
  where dues_month = v_month and status = 'active';
  if found then
    return jsonb_build_object('dues_month', v_month, 'status', v_period.status,
      'data_status', v_period.data_status, 'processed_at', v_now);
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('koppkas-monthly-dues-period-lifecycle', 0)
  );
  -- A current active period is the common fast path. No lifecycle lock is
  -- needed until a rollover is actually due.
  v_now := clock_timestamp();
  v_month := pg_catalog.date_trunc('month', v_now at time zone 'Asia/Jakarta')::date;
  select * into v_period from public.monthly_dues_periods
  where dues_month = v_month and status = 'active';
  if found then
    return jsonb_build_object('dues_month', v_month, 'status', v_period.status,
      'data_status', v_period.data_status, 'processed_at', v_now);
  end if;

  -- Lock every active period before capturing the effective processing time.
  -- This waits for in-flight FOR SHARE writers; the timestamp below is therefore
  -- after the last old-period writer has committed, not before the wait.
  perform p.dues_month
  from public.monthly_dues_periods p
  where p.status = 'active'
  order by p.dues_month
  for update;

  v_now := clock_timestamp();
  v_month := pg_catalog.date_trunc('month', v_now at time zone 'Asia/Jakarta')::date;

  select max(dues_month) into v_latest from public.monthly_dues_periods;
  if v_latest is null then
    raise exception 'Monthly dues period baseline is unavailable' using errcode = 'P0002';
  end if;
  if v_latest > v_month then
    raise exception 'Latest monthly dues period is later than the Jakarta current month'
      using errcode = '55000';
  end if;

  -- UPDATE takes FOR UPDATE semantics and waits for any payment/expense holding
  -- FOR SHARE. The effective close is calendar-derived; processing time is actual.
  update public.monthly_dues_periods p
  set status = 'closed',
      closed_effective_at = (p.dues_month + interval '1 month')::date::timestamp at time zone 'Asia/Jakarta',
      closed_processed_at = v_now
  where p.status = 'active' and p.dues_month < v_month;

  if v_latest < v_month then
    for v_loop_month in
      select series_month::date
      from pg_catalog.generate_series(
        (v_latest + interval '1 month')::date::timestamp,
        v_month::timestamp, interval '1 month'
      ) as series(series_month)
    loop
      insert into public.monthly_dues_periods (
        dues_month, opened_at, opened_by, status, data_status,
        opened_effective_at, opened_processed_at, closed_effective_at, closed_processed_at
      ) values (
        v_loop_month, v_now,
        case when v_loop_month = v_month then auth.uid() end,
        case when v_loop_month = v_month then 'active' else 'closed' end,
        case when v_loop_month = v_month
          or exists (
            select 1 from public.monthly_dues md
            join public.monthly_dues_payments pay on pay.monthly_dues_id = md.id
            where md.dues_month = v_loop_month
          )
          or exists (select 1 from public.monthly_dues_cash_expenses ex where ex.dues_month = v_loop_month)
          then 'available' else 'historical_empty' end,
        v_loop_month::timestamp at time zone 'Asia/Jakarta',
        v_now,
        case when v_loop_month < v_month
          then (v_loop_month + interval '1 month')::date::timestamp at time zone 'Asia/Jakarta' end,
        case when v_loop_month < v_month then v_now end
      ) on conflict (dues_month) do nothing;
    end loop;
  end if;

  select * into v_period from public.monthly_dues_periods where dues_month = v_month;
  if not found or v_period.status <> 'active' then
    raise exception 'Current period is not active and will not be reopened automatically'
      using errcode = '55000';
  end if;
  return jsonb_build_object('dues_month', v_month, 'status', v_period.status,
    'data_status', v_period.data_status, 'processed_at', v_now);
end;
$function$;
revoke all on function app_private.ensure_current_monthly_dues_period() from public, anon, authenticated;

-- Shared lock + timestamp after lock is the authoritative write admission check.
create or replace function app_private.lock_current_monthly_dues_period(p_month date)
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_status text;
begin
  -- Lock first, capture server time only after the lock has been acquired.
  select status into v_status
  from public.monthly_dues_periods where dues_month = p_month for share;
  if not found then
    raise exception 'Monthly dues period is unavailable' using errcode = 'P0002';
  end if;
  return clock_timestamp();
end;
$function$;
revoke all on function app_private.lock_current_monthly_dues_period(date) from public, anon, authenticated;

create or replace function app_private.assert_current_monthly_dues_period(
  p_month date, p_validated_at timestamptz
)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_status text;
  v_start timestamptz;
  v_current date;
begin
  select status, opened_effective_at into v_status, v_start
  from public.monthly_dues_periods where dues_month = p_month;
  v_current := pg_catalog.date_trunc('month', p_validated_at at time zone 'Asia/Jakarta')::date;
  if not found or v_status <> 'active' or p_month <> v_current or p_validated_at < v_start
     or p_validated_at >= (p_month + interval '1 month')::date::timestamp at time zone 'Asia/Jakarta' then
    raise exception 'This monthly dues period is closed; new transactions are only allowed in the current Jakarta month'
      using errcode = '55000';
  end if;
end;
$function$;
revoke all on function app_private.assert_current_monthly_dues_period(date,timestamptz) from public, anon, authenticated;

-- Page synchronization creates the current period and current-member registers only
-- after acquiring the shared period lock, so it cannot seed a month after its close.
create or replace function app_private.prepare_current_monthly_dues_period()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_result jsonb;
  v_month date;
  v_validated_at timestamptz;
  v_count integer := 0;
begin
  v_result := app_private.ensure_current_monthly_dues_period();
  v_month := (v_result ->> 'dues_month')::date;
  v_validated_at := app_private.lock_current_monthly_dues_period(v_month);
  perform app_private.assert_current_monthly_dues_period(v_month, v_validated_at);
  insert into public.monthly_dues(member_id, dues_month, reference_amount)
  select m.id, v_month, 10000 from public.members m where m.archived_at is null
  on conflict (member_id, dues_month) do nothing;
  get diagnostics v_count = row_count;
  return v_result || jsonb_build_object('register_count', v_count, 'validated_at', v_validated_at);
end;
$function$;
revoke all on function app_private.prepare_current_monthly_dues_period() from public, anon, authenticated;

create or replace function public.sync_monthly_dues_period_lifecycle()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if not app_private.has_any_role(array[
    'ketua_pemuda','wakil_ketua_pemuda','bendahara','sekretaris'
  ]::public.app_role[]) then
    raise exception 'Not authorized to access monthly dues' using errcode = '42501';
  end if;
  return app_private.prepare_current_monthly_dues_period();
end;
$function$;
revoke all on function public.sync_monthly_dues_period_lifecycle() from public, anon;
grant execute on function public.sync_monthly_dues_period_lifecycle() to authenticated;

-- Preserve the old RPC signature for the frontend, but no future or historical
-- period can be opened manually. Only the Jakarta current month is activated.
create or replace function public.open_monthly_dues_period(p_dues_month date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
  v_month date;
  v_opening numeric(15,2);
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if not app_private.has_any_role(array[
    'ketua_pemuda','wakil_ketua_pemuda','bendahara'
  ]::public.app_role[]) then
    raise exception 'Not authorized to open a monthly dues period' using errcode = '42501';
  end if;
  if p_dues_month is null or extract(day from p_dues_month) <> 1 then
    raise exception 'Period must be the first day of a month' using errcode = '22023';
  end if;
  v_result := app_private.prepare_current_monthly_dues_period();
  v_month := (v_result ->> 'dues_month')::date;
  if p_dues_month <> v_month then
    raise exception 'Only the current Asia/Jakarta month can be activated; historical books remain closed'
      using errcode = '55000';
  end if;
  select opening_balance into v_opening from public.monthly_dues_cash_book_summary
  where dues_month = v_month;
  return v_result || jsonb_build_object('opening_balance', v_opening);
end;
$function$;
revoke all on function public.open_monthly_dues_period(date) from public, anon;
grant execute on function public.open_monthly_dues_period(date) to authenticated;

create or replace function public.ensure_monthly_dues_for_member(p_member_id uuid, p_dues_month date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare v_id uuid; v_validated_at timestamptz;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if not app_private.has_any_role(array[
    'ketua_pemuda','wakil_ketua_pemuda','bendahara','sekretaris'
  ]::public.app_role[]) then
    raise exception 'Not authorized to prepare a monthly dues register' using errcode = '42501';
  end if;
  if p_member_id is null or p_dues_month is null or extract(day from p_dues_month) <> 1 then
    raise exception 'A member and first day of a month are required' using errcode = '22023';
  end if;
  perform app_private.ensure_current_monthly_dues_period();
  v_validated_at := app_private.lock_current_monthly_dues_period(p_dues_month);
  perform app_private.assert_current_monthly_dues_period(p_dues_month, v_validated_at);
  if not exists (select 1 from public.members where id = p_member_id and archived_at is null) then
    raise exception 'Active member not found' using errcode = 'P0002';
  end if;
  insert into public.monthly_dues(member_id, dues_month, reference_amount)
  values (p_member_id, p_dues_month, 10000)
  on conflict (member_id, dues_month) do nothing returning id into v_id;
  if v_id is null then
    select id into v_id from public.monthly_dues where member_id = p_member_id and dues_month = p_dues_month;
  end if;
  return v_id;
end;
$function$;
revoke all on function public.ensure_monthly_dues_for_member(uuid,date) from public, anon;
grant execute on function public.ensure_monthly_dues_for_member(uuid,date) to authenticated;

create or replace function public.create_member_and_monthly_dues_safe(
  p_full_name text, p_dues_month date, p_confirm_same_name boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_member uuid;
  v_dues uuid;
  v_matches jsonb;
  v_validated_at timestamptz;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if not app_private.has_any_role(array[
    'ketua_pemuda','wakil_ketua_pemuda','bendahara','sekretaris'
  ]::public.app_role[]) then
    raise exception 'Not authorized to add a member from monthly dues' using errcode = '42501';
  end if;
  if p_full_name is null or char_length(trim(p_full_name)) not between 2 and 120
     or p_dues_month is null or extract(day from p_dues_month) <> 1 then
    raise exception 'Name or period is invalid' using errcode = '22023';
  end if;
  perform app_private.ensure_current_monthly_dues_period();
  v_validated_at := app_private.lock_current_monthly_dues_period(p_dues_month);
  perform app_private.assert_current_monthly_dues_period(p_dues_month, v_validated_at);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(pg_catalog.lower(pg_catalog.btrim(p_full_name)), 0)
  );
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'full_name', c.full_name)
    order by c.full_name, c.id), '[]'::jsonb)
  into v_matches
  from (select id, full_name from public.members
    where archived_at is null
      and pg_catalog.lower(pg_catalog.btrim(full_name)) = pg_catalog.lower(pg_catalog.btrim(p_full_name))
    order by id) c;
  if jsonb_array_length(v_matches) > 0 and not coalesce(p_confirm_same_name, false) then
    return jsonb_build_object('status', 'duplicate_candidates', 'matches', v_matches);
  end if;
  insert into public.members(full_name, gender, created_by)
  values (pg_catalog.btrim(p_full_name), null, auth.uid()) returning id into v_member;
  insert into public.monthly_dues(member_id, dues_month, reference_amount)
  values (v_member, p_dues_month, 10000) returning id into v_dues;
  return jsonb_build_object('status', 'created', 'member_id', v_member,
    'monthly_dues_id', v_dues, 'full_name', pg_catalog.btrim(p_full_name));
end;
$function$;
revoke all on function public.create_member_and_monthly_dues_safe(text,date,boolean) from public, anon;
grant execute on function public.create_member_and_monthly_dues_safe(text,date,boolean) to authenticated;

-- A committed retry is reconciled before the month gate. New payments lock the
-- period FOR SHARE, then capture clock_timestamp(); rollover waits FOR UPDATE.
create or replace function public.record_monthly_dues_payment(
  p_monthly_dues_id uuid, p_amount numeric, p_idempotency_key uuid, p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_id uuid;
  v_existing public.monthly_dues_payments%rowtype;
  v_month date;
  v_validated_at timestamptz;
  v_note text := nullif(pg_catalog.btrim(p_note), '');
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if not app_private.has_any_role(array[
    'ketua_pemuda','wakil_ketua_pemuda','bendahara','sekretaris'
  ]::public.app_role[]) then
    raise exception 'Not authorized to record monthly dues' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 9999999999999.99 then
    raise exception 'Payment amount must be positive and within supported range' using errcode = '22023';
  end if;
  if p_monthly_dues_id is null or p_idempotency_key is null
     or pg_catalog.char_length(coalesce(v_note,'')) > 500 then
    raise exception 'Payment register, idempotency key, or note is invalid' using errcode = '22023';
  end if;

  select * into v_existing from public.monthly_dues_payments where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.recorded_by is distinct from auth.uid()
       or v_existing.monthly_dues_id <> p_monthly_dues_id
       or v_existing.amount <> p_amount
       or coalesce(v_existing.note,'') <> coalesce(v_note,'') then
      raise exception 'Idempotency key was already used with different payment data' using errcode = '22023';
    end if;
    return v_existing.id;
  end if;

  select dues_month into v_month from public.monthly_dues where id = p_monthly_dues_id;
  if v_month is null then raise exception 'Monthly dues record not found' using errcode = 'P0002'; end if;
  perform app_private.ensure_current_monthly_dues_period();
  v_validated_at := app_private.lock_current_monthly_dues_period(v_month);

  select * into v_existing from public.monthly_dues_payments where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.recorded_by is distinct from auth.uid()
       or v_existing.monthly_dues_id <> p_monthly_dues_id
       or v_existing.amount <> p_amount
       or coalesce(v_existing.note,'') <> coalesce(v_note,'') then
      raise exception 'Idempotency key was already used with different payment data' using errcode = '22023';
    end if;
    return v_existing.id;
  end if;
  perform app_private.assert_current_monthly_dues_period(v_month, v_validated_at);

  insert into public.monthly_dues_payments (
    monthly_dues_id, amount, paid_at, recorded_by, note, idempotency_key,
    member_name_snapshot, recorder_name_snapshot
  )
  select md.id, p_amount, v_validated_at, auth.uid(), v_note, p_idempotency_key,
    m.full_name, profile.full_name
  from public.monthly_dues md
  join public.members m on m.id = md.member_id
  join public.profiles profile on profile.id = auth.uid()
  where md.id = p_monthly_dues_id
  on conflict (idempotency_key) do nothing returning id into v_id;

  if v_id is null then
    select * into v_existing from public.monthly_dues_payments where idempotency_key = p_idempotency_key;
    if not found or v_existing.recorded_by is distinct from auth.uid()
       or v_existing.monthly_dues_id <> p_monthly_dues_id
       or v_existing.amount <> p_amount
       or coalesce(v_existing.note,'') <> coalesce(v_note,'') then
      raise exception 'Payment idempotency conflict could not be resolved' using errcode = '40001';
    end if;
    v_id := v_existing.id;
  end if;
  return v_id;
end;
$function$;
revoke all on function public.record_monthly_dues_payment(uuid,numeric,uuid,text) from public, anon;
grant execute on function public.record_monthly_dues_payment(uuid,numeric,uuid,text) to authenticated;

create or replace function public.record_monthly_dues_cash_expense(
  p_dues_month date, p_amount numeric, p_description text, p_spent_at timestamptz, p_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_id uuid;
  v_existing public.monthly_dues_cash_expenses%rowtype;
  v_description text := pg_catalog.btrim(p_description);
  v_balance numeric(15,2);
  v_validated_at timestamptz;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if not app_private.has_any_role(array[
    'ketua_pemuda','wakil_ketua_pemuda','bendahara'
  ]::public.app_role[]) then
    raise exception 'Not authorized to record monthly dues cash expenses' using errcode = '42501';
  end if;
  if p_dues_month is null or extract(day from p_dues_month) <> 1 or p_spent_at is null
     or pg_catalog.date_trunc('month', p_spent_at at time zone 'Asia/Jakarta')::date <> p_dues_month then
    raise exception 'Expense date must belong to the selected monthly book' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 9999999999999.99 then
    raise exception 'Expense amount must be positive and within supported range' using errcode = '22023';
  end if;
  if v_description is null or char_length(v_description) not between 2 and 240 then
    raise exception 'Expense description must contain 2 to 240 characters' using errcode = '22023';
  end if;
  if p_idempotency_key is null then
    raise exception 'Idempotency key is required' using errcode = '22023';
  end if;

  select * into v_existing from public.monthly_dues_cash_expenses where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.dues_month <> p_dues_month or v_existing.amount <> p_amount
       or v_existing.description <> v_description or v_existing.spent_at <> p_spent_at
       or v_existing.recorded_by <> auth.uid() then
      raise exception 'Idempotency key was already used with different expense data' using errcode = '22023';
    end if;
    return v_existing.id;
  end if;

  perform app_private.ensure_current_monthly_dues_period();
  v_validated_at := app_private.lock_current_monthly_dues_period(p_dues_month);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('koppkas-monthly-dues-cash-balance', 0)
  );

  select * into v_existing from public.monthly_dues_cash_expenses where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.dues_month <> p_dues_month or v_existing.amount <> p_amount
       or v_existing.description <> v_description or v_existing.spent_at <> p_spent_at
       or v_existing.recorded_by <> auth.uid() then
      raise exception 'Idempotency key was already used with different expense data' using errcode = '22023';
    end if;
    return v_existing.id;
  end if;
  perform app_private.assert_current_monthly_dues_period(p_dues_month, v_validated_at);
  if p_spent_at > v_validated_at then
    raise exception 'Expense timestamp cannot be in the future' using errcode = '22023';
  end if;

  select closing_balance into v_balance from public.monthly_dues_cash_book_summary
  where dues_month = p_dues_month;
  if v_balance is null then
    raise exception 'Official cash balance is unavailable; expense was not recorded' using errcode = 'P0002';
  end if;
  if p_amount > v_balance then
    raise exception 'Insufficient cash balance: available %, requested %', v_balance, p_amount
      using errcode = '23514';
  end if;

  insert into public.monthly_dues_cash_expenses(
    dues_month, amount, description, spent_at, recorded_by, idempotency_key
  ) values (p_dues_month, p_amount, v_description, p_spent_at, auth.uid(), p_idempotency_key)
  on conflict (idempotency_key) do nothing returning id into v_id;
  if v_id is null then
    select * into v_existing from public.monthly_dues_cash_expenses where idempotency_key = p_idempotency_key;
    if not found or v_existing.dues_month <> p_dues_month or v_existing.amount <> p_amount
       or v_existing.description <> v_description or v_existing.spent_at <> p_spent_at
       or v_existing.recorded_by <> auth.uid() then
      raise exception 'Expense idempotency conflict could not be resolved' using errcode = '40001';
    end if;
    v_id := v_existing.id;
  end if;
  return v_id;
end;
$function$;
revoke all on function public.record_monthly_dues_cash_expense(date,numeric,text,timestamptz,uuid) from public, anon;
grant execute on function public.record_monthly_dues_cash_expense(date,numeric,text,timestamptz,uuid) to authenticated;

create or replace function app_private.require_open_monthly_dues_period_for_expense()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if not exists (select 1 from public.monthly_dues_periods
    where dues_month = new.dues_month and status = 'active') then
    raise exception 'Monthly dues period is closed or unavailable' using errcode = '55000';
  end if;
  return new;
end;
$function$;

-- Empty missed months must not show generated register rows as member lists.
create or replace view public.monthly_dues_summary
with (security_invoker = true)
as
select md.id, md.member_id, m.full_name, m.gender, md.dues_month, md.reference_amount,
  coalesce(sum(p.amount), 0::numeric)::numeric(15,2) as paid_amount,
  greatest(md.reference_amount - coalesce(sum(p.amount), 0::numeric), 0::numeric)::numeric(15,2) as remaining_amount,
  case when coalesce(sum(p.amount), 0::numeric) >= 10000 then 'lunas'::text else 'belum_bayar'::text end as payment_status
from public.monthly_dues md
join public.monthly_dues_periods period
  on period.dues_month = md.dues_month and period.data_status = 'available'
join public.members m on m.id = md.member_id
left join public.monthly_dues_payments p on p.monthly_dues_id = md.id
group by md.id, md.member_id, m.full_name, m.gender, md.dues_month, md.reference_amount;
revoke all on public.monthly_dues_summary from public, anon;
grant select on public.monthly_dues_summary to authenticated;

-- Receipt identity is snapshot-only. Existing legacy snapshots stay NULL rather
-- than being backfilled from today's mutable names.
create or replace view public.monthly_dues_payment_receipts
with (security_invoker = true)
as
with ordered_payments as (
  select p.id as payment_id, p.monthly_dues_id, p.amount, p.paid_at, p.recorded_by, p.note,
    p.member_name_snapshot, p.recorder_name_snapshot,
    sum(p.amount) over (partition by p.monthly_dues_id
      order by p.paid_at asc, p.id asc rows between unbounded preceding and current row
    )::numeric(15,2) as paid_amount_after_transaction
  from public.monthly_dues_payments p
)
select
  'KAS-' || to_char(md.dues_month, 'YYYYMM') || '-' || upper(replace(op.payment_id::text, '-', '')) as payment_reference,
  op.payment_id, op.monthly_dues_id, md.member_id, op.member_name_snapshot as member_name,
  op.amount, op.paid_at, md.dues_month, op.note, op.recorded_by,
  op.recorder_name_snapshot as recorded_by_name, md.reference_amount, op.paid_amount_after_transaction,
  case when op.paid_amount_after_transaction >= 10000 then 'lunas'::text else 'belum_bayar'::text end as status_after_transaction
from ordered_payments op
join public.monthly_dues md on md.id = op.monthly_dues_id;
revoke all on public.monthly_dues_payment_receipts from public, anon;
grant select on public.monthly_dues_payment_receipts to authenticated;

-- Preserve the original five view columns in order; append lifecycle metadata.
-- Once an empty historical gap exists, its balance and all later carried balances
-- remain NULL until that gap is reconciled. Actual payment/expense rows are retained.
create or replace view public.monthly_dues_cash_book_summary
with (security_invoker = true)
as
with period_movements as (
  select p.dues_month, p.data_status,
    case when p.data_status = 'available' and p.dues_month = date '2026-10-01'
      then coalesce((select amount from public.monthly_dues_cash_opening_balances where dues_month = date '2026-10-01'), 0)
      else 0 end::numeric(15,2) as seed_amount,
    case when p.data_status = 'historical_empty' then null else coalesce(i.income_amount, 0)::numeric(15,2) end as income_amount,
    case when p.data_status = 'historical_empty' then null else coalesce(e.expense_amount, 0)::numeric(15,2) end as expense_amount
  from public.monthly_dues_periods p
  left join (
    select md.dues_month, sum(pay.amount)::numeric(15,2) as income_amount
    from public.monthly_dues md
    join public.monthly_dues_periods opened on opened.dues_month = md.dues_month
    join public.monthly_dues_payments pay on pay.monthly_dues_id = md.id
      and (md.dues_month <> date '2026-10-01' or pay.paid_at >= opened.opened_at)
    group by md.dues_month
  ) i on i.dues_month = p.dues_month
  left join (
    select ex.dues_month, sum(ex.amount)::numeric(15,2) as expense_amount
    from public.monthly_dues_cash_expenses ex group by ex.dues_month
  ) e on e.dues_month = p.dues_month
),
running as (
  select pm.*,
    (select coalesce(sum(seed_amount), 0) from period_movements)
      + coalesce(sum(coalesce(income_amount,0) - coalesce(expense_amount,0))
        over (order by dues_month rows between unbounded preceding and 1 preceding), 0)::numeric(15,2) as calculated_opening_balance,
    not exists (select 1 from period_movements gap
      where gap.dues_month <= pm.dues_month and gap.data_status = 'historical_empty') as cash_balance_known
  from period_movements pm
)
select dues_month,
  case when cash_balance_known then calculated_opening_balance else null end::numeric(15,2) as opening_balance,
  income_amount::numeric(15,2) as income_amount,
  expense_amount::numeric(15,2) as expense_amount,
  (case when cash_balance_known and income_amount is not null and expense_amount is not null
    then calculated_opening_balance + income_amount - expense_amount else null end)::numeric(15,2) as closing_balance,
  data_status,
  case when cash_balance_known then 'available'::text else 'historical_gap'::text end as cash_balance_status
from running
where (select app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','bendahara']::public.app_role[]));
revoke all on public.monthly_dues_cash_book_summary from public, anon;
grant select on public.monthly_dues_cash_book_summary to authenticated;

create or replace view public.monthly_dues_cash_book_movements
with (security_invoker = true)
as
with all_movements as (
  select '0:opening:' || s.dues_month::text as movement_key, null::uuid as transaction_id,
    s.dues_month, (s.dues_month::timestamp at time zone 'Asia/Jakarta') as occurred_at,
    'saldo_awal'::text as movement_type, 'Saldo awal'::text as description,
    s.opening_balance as amount, null::uuid as recorded_by, null::text as note, true as immutable
  from public.monthly_dues_cash_book_summary s where s.opening_balance is not null
  union all
  select '1:payment:' || p.id::text, p.id, md.dues_month, p.paid_at,
    'pemasukan_iuran'::text, coalesce(p.member_name_snapshot, 'Nama tidak tersimpan saat transaksi')::text,
    p.amount, p.recorded_by, p.note, true
  from public.monthly_dues_payments p
  join public.monthly_dues md on md.id = p.monthly_dues_id
  join public.monthly_dues_periods period on period.dues_month = md.dues_month
  union all
  select '2:expense:' || e.id::text, e.id, e.dues_month, e.spent_at,
    'pengeluaran'::text, e.description, e.amount, e.recorded_by, null::text, true
  from public.monthly_dues_cash_expenses e
  join public.monthly_dues_periods period on period.dues_month = e.dues_month
)
select * from all_movements
where (select app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','bendahara']::public.app_role[]));
revoke all on public.monthly_dues_cash_book_movements from public, anon;
grant select on public.monthly_dues_cash_book_movements to authenticated;

comment on table public.monthly_dues_periods is
  'One period per Jakarta calendar month. Only the current month is active; skipped months are closed and historical_empty without fabricated member registers.';
comment on function public.sync_monthly_dues_period_lifecycle() is
  'Creates the current month on demand, closes previous periods at their effective Jakarta boundary, and leaves missed months empty.';
comment on function public.record_monthly_dues_payment(uuid,numeric,uuid,text) is
  'Records voluntary payments only in the active Jakarta month with post-lock validation, idempotent reconciliation, and transaction-time identity snapshots.';
comment on view public.monthly_dues_payment_receipts is
  'Read-only receipt projection. New identities come from immutable snapshots; legacy rows without snapshots remain NULL.';
comment on view public.monthly_dues_cash_book_summary is
  'Official cash summary. Historical gaps expose NULL balances rather than fabricated zero values.';

commit;
