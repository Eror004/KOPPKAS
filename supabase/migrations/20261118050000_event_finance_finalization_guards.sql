-- KOPPKAS revision 013: freeze finalized event records and event ledgers.
-- This migration is additive and does not rewrite existing financial records.
begin;

create or replace function app_private.guard_event_finalized_updates()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status in ('selesai', 'dibatalkan') then
    raise exception 'Finalized or cancelled events cannot be changed'
      using errcode = '55000';
  end if;

  if old.status = 'menunggu_laporan' and (
    new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.location is distinct from old.location
    or new.starts_at is distinct from old.starts_at
    or new.ends_at is distinct from old.ends_at
    or new.final_report is distinct from old.final_report
  ) then
    raise exception 'Event details and final report are locked while awaiting approval'
      using errcode = '55000';
  end if;

  return new;
end
$$;

drop trigger if exists guard_event_finalized_updates on public.events;
create trigger guard_event_finalized_updates
before update on public.events
for each row execute procedure app_private.guard_event_finalized_updates();

create or replace function app_private.guard_event_ledger_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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

  select e.status
    into event_state
  from public.events e
  where e.id = new.event_id;

  if not found then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;

  if event_state in ('terbit', 'berlangsung') then
    return new;
  end if;

  -- The closeout RPC creates the matching transfer row before appending
  -- the outgoing entry, while the event is already marked as selesai.
  select exists (
    select 1
    from public.event_surplus_transfers t
    where t.event_id = new.event_id
      and t.amount = new.amount
      and t.approved_by = auth.uid()
      and new.direction = 'keluar'
  ) into is_approved_surplus_transfer;

  if is_approved_surplus_transfer then
    return new;
  end if;

  raise exception 'Event ledger is locked outside the active event period'
    using errcode = '55000';
end
$$;

drop trigger if exists guard_event_ledger_insert on public.event_ledger_entries;
create trigger guard_event_ledger_insert
before insert on public.event_ledger_entries
for each row execute procedure app_private.guard_event_ledger_insert();

revoke all on function app_private.guard_event_finalized_updates() from public, anon, authenticated;
revoke all on function app_private.guard_event_ledger_insert() from public, anon, authenticated;

commit;
