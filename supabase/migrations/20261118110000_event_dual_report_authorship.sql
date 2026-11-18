-- KOPPKAS revision 019: require independent event narrative and finance reports before closeout.
begin;

alter table public.events
  add column final_report_by uuid references public.profiles(id) on delete restrict,
  add column final_report_submitted_at timestamptz,
  add column financial_report text,
  add column financial_report_by uuid references public.profiles(id) on delete restrict,
  add column financial_report_submitted_at timestamptz;

create or replace function app_private.guard_event_report_authorship()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  role_now public.app_role;
  finance_author_role public.app_role;
begin
  role_now := app_private.current_app_role();

  if new.financial_report is distinct from old.financial_report
     or new.financial_report_by is distinct from old.financial_report_by
     or new.financial_report_submitted_at is distinct from old.financial_report_submitted_at then
    if old.financial_report_submitted_at is not null then
      raise exception 'Bendahara financial report has already been submitted'
        using errcode = '55000';
    end if;
    if auth.uid() is null or role_now <> 'bendahara'
       or new.financial_report_by is distinct from auth.uid()
       or new.financial_report_submitted_at is null
       or char_length(trim(coalesce(new.financial_report, ''))) < 10
       or char_length(trim(coalesce(new.financial_report, ''))) > 10000 then
      raise exception 'Only Bendahara may submit a valid event financial report'
        using errcode = '42501';
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
       or new.created_by is distinct from auth.uid()
       or new.final_report_by is distinct from auth.uid()
       or new.final_report_submitted_at is null
       or char_length(trim(coalesce(new.final_report, ''))) < 10
       or char_length(trim(coalesce(new.final_report, ''))) > 10000 then
      raise exception 'Only the event creator acting as Ketua Panitia may submit the narrative report'
        using errcode = '42501';
    end if;
  end if;

  if old.status = 'berlangsung' and new.status = 'menunggu_laporan' then
    if new.final_report_by is distinct from new.created_by
       or new.final_report_submitted_at is null
       or new.financial_report_by is null
       or new.financial_report_submitted_at is null
       or nullif(trim(new.financial_report), '') is null then
      raise exception 'Narrative report by Ketua Panitia and financial report by Bendahara are both required'
        using errcode = '22023';
    end if;

    select p.role into finance_author_role
    from public.profiles p
    where p.id = new.financial_report_by
      and p.is_active = true;

    if finance_author_role <> 'bendahara' then
      raise exception 'Financial report author must be an active Bendahara'
        using errcode = '42501';
    end if;
  end if;

  if old.status = 'menunggu_laporan' and new.status = 'selesai' then
    if new.final_report_by is distinct from new.created_by
       or new.final_report_submitted_at is null
       or new.financial_report_by is null
       or new.financial_report_submitted_at is null
       or nullif(trim(new.final_report), '') is null
       or nullif(trim(new.financial_report), '') is null then
      raise exception 'Both event reports must be complete before final approval'
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
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  role_now := app_private.current_app_role();
  if role_now <> 'bendahara' then
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

  update public.events
  set financial_report = trim(p_report),
      financial_report_by = auth.uid(),
      financial_report_submitted_at = now(),
      updated_at = now()
  where id = p_event_id;

  return p_event_id;
end
$$;

revoke all on function app_private.guard_event_report_authorship() from public, anon, authenticated;
revoke all on function public.submit_event_financial_report(uuid, text) from public, anon;
grant execute on function public.submit_event_financial_report(uuid, text) to authenticated;

commit;
