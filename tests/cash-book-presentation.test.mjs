import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/components/monthly-dues/cash-book-presentation.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exports = {};
runInNewContext(js, { exports, Number, String });
const { officialCashSummary } = exports;

test("official totals come from summary even when movements are paginated", () => {
  const summary = { dues_month: "2026-11-01", opening_balance: 205000, income_amount: 50000, expense_amount: 20000, closing_balance: 235000 };
  const result = { summary, movements: [], movementCount: 101, page: 0, pageSize: 50, hasMore: true };
  assert.equal(officialCashSummary("2026-11-01", result), summary);
  assert.equal(officialCashSummary("2026-10-01", result), null);
  assert.equal(officialCashSummary("2026-11-01", { ...result, error: "failed" }), null);
  assert.equal(officialCashSummary("2026-11-01", { ...result, summary: undefined }), null);
  assert.equal(officialCashSummary("2026-11-01", { ...result, summary: { ...summary, closing_balance: "" } }), null);
});
