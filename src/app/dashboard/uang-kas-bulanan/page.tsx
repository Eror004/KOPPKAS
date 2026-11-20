import { ModuleShell } from "@/components/module-shell";
import { DuesDirectory } from "@/components/monthly-dues/dues-directory";
import type { DuesRecord } from "@/components/monthly-dues/contracts";
import { Status } from "@/components/ui/status";
import { can } from "@/lib/auth/permissions";
import { requireModulePermission } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function MonthlyDuesPage() {
  const user = await requireModulePermission("monthly_dues", "read");
  const supabase = await createClient();
  const currentMonth = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }).slice(0, 7) + "-01";
  const [year, month] = currentMonth.slice(0, 7).split("-").map(Number);
  const historyStart = new Date(Date.UTC(year, month - 12, 1)).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("monthly_dues_summary")
    .select("id, member_id, full_name, dues_month, reference_amount, paid_amount, remaining_amount, payment_status")
    .gte("dues_month", historyStart)
    .lte("dues_month", currentMonth)
    .order("dues_month", { ascending: false })
    .order("full_name", { ascending: true });

  const canRecord = can(user.role, "monthly_dues", "create");
  return <ModuleShell title="Uang Kas Bulanan"><main className="module-page">
    {error ? <Status kind="error" title="Data kas belum dapat dimuat">Silakan coba muat ulang halaman.</Status> : <DuesDirectory rows={(data ?? []) as DuesRecord[]} currentMonth={currentMonth} canRecord={canRecord} />}
  </main></ModuleShell>;
}
