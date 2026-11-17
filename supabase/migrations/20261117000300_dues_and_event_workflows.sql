-- KOPPKAS revision 003: idempotent dues, inline member creation, event closeout
begin;

-- Direct member creation requires gender; the dues workflow has a dedicated, constrained path.
drop policy if exists "members_manage_secretary" on public.members;
create policy "members_insert_complete_secretary" on public.members
for insert to authenticated
with check (
  gender is not null
  and app_private.has_any_role(array['sekretaris']::public.app_role[])
  and created_by = (select auth.uid())
);
create policy "members_update_secretary" on public.members
for update to authenticated
using (app_private.has_any_role(array['sekretaris']::public.app_role[]))
with check (app_private.has_any_role(array['sekretaris']::public.app_role[]));
create policy "members_delete_secretary" on public.members
for delete to authenticated
using (app_private.has_any_role(array['sekretaris']::public.app_role[]));

create or replace function public.create_member_for_dues(p_full_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare new_member_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','bendahara','sekretaris']::public.app_role[]) then
    raise exception 'Not authorized to create a member from the dues workflow' using errcode = '42501';
  end if;
  if p_full_name is null or char_length(trim(p_full_name)) not between 2 and 120 then
    raise exception 'Name must contain 2 to 120 characters' using errcode = '22023';
  end if;

  insert into public.members (full_name, gender, created_by)
  values (trim(p_full_name), null, auth.uid())
  returning id into new_member_id;

  return new_member_id;
end
$$;

revoke all on function public.create_member_for_dues(text) from public, anon;
grant execute on function public.create_member_for_dues(text) to authenticated;

create or replace function public.record_monthly_dues_payment(
  p_monthly_dues_id uuid,
  p_amount numeric,
  p_idempotency_key uuid,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare payment_id uuid;
declare existing_payment public.monthly_dues_payments%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','bendahara','sekretaris']::public.app_role[]) then
    raise exception 'Not authorized to record monthly dues' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 9999999999999.99 then
    raise exception 'Payment amount must be positive and within supported range' using errcode = '22023';
  end if;
  if p_idempotency_key is null then
    raise exception 'Idempotency key is required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.monthly_dues where id = p_monthly_dues_id) then
    raise exception 'Monthly dues record not found' using errcode = 'P0002';
  end if;

  select * into existing_payment
  from public.monthly_dues_payments
  where idempotency_key = p_idempotency_key;

  if found then
    if existing_payment.monthly_dues_id <> p_monthly_dues_id
       or existing_payment.amount <> p_amount then
      raise exception 'Idempotency key was already used with different payment data' using errcode = '22023';
    end if;
    return existing_payment.id;
  end if;

  insert into public.monthly_dues_payments (
    monthly_dues_id, amount, recorded_by, note, idempotency_key
  ) values (
    p_monthly_dues_id, p_amount, auth.uid(), nullif(trim(p_note), ''), p_idempotency_key
  )
  on conflict (idempotency_key) do nothing
  returning id into payment_id;

  if payment_id is null then
    select id into payment_id
    from public.monthly_dues_payments
    where idempotency_key = p_idempotency_key;
  end if;

  return payment_id;
end
$$;

revoke all on function public.record_monthly_dues_payment(uuid,numeric,uuid,text) from public, anon;
grant execute on function public.record_monthly_dues_payment(uuid,numeric,uuid,text) to authenticated;

create or replace view public.monthly_dues_summary
with (security_invoker = true)
as
select
  md.id,
  md.member_id,
  m.full_name,
  m.gender,
  md.dues_month,
  md.reference_amount,
  coalesce(sum(p.amount), 0)::numeric(15,2) as paid_amount,
  greatest(md.reference_amount - coalesce(sum(p.amount), 0), 0)::numeric(15,2) as remaining_amount,
  case
    when coalesce(sum(p.amount), 0) >= md.reference_amount then 'lunas'
    else 'belum_lunas'
  end as payment_status
from public.monthly_dues md
join public.members m on m.id = md.member_id
left join public.monthly_dues_payments p on p.monthly_dues_id = md.id
group by md.id, md.member_id, m.full_name, m.gender, md.dues_month, md.reference_amount;

grant select on public.monthly_dues_summary to authenticated;

create or replace function public.approve_event_final_report(p_event_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare target_event public.events%rowtype;
declare surplus numeric(15,2);
declare ledger_id uuid;
declare transfer_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','bendahara']::public.app_role[]) then
    raise exception 'Not authorized to approve event final reports' using errcode = '42501';
  end if;

  select * into target_event
  from public.events
  where id = p_event_id
  for update;

  if not found then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;
  if target_event.status <> 'menunggu_laporan'
     or nullif(trim(target_event.final_report), '') is null then
    raise exception 'Event is not ready for final report approval' using errcode = '22023';
  end if;
  if target_event.final_report_approved_at is not null then
    raise exception 'Final report has already been approved' using errcode = '23505';
  end if;

  select coalesce(sum(case when direction = 'masuk' then amount else -amount end), 0)
  into surplus
  from public.event_ledger_entries
  where event_id = p_event_id;

  update public.events
  set final_report_approved_by = auth.uid(),
      final_report_approved_at = now(),
      status = 'selesai',
      updated_at = now()
  where id = p_event_id;

  if surplus > 0 then
    insert into public.general_ledger_entries (
      direction, amount, description, source_type, source_id, created_by
    ) values (
      'transfer_masuk',
      surplus,
      'Transfer surplus kegiatan — ' || target_event.title,
      'event_surplus_transfer',
      p_event_id,
      auth.uid()
    )
    on conflict (source_type, source_id) do nothing
    returning id into ledger_id;

    if ledger_id is null then
      select id into ledger_id
      from public.general_ledger_entries
      where source_type = 'event_surplus_transfer'
        and source_id = p_event_id;
    end if;

    insert into public.event_surplus_transfers (
      event_id, amount, approved_by, general_ledger_entry_id
    ) values (
      p_event_id, surplus, auth.uid(), ledger_id
    )
    on conflict (event_id) do nothing
    returning id into transfer_id;

    insert into public.event_ledger_entries (
      event_id, direction, amount, description, created_by
    ) values (
      p_event_id,
      'keluar',
      surplus,
      'Transfer surplus ke Uang Keseluruhan',
      auth.uid()
    );
  end if;

  return p_event_id;
end
$$;

revoke all on function public.approve_event_final_report(uuid) from public, anon;
grant execute on function public.approve_event_final_report(uuid) to authenticated;

commit;
