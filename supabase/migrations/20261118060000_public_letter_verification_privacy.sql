-- KOPPKAS revision 014: expose only minimal metadata for public general-letter verification.
begin;

drop policy if exists "letters_public_verify_published" on public.official_letters;
drop policy if exists "letters_public_verify_general_metadata" on public.official_letters;
revoke select on public.official_letters from anon, public;
-- Table-level revokes do not clear existing column-level grants. Remove the
-- legacy body grant explicitly, then grant only the public verification fields.
revoke select (body, category, letter_number) on public.official_letters from anon, public;

create policy "letters_public_verify_general_metadata" on public.official_letters
for select to anon
using (status = 'terbit' and category = 'umum');

-- Column-level grants prevent anon from selecting body or other private columns.
grant select (id, letter_number, subject, category, status, approved_at, created_at)
on public.official_letters to anon;

drop function if exists public.verify_public_letter(uuid);

create or replace view public.public_letter_verifications
with (security_barrier = true, security_invoker = true)
as
select
  l.id,
  l.letter_number,
  l.subject,
  l.category,
  l.status,
  l.approved_at,
  l.created_at
from public.official_letters l
where l.status = 'terbit'
  and l.category = 'umum';

revoke all on public.public_letter_verifications from public, anon, authenticated;
grant select on public.public_letter_verifications to anon;

commit;
