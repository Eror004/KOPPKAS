import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [migration, periodMigration, actions, contract] = await Promise.all([
  read("../supabase/migrations/20261120120000_monthly_dues_cash_book_opening_and_expenses.sql"),
  read("../supabase/migrations/20261120130000_explicit_monthly_dues_periods.sql"),
  read("../src/app/dashboard/uang-kas-bulanan/actions.ts"),
  read("../docs/backend-monthly-dues-contract.md"),
]);

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
  assert.match(periodMigration, /pay\.paid_at >= period\.opened_at/);
  assert.match(periodMigration, /Saldo awal dari saldo akhir periode sebelumnya/);
  assert.match(periodMigration, /'0:opening:' \|\| summary\.dues_month/);
  assert.match(periodMigration, /'1:payment:' \|\| p\.id/);
  assert.match(periodMigration, /'2:expense:' \|\| e\.id/);
  assert.equal([...periodMigration.matchAll(/where \(select app_private\.has_any_role\(array\[/g)].length, 2, "both cash-book views must filter to finance roles");
  assert.match(periodMigration, /revoke all on public\.monthly_dues_cash_book_summary from public, anon, authenticated/);
  assert.match(periodMigration, /revoke all on public\.monthly_dues_cash_book_movements from public, anon, authenticated/);
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
