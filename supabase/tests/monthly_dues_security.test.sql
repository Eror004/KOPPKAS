begin;

create extension if not exists pgtap with schema extensions;

select plan(69);

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
  date '2026-10-01',
  10000
);

insert into public.members (id, full_name, created_by)
values ('10000000-0000-4000-8000-000000000002', 'Anggota Uji Parsial', '00000000-0000-4000-8000-000000000001');

insert into public.monthly_dues (id, member_id, dues_month, reference_amount)
values (
  '20000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000002',
  date '2026-10-01',
  10000
);

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

-- New RPCs are private to authenticated callers, not anon/PUBLIC.
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

-- Cash-book read model is finance-only across all six organization roles.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select is((select count(*)::integer from public.monthly_dues_cash_book_summary), 1, 'Ketua Pemuda can read the cash-book summary');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select is((select count(*)::integer from public.monthly_dues_cash_book_summary), 1, 'Wakil Ketua Pemuda can read the cash-book summary');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);
select is((select count(*)::integer from public.monthly_dues_cash_book_summary), 1, 'Bendahara can read the cash-book summary');
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

-- Sekretaris cannot open a period; Ketua can open only the next month.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select throws_ok($$select public.open_monthly_dues_period(date '2026-11-01')$$, '42501', 'Not authorized to open a monthly dues period', 'Sekretaris cannot open a period');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select throws_ok($$select public.open_monthly_dues_period(date '2026-12-01')$$, '22023', 'Only the month immediately following the latest opened period can be opened', 'Cannot skip an unopened month');
select is((public.open_monthly_dues_period(date '2026-11-01')->>'opening_balance')::numeric, 205000.00::numeric, 'November opens with October closing balance');
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
select lives_ok($select public.record_monthly_dues_payment('20000000-0000-4000-8000-000000000002', 1000, '30000000-0000-4000-8000-000000000002', 'Cicilan sukarela')$, 'Sekretaris can record a partial voluntary payment');
select is((select payment_status from public.monthly_dues_summary where id = '20000000-0000-4000-8000-000000000002'), 'belum_bayar', 'partial amount below Rp10,000 remains unpaid');
select lives_ok($select public.record_monthly_dues_payment('20000000-0000-4000-8000-000000000002', 9000, '30000000-0000-4000-8000-000000000003', 'Pelunasan sukarela')$, 'Sekretaris can record the remaining voluntary payment');
select is((select payment_status from public.monthly_dues_summary where id = '20000000-0000-4000-8000-000000000002'), 'lunas', 'aggregate at Rp10,000 becomes paid');
reset role;

-- Expense guard uses the full official balance, is idempotent, and fails closed on overspend.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);
select lives_ok($$select public.record_monthly_dues_cash_expense(date '2026-10-01', 225000, 'Pengeluaran uji', timestamptz '2026-10-10 12:00:00+07', '40000000-0000-4000-8000-000000000001')$$, 'Bendahara can spend the exact available balance');
select lives_ok($$select public.record_monthly_dues_cash_expense(date '2026-10-01', 225000, 'Pengeluaran uji', timestamptz '2026-10-10 12:00:00+07', '40000000-0000-4000-8000-000000000001')$$, 'same expense idempotency key returns the original row');
select throws_ok($$select public.record_monthly_dues_cash_expense(date '2026-10-01', 1, 'Pengeluaran tambahan', timestamptz '2026-10-11 12:00:00+07', '40000000-0000-4000-8000-000000000002')$$, '23514', 'Insufficient cash balance: available 0.00, requested 1', 'expense above available balance is rejected');
reset role;
select is((select count(*)::integer from public.monthly_dues_cash_expenses where idempotency_key = '40000000-0000-4000-8000-000000000001'), 1, 'expense retry persists exactly one row');

select * from finish();
rollback;
