-- KOPPKAS revision 014: expose only minimal metadata for public general-letter verification.
begin;

drop policy if exists "letters_public_verify_published" on public.official_letters;
revoke select on public.official_letters from anon;

drop function if exists public.verify_public_letter(uuid);

-- This deliberately owner-privileged projection is the only public read surface.
-- It exposes no body or financial category and cannot be used to query the base table.
create or replace view public.public_letter_verifications
with (security_barrier = true, security_invoker = false)
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
