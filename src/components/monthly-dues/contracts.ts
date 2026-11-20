/** Fields already selected from monthly_dues_summary. Monetary values may be numeric strings. */
export interface DuesRecord {
  id: string;
  member_id: string;
  full_name: string;
  dues_month: string;
  reference_amount: number | string;
  paid_amount: number | string;
  remaining_amount: number | string;
  payment_status: "lunas" | "belum_lunas";
}
export const MONTHLY_REFERENCE = 10000;
export type DuesStatus = "lunas" | "kurang" | "belum_bayar" | "unavailable";

/** Positive payment amounts are enforced by the current database schema. */
export function duesStatus(row: DuesRecord): DuesStatus {
  const raw = row.paid_amount;
  if ((typeof raw !== "number" && typeof raw !== "string") || (typeof raw === "string" && !raw.trim())) return "unavailable";
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount < 0) return "unavailable";
  if (amount === 0) return "belum_bayar";
  return amount >= MONTHLY_REFERENCE ? "lunas" : "kurang";
}

export interface DuesPeriodSummary { members: number; paid: number; short: number; unpaid: number; unavailable: number; collected: number }
export function summarizeDues(rows: DuesRecord[]): DuesPeriodSummary {
  const paid = rows.filter(row => duesStatus(row) === "lunas").length;
  const short = rows.filter(row => duesStatus(row) === "kurang").length;
  const unpaid = rows.filter(row => duesStatus(row) === "belum_bayar").length;
  const unavailable = rows.length - paid - short - unpaid;
  return { members: rows.length, paid, short, unpaid, unavailable, collected: unavailable ? NaN : rows.reduce((total, row) => total + Number(row.paid_amount), 0) };
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
