import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function loadActions(authorize) {
  const source = readFileSync(new URL("../src/app/dashboard/uang-kas-bulanan/actions.ts", import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  runInNewContext(js, { exports, require: name => {
    if (name === "next/cache") return { revalidatePath: () => { throw new Error("unexpected revalidation"); } };
    if (name === "@/lib/auth/require-role") return { requireModulePermission: authorize };
    if (name === "@/lib/supabase/server") return { createClient: () => { throw new Error("unexpected database access"); } };
    if (name === "@/components/monthly-dues/period-totals-contract") return {};
    throw new Error(`Unexpected dependency: ${name}`);
  } });
  return exports;
}

test("legacy payment and register server actions fail closed even with valid permission", async () => {
  const checks = [];
  const actions = loadActions(async (...args) => { checks.push(args); return { role: "bendahara" }; });
  for (const action of [actions.generateMonthlyRegister, actions.recordDuesPayment]) {
    const result = await action({}, new FormData());
    assert.match(result.error, /belum terhubung/);
    assert.equal(result.success, undefined);
  }
  assert.deepEqual(checks, [["monthly_dues", "create"], ["monthly_dues", "create"]]);
});

test("legacy server actions do not bypass denied authorization", async () => {
  const actions = loadActions(async () => { throw new Error("denied"); });
  await assert.rejects(actions.generateMonthlyRegister({}, new FormData()), /denied/);
  await assert.rejects(actions.recordDuesPayment({}, new FormData()), /denied/);
});

test("all backend write implementations are retained but blocked server-side until QA approval", async () => {
  const checks = [];
  const actions = loadActions(async (...args) => { checks.push(args); return { role: "bendahara" }; });
  const results = [
    await actions.openMonthlyDuesPeriod("2026-11-01"),
    await actions.ensureDuesRegister("00000000-0000-4000-8000-000000000001", "2026-11-01"),
    await actions.createDuesMember("Fixture", "2026-11-01", false),
    await actions.recordMonthlyDuesCashExpense({}, new FormData()),
  ];
  for (const result of results) { assert.match(result.error, /belum terhubung/); assert.equal(result.success, undefined); }
  assert.deepEqual(checks, [["monthly_dues", "create"], ["monthly_dues", "create"], ["monthly_dues", "create"], ["general_finance", "create"]]);
});
