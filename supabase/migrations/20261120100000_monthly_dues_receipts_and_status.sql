-- KOPPKAS: monthly dues status, persisted receipt read model, and safe member/register workflows.
-- Prepared on an isolated backend branch. Do not apply until migration history is reconciled.
begin;

-- The voluntary monthly reference is fixed at Rp10,000. Existing production rows were
-- inspected before preparing this constraint; the live table currently has zero rows.
alter table public.monthly_dues
  alter column reference_amount set default 10000;

alter table public.monthly_dues
  add constraint monthly_dues_reference_amount_fixed
  check (reference_amount = 10000);

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
  coalesce(sum(p.amount), 0::numeric)::numeric(15,2) as paid_amount,
  greatest(md.reference_amount - coalesce(sum(p.amount), 0::numeric), 0::numeric)::numeric(15,2) as remaining_amount,
  case
    when coalesce(sum(p.amount), 0::numeric) >= 10000 then 'lunas'::text
    when coalesce(sum(p.amount), 0::numeric) > 0 then 'kurang'::text
    else 'belum_bayar'::text
  end as payment_status
from public.monthly_dues md
join public.members m on m.id = md.member_id
left join public.monthly_dues_payments p on p.monthly_dues_id = md.id
group by md.id, md.member_id, m.full_name, m.gender, md.dues_month, md.reference_amount;

revoke all on public.monthly_dues_summary from public, anon;
grant select on public.monthly_dues_summary to authenticated;

-- A receipt is a read-only projection of a persisted payment. The UUID-derived
-- reference is unique because it includes the complete immutable payment UUID.
create or replace view public.monthly_dues_payment_receipts
with (security_invoker = true)
as
with ordered_payments as (
  select
    p.id as payment_id,
    p.monthly_dues_id,
    p.amount,
    p.paid_at,
    p.recorded_by,
    p.note,
    sum(p.amount) over (
      partition by p.monthly_dues_id
      order by p.paid_at asc, p.id asc
      rows between unbounded preceding and current row
    )::numeric(15,2) as paid_amount_after_transaction
  from public.monthly_dues_payments p
)
select
  'KAS-' || to_char(md.dues_month, 'YYYYMM') || '-' || upper(replace(op.payment_id::text, '-', '')) as payment_reference,
  op.payment_id,
  op.monthly_dues_id,
  md.member_id,
  m.full_name as member_name,
  op.amount,
  op.paid_at,
  md.dues_month,
  op.note,
  op.recorded_by,
  recorder.full_name as recorded_by_name,
  md.reference_amount,
  op.paid_amount_after_transaction,
  case
    when op.paid_amount_after_transaction >= 10000 then 'lunas'::text
    when op.paid_amount_after_transaction > 0 then 'kurang'::text
    else 'belum_bayar'::text
  end as status_after_transaction
from ordered_payments op
join public.monthly_dues md on md.id = op.monthly_dues_id
join public.members m on m.id = md.member_id
left join public.profiles recorder on recorder.id = op.recorded_by;

revoke all on public.monthly_dues_payment_receipts from public, anon;
grant select on public.monthly_dues_payment_receipts to authenticated;

-- Add a period register for an existing active member without creating a new identity.
create or replace function public.ensure_monthly_dues_for_member(
  p_member_id uuid,
  p_dues_month date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_dues_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not app_private.has_any_role(array[
    'ketua_pemuda','wakil_ketua_pemuda','bendahara','sekretaris'
  ]::public.app_role[]) then
    raise exception 'Not authorized to prepare a monthly dues register' using errcode = '42501';
  end if;

  if p_member_id is null or p_dues_month is null
     or extract(day from p_dues_month) <> 1 then
    raise exception 'A member and first day of a month are required' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.members
    where id = p_member_id and archived_at is null
  ) then
    raise exception 'Active member not found' using errcode = 'P0002';
  end if;

  insert into public.monthly_dues (member_id, dues_month, reference_amount)
  values (p_member_id, p_dues_month, 10000)
  on conflict (member_id, dues_month) do nothing
  returning id into v_dues_id;

  if v_dues_id is null then
    select id into v_dues_id
    from public.monthly_dues
    where member_id = p_member_id and dues_month = p_dues_month;
  end if;

  return v_dues_id;
end;
$function$;

revoke all on function public.ensure_monthly_dues_for_member(uuid, date) from public, anon;
grant execute on function public.ensure_monthly_dues_for_member(uuid, date) to authenticated;

-- Exact-name matches are returned for disambiguation. A second person with the same
-- name can still be created, but only after an explicit confirmation from the caller.
create or replace function public.create_member_and_monthly_dues_safe(
  p_full_name text,
  p_dues_month date,
  p_confirm_same_name boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_member_id uuid;
  v_dues_id uuid;
  v_matches jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not app_private.has_any_role(array[
    'ketua_pemuda','wakil_ketua_pemuda','bendahara','sekretaris'
  ]::public.app_role[]) then
    raise exception 'Not authorized to add a member from monthly dues' using errcode = '42501';
  end if;

  if p_full_name is null or char_length(trim(p_full_name)) not between 2 and 120 then
    raise exception 'Name must contain 2 to 120 characters' using errcode = '22023';
  end if;

  if p_dues_month is null or extract(day from p_dues_month) <> 1 then
    raise exception 'Dues month must be the first day of a month' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(pg_catalog.lower(pg_catalog.btrim(p_full_name)), 0)
  );

  select coalesce(
    jsonb_agg(jsonb_build_object('id', candidate.id, 'full_name', candidate.full_name) order by candidate.full_name, candidate.id),
    '[]'::jsonb
  )
  into v_matches
  from (
    select id, full_name
    from public.members
    where archived_at is null
      and pg_catalog.lower(pg_catalog.btrim(full_name)) = pg_catalog.lower(pg_catalog.btrim(p_full_name))
    order by id
  ) candidate;

  if jsonb_array_length(v_matches) > 0 and not coalesce(p_confirm_same_name, false) then
    return jsonb_build_object('status', 'duplicate_candidates', 'matches', v_matches);
  end if;

  insert into public.members (full_name, gender, created_by)
  values (pg_catalog.btrim(p_full_name), null, auth.uid())
  returning id into v_member_id;

  insert into public.monthly_dues (member_id, dues_month, reference_amount)
  values (v_member_id, p_dues_month, 10000)
  returning id into v_dues_id;

  return jsonb_build_object(
    'status', 'created',
    'member_id', v_member_id,
    'monthly_dues_id', v_dues_id,
    'full_name', pg_catalog.btrim(p_full_name)
  );
end;
$function$;

revoke all on function public.create_member_and_monthly_dues_safe(text, date, boolean) from public, anon;
grant execute on function public.create_member_and_monthly_dues_safe(text, date, boolean) to authenticated;

comment on view public.monthly_dues_payment_receipts is
  'Read-only receipt projection from persisted monthly dues payments; respects underlying RLS via security_invoker.';
comment on function public.ensure_monthly_dues_for_member(uuid, date) is
  'Creates or returns the monthly register row for an existing active member without creating a new member.';
comment on function public.create_member_and_monthly_dues_safe(text, date, boolean) is
  'Creates a member and monthly register atomically; exact-name matches require explicit same-name confirmation.';

commit;
