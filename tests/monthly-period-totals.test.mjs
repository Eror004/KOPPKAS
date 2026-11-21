import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function transpile(path, overrides = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  runInNewContext(js, { exports, require: name => {
    if (name in overrides) return overrides[name];
    throw new Error(`Unexpected dependency ${name}`);
  }, Number });
  return exports;
}
const contract = transpile("../src/components/monthly-dues/period-totals-contract.ts");
const { can } = transpile("../src/lib/auth/permissions.ts");
const month = "2026-11-01";
const zero = { dues_month: month, status: "active", data_status: "available", member_count: 0, paid_member_count: 0,
  unpaid_member_count: 0, total_paid_amount: "0.00", total_reference_amount: "0.00", total_remaining_amount: "0.00" };
const historical = { ...zero, status: "closed", data_status: "historical_empty", member_count: null, paid_member_count: null,
  unpaid_member_count: null, total_paid_amount: null, total_reference_amount: null, total_remaining_amount: null };
function loadAction({ role = "sekretaris", row = zero, error = null, failure = false } = {}) {
  const calls = [];
  const actions = transpile("../src/app/dashboard/uang-kas-bulanan/actions.ts", {
    "@/components/monthly-dues/period-totals-contract": contract,
    "@/lib/auth/require-role": { requireModulePermission: async (module, action) => {
      calls.push(["authorize", module, action]);
      if (!can(role, module, action)) throw new Error("denied");
      return { role };
    } },
    "@/lib/supabase/server": { createClient: async () => {
      if (failure) throw new Error("network");
      return { from(table) { calls.push(["from", table]); return {
        select(fields) { calls.push(["select", fields]); return this; },
        eq(field, value) { calls.push(["eq", field, value]); return this; },
        async maybeSingle() { return { data: row, error }; },
      }; } };
    } },
  });
  return { action: actions.getMonthlyDuesPeriodTotals, calls };
}

test("available zero is preserved from backend, scoped to selected period", async () => {
  const { action, calls } = loadAction();
  const result = await action(month);
  assert.equal(result.kind, "available");
  assert.equal(result.totals.member_count, 0);
  assert.equal(contract.formatTotalsRupiah(result.totals.total_paid_amount), "Rp0");
  assert.deepEqual(calls[0], ["authorize", "monthly_dues", "read"]);
  assert.ok(calls.some(call => call[0] === "from" && call[1] === "monthly_dues_period_totals"));
  assert.ok(calls.some(call => call[0] === "eq" && call[1] === "dues_month" && call[2] === month));
  assert.equal(calls.some(call => call.some(x => typeof x === "string" && /general_finance|cash_book/.test(x))), false);
});

test("historical empty preserves all NULLs; inconsistent NULLs fail closed", async () => {
  const result = await loadAction({ row: historical }).action(month);
  assert.equal(result.kind, "historical_empty");
  for (const field of ["member_count", "paid_member_count", "unpaid_member_count", "total_paid_amount", "total_reference_amount", "total_remaining_amount"]) assert.equal(result.totals[field], null);
  assert.equal((await loadAction({ row: { ...historical, member_count: 0 } }).action(month)).kind, "malformed");
  assert.equal((await loadAction({ row: { ...zero, total_paid_amount: null } }).action(month)).kind, "malformed");
});

test("the frontend passes through whole-period backend aggregates, not page or filter rows", async () => {
  const row = { ...zero, member_count: "4", paid_member_count: "2", unpaid_member_count: "2", total_paid_amount: "27000.00", total_reference_amount: "40000.00", total_remaining_amount: "13000.00" };
  const { action, calls } = loadAction({ row });
  const result = await action(month);
  assert.equal(result.kind, "available");
  assert.equal(result.totals.total_paid_amount, "27000.00");
  assert.equal(result.totals.paid_member_count, "2");
  assert.equal(calls.some(call => ["range", "limit", "search", "filter"].includes(call[0])), false);
  assert.equal(contract.formatTotalsRupiah("9007199254740993.25"), "Rp9.007.199.254.740.993,25");
});

test("query error, missing row, invalid month and invalid data remain distinct", async () => {
  assert.equal((await loadAction({ error: { code: "missing_view" } }).action(month)).kind, "error");
  assert.equal((await loadAction({ failure: true }).action(month)).kind, "error");
  assert.equal((await loadAction({ row: null }).action(month)).kind, "not_found");
  const invalid = loadAction();
  assert.equal((await invalid.action("2026-13-01")).kind, "invalid");
  assert.equal(invalid.calls.some(call => call[0] === "from"), false);
  assert.equal((await loadAction({ row: { ...zero, dues_month: "2026-10-01" } }).action(month)).kind, "malformed");
});

test("four roles are allowed and RT/RW denied before database query", async () => {
  for (const role of ["ketua_pemuda", "wakil_ketua_pemuda", "bendahara", "sekretaris"]) {
    const { action } = loadAction({ role });
    assert.equal((await action(month)).kind, "available", role);
  }
  for (const role of ["ketua_rt_01", "ketua_rw_01"]) {
    const { action, calls } = loadAction({ role });
    await assert.rejects(action(month), /denied/);
    assert.equal(calls.some(call => call[0] === "from"), false);
  }
  assert.equal(can("sekretaris", "general_finance", "read"), false);
});

test("every metric rejects inconsistent historical values and unavailable invalid numbers", async () => {
  const keys = ["member_count", "paid_member_count", "unpaid_member_count", "total_paid_amount", "total_reference_amount", "total_remaining_amount"];
  for (const key of keys) {
    assert.equal((await loadAction({ row: { ...historical, [key]: 0 } }).action(month)).kind, "malformed", `historical ${key}`);
    for (const value of [null, NaN, -1, "-1", "NaN"]) {
      assert.equal((await loadAction({ row: { ...zero, [key]: value } }).action(month)).kind, "malformed", `${key}: ${String(value)}`);
    }
  }
  const result = await loadAction().action(month);
  for (const key of keys) assert.match(String(result.totals[key]), /^0(?:\.0+)?$/, key);
});

test("each explicitly supplied month is passed directly to the view", async () => {
  for (const chosen of ["2026-09-01", "2026-11-01"]) {
    const { action, calls } = loadAction({ row: { ...zero, dues_month: chosen } });
    assert.equal((await action(chosen)).kind, "available");
    assert.deepEqual(calls.filter(call => call[0] === "eq"), [["eq", "dues_month", chosen]]);
  }
  for (const invalid of ["", "2026-11", "2026-11-02", "2026-00-01", "2026-11-01 "]) {
    const { action, calls } = loadAction();
    assert.equal((await action(invalid)).kind, "invalid");
    assert.equal(calls.some(call => call[0] === "from"), false);
  }
});

test("malformed over-precision is rejected instead of rounded into a valid amount", async () => {
  for (const value of [1.000001, "1.001", Infinity]) {
    assert.equal((await loadAction({ row: { ...zero, total_paid_amount: value } }).action(month)).kind, "malformed");
  }
  assert.equal((await loadAction({ row: { ...zero, total_paid_amount: 0.29 } }).action(month)).kind, "available");
});

test("formatting does not introduce a cent through binary floating point rounding", () => {
  const value = 90071992547409.9;
  assert.equal(contract.formatTotalsRupiah(value), "Rp90.071.992.547.409,9");
});

test("each available metric rejects infinity and invalid precision", async () => {
  const keys = ["member_count", "paid_member_count", "unpaid_member_count", "total_paid_amount", "total_reference_amount", "total_remaining_amount"];
  for (const key of keys) {
    for (const value of [Infinity, -Infinity, "Infinity", key.endsWith("count") ? 0.5 : 0.001]) {
      assert.equal((await loadAction({ row: { ...zero, [key]: value } }).action(month)).kind, "malformed", `${key}: ${value}`);
    }
  }
});

test("view must return valid lifecycle status in its exact selected fields", async () => {
  const { action, calls } = loadAction();
  assert.equal((await action(month)).totals.status, "active");
  assert.equal(calls.find(call => call[0] === "select")[1], "dues_month, status, data_status, member_count, paid_member_count, unpaid_member_count, total_paid_amount, total_reference_amount, total_remaining_amount");
  for (const value of [undefined, null, "pending"]) assert.equal((await loadAction({ row: { ...zero, status: value } }).action(month)).kind, "malformed");
  assert.equal((await loadAction({ row: historical }).action(month)).totals.status, "closed");
});

test("numeric(15,2) aggregate bounds reject overflow without rounding", async () => {
  for (const key of ["total_paid_amount", "total_reference_amount", "total_remaining_amount"]) {
    for (const value of ["9999999999999.99", 9999999999999.99, "0009999999999999.99"]) {
      assert.equal((await loadAction({ row: { ...zero, [key]: value } }).action(month)).kind, "available", `${key}: ${value}`);
    }
    for (const value of ["10000000000000.00", 10000000000000, "100000000000000000000.00", "9999999999999.999"]) {
      assert.equal((await loadAction({ row: { ...zero, [key]: value } }).action(month)).kind, "malformed", `${key}: ${value}`);
    }
  }
});
