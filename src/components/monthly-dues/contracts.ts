/** Fields already selected from monthly_dues_summary. Monetary values may be numeric strings. */
export interface DuesRecord {
  id: string;
  full_name: string;
  dues_month: string;
  reference_amount: number | string;
  paid_amount: number | string;
  remaining_amount: number | string;
  payment_status: "lunas" | "belum_lunas";
}
export interface DuesPeriodSummary { members: number; paid: number; unpaid: number; withPayments: number; withoutPayments: number; collected: number }

export function summarizeDues(rows: DuesRecord[]): DuesPeriodSummary {
  const paid = rows.filter(row => row.payment_status === "lunas").length;
  const withPayments = rows.filter(row => Number(row.paid_amount) > 0).length;
  return { members: rows.length, paid, unpaid: rows.length - paid, withPayments, withoutPayments: rows.length - withPayments, collected: rows.reduce((total, row) => total + Number(row.paid_amount), 0) };
}

/** YYYY-MM-01 dates are calendar periods, not timestamps in the user's timezone. */
export function periodLabel(period: string): string {
  const [year, month] = period.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
}
export function periodWindow(currentMonth: string): string[] {
  const [year, month] = currentMonth.split("-").map(Number);
  return Array.from({ length: 12 }, (_, offset) => new Date(Date.UTC(year, month - 1 - offset, 1)).toISOString().slice(0, 10));
}
export function formatContribution(amount: number | string): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: Number.isInteger(value) ? 0 : 2 }).format(value);
}
