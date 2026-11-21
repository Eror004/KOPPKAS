import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(path, import.meta.url), "utf8");
const [migration, permissions, page, core, actions, accounting] = await Promise.all([
  read("../supabase/migrations/20261118074631_secretary_monthly_dues_read_access.sql"),
  read("../src/lib/auth/permissions.ts"),
  read("../src/app/dashboard/uang-kas-bulanan/page.tsx"),
  read("../supabase/migrations/20261118033844_dues_and_event_workflows.sql"),
  read("../src/app/dashboard/uang-kas-bulanan/actions.ts"),
  read("../src/components/monthly-dues/accounting-panel.tsx"),
]);

test("Sekretaris read policies replace legacy policy names instead of duplicating them", () => {
  assert.match(migration, /drop policy if exists "monthly_dues_read_secretary_register"/);
  assert.match(migration, /drop policy if exists "dues_payments_read_secretary_register"/);
  assert.match(migration, /monthly_dues_read_secretary_payment_workflow/);
  assert.match(migration, /dues_payments_read_secretary_payment_workflow/);
  assert.equal((migration.match(/for select to authenticated/g) ?? []).length, 2);
  assert.match(migration, /has_any_role\(array\['sekretaris'\]::public\.app_role\[\]\)/);
});

test("monthly dues page uses explicit opened periods and the invoker-secured summary", () => {
  assert.match(core, /create or replace view public\.monthly_dues_summary\s+with \(security_invoker = true\)/);
  assert.match(page, /getMonthlyDuesPeriods\(\)/);
  assert.match(page, /monthly_dues_summary/);
  assert.match(page, /can\(user\.role, "general_finance", "read"\)/);
  assert.doesNotMatch(page, /InlineMemberForm|create_member_and_monthly_dues\(/);
});

test("Sekretaris can read and record voluntary dues but cannot load finance cash book", () => {
  assert.match(permissions, /sekretaris:\s*\{[\s\S]*?monthly_dues:\s*\["read", "create"\]/);
  assert.match(actions, /requireModulePermission\("monthly_dues", "create"\)/);
  assert.match(actions, /requireModulePermission\("general_finance", "read"\)/);
  assert.match(accounting, /if \(!canViewFinance \|\| !getCashBook/);
  assert.match(accounting, /Akses buku kas terbatas/);
});
