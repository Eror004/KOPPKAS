-- KOPPKAS: close legacy monthly-dues write paths.
-- New member/register writes must use the explicit-period, role-checked RPCs.
-- This migration is prepared on the isolated backend PR branch only.
begin;

-- These legacy SECURITY DEFINER entry points predate explicit period opening.
-- Keep service_role access for controlled maintenance, but remove Data API execution.
revoke execute on function public.create_member_and_monthly_dues(text, date)
  from public, anon, authenticated;
revoke execute on function public.create_member_for_dues(text)
  from public, anon, authenticated;

-- Monthly dues register rows must only be created by the period-gated RPCs.
-- SECURITY DEFINER functions owned by the migration owner continue to insert.
revoke all on table public.monthly_dues from public, anon, authenticated;
grant select on table public.monthly_dues to authenticated;

-- Persisted payment history is append-only too; expose reads through RLS only.
revoke all on table public.monthly_dues_payments from public, anon, authenticated;
grant select on table public.monthly_dues_payments to authenticated;

comment on function public.create_member_and_monthly_dues(text, date) is
  'Legacy entry point disabled for authenticated Data API callers; use create_member_and_monthly_dues_safe after explicit period opening.';
comment on function public.create_member_for_dues(text) is
  'Legacy entry point disabled for authenticated Data API callers; use create_member_and_monthly_dues_safe after explicit period opening.';
comment on table public.monthly_dues is
  'Register rows are created through period-gated SECURITY DEFINER RPCs; direct Data API writes are revoked; authenticated reads remain subject to RLS.';
comment on table public.monthly_dues_payments is
  'Payment history is append-only through the idempotent SECURITY DEFINER RPC; direct Data API writes are revoked.';

commit;
