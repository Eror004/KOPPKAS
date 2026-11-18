import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [page, paymentForm] = await Promise.all([
  readFile(new URL("../src/app/dashboard/uang-kas-bulanan/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/dashboard/uang-kas-bulanan/payment-form.tsx", import.meta.url), "utf8"),
]);

test("monthly dues dashboard loads a rolling 12-period history", () => {
  assert.match(page, /historyStart/);
  assert.match(page, /\.gte\("dues_month", historyStart\)/);
  assert.match(page, /\.lte\("dues_month", currentMonth\)/);
  assert.match(page, /for \(const row of allRows\)/);
  assert.match(page, /Riwayat 12 periode terakhir/);
});

test("monthly dues recap distinguishes historical unpaid periods without debt language", () => {
  assert.match(page, /PERIODE LAMA BELUM LUNAS/);
  assert.match(page, /historicalUnpaid/);
  assert.match(page, /bukan tagihan, utang wajib, atau dasar denda/);
});

test("current-month recording and payment controls remain available", () => {
  assert.match(page, /RegisterForm/);
  assert.match(page, /PaymentForm monthlyDuesId/);
  assert.match(page, /InlineMemberForm/);
});

test("dues payment form generates an idempotency key at submit time", () => {
  assert.match(paymentForm, /crypto\.randomUUID\(\)/);
  assert.match(paymentForm, /formData\.set\("idempotency_key"/);
  assert.match(paymentForm, /useRef<string \| null>\(null\)/);
  assert.match(paymentForm, /if \(result\.success\) idempotencyKeyRef\.current = null/);
  assert.match(paymentForm, /value="" readOnly/);
});
