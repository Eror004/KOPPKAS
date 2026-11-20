import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(path, overrides = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  runInNewContext(js, { exports, require: (name) => overrides[name] ?? require(name), Intl, Date, Number });
  return exports;
}
const memberContracts = load("../src/components/members/contracts.ts");
const duesContracts = load("../src/components/monthly-dues/contracts.ts");
const { MemberDirectory } = load("../src/components/members/member-directory.tsx", { "./contracts": memberContracts });
const { DuesDirectory } = load("../src/components/monthly-dues/dues-directory.tsx", {
  "./contracts": duesContracts,
  "@/app/dashboard/uang-kas-bulanan/payment-form": { PaymentForm: () => React.createElement("span", null, "Form pembayaran fixture") },
});
const members = [
  { id: "fixture-1", full_name: "Contoh Anggota", gender: "laki_laki", phone: null, created_at: "2026-01-01" },
  { id: "fixture-2", full_name: "Contoh Belum Lengkap", gender: null, phone: null, created_at: "2026-01-01" },
];
const rows = [
  { id: "fixture-a", full_name: "Contoh Sebagian", dues_month: "2026-11-01", reference_amount: 10000, paid_amount: "4000", remaining_amount: 6000, payment_status: "belum_lunas" },
  { id: "fixture-b", full_name: "Contoh Lunas", dues_month: "2026-11-01", reference_amount: 10000, paid_amount: "12000", remaining_amount: 0, payment_status: "lunas" },
  { id: "fixture-c", full_name: "Contoh Belum Bayar", dues_month: "2026-11-01", reference_amount: 10000, paid_amount: 0, remaining_amount: 10000, payment_status: "belum_lunas" },
];

test("membership UI renders real fields, empty state and role-scoped unavailable edit", () => {
  const reader = renderToStaticMarkup(React.createElement(MemberDirectory, { members, canCreate: false, canEdit: false }));
  assert.match(reader, /Contoh Anggota/); assert.match(reader, /Belum lengkap/); assert.doesNotMatch(reader, /Tambah anggota|Formulir edit/);
  const editor = renderToStaticMarkup(React.createElement(MemberDirectory, { members, canCreate: true, canEdit: true, createForm: React.createElement("p", null, "Form fixture") }));
  assert.match(editor, /Tambah anggota/); assert.match(editor, /Formulir edit · belum tersedia/); assert.match(editor, /<fieldset disabled=""/);
  const empty = renderToStaticMarkup(React.createElement(MemberDirectory, { members: [], canCreate: false, canEdit: false }));
  assert.match(empty, /Belum ada anggota aktif/);
});

test("dues summary distinguishes partial, over-reference and no payments without carryover", () => {
  const summary = duesContracts.summarizeDues(rows);
  assert.equal(summary.members, 3); assert.equal(summary.paid, 1); assert.equal(summary.unpaid, 2);
  assert.equal(summary.withPayments, 2); assert.equal(summary.withoutPayments, 1); assert.equal(summary.collected, 16000);
  assert.equal(duesContracts.periodWindow("2026-01-01")[11], "2025-02-01");
  assert.equal(duesContracts.periodLabel("2026-01-01"), "Januari 2026");
  assert.equal(duesContracts.formatContribution("1000.5"), "Rp 1.000,5");
});

test("dues UI does not invent payment history or expose recording to read-only users", () => {
  const html = renderToStaticMarkup(React.createElement(DuesDirectory, { rows, currentMonth: "2026-11-01", canRecord: false }));
  assert.match(html, /Contoh Sebagian/); assert.match(html, /BELUM LUNAS/); assert.match(html, /Riwayat transaksi individual belum tersedia/);
  assert.match(html, /sukarela/); assert.doesNotMatch(html, /Form pembayaran fixture/);
  const recorder = renderToStaticMarkup(React.createElement(DuesDirectory, { rows, currentMonth: "2026-11-01", canRecord: true }));
  assert.match(recorder, /Form pembayaran fixture/);
  const empty = renderToStaticMarkup(React.createElement(DuesDirectory, { rows: [], currentMonth: "2026-11-01", canRecord: false }));
  assert.match(empty, /Belum ada daftar kas untuk periode ini/);
});

test("search, filtering and month navigation update the rendered UI", async () => {
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost/" });
  const previous = { window: globalThis.window, document: globalThis.document, navigator: globalThis.navigator, IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT };
  Object.defineProperty(globalThis, "window", { configurable: true, value: dom.window });
  Object.defineProperty(globalThis, "document", { configurable: true, value: dom.window.document });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: dom.window.navigator });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(dom.window.document.getElementById("root"));
  try {
    await React.act(async () => root.render(React.createElement(MemberDirectory, { members, canCreate: false, canEdit: false })));
    const search = dom.window.document.querySelector('input[placeholder="Cari nama anggota"]');
    await React.act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(search, "Belum Lengkap");
      search.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });
    assert.match(dom.window.document.body.textContent, /Contoh Belum Lengkap/);
    assert.doesNotMatch(dom.window.document.body.textContent, /Contoh Anggota/);
    await React.act(async () => root.render(React.createElement(DuesDirectory, { rows, currentMonth: "2026-11-01", canRecord: false })));
    const select = dom.window.document.querySelector(".sprint-select select");
    await React.act(async () => { select.value = "lunas"; select.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
    assert.match(dom.window.document.body.textContent, /Contoh Lunas/);
    assert.doesNotMatch(dom.window.document.body.textContent, /Contoh Sebagian/);
    await React.act(async () => dom.window.document.querySelector('[aria-label="Periode sebelumnya"]').click());
    assert.match(dom.window.document.querySelector("#dues-title").textContent, /Oktober 2026/);
    assert.match(dom.window.document.body.textContent, /Belum ada daftar kas untuk periode ini/);
  } finally {
    await React.act(async () => root.unmount());
    dom.window.close();
    for (const [key, value] of Object.entries(previous)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
});
