"use server";

import { requireModulePermission } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { isValidTotalsMonth } from "@/components/monthly-dues/period-totals-contract";

/** Mutation: never call during rendering, prefetch or a read adapter. */
export async function syncMonthlyDuesLifecycle(): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireModulePermission("monthly_dues", "update");
  if (!["ketua_pemuda", "wakil_ketua_pemuda", "bendahara"].includes(user.role)) {
    return { ok: false, error: "Anda tidak berwenang menyinkronkan periode." };
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("sync_monthly_dues_period_lifecycle");
    const validTimestamp = (value: unknown): value is string => typeof value === "string" &&
      /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) && Number.isFinite(Date.parse(value));
    if (error || !data || typeof data !== "object" || typeof data.dues_month !== "string" ||
        !isValidTotalsMonth(data.dues_month) || data.status !== "active" || data.data_status !== "available" ||
        !validTimestamp(data.processed_at) || !validTimestamp(data.validated_at) ||
        !Number.isSafeInteger(data.register_count) || data.register_count < 0) {
      return { ok: false, error: "Sinkronisasi periode belum terkonfirmasi. Silakan coba lagi." };
    }
    // Compare to the backend's post-lock validation instant, not the browser/server clock.
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" }).formatToParts(new Date(data.validated_at));
    const validatedMonth = `${parts.find(part => part.type === "year")?.value}-${parts.find(part => part.type === "month")?.value}-01`;
    if (data.dues_month !== validatedMonth) return { ok: false, error: "Sinkronisasi periode belum terkonfirmasi. Silakan coba lagi." };
    return { ok: true };
  } catch {
    return { ok: false, error: "Sinkronisasi periode belum terkonfirmasi. Silakan coba lagi." };
  }
}
