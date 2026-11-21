export type PeriodTotalsMetric = number | string;
export type MonthlyDuesPeriodTotals = {
  dues_month: string;
  status: "active" | "closed";
  data_status: "available" | "historical_empty";
  member_count: PeriodTotalsMetric | null;
  paid_member_count: PeriodTotalsMetric | null;
  unpaid_member_count: PeriodTotalsMetric | null;
  total_paid_amount: PeriodTotalsMetric | null;
  total_reference_amount: PeriodTotalsMetric | null;
  total_remaining_amount: PeriodTotalsMetric | null;
};
type AvailableTotals = Omit<MonthlyDuesPeriodTotals, "data_status" | "member_count" | "paid_member_count" | "unpaid_member_count" | "total_paid_amount" | "total_reference_amount" | "total_remaining_amount"> & {
  data_status: "available";
  member_count: PeriodTotalsMetric; paid_member_count: PeriodTotalsMetric; unpaid_member_count: PeriodTotalsMetric;
  total_paid_amount: PeriodTotalsMetric; total_reference_amount: PeriodTotalsMetric; total_remaining_amount: PeriodTotalsMetric;
};
type HistoricalTotals = Omit<MonthlyDuesPeriodTotals, "data_status" | "member_count" | "paid_member_count" | "unpaid_member_count" | "total_paid_amount" | "total_reference_amount" | "total_remaining_amount"> & {
  data_status: "historical_empty";
  member_count: null; paid_member_count: null; unpaid_member_count: null;
  total_paid_amount: null; total_reference_amount: null; total_remaining_amount: null;
};
export type PeriodTotalsResult =
  | { kind: "available"; totals: AvailableTotals }
  | { kind: "historical_empty"; totals: HistoricalTotals }
  | { kind: "not_found" }
  | { kind: "invalid"; error: string }
  | { kind: "malformed"; error: string }
  | { kind: "error"; error: string };

const MONTH = /^[1-9]\d{3}-(0[1-9]|1[0-2])-01$/;
const COUNT_KEYS = ["member_count", "paid_member_count", "unpaid_member_count"] as const;
const MONEY_KEYS = ["total_paid_amount", "total_reference_amount", "total_remaining_amount"] as const;
const KEYS = [...COUNT_KEYS, ...MONEY_KEYS] as const;
export const isValidTotalsMonth = (month: string) => MONTH.test(month);

function validMetric(value: unknown, count: boolean): boolean {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 &&
    (count ? Number.isSafeInteger(value) : value <= Number.MAX_SAFE_INTEGER / 100 && /^\d+(?:\.\d{1,2})?$/.test(String(value)));
  return typeof value === "string" && (count ? /^\d+$/.test(value) : /^\d+(?:\.\d{1,2})?$/.test(value));
}

/** Fail closed on mismatched periods, malformed metrics, and incorrect NULL semantics. */
export function parsePeriodTotals(value: unknown, month: string): PeriodTotalsResult {
  if (value === null) return { kind: "not_found" };
  if (!value || typeof value !== "object") return { kind: "malformed", error: "Rekap iuran tidak valid." };
  const row = value as Record<string, unknown>;
  if (row.dues_month !== month || (row.status !== "active" && row.status !== "closed") || (row.data_status !== "available" && row.data_status !== "historical_empty")) {
    return { kind: "malformed", error: "Periode atau status rekap iuran tidak valid." };
  }
  if (row.data_status === "historical_empty") {
    if (!KEYS.every(key => row[key] === null)) return { kind: "malformed", error: "Rekap historis tidak valid." };
    return { kind: "historical_empty", totals: row as HistoricalTotals };
  }
  const fitsNumeric15Scale2 = (value: unknown) => {
    if (!validMetric(value, false)) return false;
    // numeric(15,2) permits at most thirteen digits to the left of the decimal.
    // Validate the representation without converting decimal strings to floating point.
    const integer = String(value).split(".")[0].replace(/^0+(?=\d)/, "");
    return integer.length <= 13;
  };
  if (!COUNT_KEYS.every(key => validMetric(row[key], true)) || !MONEY_KEYS.every(key => fitsNumeric15Scale2(row[key]))) {
    return { kind: "malformed", error: "Angka rekap iuran tidak tersedia atau tidak valid." };
  }
  return { kind: "available", totals: row as AvailableTotals };
}

/** Preserve decimal strings; do not round large database numerics through JavaScript Number. */
export function formatTotalsRupiah(value: PeriodTotalsMetric): string {
  if (!validMetric(value, false)) return "—";
  const raw = String(value);
  const [whole, fractional = ""] = raw.split(".");
  const grouped = whole.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const decimal = fractional.replace(/0+$/, "");
  return `Rp${grouped}${decimal ? `,${decimal}` : ""}`;
}
