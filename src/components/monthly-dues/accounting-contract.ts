import type { MonthlyDuesCashBookResult, MonthlyDuesCashBookSummary } from "./backend-contract";

/** The backend summary is authoritative; movement pages must never be summed into a balance. */
export function officialCashSummary(period: string, result: MonthlyDuesCashBookResult): MonthlyDuesCashBookSummary | null {
  const summary = result.summary;
  if (result.error || !summary || summary.dues_month !== period) return null;
  const values = [summary.opening_balance, summary.income_amount, summary.expense_amount, summary.closing_balance];
  if (values.some(value => String(value).trim() === "" || !Number.isFinite(Number(value)))) return null;
  return summary;
}
