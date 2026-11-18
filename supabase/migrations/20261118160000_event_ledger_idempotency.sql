-- KOPPKAS revision 023: idempotent event-ledger entries for safe retries.
begin;

alter table public.event_ledger_entries
  add column idempotency_key uuid;

create unique index event_ledger_entries_idempotency_key_uidx
  on public.event_ledger_entries(idempotency_key)
  where idempotency_key is not null;

commit;
