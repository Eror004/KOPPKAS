import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [permissions, actions, page, hardening] = await Promise.all([
  read("../src/lib/auth/permissions.ts"),
  read("../src/app/dashboard/struktur/actions.ts"),
  read("../src/app/dashboard/struktur/page.tsx"),
  read("../supabase/migrations/20261118074603_committee_dues_letters_audit_hardening.sql"),
]);

test("Secretary is the only role with structure management permissions", () => {
  const secretary = permissions.match(/sekretaris:\s*\{([\s\S]*?)\n  \},/)?.[1] ?? "";
  assert.match(secretary, /structure:\s*\[[^\]]*"create"[^\]]*"update"[^\]]*"delete"/);
  const ketua = permissions.match(/ketua_pemuda:\s*\{([\s\S]*?)\n  \},/)?.[1] ?? "";
  assert.match(ketua, /structure:\s*\["read"\]/);
});

test("structure mutations are protected by server-side module permissions", () => {
  assert.match(actions, /requireModulePermission\("structure", "create"\)/);
  assert.match(actions, /requireModulePermission\("structure", "update"\)/);
  assert.match(page, /user\.role === "sekretaris"/);
  assert.match(page, /action=\{createPosition\}/);
  assert.match(page, /action=\{updatePosition\}/);
});

test("event committee mutations are limited to event creators and core leadership", () => {
  assert.match(hardening, /event_committee_insert_event_managers/);
  assert.match(hardening, /event_committee_update_event_managers/);
  assert.match(hardening, /event_committee_delete_event_managers/);
  assert.match(hardening, /e\.created_by = \(select auth\.uid\(\)\)/);
  assert.match(hardening, /'ketua_pemuda','wakil_ketua_pemuda','sekretaris'/);
  assert.match(hardening, /e\.status not in \('menunggu_laporan', 'selesai', 'dibatalkan'\)/);
  assert.match(hardening, /drop policy if exists "event_committee_manage_authenticated"/);
});

test("monthly dues register rows cannot be deleted by authenticated users", () => {
  assert.match(hardening, /drop policy if exists "monthly_dues_manage_finance_roles"/);
  assert.match(hardening, /revoke delete on public\.monthly_dues from authenticated/);
  assert.match(hardening, /audited payment reversal\/adjustment workflows/);
});
