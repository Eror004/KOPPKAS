-- KOPPKAS: serialize the one-time first Ketua Pemuda bootstrap.
-- The guard is intentionally inaccessible to browser roles. It is claimed by a
-- server-side bootstrap script before creating the first Auth user.
begin;

create table public.first_ketua_bootstrap_guard (
  id boolean primary key default true check (id = true),
  claimed_at timestamptz not null default now(),
  completed_at timestamptz,
  auth_user_id uuid references auth.users(id) on delete restrict,
  constraint first_ketua_bootstrap_completion_consistent
    check (
      (completed_at is null and auth_user_id is null)
      or (completed_at is not null and auth_user_id is not null)
    )
);

alter table public.first_ketua_bootstrap_guard enable row level security;
revoke all on public.first_ketua_bootstrap_guard from public, anon, authenticated;
grant select, insert, update, delete on public.first_ketua_bootstrap_guard to service_role;

comment on table public.first_ketua_bootstrap_guard is
  'One-time singleton claim for provisioning the initial KOPPKAS Ketua Pemuda account. Server-only; retain after completion as an audit guard.';

commit;
