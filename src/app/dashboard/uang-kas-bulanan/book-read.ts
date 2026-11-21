import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { MonthlyBookRow } from "@/components/monthly-dues/monthly-book";

// Contract: PR #25 df2abda. No finance data is read by this adapter.
const PAGE_SIZE = 24;
const MONTH_PATTERN = /^[1-9]\d{3}-(0[1-9]|1[0-2])-01$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PERIOD_FIELDS = "dues_month, opened_at, opened_effective_at, opened_processed_at, status, data_status, closed_effective_at, closed_processed_at";

export type BookPeriod = {
  dues_month: string;
  status: "active" | "closed";
  data_status: "available" | "historical_empty";
  closed_effective_at: string | null;
  closed_processed_at: string | null;
};
type Params = { month?: string; before?: string; after?: string };
type ReadResult = {
  periods: BookPeriod[];
  activeMonth?: string;
  nextPeriodCursor?: string;
  selected?: BookPeriod;
  rows?: MonthlyBookRow[];
  nextPaymentCursor?: string;
  error?: string;
};

function isBookPeriod(value: unknown): value is BookPeriod {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  const timestamp = (v: unknown) => v === null || (typeof v === "string" && Number.isFinite(Date.parse(v)));
  return typeof row.dues_month === "string" && MONTH_PATTERN.test(row.dues_month)
    && (row.status === "active" || row.status === "closed")
    && (row.data_status === "available" || row.data_status === "historical_empty")
    && timestamp(row.closed_effective_at) && timestamp(row.closed_processed_at)
    && (row.status !== "closed" || (typeof row.closed_effective_at === "string" && typeof row.closed_processed_at === "string"))
    && (row.status !== "active" || (row.closed_effective_at === null && row.closed_processed_at === null && row.data_status === "available"));
}

/** Call only after the page's monthly_dues read permission has been verified. */
export async function readMonthlyBook({ month, before, after }: Params): Promise<ReadResult> {
  if ((month && !MONTH_PATTERN.test(month)) || (before && !MONTH_PATTERN.test(before)) ||
      (after && (!month || !UUID_PATTERN.test(after)))) {
    return { periods: [], error: "Pilihan periode atau halaman transaksi tidak valid." };
  }
  try {
    const supabase = await createClient();
    // This adapter must remain read-only, including during server rendering and prefetch.
    const { data: active, error: activeError } = await supabase.from("monthly_dues_periods")
      .select(PERIOD_FIELDS).eq("status", "active").maybeSingle();
    if (activeError || (active !== null && (!isBookPeriod(active) || active.status !== "active"))) {
      return { periods: [], error: "Status periode kas belum dapat diverifikasi." };
    }
    const activeMonth = active?.dues_month as string | undefined;
    let periodsQuery = supabase.from("monthly_dues_periods")
      .select(PERIOD_FIELDS).order("dues_month", { ascending: false }).limit(PAGE_SIZE + 1);
    if (before) periodsQuery = periodsQuery.lt("dues_month", before);
    const { data: periodData, error: periodError } = await periodsQuery;
    if (periodError || !periodData || !periodData.every(isBookPeriod) ||
      periodData.some(item => item.status === "active" && item.dues_month !== activeMonth)) {
      return { periods: [], error: "Status periode kas belum dapat diverifikasi." };
    }
    const periods = periodData.slice(0, PAGE_SIZE) as BookPeriod[];
    const nextPeriodCursor = periodData.length > PAGE_SIZE ? periods[periods.length - 1].dues_month : undefined;
    const base = { periods, nextPeriodCursor, activeMonth };
    if (!month) return base;

    const { data: selected, error: selectedError } = await supabase.from("monthly_dues_periods")
      .select(PERIOD_FIELDS).eq("dues_month", month).maybeSingle();
    if (selectedError || !isBookPeriod(selected) || selected.dues_month !== month ||
        (selected.status === "active") !== (month === activeMonth)) {
      return { ...base, error: "Periode tidak ditemukan atau statusnya belum dapat diverifikasi." };
    }
    if (selected.data_status === "historical_empty") return { ...base, selected };
    let paymentsQuery = supabase.from("monthly_dues_payment_receipts")
      .select("payment_id, member_name, amount").eq("dues_month", month)
      .order("payment_id", { ascending: true }).limit(PAGE_SIZE + 1);
    if (after) paymentsQuery = paymentsQuery.gt("payment_id", after);
    const { data: paymentData, error: paymentError } = await paymentsQuery;
    if (paymentError || !paymentData || paymentData.some(item => typeof item.payment_id !== "string" || !UUID_PATTERN.test(item.payment_id) ||
      (item.member_name !== null && typeof item.member_name !== "string") ||
      (typeof item.amount !== "number" && typeof item.amount !== "string") || !String(item.amount).trim() ||
      !Number.isFinite(Number(item.amount)) || Number(item.amount) <= 0)) {
      return { ...base, selected, error: "Pembayaran periode ini belum dapat dimuat atau datanya tidak valid." };
    }
    const page = paymentData.slice(0, PAGE_SIZE);
    return { ...base, selected, rows: page.map(item => ({
      paymentId: item.payment_id as string,
      memberNameSnapshot: item.member_name as string | null,
      amount: item.amount as number | string,
    })), nextPaymentCursor: paymentData.length > PAGE_SIZE ? page[page.length - 1].payment_id as string : undefined };
  } catch {
    return { periods: [], error: "Layanan buku kas belum dapat diakses." };
  }
}
