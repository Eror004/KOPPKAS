-- Prevent non-finance dues operators from implicitly creating or rolling over a period.
-- Secretary may use dues RPCs while the current period is already active, but only
-- Ketua/Wakil/Bendahara may activate a missing period or perform rollover.
begin;

create or replace function app_private.ensure_current_monthly_dues_period()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_now timestamptz;
  v_month date;
  v_latest date;
  v_loop_month date;
  v_period public.monthly_dues_periods%rowtype;
begin
  v_now := clock_timestamp();
  v_month := pg_catalog.date_trunc('month', v_now at time zone 'Asia/Jakarta')::date;

  select * into v_period from public.monthly_dues_periods
  where dues_month = v_month and status = 'active';
  if found then
    return jsonb_build_object('dues_month', v_month, 'status', v_period.status,
      'data_status', v_period.data_status, 'processed_at', v_now);
  end if;

  -- A missing current period is a lifecycle transition. Do not let Secretary
  -- trigger it indirectly through member/register/payment RPCs.
  if not app_private.has_any_role(array[
    'ketua_pemuda','wakil_ketua_pemuda','bendahara'
  ]::public.app_role[]) then
    raise exception 'Not authorized to activate monthly dues lifecycle' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('koppkas-monthly-dues-period-lifecycle', 0)
  );

  -- Recheck after acquiring the lifecycle lock; another authorized request may
  -- have activated the current period while this transaction was waiting.
  v_now := clock_timestamp();
  v_month := pg_catalog.date_trunc('month', v_now at time zone 'Asia/Jakarta')::date;
  select * into v_period from public.monthly_dues_periods
  where dues_month = v_month and status = 'active';
  if found then
    return jsonb_build_object('dues_month', v_month, 'status', v_period.status,
      'data_status', v_period.data_status, 'processed_at', v_now);
  end if;

  -- Lock every active period before capturing the effective processing time.
  perform p.dues_month
  from public.monthly_dues_periods p
  where p.status = 'active'
  order by p.dues_month
  for update;

  v_now := clock_timestamp();
  v_month := pg_catalog.date_trunc('month', v_now at time zone 'Asia/Jakarta')::date;

  select max(dues_month) into v_latest from public.monthly_dues_periods;
  if v_latest is null then
    raise exception 'Monthly dues period baseline is unavailable' using errcode = 'P0002';
  end if;
  if v_latest > v_month then
    raise exception 'Latest monthly dues period is later than the Jakarta current month'
      using errcode = '55000';
  end if;

  update public.monthly_dues_periods p
  set status = 'closed',
      closed_effective_at = (p.dues_month + interval '1 month')::date::timestamp at time zone 'Asia/Jakarta',
      closed_processed_at = v_now
  where p.status = 'active' and p.dues_month < v_month;

  if v_latest < v_month then
    for v_loop_month in
      select series_month::date
      from pg_catalog.generate_series(
        (v_latest + interval '1 month')::date::timestamp,
        v_month::timestamp, interval '1 month'
      ) as series(series_month)
    loop
      insert into public.monthly_dues_periods (
        dues_month, opened_at, opened_by, status, data_status,
        opened_effective_at, opened_processed_at, closed_effective_at, closed_processed_at
      ) values (
        v_loop_month, v_now,
        case when v_loop_month = v_month then auth.uid() end,
        case when v_loop_month = v_month then 'active' else 'closed' end,
        case when v_loop_month = v_month
          or exists (
            select 1 from public.monthly_dues md
            where md.dues_month = v_loop_month
          )
          or exists (
            select 1 from public.monthly_dues_payments pay
            join public.monthly_dues md on md.id = pay.monthly_dues_id
            where md.dues_month = v_loop_month
          )
          or exists (select 1 from public.monthly_dues_cash_expenses ex where ex.dues_month = v_loop_month)
          then 'available' else 'historical_empty' end,
        v_loop_month::timestamp at time zone 'Asia/Jakarta',
        v_now,
        case when v_loop_month < v_month
          then (v_loop_month + interval '1 month')::date::timestamp at time zone 'Asia/Jakarta' end,
        case when v_loop_month < v_month then v_now end
      ) on conflict (dues_month) do nothing;
    end loop;
  end if;

  select * into v_period from public.monthly_dues_periods where dues_month = v_month;
  if not found or v_period.status <> 'active' then
    raise exception 'Current period is not active and will not be reopened automatically'
      using errcode = '55000';
  end if;

  return jsonb_build_object('dues_month', v_month, 'status', v_period.status,
    'data_status', v_period.data_status, 'processed_at', v_now);
end;
$function$;

revoke all on function app_private.ensure_current_monthly_dues_period() from public, anon, authenticated;

comment on function app_private.ensure_current_monthly_dues_period() is
  'Ensures the current Jakarta period exists. Only Ketua Pemuda, Wakil Ketua Pemuda, and Bendahara may trigger activation/rollover; other authorized dues operators may proceed only when the period is already active.';

commit;
