import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [migration, action, rpcMigration] = await Promise.all([
  readFile(new URL("../supabase/migrations/20261119090000_monthly_dues_rpc_only_write_path.sql", import.meta.url), "utf8"),
  readFile(new URL("../src/app/dashboard/uang-kas-bulanan/actions.ts", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20261118074623_monthly_dues_idempotency_payload_guard.sql", import.meta.url), "utf8"),
]);

test("monthly dues payments cannot be inserted directly through PostgREST roles", () => {
  assert.match(migration, /drop policy if exists dues_payments_insert_recorders/i);
  assert.match(migration, /revoke insert on table public\.monthly_dues_payments\s+from anon, authenticated/i);
});

test("the application keeps payment writes behind the validated RPC", () => {
  assert.match(action, /supabase\.rpc\("record_monthly_dues_payment"/);
  assert.doesNotMatch(action, /from\(["']monthly_dues_payments["']\)\s*\.insert/);
});

test("the validated RPC remains the authenticated write path with payload checks", () => {
  assert.match(rpcMigration, /security definer/i);
  assert.match(rpcMigration, /grant execute on function public\.record_monthly_dues_payment\(uuid, numeric, uuid, text\) to authenticated/i);
  assert.match(rpcMigration, /p_amount is null or p_amount <= 0 or p_amount > 9999999999999\.99/);
  assert.match(rpcMigration, /char_length\(coalesce\(normalized_note, ''\)\) > 500/);
  assert.match(rpcMigration, /existing_payment\.recorded_by is distinct from auth\.uid\(\)/);
});
