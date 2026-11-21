import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
const source = readFileSync(new URL("../src/components/monthly-dues/payment-attempt.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exports = {};
runInNewContext(js, { exports });
const { createPaymentIntent, validatePaymentRetry, classifyPaymentOutcome } = exports;
const input = { actorId: "00000000-0000-4000-8000-000000000001", bookMonth: "2026-11-01", registerId: "00000000-0000-4000-8000-000000000002", amount: "5000", note: " sumbangan " };
const key = "00000000-0000-4000-8000-000000000003";
const transactionId = "00000000-0000-4000-8000-000000000004";

test("one operation freezes its actor, book, register, key and canonical payload", () => {
  const intent = createPaymentIntent(input, key);
  assert.equal(Object.isFrozen(intent), true);
  assert.equal(intent.amount, "5000.00");
  assert.equal(intent.note, "sumbangan");
  assert.equal(validatePaymentRetry(intent, { ...input, amount: "05000.0" }), intent);
  for (const changed of [
    { ...input, actorId: transactionId }, { ...input, bookMonth: "2026-10-01" },
    { ...input, registerId: transactionId }, { ...input, amount: "6000" }, { ...input, note: "berbeda" },
  ]) assert.throws(() => validatePaymentRetry(intent, changed), /berubah/);
});

test("invalid money or identity never creates a payment intent", () => {
  for (const amount of ["", "0", "-1", "1.001", "1e3", "10000000000000", "Infinity"]) {
    assert.throws(() => createPaymentIntent({ ...input, amount }, key));
  }
  assert.throws(() => createPaymentIntent(input, "bad-key"));
  assert.throws(() => createPaymentIntent({ ...input, bookMonth: "2026-13-01" }, key));
});

test("timeout and ambiguous results are unconfirmed; success returns the original transaction ID", () => {
  for (const result of [null, { data: null, error: { code: "" } }, { data: null, error: { code: "08006" } },
    { data: null, error: { code: "40003" } }, { data: null, error: { code: "PGRST301" } },
    { data: "invalid", error: null }]) {
    assert.equal(classifyPaymentOutcome(result).kind, "unconfirmed");
  }
  assert.equal(classifyPaymentOutcome({ data: transactionId, error: null }, true).transactionId, transactionId);
  assert.equal(classifyPaymentOutcome({ data: null, error: { code: "55000" } }, true).kind, "unconfirmed");
});

test("explicit validation, authorization and database failures are distinct", () => {
  assert.equal(classifyPaymentOutcome({ data: null, error: { code: "22023" } }).kind, "validation");
  assert.equal(classifyPaymentOutcome({ data: null, error: { code: "42501" } }).kind, "authorization");
  assert.equal(classifyPaymentOutcome({ data: null, error: { code: "40001" } }).kind, "database");
});
