import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const read = path => readFile(new URL(path, import.meta.url), "utf8");
const [duesSource, page, payment, receipt, accounting, duesDirectory] = await Promise.all([
  read("../src/components/monthly-dues/contracts.ts"),
  read("../src/app/dashboard/uang-kas-bulanan/page.tsx"),
  read("../src/app/dashboard/uang-kas-bulanan/payment-form.tsx"),
  read("../src/components/monthly-dues/receipt-feedback.tsx"),
  read("../src/components/monthly-dues/accounting-panel.tsx"),
  read("../src/components/monthly-dues/dues-directory.tsx"),
]);
const js = ts.transpileModule(duesSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exports = {};
runInNewContext(js, { exports, Intl, Number, Date });
const { duesStatus, summarizeDues, isValidDuesMonth } = exports;
const rows = [
  { id: "a", member_id: "a", full_name: "Parsial", dues_month: "2026-11-01", reference_amount: 10000, paid_amount: 4000, remaining_amount: 6000, payment_status: "belum_bayar" },
  { id: "b", member_id: "b", full_name: "Lunas", dues_month: "2026-11-01", reference_amount: 10000, paid_amount: 12000, remaining_amount: 0, payment_status: "lunas" },
  { id: "c", member_id: "c", full_name: "Belum bayar", dues_month: "2026-11-01", reference_amount: 10000, paid_amount: 0, remaining_amount: 10000, payment_status: "belum_bayar" },
];

test("voluntary contribution status is derived from the Rp10,000 threshold", () => {
  assert.equal(duesStatus(rows[0]), "kurang");
  assert.equal(duesStatus(rows[1]), "lunas");
  assert.equal(duesStatus(rows[2]), "belum_bayar");
  assert.equal(duesStatus({ ...rows[0], paid_amount: 9999.99 }), "kurang");
  assert.equal(duesStatus({ ...rows[0], paid_amount: 10000 }), "lunas");
  assert.equal(duesStatus({ ...rows[0], reference_amount: 9000 }), "unavailable");
  const summary = summarizeDues(rows);
  assert.equal(summary.paid, 1);
  assert.equal(summary.short, 1);
  assert.equal(summary.unpaid, 1);
  assert.equal(summary.collected, 16000);
});

test("monthly dues UI preserves loading/error distinctions and does not invent balances", () => {
  assert.match(page, /periodResult\.error/);
  assert.match(page, /Status kind="error"/);
  assert.match(accounting, /officialCashSummary\(period, result\)/);
  assert.match(accounting, /summary\.closing_balance/);
  assert.doesNotMatch(accounting, /HISTORICAL_OCTOBER_AMOUNT|205000/);
});

test("payment writes use idempotency and receipt reads do not submit another payment", () => {
  assert.match(payment, /crypto\.randomUUID\(\)/);
  assert.match(payment, /formData\.set\("idempotency_key"/);
  assert.match(payment, /recordDuesPayment/);
  assert.match(receipt, /getReceipt\(transactionId\)/);
  assert.doesNotMatch(receipt, /recordDuesPayment|record_monthly_dues_payment/);
});

test("cash book shows official summary and paginates movements independently", () => {
  assert.match(accounting, /getCashBook\(period, 0, 50\)/);
  assert.match(accounting, /getCashBook\(period, \(result\.page \?\? 0\) \+ 1/);
  assert.match(accounting, /result\.hasMore/);
  assert.doesNotMatch(accounting, /reduce\(.*amount|runningBalance/);
  assert.match(accounting, /getCashBook\(period, 0, 50\)/);
  assert.match(accounting, /setCashState\(\{ period, result: refreshed/);
});


test("receipt validation accepts a valid opened month and rejects malformed dates", () => {
  assert.equal(isValidDuesMonth("2026-11-01"), true);
  assert.equal(isValidDuesMonth("2026-02-01"), true);
  assert.equal(isValidDuesMonth("2026-13-01"), false);
  assert.equal(isValidDuesMonth("2026-11-20"), false);
  assert.equal(isValidDuesMonth("not-a-month"), false);
});


test("inline member creation prevents duplicate submissions while an action is pending", () => {
  assert.match(duesDirectory, /createPendingRef\.current/);
  assert.match(duesDirectory, /disabled=\{createPending\}/);
  assert.match(duesDirectory, /finally \{[\s\S]*createPendingRef\.current = false/);
});
