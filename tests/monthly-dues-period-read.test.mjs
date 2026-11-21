import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const actions = readFileSync(
  new URL("../src/app/dashboard/uang-kas-bulanan/actions.ts", import.meta.url),
  "utf8",
);

test("period list action is read-only and never triggers lifecycle synchronization", () => {
  const start = actions.indexOf("export async function getMonthlyDuesPeriods");
  const end = actions.indexOf("/** Search active membership", start);
  assert.ok(start >= 0 && end > start, "period list action should be present");
  const readAction = actions.slice(start, end);

  assert.match(readAction, /requireModulePermission\("monthly_dues", "read"\)/);
  assert.match(readAction, /\.from\("monthly_dues_periods"\)/);
  assert.match(readAction, /\.select\(/);
  assert.doesNotMatch(readAction, /\.rpc\(/);
  assert.doesNotMatch(readAction, /sync_monthly_dues_period_lifecycle/);
});
