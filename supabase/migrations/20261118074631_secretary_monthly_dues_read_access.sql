-- KOPPKAS revision 026: align Sekretaris read access with the monthly-dues recording workflow.
begin;

-- The active Supabase schema may already contain the earlier policy names.
-- Replace them rather than accumulating duplicate permissive SELECT policies.
drop policy if exists "monthly_dues_read_secretary_register" on public.monthly_dues;
drop policy if exists "dues_payments_read_secretary_register" on public.monthly_dues_payments;

create policy "monthly_dues_read_secretary_payment_workflow" on public.monthly_dues
for select to authenticated
using (
  app_private.has_any_role(array['sekretaris']::public.app_role[])
);

create policy "dues_payments_read_secretary_payment_workflow" on public.monthly_dues_payments
for select to authenticated
using (
  app_private.has_any_role(array['sekretaris']::public.app_role[])
);

commit;
