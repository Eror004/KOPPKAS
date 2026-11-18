-- KOPPKAS revision 011: expose only approved public event information
begin;

create policy "events_public_read_published" on public.events
for select to anon
using (status in ('terbit','berlangsung','menunggu_laporan','selesai'));

grant select on public.events to anon;

commit;
