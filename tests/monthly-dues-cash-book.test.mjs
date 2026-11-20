import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [migration, periodMigration, legacyWritePathMigration, actions, contract] = await Promise.all([
  read("../supabase/migrations/20261120120000_monthly_dues_cash_book_opening_and_expenses.sql"),
  read("../supabase/migrations/20261120130000_explicit_monthly_dues_periods.sql"),
  read("../supabase/migrations/20261120140000_close_legacy_monthly_dues_write_paths.sql"),
  read("../src/app/dashboard/uang-kas-bulanan/actions.ts"),
  read("../docs/backend-monthly-dues-contract.md"),
]);


test("legacy monthly-dues SECURITY DEFINER write paths and direct register inserts are revoked", () => {
  assert.match(legacyWritePathMigration, /revoke execute on function public\.create_member_and_monthly_dues\\(text, date\\)\\s+from public, anon, authenticated/);
  assert.match(legacyWritePathMigration, /revoke execute on function public\.create_member_for_dues\\(text\\)\\s+from public, anon, authenticated/);
  assert.match(legacyWritePathMigration, /revoke all on table public\.monthly_dues from public, anon, authenticated/);
  assert.match(legacyWritePathMigration, /revoke all on table public\.monthly_dues from public, anon, authenticated/);
  assert.match(legacyWritePathMigration, /grant select on table public\.monthly_dues to authenticated/);
  assert.match(legacyWritePathMigration, /revoke all on table public\.monthly_dues_payments from public, anon, authenticated/);
  assert.match(legacyWritePathMigration, /grant select on table public\.monthly_dues_payments to authenticated/);
  assert.match(legacyWritePathMigration, /create_member_and_monthly_dues_safe/);
  assert.match(legacyWritePathMigration, /create or replace function public\.ensure_monthly_dues_for_member/);
});

test("October 2026 historical opening balance is seeded as Rp205,000 and protected from mutation", () => {
  assert.match(migration, /date '2026-10-01',[\s\S]*?205000\.00/);
  assert.match(migration, /before update or delete on public\.monthly_dues_cash_opening_balances/);
  assert.match(migration, /revoke all on public\.monthly_dues_cash_opening_balances from public, anon, authenticated/);
  assert.match(migration, /revoke all on public\.monthly_dues_cash_expenses from public, anon, authenticated/);
  assert.match(migration, /before update or delete on public\.monthly_dues_cash_expenses/);
});

test("expense write path is finance-role gated, validated, idempotent, and append-only", () => {
  assert.match(migration, /record_monthly_dues_cash_expense/);
  assert.match(migration, /'ketua_pemuda','wakil_ketua_pemuda','bendahara'/);
  assert.match(migration, /idempotency_key uuid not null unique/);
  assert.match(migration, /p_spent_at at time zone 'Asia\/Jakarta'/);
});

test("cash book exposes only explicitly opened periods and continuously carries the actual cash balance", () => {
  assert.match(migration, /monthly_dues_cash_book_summary/);
  assert.match(migration, /monthly_dues_cash_book_movements/);
  assert.match(periodMigration, /pay\.paid_at >= opened\.opened_at/);
  assert.match(periodMigration, /p\.paid_at >= period\.opened_at/);
  assert.match(periodMigration, /Saldo awal dari saldo akhir periode sebelumnya/);
  assert.match(periodMigration, /'0:opening:' \|\| summary\.dues_month/);
  assert.match(periodMigration, /'1:payment:' \|\| p\.id/);
  assert.match(periodMigration, /'2:expense:' \|\| e\.id/);
  assert.equal([...periodMigration.matchAll(/where \(select app_private\.has_any_role\(array\[/g)].length, 2, "both cash-book views must filter to finance roles");
  assert.match(periodMigration, /revoke all on public\.monthly_dues_cash_book_summary from public, anon/);
  assert.match(periodMigration, /revoke all on public\.monthly_dues_cash_book_movements from public, anon/);
  assert.match(periodMigration, /where \(select app_private\.has_any_role\(array\[/);
  assert.match(periodMigration, /grant select on public\.monthly_dues_cash_book_summary to authenticated/);
  assert.match(periodMigration, /grant select on public\.monthly_dues_cash_book_movements to authenticated/);
  assert.doesNotMatch(periodMigration, /create or replace function public\.get_monthly_dues_cash_book/);
  assert.match(periodMigration, /create table public\.monthly_dues_periods/);
  assert.match(periodMigration, /revoke all on public\.monthly_dues_periods from public, anon, authenticated/);
  assert.match(periodMigration, /select m\.id, date '2026-10-01', 10000/);
  assert.match(periodMigration, /insert into public\.monthly_dues_periods/);
  assert.match(periodMigration, /open_monthly_dues_period/);
  assert.match(periodMigration, /immediately following month/);
  assert.match(periodMigration, /monthly_dues_cash_expense_requires_open_period/);
  assert.doesNotMatch(periodMigration, /generate_series\(/);
  assert.match(migration, /opening_balance \+ income_amount - expense_amount/);
  assert.match(actions, /getMonthlyDuesCashBook/);
  assert.match(actions, /pageSize = 50/);
  assert.match(actions, /pageSize > 100/);
  assert.match(actions, /count: "exact"/);
  assert.match(actions, /const to = from \+ pageSize - 1/);
  assert.match(actions, /\.range\(from, to\)/);
  assert.match(actions, /hasMore: from \+ pageMovements\.length < count/);
  assert.match(actions, /from\("monthly_dues_cash_book_summary"\)/);
  assert.match(actions, /from\("monthly_dues_cash_book_movements"\)/);
  assert.match(actions, /recordMonthlyDuesCashExpense/);
  assert.match(actions, /getMonthlyDuesPeriods/);
  assert.match(actions, /open_monthly_dues_period/);
  assert.match(contract, /A month appears in UANG KAS BULANAN only after an authorized officer explicitly opens it/);
  assert.match(contract, /November's opening cash is Rp255,000/);
  assert.match(contract, /The two books remain separate/);
});

test("cash expense timestamp validator accepts ISO timestamps with an explicit offset", () => {
  const match = actions.match(/return (\/\^.*?\/)\.test\(value\)/s);
  assert.ok(match, "timestamp regex must remain present in the Server Action");
  const timestampPattern = new RegExp(match[1].slice(1, -1));
  assert.equal(timestampPattern.test("2026-10-15T10:00:00+07:00"), true);
  assert.equal(timestampPattern.test("not-a-timestamp"), false);
});

test("expense RPC serializes writes and rejects spending above the official available cash balance", () => {
  assert.match(migration, /pg_advisory_xact_lock\([\s\S]*?koppkas-monthly-dues-cash-balance/);
  assert.match(migration, /from public\.monthly_dues_cash_book_summary summary[\s\S]*?order by summary\.dues_month desc[\s\S]*?limit 1/);
  assert.match(migration, /if p_amount > v_available_balance then[\s\S]*?using errcode = '23514'/);
  assert.match(migration, /Re-check idempotency after acquiring the lock/);
  assert.match(migration, /Official available cash balance is unavailable/);
  assert.match(actions, /error\?\.code === "23514"[\s\S]*?Saldo kas tidak mencukupi/);
  assert.match(actions, /error\?\.code === "P0002"[\s\S]*?Saldo kas resmi belum tersedia/);
});

test("cash-book views are role-filtered and non-public from their first migration", () => {
  assert.equal([...migration.matchAll(/where \(select app_private\.has_any_role\(array\[/g)].length, 2);
  assert.match(migration, /revoke all on public\.monthly_dues_cash_book_summary from public, anon/);
  assert.match(migration, /revoke all on public\.monthly_dues_cash_book_movements from public, anon/);
  assert.match(migration, /with movements as \([\s\S]*?\)\s*select \*\s*from movements[\s\S]*?has_any_role/);
});
