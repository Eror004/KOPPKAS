import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../supabase/migrations/20261118150000_monthly_dues_idempotency_payload_guard.sql", import.meta.url), "utf8");

test("monthly dues idempotency validates member-period, amount and normalized note", () => {
  assert.match(migration, /existing_payment\.monthly_dues_id <> p_monthly_dues_id/);
  assert.match(migration, /existing_payment\.amount <> p_amount/);
  assert.match(migration, /coalesce\(existing_payment\.note, ''\) <> coalesce\(normalized_note, ''\)/);
});

test("monthly dues idempotency validates the payload after a concurrent unique-key race", () => {
  const checks = migration.match(/coalesce\(existing_payment\.note, ''\) <> coalesce\(normalized_note, ''\)/g) ?? [];
  assert.equal(checks.length, 2);
  assert.match(migration, /on conflict \(idempotency_key\) do nothing/);
});

test("monthly dues payment notes are capped at 500 characters in the database", () => {
  assert.match(migration, /char_length\(coalesce\(normalized_note, ''\)\) > 500/);
});
