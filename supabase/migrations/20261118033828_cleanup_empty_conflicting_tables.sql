-- Reconstructed from the already-applied remote cleanup migration.
-- Guarded locally: only empty legacy tables may be removed; non-empty data aborts.
begin;
do $$
declare
  target text;
  target_oid regclass;
  has_rows boolean;
begin
  foreach target in array array[
    'public.events',
    'public.organization_positions',
    'public.members'
  ] loop
    target_oid := to_regclass(target);
    if target_oid is not null then
      execute format('select exists (select 1 from %s)', target_oid) into has_rows;
      if has_rows then
        raise exception 'Refusing to remove non-empty legacy table %', target;
      end if;
      execute format('drop table %s', target_oid);
    end if;
  end loop;
end
$$;
commit;
