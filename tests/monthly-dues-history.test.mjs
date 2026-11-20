import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [page, directory, paymentForm] = await Promise.all([
  readFile(new URL("../src/app/dashboard/uang-kas-bulanan/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/monthly-dues/dues-directory.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/dashboard/uang-kas-bulanan/payment-form.tsx", import.meta.url), "utf8"),
]);

test("monthly dues dashboard loads a rolling 12-period history", () => {
  assert.match(page, /historyStart/);
  assert.match(page, /\.gte\("dues_month", historyStart\)/);
  assert.match(page, /\.lte\("dues_month", currentMonth\)/);
  assert.match(directory, /openedPeriods/);
  assert.match(directory, /Pilih periode yang sudah dibuka/);
});

test("monthly dues recap explicitly avoids debt or automatic arrears", () => {
  assert.match(directory, /Setiap bulan berdiri sendiri/);
  assert.match(directory, /rows\.filter\(row => row\.dues_month === period\)/);
});

test("current-month recording and payment controls remain role scoped", () => {
  assert.match(page, /can\(user\.role, "monthly_dues", "create"\)/);
  assert.doesNotMatch(page, /<RegisterForm/);
  assert.doesNotMatch(page, /<InlineMemberForm/);
  assert.match(directory, /row.dues_month === currentMonth/);
  assert.match(directory, /PaymentForm key=\{selected.id\} monthlyDuesId=\{selected.id\}/);
});

test("dues payment form generates an idempotency key at submit time", () => {
  assert.match(paymentForm, /crypto\.randomUUID\(\)/);
  assert.match(paymentForm, /formData\.set\("idempotency_key"/);
  assert.match(paymentForm, /useRef<string \| null>\(null\)/);
  assert.match(paymentForm, /if \(result\.success\) idempotencyKeyRef\.current = null/);
  assert.match(paymentForm, /value="" readOnly/);
});
