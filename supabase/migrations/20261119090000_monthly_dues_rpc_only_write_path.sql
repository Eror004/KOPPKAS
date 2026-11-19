-- Keep monthly-dues payment writes behind the validated SECURITY DEFINER RPC.
-- The application records payments through public.record_monthly_dues_payment().
-- Direct table INSERT would bypass its amount, note, role and idempotency-payload checks.
begin;

drop policy if exists dues_payments_insert_recorders
  on public.monthly_dues_payments;

revoke insert on table public.monthly_dues_payments
  from anon, authenticated;

commit;
