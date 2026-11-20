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
  runInNewContext(js, { exports, require: (name) => overrides[name] ?? require(name), Intl, Date, Number, crypto: globalThis.crypto });
  return exports;
}
const memberContracts = load("../src/components/members/contracts.ts");
const duesContracts = load("../src/components/monthly-dues/contracts.ts");
const { MemberDirectory } = load("../src/components/members/member-directory.tsx", { "./contracts": memberContracts });
const accountingContracts = load("../src/components/monthly-dues/accounting-contract.ts");
const { AccountingPanel } = load("../src/components/monthly-dues/accounting-panel.tsx", { "./contracts": duesContracts, "./accounting-contract": accountingContracts });
const { ReceiptFeedback } = load("../src/components/monthly-dues/receipt-feedback.tsx", { "./contracts": duesContracts });
const { PaymentForm } = load("../src/app/dashboard/uang-kas-bulanan/payment-form.tsx", { "./actions": { recordDuesPayment: async () => ({}) }, "@/components/monthly-dues/receipt-feedback": { ReceiptFeedback } });
const { DuesDirectory } = load("../src/components/monthly-dues/dues-directory.tsx", {
  "./contracts": duesContracts,
  "./accounting-panel": { AccountingPanel },
  "@/app/dashboard/uang-kas-bulanan/payment-form": { PaymentForm: ({ monthlyDuesId }) => React.createElement("span", null, `Form pembayaran fixture ${monthlyDuesId}`) },
});
const members = [
  { id: "fixture-1", full_name: "Contoh Anggota", gender: "laki_laki", phone: null, created_at: "2026-01-01" },
  { id: "fixture-2", full_name: "Contoh Belum Lengkap", gender: null, phone: null, created_at: "2026-01-01" },
];
const rows = [
  { id: "fixture-a", member_id: "member-fixture-a", full_name: "Contoh Sebagian", dues_month: "2026-11-01", reference_amount: 10000, paid_amount: "4000", remaining_amount: 6000, payment_status: "belum_lunas" },
  { id: "fixture-b", member_id: "member-fixture-b", full_name: "Contoh Lunas", dues_month: "2026-11-01", reference_amount: 10000, paid_amount: "12000", remaining_amount: 0, payment_status: "lunas" },
  { id: "fixture-c", member_id: "member-fixture-c", full_name: "Contoh Belum Bayar", dues_month: "2026-11-01", reference_amount: 10000, paid_amount: 0, remaining_amount: 10000, payment_status: "belum_lunas" },
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
  assert.equal(summary.members, 3); assert.equal(summary.paid, 1); assert.equal(summary.short, 1); assert.equal(summary.unpaid, 1); assert.equal(summary.collected, 16000);
  assert.equal(duesContracts.duesStatus(rows[0]), "kurang"); assert.equal(duesContracts.duesStatus(rows[1]), "lunas"); assert.equal(duesContracts.duesStatus(rows[2]), "belum_bayar");
  assert.equal(duesContracts.duesStatus({ ...rows[0], paid_amount: 9999.99 }), "kurang");
  assert.equal(duesContracts.duesStatus({ ...rows[0], paid_amount: 10000 }), "lunas");
  assert.equal(duesContracts.duesStatus({ ...rows[0], paid_amount: "" }), "unavailable");
  assert.equal(duesContracts.duesStatus({ ...rows[0], paid_amount: "bad" }), "unavailable");
  assert.equal(duesContracts.periodWindow("2026-01-01")[11], "2025-02-01");
  assert.equal(duesContracts.periodLabel("2026-01-01"), "Januari 2026");
  assert.equal(duesContracts.formatContribution("1000.5"), "Rp 1.000,5");
});

test("dues UI does not invent payment history or expose recording to read-only users", () => {
  const html = renderToStaticMarkup(React.createElement(DuesDirectory, { rows, currentMonth: "2026-11-01", canRecord: false }));
  assert.match(html, /Contoh Sebagian/); assert.match(html, /KURANG/); assert.match(html, /BELUM BAYAR/); assert.match(html, /Riwayat transaksi individual belum tersedia/);
  assert.match(html, /sukarela/); assert.doesNotMatch(html, /Form pembayaran fixture/);
  const recorder = renderToStaticMarkup(React.createElement(DuesDirectory, { rows, currentMonth: "2026-11-01", canRecord: true }));
  assert.doesNotMatch(recorder, /Form pembayaran fixture/);
  assert.match(recorder, /Penambahan dari kas sementara tidak tersedia/);
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
    const duplicates = [...rows, { ...rows[0], id: "fixture-duplicate", member_id: "member-fixture-duplicate" }];
    await React.act(async () => root.render(React.createElement(DuesDirectory, { rows: duplicates, currentMonth: "2026-11-01", canRecord: true })));
    const memberSearch = dom.window.document.querySelector('input[placeholder="Ketik nama anggota"]');
    await React.act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(memberSearch, "Sebagian");
      memberSearch.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });
    const memberSelect = dom.window.document.querySelector('.bank-field select');
    assert.equal(memberSelect.options.length, 3);
    await React.act(async () => { memberSelect.value = "member-fixture-a"; memberSelect.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
    assert.match(dom.window.document.body.textContent, /Form pembayaran fixture fixture-a/);
    await React.act(async () => { memberSelect.value = "member-fixture-duplicate"; memberSelect.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
    assert.match(dom.window.document.body.textContent, /Form pembayaran fixture fixture-duplicate/);

  } finally {
    await React.act(async () => root.unmount());
    dom.window.close();
    for (const [key, value] of Object.entries(previous)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
});


test("payment form requires a confirmation and supports fractional positive entries", () => {
  const html = renderToStaticMarkup(React.createElement(PaymentForm, { monthlyDuesId: "fixture-dues-id" }));
  assert.match(html, /name="monthly_dues_id" value="fixture-dues-id"/);
  assert.match(html, /min="0.01"[^>]*name="amount"/);
  assert.match(html, /type="checkbox" required=""/);
  assert.match(html, /Catatan pembayaran/);
});

test("historical opening is read-only and belongs only to October", () => {
  const html = renderToStaticMarkup(React.createElement(AccountingPanel, { period: "2026-10-01" }));
  assert.match(html, /Rp\s?205\.000/);
  assert.match(html, /bukan transaksi pemasukan baru/i);
  assert.doesNotMatch(html, /<button[^>]*>\s*(Edit|Hapus)/i);
  assert.match(html, /<fieldset disabled=""/);
  const november = renderToStaticMarkup(React.createElement(AccountingPanel, { period: "2026-11-01" }));
  assert.doesNotMatch(november, /205\.000/);
  assert.match(november, /tidak dibawa otomatis/);
});

test("running balance requires complete same-period data; historical opening remains unchanged", () => {
  const fixtureSnapshot = { period: "2026-10-01", openingAmount: 205000, complete: true, mutations: [
    { id: "fixture-expense", period: "2026-10-01", occurredAt: "2026-10-02T10:00:00Z", direction: "out", amount: 50000, description: "Pengeluaran fixture", recordedBy: "Penguji fixture" },
  ] };
  assert.equal(accountingContracts.runningBalance("2026-10-01", fixtureSnapshot), 155000);
  assert.equal(accountingContracts.runningBalance("2026-11-01", fixtureSnapshot), null);
  assert.equal(accountingContracts.runningBalance("2026-10-01", { ...fixtureSnapshot, complete: false }), null);
  assert.equal(accountingContracts.runningBalance("2026-10-01", { ...fixtureSnapshot, openingAmount: 100000 }), null);
  assert.equal(accountingContracts.runningBalance("2026-10-01", { ...fixtureSnapshot, mutations: [...fixtureSnapshot.mutations, fixtureSnapshot.mutations[0]] }), null);
  const html = renderToStaticMarkup(React.createElement(AccountingPanel, { period: "2026-10-01", state: { kind: "ready", snapshot: fixtureSnapshot } }));
  assert.match(html, /155\.000/); assert.match(html, /205\.000/); assert.match(html, /Pengeluaran fixture/);
  assert.match(html, /Saldo awal historis/);
  const november = renderToStaticMarkup(React.createElement(AccountingPanel, { period: "2026-11-01", state: { kind: "ready", snapshot: fixtureSnapshot } }));
  assert.doesNotMatch(november, /155\.000|205\.000|Pengeluaran fixture/);
});

test("receipt retrieval failure does not retry payment and can be retried separately", async () => {
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost/" });
  const names = ["window", "document", "navigator", "IS_REACT_ACT_ENVIRONMENT"];
  const old = Object.fromEntries(names.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true })) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(dom.window.document.getElementById("root"));
  let calls = 0;
  const fixtureReceipt = { payment_id: "fixture-transaction", payment_reference: "FIXTURE-ONLY", monthly_dues_id: "fixture-dues", member_id: "fixture-member", member_name: "Anggota fixture", amount: 5000, paid_at: "2026-10-02T10:00:00Z", dues_month: "2026-10-01", note: null, recorded_by: "fixture-user", recorded_by_name: null, reference_amount: 10000, paid_amount_after_transaction: 5000, status_after_transaction: "kurang" };
  const getReceipt = async () => { calls++; return calls === 1 ? { error: "Bukti gagal dimuat" } : { receipt: fixtureReceipt }; };
  try {
    // ReceiptFeedback is mounted only after a successful payment with a transaction ID.
    await React.act(async () => root.render(React.createElement(ReceiptFeedback, { transactionId: "fixture-transaction", getReceipt })));
    assert.match(dom.window.document.body.textContent, /Pembayaran tercatat/);
    await React.act(async () => dom.window.document.querySelector("button").click());
    assert.match(dom.window.document.body.textContent, /Pembayaran tetap tercatat/);
    assert.match(dom.window.document.body.textContent, /Coba ambil bukti lagi/);
    await React.act(async () => dom.window.document.querySelector("button").click());
    assert.equal(calls, 2);
    assert.match(dom.window.document.body.textContent, /FIXTURE-ONLY/);
    assert.match(dom.window.document.body.textContent, /KURANG/);
  } finally {
    await React.act(async () => root.unmount()); dom.window.close();
    for (const key of names) {
      if (old[key]) Object.defineProperty(globalThis, key, old[key]);
      else delete globalThis[key];
    }
  }
});

test("successful payment remains successful if receipt fetch fails, and retry does not resubmit", async () => {
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost/" });
  const names = ["window", "document", "navigator", "FormData", "IS_REACT_ACT_ENVIRONMENT"];
  const old = Object.fromEntries(names.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, FormData: dom.window.FormData, IS_REACT_ACT_ENVIRONMENT: true })) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const { createRoot } = await import("react-dom/client");
  let payments = 0; let receiptCalls = 0;
  const { PaymentForm: TestPaymentForm } = load("../src/app/dashboard/uang-kas-bulanan/payment-form.tsx", {
    "./actions": { recordDuesPayment: async () => { payments++; return { success: "Pembayaran berhasil dicatat.", transactionId: "fixture-id" }; } },
    "@/components/monthly-dues/receipt-feedback": { ReceiptFeedback },
  });
  const root = createRoot(dom.window.document.getElementById("root"));
  try {
    await React.act(async () => root.render(React.createElement(TestPaymentForm, { monthlyDuesId: "fixture-dues", getReceipt: async () => { receiptCalls++; return { error: "Bukti belum tersedia" }; } })));
    const form = dom.window.document.querySelector("form");
    form.querySelector('[name="amount"]').value = "5000";
    form.querySelector('input[type="checkbox"]').checked = true;
    await React.act(async () => form.requestSubmit());
    assert.equal(payments, 1);
    assert.match(dom.window.document.body.textContent, /Pembayaran berhasil dicatat/);
    await React.act(async () => [...form.querySelectorAll('button')].find(button => button.textContent === "Ambil bukti transaksi").click());
    assert.match(dom.window.document.body.textContent, /Pembayaran berhasil dicatat/);
    assert.match(dom.window.document.body.textContent, /Pembayaran tetap tercatat/);
    await React.act(async () => [...form.querySelectorAll('button')].find(button => button.textContent === "Coba ambil bukti lagi").click());
    assert.equal(receiptCalls, 2); assert.equal(payments, 1);
  } finally {
    await React.act(async () => root.unmount()); dom.window.close();
    for (const key of names) {
      if (old[key]) Object.defineProperty(globalThis, key, old[key]);
      else delete globalThis[key];
    }
  }
});

test("accounting boundary renders loading and errors without suggesting a saved transaction", () => {
  const loading = renderToStaticMarkup(React.createElement(AccountingPanel, { period: "2026-10-01", state: { kind: "loading" } }));
  assert.match(loading, /Memuat pembukuan/);
  const error = renderToStaticMarkup(React.createElement(AccountingPanel, { period: "2026-10-01", state: { kind: "error", message: "Data fixture gagal dimuat" } }));
  assert.match(error, /role="alert"/);
  assert.match(error, /Data fixture gagal dimuat/);
  assert.doesNotMatch(error, /berhasil disimpan/i);
});
