-- KOPPKAS revision 004: explicit Data API grants and audit trail
begin;

grant usage on schema public to anon, authenticated;

grant select on public.announcements to anon, authenticated;
grant insert on public.public_messages to anon, authenticated;
grant select on public.media_assets to anon, authenticated;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.members to authenticated;
grant select, insert, update, delete on public.organization_positions to authenticated;
grant select, insert, update on public.events to authenticated;
grant select, insert, update, delete on public.event_committee to authenticated;
grant select, insert, update, delete on public.monthly_dues to authenticated;
grant select, insert on public.monthly_dues_payments to authenticated;
grant select, insert on public.general_ledger_entries to authenticated;
grant select, insert on public.event_ledger_entries to authenticated;
grant select on public.event_surplus_transfers to authenticated;
grant select, insert, update on public.official_letters to authenticated;
grant select, insert, update on public.announcements to authenticated;
grant select, insert, update, delete on public.media_assets to authenticated;
grant select on public.public_messages to authenticated;
grant select on public.inbox_replies to authenticated;
grant select, update on public.notifications to authenticated;
grant select on public.activity_logs to authenticated;
grant select on public.monthly_dues_summary to authenticated;

create or replace function app_private.write_activity_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data jsonb;
  old_data jsonb;
  new_data jsonb;
  target_id uuid;
  changed_fields text[];
begin
  if tg_op = 'DELETE' then
    old_data := to_jsonb(old);
    row_data := old_data;
  elsif tg_op = 'UPDATE' then
    old_data := to_jsonb(old);
    new_data := to_jsonb(new);
    row_data := new_data;
    select coalesce(array_agg(key order by key), array[]::text[])
      into changed_fields
    from jsonb_each(new_data) n
    where n.value is distinct from old_data -> n.key;
  else
    row_data := to_jsonb(new);
  end if;

  target_id := nullif(row_data ->> 'id', '')::uuid;

  insert into public.activity_logs (
    actor_id, action, resource_type, resource_id, metadata
  ) values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    target_id,
    jsonb_build_object('changed_fields', coalesce(changed_fields, array[]::text[]))
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$$;

revoke all on function app_private.write_activity_log() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'members',
    'events',
    'monthly_dues',
    'monthly_dues_payments',
    'general_ledger_entries',
    'event_ledger_entries',
    'official_letters',
    'announcements',
    'public_messages'
  ] loop
    execute format(
      'create trigger audit_%I after insert or update or delete on public.%I for each row execute procedure app_private.write_activity_log()',
      t, t
    );
  end loop;
end
$$;

commit;
