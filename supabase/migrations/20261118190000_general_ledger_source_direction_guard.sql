-- KOPPKAS revision 033: constrain general-ledger directions by transaction source.
begin;

-- Manual entries are ordinary receipts/expenses. Transfer directions are reserved
-- for system-generated monthly-dues and event-surplus postings.
alter table public.general_ledger_entries
  add constraint general_ledger_source_direction_allowed
  check (
    (source_type = 'manual' and direction in ('masuk', 'keluar'))
    or (source_type = 'monthly_dues_payment' and direction = 'masuk')
    or (source_type = 'event_surplus_transfer' and direction = 'transfer_masuk')
  );

-- Remove the pre-hardening policy name as well, so permissive policies cannot
-- OR together and bypass the manual-entry direction restriction.
drop policy if exists "general_ledger_insert_finance_roles" on public.general_ledger_entries;
drop policy if exists "general_ledger_insert_manual_finance_roles" on public.general_ledger_entries;

create policy "general_ledger_insert_manual_finance_roles" on public.general_ledger_entries
for insert to authenticated
with check (
  source_type = 'manual'
  and direction in ('masuk', 'keluar')
  and created_by = (select auth.uid())
  and app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','bendahara']::public.app_role[])
);

commit;
