import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [actions, form, page, hardening] = await Promise.all([
  read("../src/app/dashboard/uang-keseluruhan/actions.ts"),
  read("../src/app/dashboard/uang-keseluruhan/entry-form.tsx"),
  read("../src/app/dashboard/uang-keseluruhan/page.tsx"),
  read("../supabase/migrations/20261118033900_access_hardening.sql"),
]);

test("manual general-ledger entries are restricted to finance roles and source_type manual", () => {
  assert.match(actions, /requireModulePermission\("general_finance", "create"\)/);
  assert.match(actions, /source_type: "manual"/);
  assert.match(actions, /created_by: user\.profile\.id/);
  assert.match(hardening, /source_type = 'manual'/);
});

test("manual finance form uses a stable idempotency key and duplicate verification", () => {
  assert.match(form, /crypto\.randomUUID\(\)/);
  assert.match(form, /useRef<string \| null>\(null\)/);
  assert.match(form, /if \(result\.success\) idempotencyKeyRef\.current = null/);
  assert.match(actions, /source_id: idempotencyKey/);
  assert.match(actions, /error\?\.code === "23505"/);
  assert.match(actions, /existing\.created_by === user\.profile\.id/);
});

test("general ledger page exposes manual entry only to finance roles and shows full balance", () => {
  assert.match(page, /"ketua_pemuda", "wakil_ketua_pemuda", "bendahara"/);
  assert.match(page, /general_ledger_balance/);
  assert.match(page, /ManualLedgerForm/);
});
