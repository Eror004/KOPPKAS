-- KOPPKAS revision 002: concurrency-safe letter numbering and inbox fan-out
begin;

create table public.letter_year_sequences (
  year integer primary key check (year between 2000 and 2200),
  last_number integer not null check (last_number >= 0),
  updated_at timestamptz not null default now()
);

alter table public.letter_year_sequences enable row level security;
revoke all on public.letter_year_sequences from anon, authenticated;

create or replace function app_private.next_letter_number(target_year integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare allocated integer;
begin
  insert into public.letter_year_sequences (year, last_number)
  values (target_year, 1)
  on conflict (year) do update
    set last_number = public.letter_year_sequences.last_number + 1,
        updated_at = now()
  returning last_number into allocated;

  return allocated;
end
$$;

create or replace function app_private.roman_month(month_number integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select (array['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'])[month_number]
$$;

create or replace function app_private.assign_official_letter_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare local_created_at timestamp;
begin
  if new.created_at is null then
    new.created_at = now();
  end if;

  local_created_at := new.created_at at time zone 'Asia/Jakarta';
  new.year := extract(year from local_created_at)::integer;
  new.sequence_number := app_private.next_letter_number(new.year);
  new.letter_number :=
    lpad(new.sequence_number::text, 3, '0')
    || '/PEMUDA-KS/'
    || app_private.roman_month(extract(month from local_created_at)::integer)
    || '/'
    || new.year::text;

  return new;
end
$$;

create trigger assign_official_letter_number
before insert on public.official_letters
for each row execute procedure app_private.assign_official_letter_number();

-- New public messages notify every active account among the six approved roles.
create or replace function app_private.notify_new_public_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (
    recipient_id, title, body, priority, resource_type, resource_id
  )
  select
    p.id,
    'Pesan publik baru',
    'Pesan baru masuk ke INBOX organisasi.',
    'normal',
    'public_message',
    new.id
  from public.profiles p
  where p.is_active = true
    and p.role is not null;

  return new;
end
$$;

create trigger notify_new_public_message
after insert on public.public_messages
for each row execute procedure app_private.notify_new_public_message();

-- Realtime is enabled only when the standard Supabase publication exists.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'notifications'
     ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end
$$;

revoke all on table public.letter_year_sequences from anon, authenticated;
revoke all on function app_private.next_letter_number(integer) from public, anon, authenticated;
revoke all on function app_private.assign_official_letter_number() from public, anon, authenticated;
revoke all on function app_private.notify_new_public_message() from public, anon, authenticated;
revoke all on function app_private.roman_month(integer) from public, anon, authenticated;

commit;
