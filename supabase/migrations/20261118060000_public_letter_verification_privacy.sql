-- KOPPKAS revision 014: make public letter verification metadata-only and exclude financial letters.
begin;

drop policy if exists "letters_public_verify_published" on public.official_letters;
revoke select on public.official_letters from anon;

create or replace function public.verify_public_letter(target_letter_id uuid)
returns table (
  letter_number text,
  subject text,
  category text,
  status text,
  approved_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    l.letter_number,
    l.subject,
    l.category,
    l.status,
    l.approved_at,
    l.created_at
  from public.official_letters l
  where l.id = target_letter_id
    and l.status = 'terbit'
    and l.category = 'umum'
  limit 1
$$;

revoke all on function public.verify_public_letter(uuid) from public, anon, authenticated;
grant execute on function public.verify_public_letter(uuid) to anon, authenticated;

commit;
