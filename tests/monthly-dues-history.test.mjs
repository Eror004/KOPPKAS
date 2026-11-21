import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [page, directory, paymentForm, registerForm, actions] = await Promise.all([
  readFile(new URL("../src/app/dashboard/uang-kas-bulanan/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/monthly-dues/dues-directory.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/dashboard/uang-kas-bulanan/payment-form.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/dashboard/uang-kas-bulanan/register-form.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/dashboard/uang-kas-bulanan/actions.ts", import.meta.url), "utf8"),
]);

test("monthly dues page reads only explicitly opened periods", () => {
  assert.match(page, /getMonthlyDuesPeriods/);
  assert.match(page, /\.in\("dues_month", openedPeriods\)/);
  assert.match(page, /<DuesDirectory/);
  assert.doesNotMatch(page, /create_member_and_monthly_dues|InlineMemberForm/);
  assert.match(page, /canViewCashBook=\{can\(user\.role, "general_finance", "read"\)\}/);
});

test("period opening submits an explicit month and only authorized officers see the action", () => {
  assert.match(page, /\["ketua_pemuda", "wakil_ketua_pemuda", "bendahara"\]\.includes\(user\.role\)/);
  assert.match(registerForm, /name="dues_month" value=\{duesMonth\}/);
  assert.match(registerForm, /generateMonthlyRegister/);
  assert.match(actions, /open_monthly_dues_period/);
  assert.match(actions, /isValidMonth\(duesMonth\)/);
});

test("member creation uses safe backend action and explicit duplicate review", () => {
  assert.match(actions, /create_member_and_monthly_dues_safe/);
  assert.match(actions, /p_confirm_same_name/);
  assert.match(directory, /DuesMemberCreateForm/);
});

test("payment uses idempotency key and retrieves persisted receipt separately", () => {
  assert.match(paymentForm, /crypto\.randomUUID\(\)/);
  assert.match(paymentForm, /formData\.set\("idempotency_key"/);
  assert.match(paymentForm, /if \(result\.success\) idempotencyKeyRef\.current = null/);
  assert.match(paymentForm, /getDuesPaymentReceipt/);
  assert.match(paymentForm, /ReceiptFeedback/);
  assert.match(actions, /monthly_dues_payment_receipts/);
});
