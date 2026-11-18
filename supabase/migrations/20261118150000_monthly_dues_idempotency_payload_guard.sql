-- KOPPKAS revision 022: validate the complete monthly-dues payment payload on idempotent retries.
begin;

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
as $record_dues$
declare
  payment_id uuid;
  existing_payment public.monthly_dues_payments%rowtype;
  normalized_note text := nullif(trim(p_note), '');
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
  if char_length(coalesce(normalized_note, '')) > 500 then
    raise exception 'Payment note must not exceed 500 characters' using errcode = '22023';
  end if;
  if not exists (select 1 from public.monthly_dues where id = p_monthly_dues_id) then
    raise exception 'Monthly dues record not found' using errcode = 'P0002';
  end if;

  select * into existing_payment
  from public.monthly_dues_payments
  where idempotency_key = p_idempotency_key;

  if found then
    if existing_payment.monthly_dues_id <> p_monthly_dues_id
       or existing_payment.amount <> p_amount
       or coalesce(existing_payment.note, '') <> coalesce(normalized_note, '') then
      raise exception 'Idempotency key was already used with different payment data' using errcode = '22023';
    end if;
    return existing_payment.id;
  end if;

  insert into public.monthly_dues_payments (
    monthly_dues_id, amount, recorded_by, note, idempotency_key
  ) values (
    p_monthly_dues_id, p_amount, auth.uid(), normalized_note, p_idempotency_key
  )
  on conflict (idempotency_key) do nothing
  returning id into payment_id;

  if payment_id is null then
    select * into existing_payment
    from public.monthly_dues_payments
    where idempotency_key = p_idempotency_key;

    if not found then
      raise exception 'Payment idempotency conflict could not be resolved' using errcode = '40001';
    end if;

    if existing_payment.monthly_dues_id <> p_monthly_dues_id
       or existing_payment.amount <> p_amount
       or coalesce(existing_payment.note, '') <> coalesce(normalized_note, '') then
      raise exception 'Idempotency key was already used with different payment data' using errcode = '22023';
    end if;

    payment_id := existing_payment.id;
  end if;

  return payment_id;
end
$record_dues$;

revoke all on function public.record_monthly_dues_payment(uuid, numeric, uuid, text) from public, anon;
grant execute on function public.record_monthly_dues_payment(uuid, numeric, uuid, text) to authenticated;

commit;
