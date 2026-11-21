"use server";

import { requireModulePermission } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { isValidTotalsMonth, parsePeriodTotals, type PeriodTotalsResult } from "@/components/monthly-dues/period-totals-contract";

/** Read-only iuran aggregate; permission is checked independently of the caller. */
export async function getMonthlyDuesPeriodTotals(duesMonth: string): Promise<PeriodTotalsResult> {
  await requireModulePermission("monthly_dues", "read");
  if (!isValidTotalsMonth(duesMonth)) return { kind: "invalid", error: "Periode rekap tidak valid." };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("monthly_dues_period_totals")
      .select("dues_month, status, data_status, member_count, paid_member_count, unpaid_member_count, total_paid_amount, total_reference_amount, total_remaining_amount")
      .eq("dues_month", duesMonth).maybeSingle();
    if (error) return { kind: "error", error: "Rekap iuran belum dapat dimuat." };
    return parsePeriodTotals(data, duesMonth);
  } catch {
    return { kind: "error", error: "Rekap iuran belum dapat dimuat." };
  }
}

export type DuesActionState = { success?: string; error?: string };

/**
 * The legacy actions do not enforce the book lifecycle. Keep them fail-closed
 * even when invoked directly, until the database-authoritative implementation
 * and its reconciliation contract are integrated and verified.
 */
export async function generateMonthlyRegister(_previous: DuesActionState, _formData: FormData): Promise<DuesActionState> {
  void _previous;
  void _formData;
  await requireModulePermission("monthly_dues", "create");
  return { error: "Daftar kas belum dapat disiapkan. Layanan buku bulanan belum terhubung." };
}

export async function recordDuesPayment(_previous: DuesActionState, _formData: FormData): Promise<DuesActionState> {
  void _previous;
  void _formData;
  await requireModulePermission("monthly_dues", "create");
  return { error: "Pembayaran belum dapat dicatat. Layanan buku bulanan belum terhubung." };
}
