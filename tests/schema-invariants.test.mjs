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

test("public letter verification never exposes financial letters or full letter bodies", () => {
  assert.match(letterPrivacy, /drop policy if exists "letters_public_verify_published"/);
  assert.match(letterPrivacy, /revoke select on public\.official_letters from anon/);
  assert.match(letterPrivacy, /l\.category = 'umum'/);
  assert.doesNotMatch(letterPrivacy, /returns table[\s\S]*?body text/i);
  assert.match(letterPrivacy, /grant execute on function public\.verify_public_letter\(uuid\) to anon, authenticated/);
});

test("finalized event data and event ledger are protected by database triggers", () => {
  assert.match(eventFinalization, /old\.status in \('selesai', 'dibatalkan'\)/);
  assert.match(eventFinalization, /Event ledger is locked outside the active event period/);
  assert.match(eventFinalization, /public\.event_surplus_transfers/);
  assert.match(eventFinalization, /gle\.source_type = 'event_surplus_transfer'/);
});

test("event finance dashboard aggregate is lifetime-scoped, not limited to latest 100 rows", () => {
  assert.match(eventBalance, /create or replace view public\.event_ledger_balance_summary/);
  assert.match(eventBalance, /sum\(case when direction = 'masuk' then amount else -amount end\)/);
  assert.match(eventBalance, /count\(\*\)::bigint as transaction_count/);
});
