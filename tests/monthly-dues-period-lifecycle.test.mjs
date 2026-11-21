import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../supabase/migrations/20261121100000_monthly_dues_lifecycle_and_receipt_snapshots.sql", import.meta.url), "utf8");

test("period lifecycle recaptures Jakarta time after acquiring the lifecycle lock", () => {
  const lockAt = sql.indexOf("pg_advisory_xact_lock");
  const rowLockAt = sql.indexOf("for update", lockAt);
  const recaptureAt = sql.indexOf("v_now := clock_timestamp()", rowLockAt);
  assert.ok(lockAt >= 0 && rowLockAt > lockAt && recaptureAt > rowLockAt);
  assert.ok(sql.includes("v_now at time zone 'Asia/Jakarta'"));
  assert.ok(sql.includes("closed_effective_at") && sql.includes("closed_processed_at"));
});

test("missed periods remain empty and are not exposed as generated member lists", () => {
  assert.ok(sql.includes("'historical_empty'"));
  assert.ok(sql.includes("then 'available' else 'historical_empty' end"));
  assert.ok(sql.includes("Page synchronization creates the current period"));
  assert.ok(sql.includes("period.data_status = 'available'"));
  assert.ok(sql.includes("gap.data_status = 'historical_empty'"));
});

test("payment reconciles retries before and after the period lock", () => {
  const payment = sql.slice(sql.indexOf("create or replace function public.record_monthly_dues_payment"), sql.indexOf("create or replace function public.record_monthly_dues_cash_expense"));
  assert.ok(payment.indexOf("where idempotency_key = p_idempotency_key") < payment.indexOf("perform app_private.ensure_current_monthly_dues_period()"));
  const lockAt = payment.indexOf("lock_current_monthly_dues_period(v_month)");
  const secondLookupAt = payment.indexOf("where idempotency_key = p_idempotency_key", lockAt + 1);
  const assertAt = payment.indexOf("assert_current_monthly_dues_period(v_month, v_validated_at)");
  assert.ok(lockAt >= 0 && secondLookupAt > lockAt && assertAt > secondLookupAt);
  assert.ok(payment.includes("member_name_snapshot, recorder_name_snapshot"));
  assert.ok(payment.includes("on conflict (idempotency_key) do nothing"));
});

test("receipt identity is snapshot-only", () => {
  const receipt = sql.slice(sql.indexOf("create or replace view public.monthly_dues_payment_receipts"), sql.indexOf("-- Preserve the original five view columns"));
  assert.ok(receipt.includes("op.member_name_snapshot as member_name"));
  assert.ok(receipt.includes("op.recorder_name_snapshot as recorded_by_name"));
  assert.ok(!receipt.includes("join public.members m"));
  assert.ok(!receipt.includes("join public.profiles recorder"));
});

test("historical cash gaps remain NULL and expenses fail closed", () => {
  assert.ok(sql.includes("case when cash_balance_known then calculated_opening_balance else null end"));
  assert.ok(sql.includes("end)::numeric(15,2) as closing_balance"));
  assert.ok(sql.includes("Official cash balance is unavailable; expense was not recorded"));
});

test("cash summary preserves the original five columns and appends lifecycle metadata", () => {
  const view = sql.slice(sql.indexOf("create or replace view public.monthly_dues_cash_book_summary"), sql.indexOf("create or replace view public.monthly_dues_cash_book_movements"));
  const columns = ["dues_month,", "as opening_balance,", "as income_amount,", "as expense_amount,", "as closing_balance,", "data_status,", "as cash_balance_status"];
  let cursor = -1;
  for (const column of columns) {
    const next = view.indexOf(column, cursor + 1);
    assert.ok(next > cursor, "expected column in compatible order: " + column);
    cursor = next;
  }
});
