import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [migration, actions, contract] = await Promise.all([
  read("../supabase/migrations/20261120120000_monthly_dues_cash_book_opening_and_expenses.sql"),
  read("../src/app/dashboard/uang-kas-bulanan/actions.ts"),
  read("../docs/backend-monthly-dues-contract.md"),
]);

test("October 2026 historical opening balance is seeded as Rp205,000 and protected from mutation", () => {
  assert.match(migration, /date '2026-10-01',[\s\S]*?205000\.00/);
  assert.match(migration, /before update or delete on public\.monthly_dues_cash_opening_balances/);
  assert.match(migration, /revoke insert, update, delete on public\.monthly_dues_cash_expenses from anon, authenticated/);
  assert.match(migration, /before update or delete on public\.monthly_dues_cash_expenses/);
});

test("expense write path is finance-role gated, validated, idempotent, and append-only", () => {
  assert.match(migration, /record_monthly_dues_cash_expense/);
  assert.match(migration, /'ketua_pemuda','wakil_ketua_pemuda','bendahara'/);
  assert.match(migration, /idempotency_key uuid not null unique/);
  assert.match(migration, /p_spent_at at time zone 'Asia\/Jakarta'/);
});

test("cash book exposes opening, income, expenses, and carried closing balance without mutating opening", () => {
  assert.match(migration, /monthly_dues_cash_book_summary/);
  assert.match(migration, /monthly_dues_cash_book_movements/);
  assert.match(migration, /opening_balance \+ income_amount - expense_amount/);
  assert.match(actions, /getMonthlyDuesCashBook/);
  assert.match(actions, /recordMonthlyDuesCashExpense/);
  assert.match(contract, /Saldo awal historis UANG KAS BULANAN Oktober 2026/);
  assert.match(contract, /The two books remain separate/);
});
