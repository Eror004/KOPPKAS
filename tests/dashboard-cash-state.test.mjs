import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function load(path) {
  const code = readFileSync(new URL(path, import.meta.url), "utf8");
  const js = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  runInNewContext(js, { exports, Intl, Number });
  return exports;
}
const { dashboardCashDisplay } = load("../src/components/monthly-dues/dashboard-cash-state.ts");
const { can } = load("../src/lib/auth/permissions.ts");

test("unopened, error and unavailable never masquerade as a zero payment", () => {
  for (const [kind, label] of [["unopened", "Periode belum dibuka"], ["error", "Data kas gagal dimuat"], ["unavailable", "Data kas belum terhubung"], ["restricted", "Akses terbatas"]]) {
    const display = dashboardCashDisplay({ kind });
    assert.equal(display.value, "—");
    assert.equal(display.label, label);
  }
  const zero = dashboardCashDisplay({ kind: "opened", income: 0 });
  assert.match(zero.value, /Rp\s*0/);
  assert.equal(zero.label, "Pemasukan periode terbuka");
  assert.equal(dashboardCashDisplay({ kind: "opened", income: NaN }).value, "—");
});

test("all roles retain distinct monthly dues and finance permission gates", () => {
  for (const role of ["ketua_pemuda", "wakil_ketua_pemuda", "bendahara"]) {
    assert.equal(can(role, "monthly_dues", "read"), true);
    assert.equal(can(role, "monthly_dues", "create"), true);
    assert.equal(can(role, "general_finance", "read"), true);
    assert.equal(can(role, "general_finance", "create"), true);
  }
  assert.equal(can("sekretaris", "monthly_dues", "read"), true);
  assert.equal(can("sekretaris", "monthly_dues", "create"), true);
  assert.equal(can("sekretaris", "general_finance", "read"), false);
  assert.equal(can("sekretaris", "general_finance", "create"), false);
  for (const role of ["ketua_rt_01", "ketua_rw_01"]) {
    assert.equal(can(role, "monthly_dues", "read"), false);
    assert.equal(can(role, "general_finance", "read"), false);
  }
});
