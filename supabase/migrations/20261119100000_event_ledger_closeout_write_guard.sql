-- Serialize event-ledger writes with final-report approval and reject
-- new entries once an event has entered closeout.
begin;

drop policy if exists event_ledger_insert_finance_roles
  on public.event_ledger_entries;

-- Replace broad default table grants with the minimum client privileges.
-- RLS still decides which rows each role may access.
revoke all on table public.events,
  public.event_financial_reports,
  public.event_ledger_entries,
  public.event_surplus_transfers
  from anon, authenticated;

-- Public visitors may only read events allowed by the events SELECT policy.
grant select on table public.events to anon;

-- Signed-in users read events; RLS controls event creation and updates.
grant select, insert, update on table public.events to authenticated;

-- Reports and ledgers are read-only through the Data API.
-- Their write paths are the guarded SECURITY DEFINER workflows.
grant select on table public.event_financial_reports,
  public.event_ledger_entries,
  public.event_surplus_transfers
  to authenticated;

create or replace function public.record_event_finance_entry(
  p_event_id uuid,
  p_direction public.ledger_direction,
  p_amount numeric,
  p_description text,
  p_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_event public.events%rowtype;
  existing_entry public.event_ledger_entries%rowtype;
  entry_id uuid;
  normalized_description text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','bendahara']::public.app_role[]) then
    raise exception 'Not authorized to record event finance' using errcode = '42501';
  end if;

  if p_direction is null or p_direction not in ('masuk','keluar') then
    raise exception 'Invalid event ledger direction' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 9999999999999.99 then
    raise exception 'Amount must be positive and within supported range' using errcode = '22023';
  end if;
  normalized_description := trim(coalesce(p_description, ''));
  if char_length(normalized_description) < 2 or char_length(normalized_description) > 240 then
    raise exception 'Description must contain 2 to 240 characters' using errcode = '22023';
  end if;
  if p_idempotency_key is null then
    raise exception 'Idempotency key is required' using errcode = '22023';
  end if;

  -- Return a previous successful request even if the event has since closed.
  select * into existing_entry
  from public.event_ledger_entries
  where idempotency_key = p_idempotency_key;

  if found then
    if existing_entry.event_id <> p_event_id
       or existing_entry.direction <> p_direction
       or existing_entry.amount <> p_amount
       or existing_entry.description <> normalized_description
       or existing_entry.created_by is distinct from auth.uid() then
      raise exception 'Idempotency key was already used with different transaction data' using errcode = '22023';
    end if;
    return existing_entry.id;
  end if;

  -- This row lock serializes new entries against approve_event_final_report(),
  -- which takes the same lock before calculating and transferring the surplus.
  select * into target_event
  from public.events
  where id = p_event_id
  for update;

  if not found then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;
  if target_event.status not in ('terbit','berlangsung') then
    raise exception 'Event ledger is closed for this event status' using errcode = '22023';
  end if;

  insert into public.event_ledger_entries (
    event_id, direction, amount, description, created_by, idempotency_key
  ) values (
    p_event_id, p_direction, p_amount, normalized_description, auth.uid(), p_idempotency_key
  )
  on conflict do nothing
  returning id into entry_id;

  if entry_id is null then
    select * into existing_entry
    from public.event_ledger_entries
    where idempotency_key = p_idempotency_key;

    if not found then
      raise exception 'Event transaction idempotency conflict could not be resolved' using errcode = '40001';
    end if;
    if existing_entry.event_id <> p_event_id
       or existing_entry.direction <> p_direction
       or existing_entry.amount <> p_amount
       or existing_entry.description <> normalized_description
       or existing_entry.created_by is distinct from auth.uid() then
      raise exception 'Idempotency key was already used with different transaction data' using errcode = '22023';
    end if;
    entry_id := existing_entry.id;
  end if;

  return entry_id;
end
$$;

revoke all on function public.record_event_finance_entry(uuid,public.ledger_direction,numeric,text,uuid) from public, anon;
grant execute on function public.record_event_finance_entry(uuid,public.ledger_direction,numeric,text,uuid) to authenticated;

commit;
