import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [migration, hardening, actions] = await Promise.all([
  read("../supabase/migrations/20261118190000_general_ledger_source_direction_guard.sql"),
  read("../supabase/migrations/20261118033900_access_hardening.sql"),
  read("../src/app/dashboard/uang-keseluruhan/actions.ts"),
]);

test("manual ledger entries cannot use system transfer directions", () => {
  assert.match(migration, /source_type = 'manual' and direction in \('masuk', 'keluar'\)/);
  assert.match(migration, /direction in \('masuk', 'keluar'\)[\s\S]*?created_by = \(select auth\.uid\(\)\)/);
});

test("automated ledger source types are paired with their only valid directions", () => {
  assert.match(migration, /source_type = 'monthly_dues_payment' and direction = 'masuk'/);
  assert.match(migration, /source_type = 'event_surplus_transfer' and direction = 'transfer_masuk'/);
});

test("legacy permissive and previous manual insert policies are removed before recreation", () => {
  assert.match(migration, /drop policy if exists "general_ledger_insert_finance_roles"/);
  assert.match(migration, /drop policy if exists "general_ledger_insert_manual_finance_roles"/);
  assert.match(migration, /create policy "general_ledger_insert_manual_finance_roles"/);
});

test("application action continues to accept only ordinary manual directions", () => {
  assert.match(actions, /direction !== "masuk" && direction !== "keluar"/);
  assert.match(actions, /source_type: "manual"/);
});

test("source allowlist from the previous hardening migration remains intact", () => {
  assert.match(hardening, /source_type in \('manual', 'monthly_dues_payment', 'event_surplus_transfer'\)/);
});
