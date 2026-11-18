import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const migration = (name) => readFileSync(join(process.cwd(), "supabase/migrations", name), "utf8");

const core = migration("20261117000100_core_schema.sql");
const numbering = migration("20261117000200_letter_numbering_and_inbox.sql");
const dues = migration("20261117000300_dues_and_event_workflows.sql");
const grants = migration("20261117000400_api_grants_and_audit.sql");
const approvals = migration("20261117000500_approval_guards.sql");
const inlineDues = migration("20261117000800_inline_dues_member_and_letter_submit.sql");
const opening = migration("20261117000900_opening_balance_and_balance_view.sql");
const hardening = migration("20261117001000_access_hardening.sql");
const publicEvents = migration("20261117001100_public_events.sql");

test("finance uses exact numeric precision and source-level idempotency", () => {
  assert.match(core, /amount numeric\(15,2\)/);
  assert.match(core, /unique \(source_type, source_id\)/);
  assert.match(core, /idempotency_key uuid not null unique/);
  assert.match(dues, /record_monthly_dues_payment/);
});

test("monthly dues payments post exactly once to the general ledger", () => {
  assert.match(core, /monthly_dues_payment_to_general_ledger/);
  assert.match(core, /'monthly_dues_payment'/);
  assert.match(core, /on conflict \(source_type, source_id\) do nothing/);
});

test("voluntary monthly dues reference remains Rp10,000 without debt or fines", () => {
  assert.match(core, /reference_amount numeric\(15,2\) not null default 10000/);
  assert.doesNotMatch(core, /fine_amount|penalty_amount|mandatory_debt/i);
});

test("public contact accepts submissions but does not grant anonymous reads", () => {
  assert.match(core, /public_contact_submit" on public\.public_messages\s+for insert to anon, authenticated/i);
  assert.doesNotMatch(core, /for select to anon[\s\S]{0,120}public_messages/i);
});

test("INBOX notifications fan out to active role accounts and use realtime", () => {
  assert.match(numbering, /notify_new_public_message/);
  assert.match(numbering, /where p\.is_active = true\s+and p\.role is not null/);
  assert.match(numbering, /alter publication supabase_realtime add table public\.notifications/);
});

test("official letter numbering is atomic, yearly continuous and immutable", () => {
  assert.match(numbering, /on conflict \(year\) do update/);
  assert.match(numbering, /lpad\(new\.sequence_number::text, 3, '0'\)/);
  assert.match(approvals, /Issued letter number is immutable/);
  assert.match(core, /unique \(year, sequence_number\)/);
});

test("event surplus transfer is unique per event and only positive surplus is moved", () => {
  assert.match(core, /event_id uuid not null unique references public\.events/);
  assert.match(dues, /if surplus > 0 then/);
  assert.match(dues, /'transfer_masuk'/);
  assert.match(dues, /Transfer surplus ke Uang Keseluruhan/);
});

test("inline dues registration creates incomplete member and monthly dues in one transaction", () => {
  assert.match(inlineDues, /create_member_and_monthly_dues/);
  assert.match(inlineDues, /values \(trim\(p_full_name\), null, auth\.uid\(\)\)/);
  assert.match(inlineDues, /values \(new_member_id, p_dues_month, 10000\)/);
});

test("October closing balance is carried forward as a snapshot, not a ledger inflow", () => {
  assert.match(opening, /date '2026-11-01',\s+205000\.00/);
  assert.match(opening, /bukan pemasukan baru/);
  assert.match(opening, /create or replace view public\.general_ledger_balance/);
  assert.doesNotMatch(opening, /insert into public\.general_ledger_entries/i);
});

test("all core exposed tables enable row level security", () => {
  const tables = [
    "profiles","members","organization_positions","events","event_committee",
    "monthly_dues","monthly_dues_payments","general_ledger_entries","event_ledger_entries",
    "event_surplus_transfers","official_letters","announcements","media_assets",
    "public_messages","inbox_replies","notifications","activity_logs"
  ];
  for (const table of tables) {
    assert.match(core, new RegExp(`alter table public\\.${table} enable row level security`), table);
  }
  assert.match(grants, /grant select on public\.activity_logs to authenticated/);
});

test("member deletion requires archive reason and hard delete is revoked", () => {
  assert.match(hardening, /members_archive_reason_required/);
  assert.match(hardening, /revoke delete on public\.members from authenticated/);
});

test("notifications can only be marked read by recipients", () => {
  assert.match(hardening, /grant update \(read_at\) on public\.notifications to authenticated/);
  assert.match(core, /notifications_update_own/);
});

test("letter sequence and opening-balance tables are protected by RLS", () => {
  assert.match(numbering, /alter table public\.letter_year_sequences enable row level security/);
  assert.match(opening, /alter table public\.general_ledger_opening_balances enable row level security/);
});

test("public event listings expose only approved statuses", () => {
  assert.match(publicEvents, /status in \('terbit','berlangsung','menunggu_laporan','selesai'\)/);
});


const eventFinalization = migration("20261118050000_event_finance_finalization_guards.sql");
const letterPrivacy = migration("20261118060000_public_letter_verification_privacy.sql");
const eventBalance = migration("20261118070000_event_ledger_balance_summary.sql");
const eventDualReports = migration("20261118110000_event_dual_report_authorship.sql");
const duesIdempotency = migration("20261118150000_monthly_dues_idempotency_payload_guard.sql");
const eventLedgerIdempotency = migration("20261118160000_event_ledger_idempotency.sql");

test("public letter verification never exposes financial letters or full letter bodies", () => {
  assert.match(letterPrivacy, /drop policy if exists "letters_public_verify_published"/);
  assert.ok(letterPrivacy.includes("revoke select on public.official_letters from anon, public;"));
  assert.ok(letterPrivacy.includes("revoke select (body, category, letter_number) on public.official_letters from anon, public;"));
  assert.match(letterPrivacy, /l\.category = 'umum'/);
  assert.match(letterPrivacy, /create or replace view public\.public_letter_verifications/);
  assert.match(letterPrivacy, /security_barrier = true, security_invoker = true/);
  assert.match(letterPrivacy, /grant select \(id, letter_number, subject, category, status, approved_at, created_at\)/);
  assert.match(letterPrivacy, /for select to anon[\s\S]*?status = 'terbit' and category = 'umum'/);
  assert.match(letterPrivacy, /grant select on public\.public_letter_verifications to anon/);
  assert.doesNotMatch(letterPrivacy, /l\.body/);
});

test("finalized event data and event ledger are protected by database triggers", () => {
  assert.match(eventFinalization, /old\.status in \('selesai', 'dibatalkan'\)/);
  assert.match(eventFinalization, /Event ledger is locked outside the active event period/);
  assert.match(eventFinalization, /public\.event_surplus_transfers/);
  assert.match(eventFinalization, /gle\.source_type = 'event_surplus_transfer'/);
});

test("event ledger insert trigger remains installed while its guard function is hardened", () => {
  assert.match(eventFinalization, /create trigger guard_event_ledger_insert/);
  assert.ok(eventLedgerIdempotency.includes("create or replace function app_private.guard_event_ledger_insert()"));
  assert.match(eventLedgerIdempotency, /Event finance idempotency key is required/);
});

test("event finance dashboard aggregate is lifetime-scoped, not limited to latest 100 rows", () => {
  assert.match(eventBalance, /create or replace view public\.event_ledger_balance_summary/);
  assert.match(eventBalance, /sum\(case when direction = 'masuk' then amount else -amount end\)/);
  assert.match(eventBalance, /count\(\*\)::bigint as transaction_count/);
});


const committeeHardening = migration("20261118080000_committee_dues_letters_audit_hardening.sql");

test("event committee management is limited to creator and core leadership before closeout", () => {
  assert.match(committeeHardening, /drop policy if exists "event_committee_manage_authenticated"/);
  assert.match(committeeHardening, /event_committee_insert_event_managers/);
  assert.match(committeeHardening, /event_committee_update_event_managers/);
  assert.match(committeeHardening, /event_committee_delete_event_managers/);
  assert.match(committeeHardening, /e\.status not in \('menunggu_laporan', 'selesai', 'dibatalkan'\)/);
  assert.match(committeeHardening, /e\.created_by = \(select auth\.uid\(\)\)/);
});

test("monthly dues idempotent retries must match the original actor and payload", () => {
  assert.equal(duesIdempotency.split("existing_payment.recorded_by is distinct from auth.uid()").length - 1, 2);
  assert.ok(duesIdempotency.includes("existing_payment.monthly_dues_id <> p_monthly_dues_id"));
  assert.ok(duesIdempotency.includes("existing_payment.amount <> p_amount"));
  assert.ok(duesIdempotency.includes("coalesce(existing_payment.note, '') <> coalesce(normalized_note, '')"));
});

test("monthly dues register rows cannot be deleted", () => {
  assert.match(committeeHardening, /revoke delete on public\.monthly_dues from authenticated/);
  assert.match(committeeHardening, /monthly_dues_update_finance_roles/);
});

test("submitted official letter content is immutable", () => {
  assert.match(committeeHardening, /old\.status <> 'draft'/);
  assert.match(committeeHardening, /new\.subject is distinct from old\.subject/);
  assert.match(committeeHardening, /new\.body is distinct from old\.body/);
  assert.match(committeeHardening, /new\.category is distinct from old\.category/);
});

test("activity audit covers structure, event committee and media", () => {
  for (const table of ["organization_positions", "event_committee", "media_assets"]) {
    assert.match(committeeHardening, new RegExp(`'${table}'`));
    assert.match(committeeHardening, /create trigger audit_%I/);
  }
});


const accountAuditGrants = migration("20261118100000_server_account_audit_grants.sql");

test("server-side account administration can write profiles and actor-attributed audit events", () => {
  assert.match(accountAuditGrants, /grant select, insert, update, delete on public\.profiles to service_role/);
  assert.match(accountAuditGrants, /grant insert on public\.activity_logs to service_role/);
});


test("dual-report migration uses valid dollar-quoted trigger function syntax", () => {
  assert.ok(eventDualReports.includes("create or replace function app_private.guard_event_finalized_updates()"));
  assert.match(eventDualReports, /as \$\$[\s\S]*?end\s+\$\$;/);
});

test("event finalization guard has no forward dependency on dual-report columns", () => {
  assert.doesNotMatch(eventFinalization, /new\.(committee_chair_profile_id|final_report_by|final_report_submitted_at|financial_report_by|financial_report_submitted_at)/);
  assert.match(eventDualReports, /add column committee_chair_profile_id/);
  assert.match(eventDualReports, /create or replace function app_private\.guard_event_finalized_updates/);
  assert.match(eventDualReports, /new\.financial_report_submitted_at is distinct from old\.financial_report_submitted_at/);
});


const eventApprovalActor = migration("20261118200000_event_approval_actor_attribution.sql");

test("event approval and cancellation metadata are bound to the authenticated actor exactly once", () => {
  assert.match(eventApprovalActor, /new\.approved_by is distinct from auth\.uid\(\)/);
  assert.match(eventApprovalActor, /new\.cancelled_by is distinct from auth\.uid\(\)/);
  assert.match(eventApprovalActor, /new\.final_report_approved_by is distinct from auth\.uid\(\)/);
  assert.match(eventApprovalActor, /old\.approved_by is not null/);
  assert.match(eventApprovalActor, /old\.cancelled_by is not null/);
  assert.match(eventApprovalActor, /old\.final_report_approved_by is not null/);
  assert.match(eventApprovalActor, /create trigger guard_event_approval_actor/);
});


const lastActiveKetuaGuard = migration("20261118210000_last_active_ketua_guard.sql");

test("database serializes changes that could remove the last active Ketua account", () => {
  assert.match(lastActiveKetuaGuard, /pg_advisory_xact_lock\(74102820261118::bigint\)/);
  assert.match(lastActiveKetuaGuard, /old\.role = 'ketua_pemuda'/);
  assert.match(lastActiveKetuaGuard, /old\.is_active = true/);
  assert.match(lastActiveKetuaGuard, /active_ketua_count <= 1/);
  assert.match(lastActiveKetuaGuard, /before update of role, is_active on public\.profiles/);
});


const announcementMediaRoleRls = migration("20261118220000_announcement_media_role_rls.sql");

test("announcement and media database policies match approved role boundaries", () => {
  assert.match(announcementMediaRoleRls, /announcements_insert_authorized_roles/);
  assert.match(announcementMediaRoleRls, /media_insert_authorized_roles/);
  assert.match(announcementMediaRoleRls, /'ketua_rw_01','ketua_rt_01'/);
  assert.match(announcementMediaRoleRls, /announcements_delete_ketua[\s\S]*?has_any_role\(array\['ketua_pemuda'\]/);
  assert.match(announcementMediaRoleRls, /media_delete_ketua[\s\S]*?has_any_role\(array\['ketua_pemuda'\]/);
  assert.doesNotMatch(announcementMediaRoleRls, /has_any_role\(array\['ketua_pemuda','wakil_ketua_pemuda','sekretaris','bendahara','ketua_rw_01','ketua_rt_01'\]/);
});
