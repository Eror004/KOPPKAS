-- Require the designated Ketua Panitia to still have an active organization account.
create or replace function public.submit_event_narrative_report(p_event_id uuid, p_report text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  target_status public.event_status;
  target_chair uuid;
  finance_author uuid;
  report_already_submitted timestamptz;
  role_now public.app_role;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  role_now := app_private.current_app_role();
  if role_now is null then
    raise exception 'An active organization account is required' using errcode = '42501';
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
$function$;
