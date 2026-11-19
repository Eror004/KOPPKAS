import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [migration, action, approvalMigration] = await Promise.all([
  readFile(new URL("../supabase/migrations/20261119100000_event_ledger_closeout_write_guard.sql", import.meta.url), "utf8"),
  readFile(new URL("../src/app/dashboard/keuangan-kegiatan/actions.ts", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20261118033844_dues_and_event_workflows.sql", import.meta.url), "utf8"),
]);

test("event ledger writes are removed from direct PostgREST INSERT access", () => {
  assert.match(migration, /drop policy if exists event_ledger_insert_finance_roles/i);
  assert.match(migration, /revoke insert on table public\.event_ledger_entries\s+from anon, authenticated/i);
});

test("event ledger RPC locks the event and only accepts open event statuses", () => {
  assert.match(migration, /from public\.events\s+where id = p_event_id\s+for update/i);
  assert.match(migration, /target_event\.status not in \('terbit','berlangsung'\)/i);
  assert.match(migration, /grant execute on function public\.record_event_finance_entry/);
});

test("event ledger RPC validates role, amount, description and idempotency payload", () => {
  assert.match(migration, /has_any_role\(array\['ketua_pemuda','wakil_ketua_pemuda','bendahara'\]/);
  assert.match(migration, /p_amount <= 0/);
  assert.match(migration, /char_length\(normalized_description\) < 2 or char_length\(normalized_description\) > 240/);
  assert.match(migration, /existing_entry\.created_by is distinct from auth\.uid\(\)/);
});

test("approval and event-ledger writes serialize on the same event row", () => {
  assert.match(approvalMigration, /from public\.events\s+where id = p_event_id\s+for update/i);
  assert.match(migration, /from public\.events\s+where id = p_event_id\s+for update/i);
});

test("application records event transactions only through the guarded RPC", () => {
  assert.match(action, /supabase\.rpc\("record_event_finance_entry"/);
  assert.doesNotMatch(action, /from\(["']event_ledger_entries["']\)\s*\.insert/);
});
