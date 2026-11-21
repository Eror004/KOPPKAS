import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
function load(role, responses) {
  const calls = [];
  const source = readFileSync(new URL("../src/app/dashboard/uang-kas-bulanan/reference-check-action.ts", import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  runInNewContext(js, { exports, Number, Promise, require: name => {
    if (name === "@/lib/auth/require-role") return { requireModulePermission: async (...args) => {
      calls.push(["authorize", ...args]); if (["ketua_rt_01", "ketua_rw_01"].includes(role)) throw new Error("denied");
    } };
    if (name === "@/components/monthly-dues/period-totals-contract") return { isValidTotalsMonth: value => /^\d{4}-(0[1-9]|1[0-2])-01$/.test(value) };
    if (name === "@/lib/supabase/server") return { createClient: async () => ({ from: table => {
      calls.push(["from", table]); const response = responses.shift(); const chain = {};
      chain.select = (fields, options) => { calls.push(["select", fields, options.count, options.head]); return chain; };
      chain.eq = (...args) => { calls.push(["eq", ...args]); return chain; };
      chain.neq = (...args) => { calls.push(["neq", ...args]); return chain; };
      chain.then = (resolve, reject) => Promise.resolve(response).then(resolve, reject);
      return chain;
    } }) };
    throw new Error(`Unexpected import ${name}`);
  } });
  return { action: exports.checkMonthlyDuesReference, calls };
}

test("checks every visible register with exact count instead of aggregate-only arithmetic", async () => {
  for (const role of ["ketua_pemuda", "wakil_ketua_pemuda", "bendahara", "sekretaris"]) {
    const { action, calls } = load(role, [{ count: 2, error: null }, { count: 2, error: null }]);
    const result = await action("2026-11-01");
    assert.equal(result.kind, "checked"); assert.equal(result.registerCount, 2); assert.equal(result.mismatchCount, 2);
    assert.ok(calls.every(call => call[0] !== "from" || call[1] === "monthly_dues_summary"));
    assert.equal(calls.filter(call => call[0] === "eq" && call[1] === "dues_month" && call[2] === "2026-11-01").length, 2);
    assert.ok(calls.some(call => call[0] === "neq" && call[1] === "reference_amount" && call[2] === 10000));
    assert.ok(calls.filter(call => call[0] === "select").every(call => call[2] === "exact" && call[3] === true));
  }
});

test("denied roles, query failures and inconsistent counts never become zero or verified", async () => {
  for (const role of ["ketua_rt_01", "ketua_rw_01"]) {
    const { action, calls } = load(role, []); await assert.rejects(action("2026-11-01"), /denied/);
    assert.equal(calls.some(call => call[0] === "from"), false);
  }
  for (const responses of [[{ count: null, error: { code: "error" } }, { count: 0, error: null }], [{ count: 1, error: null }, { count: 2, error: null }]]) {
    assert.equal((await load("sekretaris", responses).action("2026-11-01")).kind, "unavailable");
  }
  const invalid = load("sekretaris", []);
  assert.equal((await invalid.action("2026-11-02")).kind, "unavailable");
  assert.equal(invalid.calls.some(call => call[0] === "from"), false);
});
