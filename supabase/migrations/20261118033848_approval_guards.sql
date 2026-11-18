-- KOPPKAS revision 005: enforce state transitions and approval boundaries
begin;

create or replace function app_private.guard_event_transitions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare role_now public.app_role;
begin
  role_now := app_private.current_app_role();

  if new.status is distinct from old.status then
    if new.status = 'dibatalkan' then
      if role_now is null or role_now not in ('ketua_pemuda','wakil_ketua_pemuda') then
        raise exception 'Only Ketua or Wakil Ketua may cancel an event' using errcode = '42501';
      end if;
    elsif old.status = 'draft' and new.status = 'menunggu_persetujuan' then
      if role_now is null then
        raise exception 'Active organization role required' using errcode = '42501';
      end if;
    elsif old.status = 'menunggu_persetujuan' and new.status = 'terbit' then
      if role_now is null or role_now not in ('ketua_pemuda','wakil_ketua_pemuda') then
        raise exception 'Only Ketua or Wakil Ketua may publish an event' using errcode = '42501';
      end if;
      if new.approved_by is null or new.approved_at is null then
        raise exception 'Event publication approval metadata is required' using errcode = '22023';
      end if;
    elsif old.status = 'terbit' and new.status = 'berlangsung' then
      if role_now is null then
        raise exception 'Active organization role required' using errcode = '42501';
      end if;
    elsif old.status = 'berlangsung' and new.status = 'menunggu_laporan' then
      if role_now is null or (role_now <> 'sekretaris' and new.created_by <> auth.uid()) then
        raise exception 'Only the event creator or Sekretaris may submit a final report' using errcode = '42501';
      end if;
      if nullif(trim(new.final_report), '') is null then
        raise exception 'Final report content is required' using errcode = '22023';
      end if;
    elsif old.status = 'menunggu_laporan' and new.status = 'selesai' then
      if role_now is null or role_now not in ('ketua_pemuda','wakil_ketua_pemuda','bendahara') then
        raise exception 'Only authorized approvers may finalize an event' using errcode = '42501';
      end if;
      if new.final_report_approved_at is null or new.final_report_approved_by is null then
        raise exception 'Final report approval metadata is required' using errcode = '22023';
      end if;
    else
      raise exception 'Invalid event status transition: % -> %', old.status, new.status using errcode = '22023';
    end if;
  end if;

  if new.approved_by is distinct from old.approved_by
     or new.approved_at is distinct from old.approved_at
     or new.cancelled_by is distinct from old.cancelled_by
     or new.cancelled_at is distinct from old.cancelled_at then
    if role_now is null or role_now not in ('ketua_pemuda','wakil_ketua_pemuda') then
      raise exception 'Only Ketua or Wakil Ketua may change publication or cancellation metadata' using errcode = '42501';
    end if;
  end if;

  if new.final_report_approved_by is distinct from old.final_report_approved_by
     or new.final_report_approved_at is distinct from old.final_report_approved_at then
    if role_now is null or role_now not in ('ketua_pemuda','wakil_ketua_pemuda','bendahara') then
      raise exception 'Not authorized to approve the event final report' using errcode = '42501';
    end if;
  end if;

  if new.status = 'dibatalkan' and nullif(trim(new.cancellation_reason), '') is null then
    raise exception 'Cancellation reason is required' using errcode = '22023';
  end if;
  if new.status = 'dibatalkan' and (new.cancelled_by is null or new.cancelled_at is null) then
    raise exception 'Event cancellation metadata is required' using errcode = '22023';
  end if;

  return new;
end
$$;

create trigger guard_event_transitions
before update on public.events
for each row execute procedure app_private.guard_event_transitions();

create or replace function app_private.guard_letter_transitions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare role_now public.app_role;
begin
  role_now := app_private.current_app_role();

  if new.letter_number is distinct from old.letter_number
     or new.year is distinct from old.year
     or new.sequence_number is distinct from old.sequence_number then
    raise exception 'Issued letter number is immutable' using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    if new.status = 'dibatalkan' then
      if role_now is null or role_now not in ('ketua_pemuda','wakil_ketua_pemuda') then
        raise exception 'Only Ketua or Wakil Ketua may cancel an official letter' using errcode = '42501';
      end if;
    elsif old.status = 'draft' and new.status = 'menunggu_persetujuan' then
      if role_now is null then
        raise exception 'Active organization role required' using errcode = '42501';
      end if;
    elsif old.status = 'menunggu_persetujuan' and new.status = 'terbit' then
      if role_now is null or role_now not in ('ketua_pemuda','wakil_ketua_pemuda') then
        raise exception 'Only Ketua or Wakil Ketua may publish an official letter' using errcode = '42501';
      end if;
      if new.approved_by is null or new.approved_at is null then
        raise exception 'Official letter approval metadata is required' using errcode = '22023';
      end if;
    else
      raise exception 'Invalid official letter status transition' using errcode = '22023';
    end if;
  end if;

  if new.approved_by is distinct from old.approved_by
     or new.approved_at is distinct from old.approved_at
     or new.cancelled_by is distinct from old.cancelled_by
     or new.cancelled_at is distinct from old.cancelled_at then
    if role_now is null or role_now not in ('ketua_pemuda','wakil_ketua_pemuda') then
      raise exception 'Only Ketua or Wakil Ketua may change official letter approval metadata' using errcode = '42501';
    end if;
  end if;

  if new.status = 'dibatalkan' and nullif(trim(new.cancellation_reason), '') is null then
    raise exception 'Cancellation reason is required' using errcode = '22023';
  end if;
  if new.status = 'dibatalkan' and (new.cancelled_by is null or new.cancelled_at is null) then
    raise exception 'Letter cancellation metadata is required' using errcode = '22023';
  end if;

  return new;
end
$$;

create trigger guard_letter_transitions
before update on public.official_letters
for each row execute procedure app_private.guard_letter_transitions();

revoke all on function app_private.guard_event_transitions() from public, anon, authenticated;
revoke all on function app_private.guard_letter_transitions() from public, anon, authenticated;

commit;
