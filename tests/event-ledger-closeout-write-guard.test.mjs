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

test("final-report approval serializes on the event row and restricts approver roles", () => {
  const start = workflow.indexOf("create or replace function public.approve_event_final_report");
  const end = workflow.indexOf("revoke all on function public.approve_event_final_report", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const approval = workflow.slice(start, end);
  assert.match(approval, /has_any_role\(array\['ketua_pemuda','wakil_ketua_pemuda','bendahara'\]/);
  assert.match(approval, /from public\.events\s+where id = p_event_id\s+for update/i);
  assert.match(approval, /target_event\.status <> 'menunggu_laporan'/);
  assert.match(approval, /on conflict \(source_type, source_id\) do nothing/i);
  assert.match(approval, /on conflict \(event_id\) do nothing/i);
  assert.match(migration, /from public\.events\s+where id = p_event_id\s+for update/i);
});
test("event finance RPC uses a fixed search path and is not executable by public roles", () => {
  assert.match(migration, /security definer\s+set search_path = ''/i);
  assert.match(migration, /revoke all on function public\.record_event_finance_entry\([\s\S]*?from public, anon/i);
  assert.match(migration, /grant execute on function public\.record_event_finance_entry\([\s\S]*?to authenticated/i);
});
