-- KOPPKAS core schema, revision 001
-- Apply only to a dedicated KOPPKAS Supabase project after reviewing this migration.
begin;

create extension if not exists pgcrypto with schema extensions;

create schema if not exists app_private;

create type public.app_role as enum (
  'ketua_pemuda',
  'wakil_ketua_pemuda',
  'sekretaris',
  'bendahara',
  'ketua_rw_01',
  'ketua_rt_01'
);

create type public.member_gender as enum ('laki_laki', 'perempuan');
create type public.event_status as enum ('draft', 'menunggu_persetujuan', 'terbit', 'berlangsung', 'menunggu_laporan', 'selesai', 'dibatalkan');
create type public.message_status as enum ('baru', 'diproses', 'selesai');
create type public.ledger_direction as enum ('masuk', 'keluar', 'transfer_masuk', 'transfer_keluar');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  role public.app_role,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  gender public.member_gender,
  phone text,
  address text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index members_name_search_idx on public.members using gin (to_tsvector('simple', full_name));
create index members_gender_active_idx on public.members (gender) where archived_at is null;

create table public.organization_positions (
  id uuid primary key default gen_random_uuid(),
  position_name text not null unique,
  member_id uuid references public.members(id) on delete set null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 3 and 160),
  description text,
  location text,
  starts_at timestamptz,
  ends_at timestamptz,
  status public.event_status not null default 'draft',
  created_by uuid not null references public.profiles(id) on delete restrict,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  cancelled_by uuid references public.profiles(id) on delete set null,
  cancelled_at timestamptz,
  cancellation_reason text,
  final_report text,
  final_report_approved_by uuid references public.profiles(id) on delete set null,
  final_report_approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at >= starts_at),
  check (status <> 'dibatalkan' or nullif(trim(cancellation_reason), '') is not null)
);

create table public.event_committee (
  event_id uuid not null references public.events(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete restrict,
  committee_role text not null,
  created_at timestamptz not null default now(),
  primary key (event_id, member_id)
);

create table public.monthly_dues (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete restrict,
  dues_month date not null check (extract(day from dues_month) = 1),
  reference_amount numeric(15,2) not null default 10000 check (reference_amount >= 0),
  created_at timestamptz not null default now(),
  unique (member_id, dues_month)
);

create table public.general_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  direction public.ledger_direction not null,
  amount numeric(15,2) not null check (amount > 0),
  description text not null check (char_length(trim(description)) between 2 and 240),
  source_type text not null,
  source_id uuid not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (source_type, source_id)
);

create index general_ledger_date_idx on public.general_ledger_entries (occurred_at desc);

create table public.monthly_dues_payments (
  id uuid primary key default gen_random_uuid(),
  monthly_dues_id uuid not null references public.monthly_dues(id) on delete restrict,
  amount numeric(15,2) not null check (amount > 0),
  paid_at timestamptz not null default now(),
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  note text,
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now()
);

create index monthly_dues_payments_dues_idx on public.monthly_dues_payments (monthly_dues_id, paid_at desc);

create table public.event_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  direction public.ledger_direction not null check (direction in ('masuk', 'keluar')),
  amount numeric(15,2) not null check (amount > 0),
  description text not null,
  occurred_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.event_surplus_transfers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events(id) on delete restrict,
  amount numeric(15,2) not null check (amount > 0),
  transferred_at timestamptz not null default now(),
  approved_by uuid not null references public.profiles(id) on delete restrict,
  general_ledger_entry_id uuid not null unique references public.general_ledger_entries(id) on delete restrict
);

create table public.official_letters (
  id uuid primary key default gen_random_uuid(),
  letter_number text not null default '' unique,
  year integer not null default extract(year from now())::integer check (year between 2000 and 2200),
  sequence_number integer not null default 0 check (sequence_number >= 0),
  subject text not null,
  body text not null,
  status text not null default 'draft' check (status in ('draft', 'menunggu_persetujuan', 'terbit', 'dibatalkan')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  cancelled_by uuid references public.profiles(id) on delete set null,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (year, sequence_number),
  check (status <> 'dibatalkan' or nullif(trim(cancellation_reason), '') is not null)
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  is_published boolean not null default false,
  published_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  storage_path text not null unique,
  visibility text not null default 'public' check (visibility in ('public', 'internal')),
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.public_messages (
  id uuid primary key default gen_random_uuid(),
  sender_name text not null check (char_length(trim(sender_name)) between 2 and 120),
  sender_contact text not null check (char_length(trim(sender_contact)) between 5 and 160),
  category text not null check (char_length(trim(category)) between 2 and 80),
  subject text not null check (char_length(trim(subject)) between 3 and 160),
  message text not null check (char_length(trim(message)) between 10 and 5000),
  status public.message_status not null default 'baru',
  assigned_to uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index public_messages_status_date_idx on public.public_messages (status, created_at desc);

create table public.inbox_replies (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.public_messages(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  body text not null check (char_length(trim(body)) between 1 and 5000),
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  priority text not null default 'normal' check (priority in ('normal', 'penting', 'mendesak')),
  resource_type text,
  resource_id uuid,
  read_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_date_idx on public.notifications (recipient_id, created_at desc) where archived_at is null;

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index activity_logs_date_idx on public.activity_logs (created_at desc);

-- Request-scoped authorization helpers. Kept in a non-exposed schema.
create or replace function app_private.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid())
    and p.is_active = true
  limit 1
$$;

create or replace function app_private.has_any_role(allowed_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(app_private.current_app_role() = any(allowed_roles), false)
$$;

revoke all on schema app_private from public, anon, authenticated;
grant usage on schema app_private to authenticated;
revoke all on all functions in schema app_private from public, anon;
grant execute on all functions in schema app_private to authenticated;

-- Profile rows are created by an Auth trigger. Role assignment is never user-editable.
create or replace function app_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Pengguna Baru')
  );
  return new;
end
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure app_private.handle_new_user();

-- Keep updated_at server-managed.
create or replace function app_private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

do $$
declare t text;
begin
  foreach t in array array['profiles','members','events','official_letters','announcements','public_messages'] loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute procedure app_private.set_updated_at()', t);
  end loop;
end
$$;

-- Every recorded monthly payment posts once to the overall ledger.
create or replace function app_private.post_monthly_dues_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare member_name text;
begin
  select m.full_name into member_name
  from public.monthly_dues md
  join public.members m on m.id = md.member_id
  where md.id = new.monthly_dues_id;

  insert into public.general_ledger_entries (
    direction, amount, description, source_type, source_id, created_by, occurred_at
  ) values (
    'masuk',
    new.amount,
    'Pembayaran kas bulanan — ' || coalesce(member_name, 'Anggota'),
    'monthly_dues_payment',
    new.id,
    new.recorded_by,
    new.paid_at
  )
  on conflict (source_type, source_id) do nothing;

  return new;
end
$$;

create trigger monthly_dues_payment_to_general_ledger
after insert on public.monthly_dues_payments
for each row execute procedure app_private.post_monthly_dues_payment();

-- Enable RLS on every exposed application table.
alter table public.profiles enable row level security;
alter table public.members enable row level security;
alter table public.organization_positions enable row level security;
alter table public.events enable row level security;
alter table public.event_committee enable row level security;
alter table public.monthly_dues enable row level security;
alter table public.monthly_dues_payments enable row level security;
alter table public.general_ledger_entries enable row level security;
alter table public.event_ledger_entries enable row level security;
alter table public.event_surplus_transfers enable row level security;
alter table public.official_letters enable row level security;
alter table public.announcements enable row level security;
alter table public.media_assets enable row level security;
alter table public.public_messages enable row level security;
alter table public.inbox_replies enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_logs enable row level security;

-- Profiles: self-read, leadership oversight; only Ketua can manage accounts.
create policy "profiles_read_self_or_leadership" on public.profiles
for select to authenticated
using (id = (select auth.uid()) or app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda']::public.app_role[]));

create policy "profiles_update_self_non_privileged" on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (
  id = (select auth.uid())
  and role is not distinct from app_private.current_app_role()
  and is_active = true
);

create policy "profiles_manage_ketua" on public.profiles
for all to authenticated
using (app_private.has_any_role(array['ketua_pemuda']::public.app_role[]))
with check (app_private.has_any_role(array['ketua_pemuda']::public.app_role[]));

-- Member directory: all active dashboard roles can read; Sekretaris manages.
create policy "members_read_authenticated" on public.members
for select to authenticated
using (app_private.current_app_role() is not null);
create policy "members_manage_secretary" on public.members
for all to authenticated
using (app_private.has_any_role(array['sekretaris']::public.app_role[]))
with check (app_private.has_any_role(array['sekretaris']::public.app_role[]));

create policy "positions_read_authenticated" on public.organization_positions
for select to authenticated using (app_private.current_app_role() is not null);
create policy "positions_manage_secretary" on public.organization_positions
for all to authenticated
using (app_private.has_any_role(array['sekretaris']::public.app_role[]))
with check (app_private.has_any_role(array['sekretaris']::public.app_role[]));

create policy "events_read_authenticated" on public.events
for select to authenticated using (app_private.current_app_role() is not null);
create policy "events_create_allowed_roles" on public.events
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and app_private.current_app_role() is not null
);
create policy "events_update_creator_or_leadership" on public.events
for update to authenticated
using (
  created_by = (select auth.uid())
  or app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','sekretaris']::public.app_role[])
)
with check (
  created_by = (select auth.uid())
  or app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','sekretaris']::public.app_role[])
);

create policy "event_committee_read_authenticated" on public.event_committee
for select to authenticated using (app_private.current_app_role() is not null);
create policy "event_committee_manage_authenticated" on public.event_committee
for all to authenticated
using (app_private.current_app_role() is not null)
with check (app_private.current_app_role() is not null);

-- Finance access is intentionally narrower than general dashboard access.
create policy "monthly_dues_read_finance_roles" on public.monthly_dues
for select to authenticated
using (app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','bendahara']::public.app_role[]));
create policy "monthly_dues_manage_finance_roles" on public.monthly_dues
for all to authenticated
using (app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','bendahara']::public.app_role[]))
with check (app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','bendahara']::public.app_role[]));

create policy "dues_payments_read_finance_roles" on public.monthly_dues_payments
for select to authenticated
using (app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','bendahara']::public.app_role[]));
create policy "dues_payments_insert_recorders" on public.monthly_dues_payments
for insert to authenticated
with check (
  recorded_by = (select auth.uid())
  and app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','bendahara','sekretaris']::public.app_role[])
);

create policy "general_ledger_read_finance_roles" on public.general_ledger_entries
for select to authenticated
using (app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','bendahara']::public.app_role[]));
create policy "general_ledger_insert_finance_roles" on public.general_ledger_entries
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','bendahara']::public.app_role[])
);

create policy "event_ledger_read_finance_roles" on public.event_ledger_entries
for select to authenticated
using (app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','bendahara']::public.app_role[]));
create policy "event_ledger_insert_finance_roles" on public.event_ledger_entries
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','bendahara']::public.app_role[])
);

create policy "event_surplus_read_finance_roles" on public.event_surplus_transfers
for select to authenticated
using (app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','bendahara']::public.app_role[]));

create policy "letters_read_authenticated" on public.official_letters
for select to authenticated using (app_private.current_app_role() is not null);
create policy "letters_create_allowed_roles" on public.official_letters
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','sekretaris','bendahara','ketua_rw_01','ketua_rt_01']::public.app_role[])
);
create policy "letters_update_leadership_secretary" on public.official_letters
for update to authenticated
using (app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','sekretaris']::public.app_role[]))
with check (app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda','sekretaris']::public.app_role[]));

create policy "announcements_public_read_published" on public.announcements
for select to anon, authenticated using (is_published = true);
create policy "announcements_internal_read" on public.announcements
for select to authenticated using (app_private.current_app_role() is not null);
create policy "announcements_manage_authenticated" on public.announcements
for all to authenticated
using (app_private.current_app_role() is not null)
with check (app_private.current_app_role() is not null);

create policy "media_public_read" on public.media_assets
for select to anon, authenticated using (visibility = 'public');
create policy "media_internal_read" on public.media_assets
for select to authenticated using (visibility = 'internal' and app_private.current_app_role() is not null);
create policy "media_manage_authenticated" on public.media_assets
for all to authenticated
using (app_private.current_app_role() is not null)
with check (uploaded_by = (select auth.uid()) and app_private.current_app_role() is not null);

-- Public visitors can submit a message but cannot read any message.
create policy "public_contact_submit" on public.public_messages
for insert to anon, authenticated
with check (status = 'baru' and assigned_to is null);
create policy "inbox_read_all_six_roles" on public.public_messages
for select to authenticated
using (app_private.current_app_role() is not null);

create policy "inbox_replies_read_all_six_roles" on public.inbox_replies
for select to authenticated
using (app_private.current_app_role() is not null);

-- Inbox reply/status update permissions remain intentionally ungranted pending a role decision.
create policy "notifications_read_own" on public.notifications
for select to authenticated using (recipient_id = (select auth.uid()));
create policy "notifications_update_own" on public.notifications
for update to authenticated
using (recipient_id = (select auth.uid()))
with check (recipient_id = (select auth.uid()));

create policy "activity_logs_read_leadership" on public.activity_logs
for select to authenticated
using (app_private.has_any_role(array['ketua_pemuda','wakil_ketua_pemuda']::public.app_role[]));

commit;
