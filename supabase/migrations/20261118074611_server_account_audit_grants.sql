-- KOPPKAS revision 018: grant server-only account administration and explicit audit writes.
begin;

grant select, insert, update, delete on public.profiles to service_role;
grant insert on public.activity_logs to service_role;

commit;
