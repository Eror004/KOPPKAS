import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
const require = createRequire(import.meta.url);

function pageWith({ authorize, read, totals = async () => ({ kind: "error", error: "Tidak tersedia" }) }) {
  const source = readFileSync(new URL("../src/app/dashboard/uang-kas-bulanan/page.tsx", import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  const overrides = {
    "@/components/module-shell": { ModuleShell: ({ children }) => React.createElement("div", null, children) },
    "@/components/monthly-dues/lifecycle-sync": { LifecycleSync: () => React.createElement("div", { "data-lifecycle-sync": true }) },
    "@/components/ui/status": { Status: ({ title, children }) => React.createElement("section", null, React.createElement("strong", null, title), children) },
    "@/components/monthly-dues/monthly-book": { MonthlyBook: ({ data }) => data.kind === "historical_unavailable" ? React.createElement("p", null, "Data historis tidak tersedia.") : React.createElement("div", null, data.rows.map(row => React.createElement("div", { key: row.paymentId }, `${row.memberNameSnapshot ?? "Nama historis tidak tersedia"}: ${row.amount}`))) },
    "@/components/monthly-dues/contracts": { periodLabel: value => value },
    "@/lib/auth/require-role": { requireModulePermission: async (...args) => { const user = (await authorize(...args)) ?? { role: "bendahara" }; return { profile: { id: "test-user" }, ...user }; } },
    "./book-read": { readMonthlyBook: read },
    "./receipt-read": { readReceipt: async () => ({ error: "Bukti tidak tersedia" }) },
    "./actions": { getMonthlyDuesPeriodTotals: totals },
    "@/components/monthly-dues/period-totals-contract": { formatTotalsRupiah: value => `Rp${value}` },
  };
  runInNewContext(js, { exports, require: name => overrides[name] ?? require(name), URLSearchParams });
  return exports.default;
}

test("page authorizes before backend read and shows only confirmed read-only data", async () => {
  const events = [];
  const page = pageWith({
    authorize: async (...args) => { events.push(`authorize:${args.join(":")}`); },
    read: async params => { events.push(`read:${params.month}`); return { periods: [{ dues_month: "2026-10-01", status: "active", data_status: "available", closed_effective_at: null, closed_processed_at: null }], activeMonth: "2026-10-01", selected: { dues_month: "2026-10-01", status: "active", data_status: "available", closed_effective_at: null, closed_processed_at: null }, rows: [{ paymentId: "payment", memberNameSnapshot: null, amount: 5000 }] }; },
  });
  const html = renderToStaticMarkup(await page({ searchParams: Promise.resolve({ month: "2026-10-01" }) }));
  assert.deepEqual(events, ["authorize:monthly_dues:read", "read:2026-10-01"]);
  assert.match(html, /Nama historis tidak tersedia/);
  assert.match(html, /PERIODE BERSTATUS AKTIF/);
  assert.match(html, /Pencatatan sementara belum tersedia/);
  assert.match(html, /Rekap iuran belum tersedia atau gagal dimuat/);
  assert.doesNotMatch(html, /Catat pembayaran|Buka periode|Saldo kas|KURANG|BELUM BAYAR/);
});

test("denied role cannot trigger read queries", async () => {
  let reads = 0;
  const page = pageWith({ authorize: async () => { throw new Error("denied"); }, read: async () => { reads++; return {}; } });
  await assert.rejects(page({ searchParams: Promise.resolve({}) }), /denied/);
  assert.equal(reads, 0);
});

test("page shows unavailable result instead of zero or fake book", async () => {
  const page = pageWith({ authorize: async () => {}, read: async () => ({ periods: [], error: "Tidak tersedia" }) });
  const html = renderToStaticMarkup(await page({ searchParams: Promise.resolve({}) }));
  assert.match(html, /Tidak tersedia/);
  assert.match(html, /tidak dianggap nol/);
  assert.doesNotMatch(html, /Rp\s*0|<table/);
});

test("historical empty period is closed read-only and never shown as zero", async () => {
  const past = { dues_month: "2026-09-01", status: "closed", data_status: "historical_empty", closed_effective_at: "2026-09-30T17:00:00Z", closed_processed_at: "2026-10-03T01:00:00Z" };
  const page = pageWith({ authorize: async () => {}, read: async () => ({ periods: [past], selected: past, activeMonth: "2026-10-01" }) });
  const html = renderToStaticMarkup(await page({ searchParams: Promise.resolve({ month: past.dues_month }) }));
  assert.match(html, /DITUTUP — READ-ONLY/);
  assert.match(html, /Data historis tidak tersedia/);
  assert.match(html, /Batas efektif penutupan/);
  assert.match(html, /Penutupan diproses/);
  assert.doesNotMatch(html, /Rp\s*0|Catat pembayaran/);
});

test("page does not select a period or query totals automatically", async () => {
  let totalsCalls = 0;
  const period = { dues_month: "2026-11-01", status: "active", data_status: "available", closed_effective_at: null, closed_processed_at: null };
  const page = pageWith({ authorize: async () => {}, read: async () => ({ periods: [period], activeMonth: period.dues_month }), totals: async () => { totalsCalls++; return {}; } });
  const html = renderToStaticMarkup(await page({ searchParams: Promise.resolve({}) }));
  assert.match(html, /Pilih buku untuk melihat ringkasan/);
  assert.equal(totalsCalls, 0);
});

test("selected period displays available aggregate zeros, and refuses inconsistent historical state", async () => {
  const period = { dues_month: "2026-11-01", status: "active", data_status: "available", closed_effective_at: null, closed_processed_at: null };
  const zero = { dues_month: period.dues_month, status: "active", data_status: "available", member_count: 0, paid_member_count: 0, unpaid_member_count: 0, total_paid_amount: 0, total_reference_amount: 0, total_remaining_amount: 0 };
  const props = { authorize: async () => {}, read: async () => ({ periods: [period], selected: period, activeMonth: period.dues_month, rows: [] }) };
  const html = renderToStaticMarkup(await pageWith({ ...props, totals: async () => ({ kind: "available", totals: zero }) })({ searchParams: Promise.resolve({ month: period.dues_month }) }));
  assert.match(html, /Anggota terdaftar/); assert.match(html, /Rp0/);
  assert.match(html, /Belum ada anggota terdaftar pada periode ini/);
  const mismatch = renderToStaticMarkup(await pageWith({ ...props, totals: async () => ({ kind: "historical_empty", totals: { ...zero, data_status: "historical_empty" } }) })({ searchParams: Promise.resolve({ month: period.dues_month }) }));
  assert.match(mismatch, /tidak sesuai dengan periode/); assert.doesNotMatch(mismatch, /Rp0/);
});

test("historical-empty aggregate shows unavailable and no numeric figures", async () => {
  const period = { dues_month: "2026-09-01", status: "closed", data_status: "historical_empty", closed_effective_at: "2026-09-30T17:00:00Z", closed_processed_at: "2026-10-03T01:00:00Z" };
  const totals = { dues_month: period.dues_month, status: "closed", data_status: "historical_empty", member_count: null, paid_member_count: null, unpaid_member_count: null, total_paid_amount: null, total_reference_amount: null, total_remaining_amount: null };
  const page = pageWith({ authorize: async () => {}, read: async () => ({ periods: [period], selected: period, activeMonth: "2026-11-01" }), totals: async () => ({ kind: "historical_empty", totals }) });
  const html = renderToStaticMarkup(await page({ searchParams: Promise.resolve({ month: period.dues_month }) }));
  assert.match(html, /DATA HISTORIS TIDAK TERSEDIA/);
  assert.doesNotMatch(html, /Rp0|Anggota terdaftar/);
});

test("missing totals and query errors have distinct messages and never show zero", async () => {
  const period = { dues_month: "2026-11-01", status: "active", data_status: "available", closed_effective_at: null, closed_processed_at: null };
  const props = { authorize: async () => {}, read: async () => ({ periods: [period], selected: period, activeMonth: period.dues_month, rows: [] }) };
  for (const [kind, expected] of [["not_found", /tidak ditemukan/], ["error", /gagal dimuat/], ["malformed", /tidak sesuai kontrak/]]) {
    const html = renderToStaticMarkup(await pageWith({ ...props, totals: async () => ({ kind }) })({ searchParams: Promise.resolve({ month: period.dues_month }) }));
    assert.match(html, expected); assert.doesNotMatch(html, /Rp0/);
  }
});

test("selected month drives aggregate independently of page, search, filter and displayed rows", async () => {
  const seen = [];
  const page = pageWith({ authorize: async () => {}, read: async ({ month, after }) => {
    const period = { dues_month: month, status: "closed", data_status: "available", closed_effective_at: "2026-09-30T17:00:00Z", closed_processed_at: "2026-10-03T01:00:00Z" };
    return { periods: [period], selected: period, activeMonth: "2026-11-01", rows: after ? [] : [{ paymentId: "one", memberNameSnapshot: "A", amount: 5000 }] };
  }, totals: async month => { seen.push(month); return { kind: "available", totals: { dues_month: month, status: "closed", data_status: "available", member_count: 3, paid_member_count: 1, unpaid_member_count: 2, total_paid_amount: 15000, total_reference_amount: 30000, total_remaining_amount: 15000 } }; } });
  for (const params of [{ month: "2026-09-01" }, { month: "2026-09-01", after: "next", search: "A", filter: "lunas" }, { month: "2026-10-01" }]) {
    const html = renderToStaticMarkup(await page({ searchParams: Promise.resolve(params) }));
    assert.match(html, /Rp15000/);
  }
  assert.deepEqual(seen, ["2026-09-01", "2026-09-01", "2026-10-01"]);
});

test("picker exposes a labelled keyboard focusable native control and responsive styles", async () => {
  const { JSDOM } = await import("jsdom");
  const period = { dues_month: "2026-11-01", status: "active", data_status: "available", closed_effective_at: null, closed_processed_at: null };
  const page = pageWith({ authorize: async () => {}, read: async () => ({ periods: [period], activeMonth: period.dues_month }) });
  const dom = new JSDOM(renderToStaticMarkup(await page({ searchParams: Promise.resolve({}) })));
  const select = dom.window.document.querySelector("#monthly-book-period");
  assert.equal(dom.window.document.querySelector('label[for="monthly-book-period"]').textContent, "Pilih buku bulanan");
  select.focus(); assert.equal(dom.window.document.activeElement, select);
  assert.equal(select.value, ""); assert.equal(select.required, true);
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.monthly-book-picker\s*:focus-visible/);
  assert.match(css, /\.monthly-book-picker\s*\{[^}]*flex-wrap:\s*wrap/);
  assert.match(css, /\.dues-totals\s*\{[^}]*auto-fit/);
});

test("one page invocation reads once; rendering returned markup does not repeat the read", async () => {
  let reads = 0;
  const page = pageWith({ authorize: async () => {}, read: async () => { reads++; return { periods: [] }; } });
  const element = await page({ searchParams: Promise.resolve({}) });
  assert.equal(reads, 1);
  renderToStaticMarkup(element);
  renderToStaticMarkup(element);
  assert.equal(reads, 1);
  await page({ searchParams: Promise.resolve({}) });
  assert.equal(reads, 2);
});

test("only the three authorized roles receive the mounted lifecycle component", async () => {
  const period = { dues_month: "2026-01-01", status: "closed", data_status: "available", closed_effective_at: "2026-01-31T17:00:00Z", closed_processed_at: "2026-02-01T00:00:00Z" };
  for (const role of ["ketua_pemuda", "wakil_ketua_pemuda", "bendahara", "sekretaris"]) {
    const page = pageWith({ authorize: async () => ({ role }), read: async () => ({ periods: [period], selected: period, rows: [] }) });
    const html = renderToStaticMarkup(await page({ searchParams: Promise.resolve({ month: period.dues_month }) }));
    assert.equal(html.includes('data-lifecycle-sync="true"'), role !== "sekretaris", role);
    assert.match(html, /menunggu aktivasi pengurus/);
    assert.match(html, /2026-01-01/);
  }
  for (const role of ["ketua_rt_01", "ketua_rw_01"]) {
    let reads = 0;
    const page = pageWith({ authorize: async () => { throw new Error(`denied ${role}`); }, read: async () => { reads++; return {}; } });
    await assert.rejects(page({ searchParams: Promise.resolve({}) }), /denied/);
    assert.equal(reads, 0);
  }
});

test("subsequent server render after refresh rereads selected period and its totals", async () => {
  const calls = [];
  const month = "2026-09-01";
  const period = { dues_month: month, status: "closed", data_status: "available", closed_effective_at: "2026-09-30T17:00:00Z", closed_processed_at: "2026-10-03T01:00:00Z" };
  const page = pageWith({ authorize: async () => ({ role: "bendahara" }), read: async args => { calls.push(`read:${args.month}`); return { periods: [period], selected: period, rows: [] }; }, totals: async value => { calls.push(`totals:${value}`); return { kind: "not_found" }; } });
  await page({ searchParams: Promise.resolve({ month }) });
  await page({ searchParams: Promise.resolve({ month }) });
  assert.deepEqual(calls, [`read:${month}`, `totals:${month}`, `read:${month}`, `totals:${month}`]);
});

test("secretary reads selected dues aggregates without sync or general cash balance", async () => {
  const period = { dues_month: "2026-11-01", status: "closed", data_status: "available", closed_effective_at: "2026-11-30T17:00:00Z", closed_processed_at: "2026-12-01T00:00:00Z" };
  const events = [];
  const page = pageWith({ authorize: async () => ({ role: "sekretaris" }), read: async () => ({ periods: [period], selected: period, rows: [] }), totals: async month => { events.push(month); return { kind: "available", totals: { dues_month: month, status: "closed", data_status: "available", member_count: 2, paid_member_count: 1, unpaid_member_count: 1, total_paid_amount: 12000, total_reference_amount: 20000, total_remaining_amount: 8000 } }; } });
  const html = renderToStaticMarkup(await page({ searchParams: Promise.resolve({ month: period.dues_month }) }));
  assert.deepEqual(events, [period.dues_month]);
  assert.match(html, /Rp12000/); assert.match(html, /DITUTUP/); assert.match(html, /Status ketersediaan data: TERSEDIA/);
  assert.doesNotMatch(html, /data-lifecycle-sync|Saldo kas/);
});

test("conflicting lifecycle status hides aggregates", async () => {
  const period = { dues_month: "2026-11-01", status: "closed", data_status: "available", closed_effective_at: "2026-11-30T17:00:00Z", closed_processed_at: "2026-12-01T00:00:00Z" };
  const page = pageWith({ authorize: async () => ({ role: "sekretaris" }), read: async () => ({ periods: [period], selected: period, rows: [] }), totals: async () => ({ kind: "available", totals: { dues_month: period.dues_month, status: "active", data_status: "available", member_count: 0, paid_member_count: 0, unpaid_member_count: 0, total_paid_amount: 0, total_reference_amount: 0, total_remaining_amount: 0 } }) });
  const html = renderToStaticMarkup(await page({ searchParams: Promise.resolve({ month: period.dues_month }) }));
  assert.match(html, /tidak sesuai dengan periode/); assert.doesNotMatch(html, /Rp0/);
});
