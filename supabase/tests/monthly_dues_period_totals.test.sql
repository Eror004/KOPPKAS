begin;

create extension if not exists pgtap with schema extensions;
select plan(30);

-- Local-only test identities; the auth trigger creates their profiles.
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

-- Synthetic periods: one populated, one available-but-empty, one historical gap.
insert into public.monthly_dues_periods (
  dues_month, opened_at, opened_by, status, data_status,
  opened_effective_at, opened_processed_at, closed_effective_at, closed_processed_at
) values
  (date '2097-01-01', timestamptz '2097-01-01 00:00:00+07', null, 'closed', 'available',
   timestamptz '2097-01-01 00:00:00+07', timestamptz '2097-01-01 00:00:00+07',
   timestamptz '2097-02-01 00:00:00+07', timestamptz '2097-02-01 00:00:00+07'),
  (date '2097-02-01', timestamptz '2097-02-01 00:00:00+07', null, 'closed', 'available',
   timestamptz '2097-02-01 00:00:00+07', timestamptz '2097-02-01 00:00:00+07',
   timestamptz '2097-03-01 00:00:00+07', timestamptz '2097-03-01 00:00:00+07'),
  (date '2097-03-01', timestamptz '2097-03-01 00:00:00+07', null, 'closed', 'historical_empty',
   timestamptz '2097-03-01 00:00:00+07', timestamptz '2097-03-01 00:00:00+07',
   timestamptz '2097-04-01 00:00:00+07', timestamptz '2097-04-01 00:00:00+07');

insert into public.members (id, full_name, created_by) values
  ('10000000-0000-4000-8000-000000000031', 'Anggota Agregat Lunas', '00000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000032', 'Anggota Agregat Belum Lunas', '00000000-0000-4000-8000-000000000001');

insert into public.monthly_dues (id, member_id, dues_month, reference_amount) values
  ('20000000-0000-4000-8000-000000000031', '10000000-0000-4000-8000-000000000031', date '2097-01-01', 10000),
  ('20000000-0000-4000-8000-000000000032', '10000000-0000-4000-8000-000000000032', date '2097-01-01', 10000);

insert into public.monthly_dues_payments (id, monthly_dues_id, amount, paid_at, recorded_by, idempotency_key) values
  ('30000000-0000-4000-8000-000000000031', '20000000-0000-4000-8000-000000000031', 4000, timestamptz '2097-01-10 09:00:00+07', '00000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000031'),
  ('30000000-0000-4000-8000-000000000032', '20000000-0000-4000-8000-000000000031', 6000, timestamptz '2097-01-15 09:00:00+07', '00000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000032'),
  ('30000000-0000-4000-8000-000000000033', '20000000-0000-4000-8000-000000000032', 9999, timestamptz '2097-01-20 09:00:00+07', '00000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000033');

select ok(not has_table_privilege('anon', 'public.monthly_dues_period_totals', 'SELECT'), 'anon cannot read period totals');
select ok(has_table_privilege('authenticated', 'public.monthly_dues_period_totals', 'SELECT'), 'authenticated has SELECT on the read model');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select is((select count(*)::integer from public.monthly_dues_period_totals where dues_month between date '2097-01-01' and date '2097-03-01'), 3, 'Ketua can read all three test periods');
select is((select status from public.monthly_dues_period_totals where dues_month = date '2097-01-01'), 'closed', 'period status is exposed for the selected book');
select is((select data_status from public.monthly_dues_period_totals where dues_month = date '2097-01-01'), 'available', 'available data status is explicit');
select is((select member_count from public.monthly_dues_period_totals where dues_month = date '2097-01-01'), 2, 'member count aggregates all registers');
select is((select paid_member_count from public.monthly_dues_period_totals where dues_month = date '2097-01-01'), 1, 'paid count uses cumulative threshold');
select is((select unpaid_member_count from public.monthly_dues_period_totals where dues_month = date '2097-01-01'), 1, 'partial payment remains unpaid');
select is((select total_paid_amount from public.monthly_dues_period_totals where dues_month = date '2097-01-01'), 19999::numeric, 'total paid sums multiple and partial payments');
select is((select total_reference_amount from public.monthly_dues_period_totals where dues_month = date '2097-01-01'), 20000::numeric, 'total reference sums register targets');
select is((select total_remaining_amount from public.monthly_dues_period_totals where dues_month = date '2097-01-01'), 1::numeric, 'remaining total is aggregated');
select is((select member_count from public.monthly_dues_period_totals where dues_month = date '2097-02-01'), 0, 'available empty period has zero members');
select is((select paid_member_count from public.monthly_dues_period_totals where dues_month = date '2097-02-01'), 0, 'available empty period has zero paid members');
select is((select unpaid_member_count from public.monthly_dues_period_totals where dues_month = date '2097-02-01'), 0, 'available empty period has zero unpaid members');
select is((select total_paid_amount from public.monthly_dues_period_totals where dues_month = date '2097-02-01'), 0::numeric, 'available empty period has zero paid amount');
select is((select total_reference_amount from public.monthly_dues_period_totals where dues_month = date '2097-02-01'), 0::numeric, 'available empty period has zero reference amount');
select is((select total_remaining_amount from public.monthly_dues_period_totals where dues_month = date '2097-02-01'), 0::numeric, 'available empty period has zero remaining amount');
select is((select member_count from public.monthly_dues_period_totals where dues_month = date '2097-03-01'), null, 'historical empty member count is unknown');
select is((select total_paid_amount from public.monthly_dues_period_totals where dues_month = date '2097-03-01'), null::numeric, 'historical empty paid amount is unknown');
select is((select total_remaining_amount from public.monthly_dues_period_totals where dues_month = date '2097-03-01'), null::numeric, 'historical empty remaining amount is unknown');
select is((select data_status from public.monthly_dues_period_totals where dues_month = date '2097-03-01'), 'historical_empty', 'historical period state is explicit');
select is((select paid_member_count from public.monthly_dues_period_totals where dues_month = date '2097-03-01'), null, 'historical empty paid-member count is unknown');
select is((select unpaid_member_count from public.monthly_dues_period_totals where dues_month = date '2097-03-01'), null, 'historical empty unpaid-member count is unknown');
select is((select total_reference_amount from public.monthly_dues_period_totals where dues_month = date '2097-03-01'), null::numeric, 'historical empty reference amount is unknown');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select is((select count(*)::integer from public.monthly_dues_period_totals where dues_month between date '2097-01-01' and date '2097-03-01'), 3, 'Wakil can read dues totals');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);
select is((select count(*)::integer from public.monthly_dues_period_totals where dues_month between date '2097-01-01' and date '2097-03-01'), 3, 'Bendahara can read dues totals');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select is((select count(*)::integer from public.monthly_dues_period_totals where dues_month between date '2097-01-01' and date '2097-03-01'), 3, 'Sekretaris can read dues totals');
select is((select count(*)::integer from public.monthly_dues_cash_book_summary where dues_month between date '2097-01-01' and date '2097-03-01'), 0, 'Sekretaris cannot read general cash balances');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000005', true);
select is((select count(*)::integer from public.monthly_dues_period_totals where dues_month between date '2097-01-01' and date '2097-03-01'), 0, 'Ketua RW cannot read dues totals');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000006', true);
select is((select count(*)::integer from public.monthly_dues_period_totals where dues_month between date '2097-01-01' and date '2097-03-01'), 0, 'Ketua RT cannot read dues totals');
reset role;

select * from finish();
rollback;
