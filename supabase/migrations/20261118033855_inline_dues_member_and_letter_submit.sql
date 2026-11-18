-- KOPPKAS revision 008: atomic inline member registration from monthly dues
begin;

create or replace function public.create_member_and_monthly_dues(
  p_full_name text,
  p_dues_month date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare new_member_id uuid;
declare new_dues_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','bendahara','sekretaris']::public.app_role[]) then
    raise exception 'Not authorized to add a member from monthly dues' using errcode = '42501';
  end if;
  if p_full_name is null or char_length(trim(p_full_name)) not between 2 and 120 then
    raise exception 'Name must contain 2 to 120 characters' using errcode = '22023';
  end if;
  if p_dues_month is null or extract(day from p_dues_month) <> 1 then
    raise exception 'Dues month must be the first day of a month' using errcode = '22023';
  end if;

  insert into public.members (full_name, gender, created_by)
  values (trim(p_full_name), null, auth.uid())
  returning id into new_member_id;

  insert into public.monthly_dues (member_id, dues_month, reference_amount)
  values (new_member_id, p_dues_month, 10000)
  returning id into new_dues_id;

  return new_dues_id;
end
$$;

revoke all on function public.create_member_and_monthly_dues(text,date) from public, anon;
grant execute on function public.create_member_and_monthly_dues(text,date) to authenticated;

-- Allow original creators to submit their own draft letters for approval.
create policy "letters_update_own_draft" on public.official_letters
for update to authenticated
using (
  created_by = (select auth.uid())
  and status = 'draft'
)
with check (
  created_by = (select auth.uid())
  and status in ('draft', 'menunggu_persetujuan')
);

commit;
