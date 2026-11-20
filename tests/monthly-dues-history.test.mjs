import test from "node:test";
import assert from "node:assert/strict";
import { createLatestRequestGate } from "../src/components/monthly-dues/latest-request.js";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(path, import.meta.url), "utf8");
const [page, actions, directory, registerForm, paymentForm] = await Promise.all([
  read("../src/app/dashboard/uang-kas-bulanan/page.tsx"),
  read("../src/app/dashboard/uang-kas-bulanan/actions.ts"),
  read("../src/components/monthly-dues/dues-directory.tsx"),
  read("../src/app/dashboard/uang-kas-bulanan/register-form.tsx"),
  read("../src/app/dashboard/uang-kas-bulanan/payment-form.tsx"),
]);

test("monthly dues page reads explicit opened periods before querying member summaries", () => {
  assert.match(page, /getMonthlyDuesPeriods\(\)/);
  assert.match(page, /periodResult\.error/);
  assert.match(page, /\.in\("dues_month", openedPeriods\)/);
  assert.match(page, /\.range\(offset, offset \+ 999\)/);
  assert.doesNotMatch(page, /historyStart|InlineMemberForm/);
});

test("period opening always submits an explicit next-month value", () => {
  assert.match(registerForm, /name="dues_month"/);
  assert.match(registerForm, /nextMonth/);
  assert.match(actions, /formData\.get\("dues_month"\)/);
  assert.match(actions, /open_monthly_dues_period/);
  assert.doesNotMatch(actions, /upsert\(rows/);
});

test("member search and register creation use stable member IDs and explicit period", () => {
  assert.match(directory, /searchMembers\(memberQuery, currentMonth\)/);
  assert.match(directory, /ensureRegister\(member\.memberId, currentMonth\)/);
  assert.match(directory, /createMember\(newName, currentMonth/);
  assert.match(directory, /memberResults\.hasMore/);
  assert.match(actions, /create_member_and_monthly_dues_safe/);
  assert.match(actions, /ensure_monthly_dues_for_member/);
  assert.doesNotMatch(directory, /from\("members"\)/);
});

test("late register responses cannot replace a newer member selection", async () => {
  assert.match(directory, /selectionGate\.begin\(\)/);
  assert.match(directory, /selectionGate\.isCurrent\(requestId\)/);
  assert.match(directory, /selectionGate\.invalidate\(\)/);

  const gate = createLatestRequestGate();
  let selected = null;
  let resolveFirst;
  let resolveSecond;
  const firstResult = new Promise(resolve => { resolveFirst = resolve; });
  const secondResult = new Promise(resolve => { resolveSecond = resolve; });
  const select = async (memberId, resultPromise) => {
    const requestId = gate.begin();
    const result = await resultPromise;
    if (!gate.isCurrent(requestId)) return;
    selected = { memberId, registerId: result.registerId };
  };

  const firstSelection = select("member-a", firstResult);
  const secondSelection = select("member-b", secondResult);
  resolveSecond({ registerId: "register-b" });
  await secondSelection;
  resolveFirst({ registerId: "register-a" });
  await firstSelection;

  assert.deepEqual(selected, { memberId: "member-b", registerId: "register-b" });
});

test("payment receipt lookup remains separate from payment submission", () => {
  assert.match(directory, /getReceipt=\{getReceipt\}/);
  assert.match(paymentForm, /idempotency_key/);
  assert.match(paymentForm, /getReceipt/);
  assert.match(actions, /getDuesPaymentReceipt/);
});
