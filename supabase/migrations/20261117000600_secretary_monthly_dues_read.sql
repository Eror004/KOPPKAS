-- KOPPKAS revision 006: secretary access is limited to the monthly dues register
begin;

create policy "monthly_dues_read_secretary_register" on public.monthly_dues
for select to authenticated
using (app_private.has_any_role(array['sekretaris']::public.app_role[]));

create policy "dues_payments_read_secretary_register" on public.monthly_dues_payments
for select to authenticated
using (app_private.has_any_role(array['sekretaris']::public.app_role[]));

commit;
