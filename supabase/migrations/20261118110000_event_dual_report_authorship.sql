-- KOPPKAS revision 019: require independent event narrative and finance reports before closeout.
begin;

alter table public.events
  add column committee_chair_profile_id uuid references public.profiles(id) on delete restrict,
  add column final_report_by uuid references public.profiles(id) on delete restrict,
  add column final_report_submitted_at timestamptz,
  add column financial_report_by uuid references public.profiles(id) on delete restrict,
  add column financial_report_submitted_at timestamptz;

alter table public.events disable trigger guard_event_finalized_updates;
update public.events set committee_chair_profile_id = created_by where committee_chair_profile_id is null;
alter table public.events enable trigger guard_event_finalized_updates;
alter table public.events alter column committee_chair_profile_id set not null;


-- The later dual-authorship migration adds these report-author columns.
-- Extend the event lock only after those columns exist, avoiding a forward
-- dependency during the interval between migration 013 and migration 019.
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
    or new.committee_chair_profile_id is distinct from old.committee_chair_profile_id
    or new.final_report_by is distinct from old.final_report_by
    or new.final_report_submitted_at is distinct from old.final_report_submitted_at
    or new.financial_report_by is distinct from old.financial_report_by
    or new.financial_report_submitted_at is distinct from old.financial_report_submitted_at
  ) then
    raise exception 'Event details and final report are locked while awaiting approval'
      using errcode = '55000';
  end if;

  return new;
end
$$;

drop policy if exists "profiles_read_active_org_accounts" on public.profiles;
create policy "profiles_read_active_org_accounts" on public.profiles
for select to authenticated
using (is_active = true and role is not null and app_private.current_app_role() is not null);

create table public.event_financial_reports (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events(id) on delete restrict,
  report text not null check (char_length(trim(report)) between 10 and 10000),
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.event_financial_reports enable row level security;
create policy "event_financial_reports_read_finance_roles" on public.event_financial_reports
for select to authenticated
using (
  app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','bendahara']::public.app_role[])
);
grant select on public.event_financial_reports to authenticated;
revoke insert, update, delete on public.event_financial_reports from authenticated;

create trigger audit_event_financial_reports
after insert on public.event_financial_reports
for each row execute procedure app_private.write_activity_log();

create or replace function app_private.set_event_chair_default()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $event_chair$
declare chair_role public.app_role;
begin
  if new.committee_chair_profile_id is null then
    new.committee_chair_profile_id := new.created_by;
  end if;

  select p.role into chair_role
  from public.profiles p
  where p.id = new.committee_chair_profile_id
    and p.is_active = true;

  if chair_role is null then
    raise exception 'Ketua Panitia must be an active organization account'
      using errcode = '42501';
  end if;

  return new;
end
$event_chair$;

drop trigger if exists set_event_chair_default on public.events;
create trigger set_event_chair_default
before insert on public.events
for each row execute procedure app_private.set_event_chair_default();

create or replace function app_private.guard_event_report_authorship()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  role_now public.app_role;
  finance_author_role public.app_role;
  finance_report_author uuid;
  finance_report_submitted_at timestamptz;
  chair_role public.app_role;
begin
  role_now := app_private.current_app_role();

  if new.committee_chair_profile_id is distinct from old.committee_chair_profile_id then
    if old.status not in ('draft', 'terbit', 'berlangsung')
       or auth.uid() is null
       or (old.created_by is distinct from auth.uid() and role_now is distinct from 'sekretaris') then
      raise exception 'Only the event creator or Secretary may assign the Ketua Panitia'
        using errcode = '42501';
    end if;
    select p.role into chair_role
    from public.profiles p
    where p.id = new.committee_chair_profile_id
      and p.is_active = true;
    if chair_role is null then
      raise exception 'Ketua Panitia must be an active organization account'
        using errcode = '42501';
    end if;
    if new.financial_report_by is not null and new.committee_chair_profile_id = new.financial_report_by then
      raise exception 'Ketua Panitia and Bendahara report authors must be different accounts'
        using errcode = '42501';
    end if;
  end if;

  if new.financial_report_by is distinct from old.financial_report_by
     or new.financial_report_submitted_at is distinct from old.financial_report_submitted_at then
    if old.financial_report_submitted_at is not null then
      raise exception 'Bendahara financial report has already been submitted'
        using errcode = '55000';
    end if;
    if auth.uid() is null
       or role_now is distinct from 'bendahara'
       or new.financial_report_by is distinct from auth.uid()
       or new.financial_report_submitted_at is null then
      raise exception 'Only Bendahara may submit the event financial report'
        using errcode = '42501';
    end if;

    select r.submitted_by, r.submitted_at
      into finance_report_author, finance_report_submitted_at
    from public.event_financial_reports r
    where r.event_id = new.id;

    if not found
       or finance_report_author is distinct from new.financial_report_by
       or finance_report_submitted_at is distinct from new.financial_report_submitted_at then
      raise exception 'A matching Bendahara financial report record is required'
        using errcode = '22023';
    end if;
  end if;

  if new.final_report is distinct from old.final_report
     or new.final_report_by is distinct from old.final_report_by
     or new.final_report_submitted_at is distinct from old.final_report_submitted_at then
    if old.final_report_submitted_at is not null then
      raise exception 'Event narrative report has already been submitted'
        using errcode = '55000';
    end if;
    if auth.uid() is null
       or role_now is null
       or new.committee_chair_profile_id is distinct from auth.uid()
       or new.final_report_by is distinct from auth.uid()
       or new.final_report_submitted_at is null
       or char_length(trim(coalesce(new.final_report, ''))) < 10
       or char_length(trim(coalesce(new.final_report, ''))) > 10000 then
      raise exception 'Only the designated Ketua Panitia may submit the narrative report'
        using errcode = '42501';
    end if;
  end if;

  if old.status = 'berlangsung' and new.status = 'menunggu_laporan' then
    if new.final_report_by is distinct from new.committee_chair_profile_id
       or new.final_report_submitted_at is null
       or new.financial_report_by is null
       or new.financial_report_submitted_at is null
       or new.financial_report_by = new.final_report_by
       or nullif(trim(new.final_report), '') is null then
      raise exception 'Narrative report by Ketua Panitia and financial report by Bendahara are both required'
        using errcode = '22023';
    end if;

    select p.role into finance_author_role
    from public.profiles p
    where p.id = new.financial_report_by
      and p.is_active = true;

    if finance_author_role is distinct from 'bendahara' then
      raise exception 'Financial report author must be an active Bendahara'
        using errcode = '42501';
    end if;

    select p.role into chair_role
    from public.profiles p
    where p.id = new.committee_chair_profile_id
      and p.is_active = true;
    if chair_role is null then
      raise exception 'Ketua Panitia must remain active when submitting the final report'
        using errcode = '42501';
    end if;

    select r.submitted_by into finance_report_author
    from public.event_financial_reports r
    where r.event_id = new.id;

    if finance_report_author is distinct from new.financial_report_by then
      raise exception 'Bendahara financial report record is missing or mismatched'
        using errcode = '22023';
    end if;
  end if;

  if old.status = 'menunggu_laporan' and new.status = 'selesai' then
    if new.final_report_by is distinct from new.committee_chair_profile_id
       or new.final_report_submitted_at is null
       or new.financial_report_by is null
       or new.financial_report_submitted_at is null
       or new.financial_report_by = new.final_report_by
       or nullif(trim(new.final_report), '') is null then
      raise exception 'Both event reports must be complete before final approval'
        using errcode = '22023';
    end if;

    select p.role into finance_author_role
    from public.profiles p
    where p.id = new.financial_report_by
      and p.is_active = true;

    if finance_author_role is distinct from 'bendahara' then
      raise exception 'Financial report author must remain an active Bendahara'
        using errcode = '42501';
    end if;

    select p.role into chair_role
    from public.profiles p
    where p.id = new.committee_chair_profile_id
      and p.is_active = true;
    if chair_role is null then
      raise exception 'Ketua Panitia must remain active until final approval'
        using errcode = '42501';
    end if;

    select r.submitted_by, r.submitted_at
      into finance_report_author, finance_report_submitted_at
    from public.event_financial_reports r
    where r.event_id = new.id;

    if not found
       or finance_report_author is distinct from new.financial_report_by
       or finance_report_submitted_at is distinct from new.financial_report_submitted_at then
      raise exception 'Bendahara financial report record is missing or mismatched'
        using errcode = '22023';
    end if;
  end if;

  return new;
end
$$;

drop trigger if exists guard_event_report_authorship on public.events;
create trigger guard_event_report_authorship
before update on public.events
for each row execute procedure app_private.guard_event_report_authorship();

create or replace function app_private.guard_event_transitions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $event_transitions$
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
      if role_now is null or new.committee_chair_profile_id is distinct from auth.uid() then
        raise exception 'Only the designated Ketua Panitia may submit a final report' using errcode = '42501';
      end if;
      if nullif(trim(new.final_report), '') is null
         or new.final_report_by is distinct from auth.uid()
         or new.final_report_submitted_at is null then
        raise exception 'Final report content and author metadata are required' using errcode = '22023';
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
$event_transitions$;

create or replace function public.submit_event_narrative_report(
  p_event_id uuid,
  p_report text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $submit_narrative$
declare
  target_status public.event_status;
  target_chair uuid;
  finance_author uuid;
  report_already_submitted timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select e.status, e.committee_chair_profile_id, e.financial_report_by, e.final_report_submitted_at
    into target_status, target_chair, finance_author, report_already_submitted
  from public.events e
  where e.id = p_event_id
  for update;

  if not found then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;
  if target_status <> 'berlangsung' then
    raise exception 'Narrative report can only be submitted while the event is berlangsung' using errcode = '22023';
  end if;
  if target_chair is distinct from auth.uid() then
    raise exception 'Only the designated Ketua Panitia may submit the narrative report' using errcode = '42501';
  end if;
  if finance_author is null or finance_author = auth.uid() then
    raise exception 'A separate Bendahara financial report is required first' using errcode = '22023';
  end if;
  if report_already_submitted is not null then
    raise exception 'Narrative report has already been submitted' using errcode = '23505';
  end if;
  if p_report is null or char_length(trim(p_report)) < 10 or char_length(trim(p_report)) > 10000 then
    raise exception 'Narrative report must contain 10–10000 characters' using errcode = '22023';
  end if;

  update public.events
  set final_report = trim(p_report),
      final_report_by = auth.uid(),
      final_report_submitted_at = now(),
      status = 'menunggu_laporan',
      updated_at = now()
  where id = p_event_id;

  return p_event_id;
end
$submit_narrative$;

create or replace function public.submit_event_financial_report(
  p_event_id uuid,
  p_report text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  role_now public.app_role;
  target_status public.event_status;
  report_already_submitted timestamptz;
  report_timestamp timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  role_now := app_private.current_app_role();
  if role_now is distinct from 'bendahara' then
    raise exception 'Only Bendahara may submit the event financial report' using errcode = '42501';
  end if;

  if p_report is null or char_length(trim(p_report)) < 10 or char_length(trim(p_report)) > 10000 then
    raise exception 'Financial report must contain 10–10000 characters' using errcode = '22023';
  end if;

  select e.status, e.financial_report_submitted_at
    into target_status, report_already_submitted
  from public.events e
  where e.id = p_event_id
  for update;

  if not found then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;
  if target_status <> 'berlangsung' then
    raise exception 'Financial report can only be submitted while the event is berlangsung' using errcode = '22023';
  end if;
  if report_already_submitted is not null then
    raise exception 'Financial report has already been submitted' using errcode = '23505';
  end if;

  report_timestamp := now();

  insert into public.event_financial_reports (
    event_id, report, submitted_by, submitted_at
  ) values (
    p_event_id, trim(p_report), auth.uid(), report_timestamp
  );

  update public.events
  set financial_report_by = auth.uid(),
      financial_report_submitted_at = report_timestamp,
      updated_at = now()
  where id = p_event_id;

  return p_event_id;
end
$$;

revoke all on function app_private.set_event_chair_default() from public, anon, authenticated;
revoke all on function app_private.guard_event_report_authorship() from public, anon, authenticated;
revoke all on function app_private.guard_event_transitions() from public, anon, authenticated;
revoke all on function public.submit_event_financial_report(uuid, text) from public, anon;
revoke all on function public.submit_event_narrative_report(uuid, text) from public, anon;
grant execute on function public.submit_event_financial_report(uuid, text) to authenticated;
grant execute on function public.submit_event_narrative_report(uuid, text) to authenticated;

commit;
