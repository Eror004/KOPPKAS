import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../supabase/migrations/20261121100000_monthly_dues_lifecycle_and_receipt_snapshots.sql", import.meta.url), "utf8");

test("period lifecycle uses Asia/Jakarta clock after acquiring the lifecycle lock", () => {
  assert.match(sql, /pg_advisory_xact_lock[\\s\\S]*?v_processed_at := clock_timestamp\\(\\)/i);
  assert.match(sql, /date_trunc[\\s\\S]*?'month', v_processed_at at time zone 'Asia\\/Jakarta'/i);
  assert.match(sql, /closed_effective_at[\\s\\S]*?closed_processed_at/i);
});

test("missed periods are closed and empty without member registers", () => {
  assert.match(sql, /'historical_empty'/);
  assert.match(sql, /case when v_month = v_current_month[\\s\\S]*?then 'available' else 'historical_empty' end/);
  assert.match(sql, /Register preparation is a separate shared-lock step/);
  assert.match(sql, /period\\.data_status = 'available'/);
  assert.match(sql, /gap\\.data_status = 'historical_empty'/);
});

test("payment validates only after a shared period lock and reconciles retries first", () => {
  const payment = sql.slice(sql.indexOf("create or replace function public.record_monthly_dues_payment"), sql.indexOf("create or replace function public.record_monthly_dues_cash_expense"));
  assert.ok(payment.indexOf("where idempotency_key = p_idempotency_key") < payment.indexOf("perform app_private.ensure_current_monthly_dues_period()"));
  assert.match(payment, /lock_current_monthly_dues_period\\(v_month\\)/);
  assert.match(payment, /member_name_snapshot, recorder_name_snapshot/);
  assert.match(payment, /on conflict \\(idempotency_key\\) do nothing/i);
  const lockAt = payment.indexOf("lock_current_monthly_dues_period(v_month)");
  const secondLookupAt = payment.indexOf("where idempotency_key = p_idempotency_key", lockAt + 1);
  const assertAt = payment.indexOf("assert_current_monthly_dues_period(v_month, v_validated_at)");
  assert.ok(lockAt >= 0 && secondLookupAt > lockAt && assertAt > secondLookupAt);
});

test("receipt identity is sourced from snapshots, not live member/profile joins", () => {
  const receipt = sql.slice(sql.indexOf("create or replace view public.monthly_dues_payment_receipts"), sql.indexOf("-- Preserve the original five view columns"));
  assert.match(receipt, /op\\.member_name_snapshot as member_name/);
  assert.match(receipt, /op\\.recorder_name_snapshot as recorded_by_name/);
  assert.doesNotMatch(receipt, /join public\\.members m|join public\\.profiles recorder/i);
});

test("historical cash gaps stay NULL and expense RPC fails closed", () => {
  assert.match(sql, /case when cash_balance_known then calculated_opening_balance else null end/);
  assert.match(sql, /case when cash_balance_known and income_amount is not null and expense_amount is not null[\\s\\S]*?else null end as closing_balance/);
  assert.match(sql, /Official cash balance is unavailable; expense was not recorded/);
});

test("cash summary preserves its original five-column order and appends metadata", () => {
  const view = sql.slice(sql.indexOf("create or replace view public.monthly_dues_cash_book_summary"), sql.indexOf("create or replace view public.monthly_dues_cash_book_movements"));
  const columns = ["dues_month,", "as opening_balance,", "as income_amount,", "as expense_amount,", "as closing_balance,", "data_status,", "as cash_balance_status"];
  let cursor = -1;
  for (const column of columns) {
    const next = view.indexOf(column, cursor + 1);
    assert.ok(next > cursor, `expected column ${column} in compatible order`);
    cursor = next;
  }
});
