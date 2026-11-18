-- KOPPKAS revision 023: idempotent event-ledger entries for safe retries.
begin;

alter table public.event_ledger_entries
  add column idempotency_key uuid;

create unique index event_ledger_entries_idempotency_key_uidx
  on public.event_ledger_entries(idempotency_key)
  where idempotency_key is not null;

create or replace function app_private.guard_event_ledger_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $event_ledger_guard$
declare
  event_state public.event_status;
  role_now public.app_role;
  is_approved_surplus_transfer boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  role_now := app_private.current_app_role();
  if role_now is null or role_now not in ('ketua_pemuda', 'wakil_ketua_pemuda', 'bendahara') then
    raise exception 'Not authorized to record event finance' using errcode = '42501';
  end if;

  select e.status into event_state
  from public.events e
  where e.id = new.event_id;

  if not found then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;

  if event_state in ('terbit', 'berlangsung') then
    if new.idempotency_key is null then
      raise exception 'Event finance idempotency key is required' using errcode = '22023';
    end if;
    return new;
  end if;

  select exists (
    select 1
    from public.event_surplus_transfers t
    join public.general_ledger_entries gle
      on gle.id = t.general_ledger_entry_id
     and gle.source_type = 'event_surplus_transfer'
     and gle.source_id = t.event_id
     and gle.direction = 'transfer_masuk'
     and gle.amount = t.amount
    where t.event_id = new.event_id
      and t.amount = new.amount
      and t.approved_by = auth.uid()
      and new.direction = 'keluar'
      and new.created_by = auth.uid()
      and new.description = 'Transfer surplus ke Uang Keseluruhan'
      and not exists (
        select 1
        from public.event_ledger_entries existing
        where existing.event_id = new.event_id
          and existing.direction = 'keluar'
          and existing.amount = new.amount
          and existing.description = 'Transfer surplus ke Uang Keseluruhan'
      )
  ) into is_approved_surplus_transfer;

  if is_approved_surplus_transfer then
    return new;
  end if;

  raise exception 'Event ledger is locked outside the active event period'
    using errcode = '55000';
end
$event_ledger_guard$;

revoke all on function app_private.guard_event_ledger_insert() from public, anon, authenticated;

commit;
