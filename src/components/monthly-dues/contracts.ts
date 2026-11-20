/** Presentation helpers for the authoritative monthly_dues_summary read model. */
export interface DuesRecord {
  id: string;
  member_id: string;
  full_name: string;
  dues_month: string;
  reference_amount: number | string;
  paid_amount: number | string;
  remaining_amount: number | string;
  payment_status: "lunas" | "belum_bayar";
}
export const MONTHLY_REFERENCE = 10000;
export type DuesStatus = "lunas" | "kurang" | "belum_bayar" | "unavailable";

export function duesStatus(row: DuesRecord): DuesStatus {
  const raw = row.paid_amount;
  if ((typeof raw !== "number" && typeof raw !== "string") || (typeof raw === "string" && !raw.trim())) return "unavailable";
  const amount = Number(raw);
  const reference = Number(row.reference_amount);
  if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(reference) || reference !== MONTHLY_REFERENCE) return "unavailable";
  if (amount >= MONTHLY_REFERENCE) return "lunas";
  return amount > 0 ? "kurang" : "belum_bayar";
}
export interface DuesPeriodSummary { members: number; paid: number; short: number; unpaid: number; unavailable: number; collected: number }
export function summarizeDues(rows: DuesRecord[]): DuesPeriodSummary {
  const paid = rows.filter(row => duesStatus(row) === "lunas").length;
  const short = rows.filter(row => duesStatus(row) === "kurang").length;
  const unpaid = rows.filter(row => duesStatus(row) === "belum_bayar").length;
  const unavailable = rows.length - paid - short - unpaid;
  return { members: rows.length, paid, short, unpaid, unavailable, collected: unavailable ? NaN : rows.reduce((total, row) => total + Number(row.paid_amount), 0) };
}
export function periodLabel(period: string): string {
  const [year, month] = period.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
}
export function formatContribution(amount: number | string): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: Number.isInteger(value) ? 0 : 2 }).format(value);
}
