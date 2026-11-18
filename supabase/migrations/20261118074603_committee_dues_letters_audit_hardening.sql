-- KOPPKAS revision 016: narrow committee management, preserve dues history, and complete audit coverage.
begin;

-- Committee membership is managed only by the event creator or core leadership,
-- and never after an event has been finalized or cancelled.
drop policy if exists "event_committee_manage_authenticated" on public.event_committee;

create policy "event_committee_insert_event_managers" on public.event_committee
for insert to authenticated
with check (
  exists (
    select 1
    from public.events e
    where e.id = event_id
      and e.status not in ('menunggu_laporan', 'selesai', 'dibatalkan')
      and (
        e.created_by = (select auth.uid())
        or app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','sekretaris']::public.app_role[])
      )
  )
);

create policy "event_committee_update_event_managers" on public.event_committee
for update to authenticated
using (
  exists (
    select 1
    from public.events e
    where e.id = event_id
      and e.status not in ('menunggu_laporan', 'selesai', 'dibatalkan')
      and (
        e.created_by = (select auth.uid())
        or app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','sekretaris']::public.app_role[])
      )
  )
)
with check (
  exists (
    select 1
    from public.events e
    where e.id = event_id
      and e.status not in ('menunggu_laporan', 'selesai', 'dibatalkan')
      and (
        e.created_by = (select auth.uid())
        or app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','sekretaris']::public.app_role[])
      )
  )
);

create policy "event_committee_delete_event_managers" on public.event_committee
for delete to authenticated
using (
  exists (
    select 1
    from public.events e
    where e.id = event_id
      and e.status not in ('menunggu_laporan', 'selesai', 'dibatalkan')
      and (
        e.created_by = (select auth.uid())
        or app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','sekretaris']::public.app_role[])
      )
  )
);

-- Monthly dues rows are historical records. Payments are corrected through
-- audited payment reversal/adjustment workflows, never by deleting the register.
drop policy if exists "monthly_dues_manage_finance_roles" on public.monthly_dues;
create policy "monthly_dues_insert_finance_roles" on public.monthly_dues
for insert to authenticated
with check (
  app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','bendahara']::public.app_role[])
);
create policy "monthly_dues_update_finance_roles" on public.monthly_dues
for update to authenticated
using (
  app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','bendahara']::public.app_role[])
)
with check (
  app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','bendahara']::public.app_role[])
);
revoke delete on public.monthly_dues from authenticated;

-- Once a letter leaves draft, its body, subject and category are immutable.
create or replace function app_private.guard_submitted_letter_content()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status <> 'draft' and (
    new.subject is distinct from old.subject
    or new.body is distinct from old.body
    or new.category is distinct from old.category
  ) then
    raise exception 'Submitted or issued letter content is immutable'
      using errcode = '55000';
  end if;
  return new;
end
$$;

drop trigger if exists guard_submitted_letter_content on public.official_letters;
create trigger guard_submitted_letter_content
before update on public.official_letters
for each row execute procedure app_private.guard_submitted_letter_content();

revoke all on function app_private.guard_submitted_letter_content() from public, anon, authenticated;

-- Extend activity logging to structure, committee and media changes. Account-profile
-- changes are logged explicitly by the Ketua-only server actions to preserve actor identity.
do $$
declare target_table text;
begin
  foreach target_table in array array[
    'organization_positions',
    'event_committee',
    'media_assets'
  ] loop
    execute format('drop trigger if exists audit_%I on public.%I', target_table, target_table);
    execute format(
      'create trigger audit_%I after insert or update or delete on public.%I for each row execute procedure app_private.write_activity_log()',
      target_table, target_table
    );
  end loop;
end
$$;

commit;
