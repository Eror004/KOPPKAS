import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [migration, action, workflow] = await Promise.all([
  readFile(new URL("../supabase/migrations/20261119100000_event_ledger_closeout_write_guard.sql", import.meta.url), "utf8"),
  readFile(new URL("../src/app/dashboard/keuangan-kegiatan/actions.ts", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20261118033844_dues_and_event_workflows.sql", import.meta.url), "utf8"),
]);

test("event workflow tables expose only minimum client grants", () => {
  assert.match(migration, /revoke all on table public\.events,[\s\S]*?public\.event_surplus_transfers\s+from anon, authenticated/i);
  assert.match(migration, /grant select on table public\.events to anon/i);
  assert.match(migration, /grant select, insert, update on table public\.events to authenticated/i);
  assert.match(migration, /grant select on table public\.event_financial_reports,[\s\S]*?public\.event_surplus_transfers\s+to authenticated/i);
  assert.match(migration, /drop policy if exists event_ledger_insert_finance_roles/i);
});

test("event ledger write path is RPC-only and accepts only open event statuses", () => {
  assert.match(migration, /revoke all on table public\.events,[\s\S]*?public\.event_ledger_entries/);
  assert.match(migration, /from public\.events\s+where id = p_event_id\s+for update/i);
  assert.match(migration, /target_event\.status not in \('terbit','berlangsung'\)/i);
  assert.match(migration, /grant execute on function public\.record_event_finance_entry/);
  assert.match(action, /supabase\.rpc\("record_event_finance_entry"/);
  assert.doesNotMatch(action, /from\(["']event_ledger_entries["']\)\s*\.insert/);
});

test("event ledger RPC validates role, direction, amount, description and idempotency payload", () => {
  assert.match(migration, /has_any_role\(array\['ketua_pemuda','wakil_ketua_pemuda','bendahara'\]/);
  assert.match(migration, /p_direction is null or p_direction not in \('masuk','keluar'\)/);
  assert.match(migration, /p_amount <= 0/);
  assert.match(migration, /char_length\(normalized_description\) < 2 or char_length\(normalized_description\) > 240/);
  assert.match(migration, /existing_entry\.created_by is distinct from auth\.uid\(\)/);
});

test("event transaction creation serializes with final-report approval", () => {
  const approvalStart = workflow.indexOf("create or replace function public.approve_event_final_report");
  const approvalEnd = workflow.indexOf("revoke all on function public.approve_event_final_report", approvalStart);
  const approval = workflow.slice(approvalStart, approvalEnd);
  assert.match(approval, /from public\.events\s+where id = p_event_id\s+for update/i);
  assert.match(migration, /from public\.events\s+where id = p_event_id\s+for update/i);
});

test("financial and narrative reports retain separate authorship requirements", () => {
  const financeStart = workflow.indexOf("create or replace function public.submit_event_financial_report");
  const financeEnd = workflow.indexOf("revoke all on function public.submit_event_financial_report", financeStart);
  const finance = workflow.slice(financeStart, financeEnd);
  assert.match(finance, /role_now is distinct from 'bendahara'/);

  const narrativeStart = workflow.indexOf("create or replace function public.submit_event_narrative_report");
  const narrativeEnd = workflow.indexOf("revoke all on function public.submit_event_narrative_report", narrativeStart);
  const narrative = workflow.slice(narrativeStart, narrativeEnd);
  assert.match(narrative, /target_chair is distinct from auth\.uid\(\)/);
  assert.match(narrative, /finance_author = auth\.uid\(\)/);
});
