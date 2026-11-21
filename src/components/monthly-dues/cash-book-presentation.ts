import type { MonthlyDuesCashBookResult, MonthlyDuesCashBookSummary } from "./backend-contract";

/** Read only the official summary; a page of movements is never a balance source. */
export function officialCashSummary(period: string, result: MonthlyDuesCashBookResult): MonthlyDuesCashBookSummary | null {
  const summary = result.summary;
  if (result.error || !summary || summary.dues_month !== period) return null;
  const amounts = [summary.opening_balance, summary.income_amount, summary.expense_amount, summary.closing_balance];
  if (amounts.some(value => String(value).trim() === "" || !Number.isFinite(Number(value)))) return null;
  return summary;
}
