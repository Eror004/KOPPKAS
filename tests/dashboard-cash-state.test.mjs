import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/components/monthly-dues/dashboard-cash-state.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exports = {};
runInNewContext(js, { exports, Intl, Number });
const { dashboardCashDisplay } = exports;

test("unavailable and restricted dashboard cash never display as zero", () => {
  for (const [kind, label] of [["unopened", "Periode belum dibuka"], ["error", "Data kas gagal dimuat"], ["unavailable", "Data kas belum terhubung"], ["restricted", "Akses terbatas"]]) {
    const display = dashboardCashDisplay({ kind });
    assert.equal(display.value, "—");
    assert.equal(display.label, label);
  }
  const zero = dashboardCashDisplay({ kind: "opened", income: 0 });
  assert.match(zero.value, /Rp\s*0/);
  assert.equal(zero.label, "Pemasukan periode terbuka");
});
