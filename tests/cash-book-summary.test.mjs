import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
const require = createRequire(import.meta.url);
const src = readFileSync(new URL("../src/components/monthly-dues/cash-book-summary.tsx", import.meta.url), "utf8");
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const exports = {};
runInNewContext(js, { exports, require: name => name === "./period-totals-contract" ? { formatTotalsRupiah: value => `Rp${value}` } : require(name), Number });
const { CashBookSummary } = exports;
const summary = { dues_month: "2026-11-01", data_status: "available", cash_balance_status: "historical_gap", opening_balance: null, income_amount: 5000, expense_amount: 1000, closing_balance: null };
const result = { summary, movements: [{ movement_key: "m1", description: "Pembayaran", amount: 5000, recorded_by: null }] };
test("cash gap remains unknown while known movements remain visible", () => {
  const html = renderToStaticMarkup(React.createElement(CashBookSummary, { period: summary.dues_month, dataStatus: "available", result }));
  assert.match(html, /Saldo tidak diketahui/); assert.match(html, /Pembayaran/); assert.match(html, /Rp5000/); assert.match(html, /Nama historis tidak tersedia/);
  assert.doesNotMatch(html, /Rp0/);
});
test("wrong period or inconsistent status fails closed", () => {
  for (const props of [{ period: "2026-10-01", dataStatus: "available", result }, { period: summary.dues_month, dataStatus: "historical_empty", result }, { period: summary.dues_month, dataStatus: "available", result: { ...result, summary: { ...summary, closing_balance: 0 } } }]) {
    const html = renderToStaticMarkup(React.createElement(CashBookSummary, props));
    assert.match(html, /belum dapat diverifikasi/); assert.doesNotMatch(html, /Rp0|Pembayaran/);
  }
});
