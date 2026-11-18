-- KOPPKAS revision 026: allow Sekretaris to read the monthly-dues workflow they are authorized to record.
begin;

-- Sekretaris may record voluntary monthly payments, so the role must be able
-- to load the member register and its payment history in the same workflow.
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
