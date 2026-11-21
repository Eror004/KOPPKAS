"use server";

import { requireModulePermission } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { isValidTotalsMonth } from "@/components/monthly-dues/period-totals-contract";

/** Counts per-register discrepancies across the RLS-visible period, not the current page. */
export async function checkMonthlyDuesReference(duesMonth: string): Promise<
  { kind: "checked"; registerCount: number; mismatchCount: number } | { kind: "unavailable" }
> {
  await requireModulePermission("monthly_dues", "read");
  if (!isValidTotalsMonth(duesMonth)) return { kind: "unavailable" };
  try {
    const supabase = await createClient();
    const [all, mismatches] = await Promise.all([
      supabase.from("monthly_dues_summary").select("id", { count: "exact", head: true }).eq("dues_month", duesMonth),
      supabase.from("monthly_dues_summary").select("id", { count: "exact", head: true }).eq("dues_month", duesMonth).neq("reference_amount", 10000),
    ]);
    if (all.error || mismatches.error || !Number.isSafeInteger(all.count) || !Number.isSafeInteger(mismatches.count) ||
        all.count === null || mismatches.count === null || all.count < 0 || mismatches.count < 0 || mismatches.count > all.count) {
      return { kind: "unavailable" };
    }
    return { kind: "checked", registerCount: all.count, mismatchCount: mismatches.count };
  } catch {
    return { kind: "unavailable" };
  }
}
