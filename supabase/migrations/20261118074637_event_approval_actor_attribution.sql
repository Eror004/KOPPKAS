-- KOPPKAS revision 027: bind event approval metadata to the authenticated actor.
-- Prevent privileged users from attributing approvals or cancellations to another account.
begin;

create or replace function app_private.guard_event_approval_actor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.approved_by is distinct from old.approved_by
     or new.approved_at is distinct from old.approved_at then
    if old.approved_by is not null
       or old.approved_at is not null
       or new.status is distinct from 'terbit'
       or old.status is distinct from 'menunggu_persetujuan'
       or auth.uid() is null
       or new.approved_by is distinct from auth.uid()
       or new.approved_at is null then
      raise exception 'Publication approval metadata must identify the authenticated approver exactly once'
        using errcode = '42501';
    end if;
  end if;

  if new.cancelled_by is distinct from old.cancelled_by
     or new.cancelled_at is distinct from old.cancelled_at then
    if old.cancelled_by is not null
       or old.cancelled_at is not null
       or new.status is distinct from 'dibatalkan'
       or old.status in ('selesai', 'dibatalkan')
       or auth.uid() is null
       or new.cancelled_by is distinct from auth.uid()
       or new.cancelled_at is null then
      raise exception 'Cancellation metadata must identify the authenticated actor exactly once'
        using errcode = '42501';
    end if;
  end if;

  if new.final_report_approved_by is distinct from old.final_report_approved_by
     or new.final_report_approved_at is distinct from old.final_report_approved_at then
    if old.final_report_approved_by is not null
       or old.final_report_approved_at is not null
       or new.status is distinct from 'selesai'
       or old.status is distinct from 'menunggu_laporan'
       or auth.uid() is null
       or new.final_report_approved_by is distinct from auth.uid()
       or new.final_report_approved_at is null then
      raise exception 'Final report approval metadata must identify the authenticated approver exactly once'
        using errcode = '42501';
    end if;
  end if;

  return new;
end
$$;

drop trigger if exists guard_event_approval_actor on public.events;
create trigger guard_event_approval_actor
before update on public.events
for each row execute procedure app_private.guard_event_approval_actor();

revoke all on function app_private.guard_event_approval_actor() from public, anon, authenticated;

commit;
