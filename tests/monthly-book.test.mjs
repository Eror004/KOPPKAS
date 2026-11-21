import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import ts from "typescript";
const require = createRequire(import.meta.url);
function load(path, overrides = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  runInNewContext(js, { exports, require: name => overrides[name] ?? require(name), Intl, Date, Number });
  return exports;
}
const contracts = load("../src/components/monthly-dues/contracts.ts");
const { MonthlyBook } = load("../src/components/monthly-dues/monthly-book.tsx", { "./contracts": contracts });
const render = data => renderToStaticMarkup(React.createElement(MonthlyBook, { data }));

test("book renders only two columns and each actual payment separately", () => {
  const html = render({ kind: "available", rows: [
    { paymentId: "one", memberNameSnapshot: "Andi", amount: 5000 },
    { paymentId: "two", memberNameSnapshot: "Andi", amount: "5000" },
  ] });
  const doc = new JSDOM(html).window.document;
  assert.deepEqual([...doc.querySelectorAll("th")].map(node => node.textContent), ["NAMA", "NOMINAL"]);
  assert.equal(doc.querySelectorAll("tbody tr").length, 2);
  for (const row of doc.querySelectorAll("tbody tr")) {
    assert.equal(row.children.length, 2);
    assert.equal(row.children[0].textContent, "Andi");
    assert.match(row.children[1].textContent, /Rp\s*5\.000/);
  }
});

test("availability, empty and missing snapshot are distinct without invented values", () => {
  assert.match(render({ kind: "historical_unavailable" }), /Data historis tidak tersedia/);
  assert.match(render({ kind: "available", rows: [] }), /Belum ada transaksi tercatat/);
  const html = render({ kind: "available", rows: [{ paymentId: "x", memberNameSnapshot: null, amount: "" }] });
  assert.match(html, /Nama historis tidak tersedia/);
  assert.match(html, /Nominal tidak tersedia/);
  assert.doesNotMatch(html, /Rp\s*0/);
  for (const kind of ["loading", "error", "restricted"]) assert.doesNotMatch(render({ kind }), /<table/);
});

test("zero, partial and threshold have two statuses, invalid data is not a status", () => {
  const row = { paid_amount: 0, payment_status: "belum_bayar" };
  for (const value of [0, 5000, 9999]) assert.equal(contracts.duesStatus({ ...row, paid_amount: value }), "belum_lunas");
  for (const value of [10000, 15000]) assert.equal(contracts.duesStatus({ ...row, paid_amount: value, payment_status: "lunas" }), "lunas");
  for (const value of ["", "invalid", -1]) assert.equal(contracts.duesStatus({ ...row, paid_amount: value }), "unavailable");
  assert.equal(contracts.duesStatus({ ...row, paid_amount: 10000 }), "belum_lunas");
  assert.equal(contracts.duesStatus({ ...row, payment_status: "kurang" }), "unavailable");
});

test("loading route exposes a status message while the server page is pending", () => {
  const status = load("../src/components/ui/status.tsx");
  const { default: Loading } = load("../src/app/dashboard/uang-kas-bulanan/loading.tsx", { "@/components/ui/status": status });
  const doc = new JSDOM(renderToStaticMarkup(React.createElement(Loading))).window.document;
  const indicator = doc.querySelector('[role="status"]');
  assert.ok(indicator);
  assert.match(indicator.textContent, /Memuat data kas/);
  assert.equal(indicator.querySelector('[aria-hidden="true"]').className, "ui-spinner");
});
