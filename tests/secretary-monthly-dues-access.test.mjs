import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [migration, permissions, workflow, core, actions] = await Promise.all([
  read("../supabase/migrations/20261118190000_secretary_monthly_dues_read_access.sql"),
  read("../src/lib/auth/permissions.ts"),
  read("../src/app/dashboard/uang-kas-bulanan/page.tsx"),
  read("../supabase/migrations/20261118033844_dues_and_event_workflows.sql"),
  read("../src/app/dashboard/uang-kas-bulanan/actions.ts"),
]);

test("Sekretaris read policies replace legacy policy names instead of duplicating them", () => {
  assert.match(migration, /drop policy if exists "monthly_dues_read_secretary_register"/);
  assert.match(migration, /drop policy if exists "dues_payments_read_secretary_register"/);
  assert.match(migration, /monthly_dues_read_secretary_payment_workflow/);
  assert.match(migration, /dues_payments_read_secretary_payment_workflow/);
  assert.equal((migration.match(/for select to authenticated/g) ?? []).length, 2);
  assert.match(migration, /has_any_role\(array\['sekretaris'\]::public\.app_role\[\]\)/);
});

test("monthly dues page uses an invoker-secured summary view", () => {
  assert.match(core, /create or replace view public\.monthly_dues_summary\s+with \(security_invoker = true\)/);
  assert.match(workflow, /monthly_dues_summary/);
});

test("Sekretaris retains explicit permission to read and record voluntary payments", () => {
  assert.match(permissions, /sekretaris:\s*\{[\s\S]*?monthly_dues:\s*\["read", "create"\]/);
  assert.match(actions, /requireModulePermission\("monthly_dues", "create"\)/);
  assert.match(core, /'bendahara','sekretaris'\]::public\.app_role\[\]\)/);
});
