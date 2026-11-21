begin;

create extension if not exists pgtap with schema extensions;

select plan(79);

-- Deterministic local-only identities. auth.users' existing trigger creates profiles;
-- roles are assigned explicitly here, inside this test transaction.
insert into auth.users (id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'koppkas-test-ketua@example.test', '{"full_name":"Test Ketua"}'),
  ('00000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'koppkas-test-wakil@example.test', '{"full_name":"Test Wakil"}'),
  ('00000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'koppkas-test-sekretaris@example.test', '{"full_name":"Test Sekretaris"}'),
  ('00000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'koppkas-test-bendahara@example.test', '{"full_name":"Test Bendahara"}'),
  ('00000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'koppkas-test-rw@example.test', '{"full_name":"Test Ketua RW"}'),
  ('00000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'koppkas-test-rt@example.test', '{"full_name":"Test Ketua RT"}');

update public.profiles set role = 'ketua_pemuda', is_active = true where id = '00000000-0000-4000-8000-000000000001';
update public.profiles set role = 'wakil_ketua_pemuda', is_active = true where id = '00000000-0000-4000-8000-000000000002';
update public.profiles set role = 'sekretaris', is_active = true where id = '00000000-0000-4000-8000-000000000003';
update public.profiles set role = 'bendahara', is_active = true where id = '00000000-0000-4000-8000-000000000004';
update public.profiles set role = 'ketua_rw_01', is_active = true where id = '00000000-0000-4000-8000-000000000005';
update public.profiles set role = 'ketua_rt_01', is_active = true where id = '00000000-0000-4000-8000-000000000006';

insert into public.members (id, full_name, created_by)
values ('10000000-0000-4000-8000-000000000001', 'Anggota Uji KOPPKAS', '00000000-0000-4000-8000-000000000001');

insert into public.monthly_dues (id, member_id, dues_month, reference_amount)
values (
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  date_trunc('month', clock_timestamp() at time zone 'Asia/Jakarta')::date,
  10000
);

insert into public.members (id, full_name, created_by)
values ('10000000-0000-4000-8000-000000000002', 'Anggota Uji Parsial', '00000000-0000-4000-8000-000000000001');

insert into public.monthly_dues (id, member_id, dues_month, reference_amount)
values (
  '20000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000002',
  date_trunc('month', clock_timestamp() at time zone 'Asia/Jakarta')::date,
  10000
);

-- Secretary may use member/payment RPCs only after an authorized officer has activated the current period.
-- These calls must not implicitly create or roll over the current period.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select throws_ok(
  $select public.ensure_monthly_dues_for_member('10000000-0000-4000-8000-000000000001', date_trunc('month', clock_timestamp() at time zone 'Asia/Jakarta')::date)$,
  '42501',
  'Not authorized to activate monthly dues lifecycle',
  'Sekretaris cannot implicitly activate lifecycle through register RPC'
);
select throws_ok(
  $select public.create_member_and_monthly_dues_safe('Anggota Uji Sekretaris', date_trunc('month', clock_timestamp() at time zone 'Asia/Jakarta')::date, true)$,
  '42501',
  'Not authorized to activate monthly dues lifecycle',
  'Sekretaris cannot implicitly activate lifecycle through member RPC'
);
select throws_ok(
  $select public.record_monthly_dues_payment('20000000-0000-4000-8000-000000000001', 10000, '30000000-0000-4000-8000-000000000099', 'Retry sebelum aktivasi')$,
  '42501',
  'Not authorized to activate monthly dues lifecycle',
  'Sekretaris cannot implicitly activate lifecycle through payment RPC'
);
select is(
  (select count(*)::integer from public.monthly_dues_periods
   where dues_month = date_trunc('month', clock_timestamp() at time zone 'Asia/Jakarta')::date
     and status = 'active'),
  0,
  'Rejected Secretary calls leave the current period unopened'
);
reset role;

-- Materialize the active Jakarta month before exercising current-period writes.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select public.sync_monthly_dues_period_lifecycle();
reset role;

-- Legacy SECURITY DEFINER endpoints must not be executable by API roles.
select ok(not has_function_privilege('anon', 'public.create_member_and_monthly_dues(text,date)', 'EXECUTE'), 'anon cannot execute legacy member/register RPC');
select ok(not has_function_privilege('authenticated', 'public.create_member_and_monthly_dues(text,date)', 'EXECUTE'), 'authenticated cannot execute legacy member/register RPC');
select ok(not has_function_privilege('anon', 'public.create_member_for_dues(text)', 'EXECUTE'), 'anon cannot execute legacy member RPC');
select ok(not has_function_privilege('authenticated', 'public.create_member_for_dues(text)', 'EXECUTE'), 'authenticated cannot execute legacy member RPC');

-- Direct writes must be impossible even if an RLS policy is accidentally permissive.
select ok(not has_table_privilege('anon', 'public.monthly_dues', 'INSERT'), 'anon cannot insert monthly register rows');
select ok(not has_table_privilege('authenticated', 'public.monthly_dues', 'INSERT'), 'authenticated cannot insert monthly register rows');
select ok(not has_table_privilege('authenticated', 'public.monthly_dues', 'UPDATE'), 'authenticated cannot update monthly register rows');
select ok(not has_table_privilege('authenticated', 'public.monthly_dues', 'DELETE'), 'authenticated cannot delete monthly register rows');
select ok(not has_table_privilege('anon', 'public.monthly_dues_payments', 'INSERT'), 'anon cannot insert payment rows');
select ok(not has_table_privilege('authenticated', 'public.monthly_dues_payments', 'INSERT'), 'authenticated cannot insert payment rows');
select ok(not has_table_privilege('authenticated', 'public.monthly_dues_payments', 'UPDATE'), 'authenticated cannot update payment history');
select ok(not has_table_privilege('authenticated', 'public.monthly_dues_payments', 'DELETE'), 'authenticated cannot delete payment history');
select ok(has_table_privilege('authenticated', 'public.monthly_dues', 'SELECT'), 'authenticated retains RLS-scoped register reads');
select ok(has_table_privilege('authenticated', 'public.monthly_dues_payments', 'SELECT'), 'authenticated retains RLS-scoped payment reads');
select ok(exists (select 1 from information_schema.columns where table_schema='public' and table_name='monthly_dues_payments' and column_name='member_name_snapshot'), 'payment table stores member name snapshots');
select ok(exists (select 1 from information_schema.columns where table_schema='public' and table_name='monthly_dues_payments' and column_name='recorder_name_snapshot'), 'payment table stores recorder name snapshots');

-- New RPCs are private to authenticated callers, not anon/PUBLIC.
select ok(not has_function_privilege('anon', 'public.sync_monthly_dues_period_lifecycle()', 'EXECUTE'), 'anon cannot synchronize monthly dues periods');
select ok(has_function_privilege('authenticated', 'public.sync_monthly_dues_period_lifecycle()', 'EXECUTE'), 'authenticated can call the role-checked lifecycle sync');
select ok(not has_function_privilege('anon', 'public.open_monthly_dues_period(date)', 'EXECUTE'), 'anon cannot open periods');
select ok(has_function_privilege('authenticated', 'public.open_monthly_dues_period(date)', 'EXECUTE'), 'authenticated can call the role-checked period RPC');
select ok(not has_function_privilege('anon', 'public.ensure_monthly_dues_for_member(uuid,date)', 'EXECUTE'), 'anon cannot prepare member registers');
select ok(has_function_privilege('authenticated', 'public.ensure_monthly_dues_for_member(uuid,date)', 'EXECUTE'), 'authenticated can call the role-checked register RPC');
select ok(not has_function_privilege('anon', 'public.create_member_and_monthly_dues_safe(text,date,boolean)', 'EXECUTE'), 'anon cannot create members through dues workflow');
select ok(has_function_privilege('authenticated', 'public.create_member_and_monthly_dues_safe(text,date,boolean)', 'EXECUTE'), 'authenticated can call the role-checked member RPC');
select ok(not has_function_privilege('anon', 'public.record_monthly_dues_payment(uuid,numeric,uuid,text)', 'EXECUTE'), 'anon cannot record payments');
select ok(has_function_privilege('authenticated', 'public.record_monthly_dues_payment(uuid,numeric,uuid,text)', 'EXECUTE'), 'authenticated can call the role-checked payment RPC');
select ok(not has_function_privilege('anon', 'public.record_monthly_dues_cash_expense(date,numeric,text,timestamptz,uuid)', 'EXECUTE'), 'anon cannot record expenses');
select ok(has_function_privilege('authenticated', 'public.record_monthly_dues_cash_expense(date,numeric,text,timestamptz,uuid)', 'EXECUTE'), 'authenticated can call the role-checked expense RPC');

-- Lifecycle synchronization mutates period/register state, so only the three finance
-- officers may execute it. Secretary may read and record dues but cannot activate periods.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select is((public.sync_monthly_dues_period_lifecycle()->>'register_count')::integer, 0, 'Ketua repeated sync creates no duplicate registers');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select is((public.sync_monthly_dues_period_lifecycle()->>'register_count')::integer, 0, 'Wakil repeated sync creates no duplicate registers');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);
select is((public.sync_monthly_dues_period_lifecycle()->>'register_count')::integer, 0, 'Bendahara repeated sync creates no duplicate registers');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select throws_ok(
  'select public.sync_monthly_dues_period_lifecycle()',
  '42501',
  'Not authorized to synchronize monthly dues lifecycle',
  'Sekretaris cannot synchronize or activate monthly dues lifecycle'
);
reset role;

-- Cash-book read model is finance-only across all six organization roles.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select is((select count(*)::integer from public.monthly_dues_cash_book_summary), (select count(*)::integer from public.monthly_dues_periods), 'Ketua Pemuda can read the cash-book summary');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select is((select count(*)::integer from public.monthly_dues_cash_book_summary), (select count(*)::integer from public.monthly_dues_periods), 'Wakil Ketua Pemuda can read the cash-book summary');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);
select is((select count(*)::integer from public.monthly_dues_cash_book_summary), (select count(*)::integer from public.monthly_dues_periods), 'Bendahara can read the cash-book summary');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select is((select count(*)::integer from public.monthly_dues_cash_book_summary), 0, 'Sekretaris cannot read cash-book balances');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000005', true);
select is((select count(*)::integer from public.monthly_dues_cash_book_summary), 0, 'Ketua RW cannot read cash-book balances');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000006', true);
select is((select count(*)::integer from public.monthly_dues_cash_book_summary), 0, 'Ketua RT cannot read cash-book balances');
reset role;

-- Four operating roles can use dues workflows; RW/RT cannot.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select throws_ok($$select public.ensure_monthly_dues_for_member(null, null)$$, '22023', 'A member and first day of a month are required', 'Ketua passes authorization before register input validation');
select throws_ok($$select public.create_member_and_monthly_dues_safe(null, date '2026-10-01', false)$$, '22023', 'Name must contain 2 to 120 characters', 'Ketua passes authorization before member input validation');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select throws_ok($$select public.ensure_monthly_dues_for_member(null, null)$$, '22023', 'A member and first day of a month are required', 'Wakil passes register authorization');
select throws_ok($$select public.create_member_and_monthly_dues_safe(null, date '2026-10-01', false)$$, '22023', 'Name must contain 2 to 120 characters', 'Wakil passes member authorization');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select throws_ok($$select public.ensure_monthly_dues_for_member(null, null)$$, '22023', 'A member and first day of a month are required', 'Sekretaris passes register authorization');
select throws_ok($$select public.create_member_and_monthly_dues_safe(null, date '2026-10-01', false)$$, '22023', 'Name must contain 2 to 120 characters', 'Sekretaris passes member authorization');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);
select throws_ok($$select public.ensure_monthly_dues_for_member(null, null)$$, '22023', 'A member and first day of a month are required', 'Bendahara passes register authorization');
select throws_ok($$select public.create_member_and_monthly_dues_safe(null, date '2026-10-01', false)$$, '22023', 'Name must contain 2 to 120 characters', 'Bendahara passes member authorization');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000005', true);
select throws_ok($$select public.ensure_monthly_dues_for_member(null, null)$$, '42501', 'Not authorized to prepare a monthly dues register', 'Ketua RW cannot prepare member registers');
select throws_ok($$select public.create_member_and_monthly_dues_safe(null, date '2026-10-01', false)$$, '42501', 'Not authorized to add a member from monthly dues', 'Ketua RW cannot create members from dues workflow');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000006', true);
select throws_ok($$select public.ensure_monthly_dues_for_member(null, null)$$, '42501', 'Not authorized to prepare a monthly dues register', 'Ketua RT cannot prepare member registers');
select throws_ok($$select public.create_member_and_monthly_dues_safe(null, date '2026-10-01', false)$$, '42501', 'Not authorized to add a member from monthly dues', 'Ketua RT cannot create members from dues workflow');
reset role;

-- Payment authorization matrix: Ketua, Wakil, Sekretaris, Bendahara allowed; RW/RT denied.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select throws_ok($$select public.record_monthly_dues_payment(null, 0, null, null)$$, '22023', 'Payment amount must be positive and within supported range', 'Ketua passes payment authorization');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select throws_ok($$select public.record_monthly_dues_payment(null, 0, null, null)$$, '22023', 'Payment amount must be positive and within supported range', 'Wakil passes payment authorization');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select throws_ok($$select public.record_monthly_dues_payment(null, 0, null, null)$$, '22023', 'Payment amount must be positive and within supported range', 'Sekretaris passes payment authorization');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);
select throws_ok($$select public.record_monthly_dues_payment(null, 0, null, null)$$, '22023', 'Payment amount must be positive and within supported range', 'Bendahara passes payment authorization');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000005', true);
select throws_ok($$select public.record_monthly_dues_payment(null, 0, null, null)$$, '42501', 'Not authorized to record monthly dues', 'Ketua RW cannot record payments');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000006', true);
select throws_ok($$select public.record_monthly_dues_payment(null, 0, null, null)$$, '42501', 'Not authorized to record monthly dues', 'Ketua RT cannot record payments');
reset role;

-- Cash-expense authorization matrix: only the three finance officers may proceed.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select throws_ok($$select public.record_monthly_dues_cash_expense(date '2026-10-01', 0, 'Uji', timestamptz '2026-10-10 12:00:00+07', gen_random_uuid())$$, '22023', 'Expense amount must be positive and within supported range', 'Ketua passes expense authorization');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select throws_ok($$select public.record_monthly_dues_cash_expense(date '2026-10-01', 0, 'Uji', timestamptz '2026-10-10 12:00:00+07', gen_random_uuid())$$, '22023', 'Expense amount must be positive and within supported range', 'Wakil passes expense authorization');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);
select throws_ok($$select public.record_monthly_dues_cash_expense(date '2026-10-01', 0, 'Uji', timestamptz '2026-10-10 12:00:00+07', gen_random_uuid())$$, '22023', 'Expense amount must be positive and within supported range', 'Bendahara passes expense authorization');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select throws_ok($$select public.record_monthly_dues_cash_expense(date '2026-10-01', 0, 'Uji', timestamptz '2026-10-10 12:00:00+07', gen_random_uuid())$$, '42501', 'Not authorized to record monthly dues cash expenses', 'Sekretaris cannot record cash expenses');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000005', true);
select throws_ok($$select public.record_monthly_dues_cash_expense(date '2026-10-01', 0, 'Uji', timestamptz '2026-10-10 12:00:00+07', gen_random_uuid())$$, '42501', 'Not authorized to record monthly dues cash expenses', 'Ketua RW cannot record cash expenses');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000006', true);
select throws_ok($$select public.record_monthly_dues_cash_expense(date '2026-10-01', 0, 'Uji', timestamptz '2026-10-10 12:00:00+07', gen_random_uuid())$$, '42501', 'Not authorized to record monthly dues cash expenses', 'Ketua RT cannot record cash expenses');
reset role;

-- Sekretaris cannot open a period; Ketua can activate only the current month.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select throws_ok($$select public.open_monthly_dues_period(date_trunc('month', clock_timestamp() at time zone 'Asia/Jakarta')::date)$$, '42501', 'Not authorized to open a monthly dues period', 'Sekretaris cannot open a period');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select throws_ok('select public.open_monthly_dues_period(((date_trunc(''month'', clock_timestamp() at time zone ''Asia/Jakarta'')::date + interval ''1 month'')::date))', '55000', 'Only the current Asia/Jakarta month can be activated; historical books remain closed', 'Future month cannot be activated');
select is(public.open_monthly_dues_period(date_trunc('month', clock_timestamp() at time zone 'Asia/Jakarta')::date)->>'status', 'active', 'Current Jakarta month is active');
reset role;

-- Persisted payment idempotency: a retry with the same key is a no-op; payload reuse is rejected.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select lives_ok($$select public.record_monthly_dues_payment('20000000-0000-4000-8000-000000000001', 10000, '30000000-0000-4000-8000-000000000001', 'Pembayaran uji')$$, 'Sekretaris records a persisted payment');
select lives_ok($$select public.record_monthly_dues_payment('20000000-0000-4000-8000-000000000001', 10000, '30000000-0000-4000-8000-000000000001', 'Pembayaran uji')$$, 'same idempotency key returns the original payment');
select throws_ok($$select public.record_monthly_dues_payment('20000000-0000-4000-8000-000000000001', 9000, '30000000-0000-4000-8000-000000000001', 'Pembayaran uji')$$, '22023', 'Idempotency key was already used with different payment data', 'same key with changed payload is rejected');
reset role;
select is((select count(*)::integer from public.monthly_dues_payments where idempotency_key = '30000000-0000-4000-8000-000000000001'), 1, 'payment retry persists exactly one row');

-- Partial voluntary payments remain BELUM LUNAS until the monthly aggregate reaches Rp10,000.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select lives_ok('select public.record_monthly_dues_payment(''20000000-0000-4000-8000-000000000002'', 1000, ''30000000-0000-4000-8000-000000000002'', ''Cicilan sukarela'')', 'Sekretaris can record a partial voluntary payment');
select is((select payment_status from public.monthly_dues_summary where id = '20000000-0000-4000-8000-000000000002'), 'belum_bayar', 'partial amount below Rp10,000 remains unpaid');
select lives_ok('select public.record_monthly_dues_payment(''20000000-0000-4000-8000-000000000002'', 9000, ''30000000-0000-4000-8000-000000000003'', ''Pelunasan sukarela'')', 'Sekretaris can record the remaining voluntary payment');
select is((select payment_status from public.monthly_dues_summary where id = '20000000-0000-4000-8000-000000000002'), 'lunas', 'aggregate at Rp10,000 becomes paid');
reset role;

-- Expense guard is idempotent when the cash balance is known and fails closed
-- when an unreconciled historical gap makes the official balance NULL.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);
select lives_ok($do$
do $test$
declare
  v_month date := date_trunc('month', clock_timestamp() at time zone 'Asia/Jakarta')::date;
  v_spent_at timestamptz := date_trunc('day', clock_timestamp() at time zone 'Asia/Jakarta')::timestamp at time zone 'Asia/Jakarta';
  v_balance numeric(15,2);
  v_first_id uuid;
  v_retry_id uuid;
begin
  select closing_balance into v_balance
  from public.monthly_dues_cash_book_summary where dues_month = v_month;

  if v_balance is null then
    begin
      perform public.record_monthly_dues_cash_expense(
        v_month, 1, 'Pengeluaran uji', v_spent_at,
        '40000000-0000-4000-8000-000000000001'
      );
      raise exception 'Expected fail-closed expense rejection';
    exception when sqlstate 'P0002' then
      null;
    end;
  else
    v_first_id := public.record_monthly_dues_cash_expense(
      v_month, v_balance, 'Pengeluaran uji', v_spent_at,
      '40000000-0000-4000-8000-000000000001'
    );
    v_retry_id := public.record_monthly_dues_cash_expense(
      v_month, v_balance, 'Pengeluaran uji', v_spent_at,
      '40000000-0000-4000-8000-000000000001'
    );
    if v_retry_id <> v_first_id then
      raise exception 'Expense retry did not return the original transaction';
    end if;
    begin
      perform public.record_monthly_dues_cash_expense(
        v_month, 1, 'Pengeluaran tambahan', v_spent_at,
        '40000000-0000-4000-8000-000000000002'
      );
      raise exception 'Expected overspend rejection';
    exception when sqlstate '23514' then
      null;
    end;
  end if;
end;
$test$
$do$, 'expense writes are idempotent with a known balance and fail closed across historical gaps');
reset role;
select is(
  (select count(*)::integer from public.monthly_dues_cash_expenses
    where idempotency_key = '40000000-0000-4000-8000-000000000001'),
  case when (select cash_balance_status from public.monthly_dues_cash_book_summary
    where dues_month = date_trunc('month', clock_timestamp() at time zone 'Asia/Jakarta')::date) = 'available'
    then 1 else 0 end,
  'expense persists only when the official balance is available'
);

select * from finish();
rollback;
