import { ModuleShell } from "@/components/module-shell";
import { DuesDirectory } from "@/components/monthly-dues/dues-directory";
import type { DuesRecord } from "@/components/monthly-dues/contracts";
import { Status } from "@/components/ui/status";
import { can } from "@/lib/auth/permissions";
import { requireModulePermission } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { getMonthlyDuesPeriods } from "./actions";
import { RegisterForm } from "./register-form";

export const dynamic = "force-dynamic";

function jakartaMonth(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }).slice(0, 7) + "-01";
}

function nextMonth(period: string): string {
  const [year, month] = period.split("-").map(Number);
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
}

export default async function MonthlyDuesPage() {
  const user = await requireModulePermission("monthly_dues", "read");
  const currentMonth = jakartaMonth();
  const periodResult = await getMonthlyDuesPeriods();

  if (periodResult.error) {
    return <ModuleShell title="Uang Kas Bulanan"><main className="module-page">
      <Status kind="error" title="Periode kas belum dapat dimuat">{periodResult.error}</Status>
    </main></ModuleShell>;
  }

  const openedPeriods = periodResult.periods.map((period) => period.dues_month);
  const supabase = await createClient();
  const { data, error } = openedPeriods.length
    ? await supabase.from("monthly_dues_summary")
        .select("id, member_id, full_name, dues_month, reference_amount, paid_amount, remaining_amount, payment_status")
        .in("dues_month", openedPeriods)
        .order("dues_month", { ascending: false })
        .order("full_name", { ascending: true })
    : { data: [], error: null };

  if (error) {
    return <ModuleShell title="Uang Kas Bulanan"><main className="module-page">
      <Status kind="error" title="Daftar pembayaran belum dapat dimuat">Data ringkasan kas gagal dibaca. Tidak ada status pembayaran yang ditampilkan sebagai data resmi.</Status>
    </main></ModuleShell>;
  }

  const nextOpenPeriod = openedPeriods.length
    ? nextMonth([...openedPeriods].sort().at(-1)!)
    : "2026-10-01";
  const canOpenPeriod = ["ketua_pemuda", "wakil_ketua_pemuda", "bendahara"].includes(user.role)
    && nextOpenPeriod <= currentMonth
    && !openedPeriods.includes(nextOpenPeriod);

  return <ModuleShell title="Uang Kas Bulanan"><main className="module-page">
    {canOpenPeriod && <RegisterForm duesMonth={nextOpenPeriod} />}
    <DuesDirectory rows={(data ?? []) as DuesRecord[]} currentMonth={currentMonth}
      canRecord={can(user.role, "monthly_dues", "create")} canViewCashBook={can(user.role, "general_finance", "read")} openedPeriods={openedPeriods} />
  </main></ModuleShell>;
}
