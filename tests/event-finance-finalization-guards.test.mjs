import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationPath = new URL(
  "../supabase/migrations/20261118050000_event_finance_finalization_guards.sql",
  import.meta.url,
);
const migration = await readFile(migrationPath, "utf8");

test("finalized and cancelled events reject further updates", () => {
  assert.match(migration, /old\.status in \('selesai', 'dibatalkan'\)/);
  assert.match(migration, /Finalized or cancelled events cannot be changed/);
});

test("event details and final report are locked while awaiting approval", () => {
  assert.match(migration, /old\.status = 'menunggu_laporan'/);
  for (const field of ["title", "description", "location", "starts_at", "ends_at", "final_report"]) {
    assert.match(migration, new RegExp(`new\\.${field} is distinct from old\\.${field}`));
  }
});

test("event ledger inserts require an authorized finance role", () => {
  assert.match(migration, /role_now not in \('ketua_pemuda', 'wakil_ketua_pemuda', 'bendahara'\)/);
  assert.match(migration, /Not authorized to record event finance/);
});

test("event ledger inserts are blocked outside active event states", () => {
  assert.match(migration, /event_state in \('terbit', 'berlangsung'\)/);
  assert.match(migration, /Event ledger is locked outside the active event period/);
});

test("closeout exception requires its matching general-ledger transfer", () => {
  assert.match(migration, /public\.event_surplus_transfers/);
  assert.match(migration, /gle\.source_type = 'event_surplus_transfer'/);
  assert.match(migration, /gle\.source_id = t\.event_id/);
  assert.match(migration, /new\.description = 'Transfer surplus ke Uang Keseluruhan'/);
  assert.match(migration, /new\.created_by = auth\.uid\(\)/);
});

test("closeout transfer entry cannot be appended more than once", () => {
  assert.match(migration, /not exists \(/);
  assert.match(migration, /existing\.description = 'Transfer surplus ke Uang Keseluruhan'/);
  assert.match(migration, /if is_approved_surplus_transfer then\s+return new;/);
});
