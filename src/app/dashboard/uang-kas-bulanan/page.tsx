import { ModuleShell } from "@/components/module-shell";
import { Status } from "@/components/ui/status";
import { DuesDirectory } from "@/components/monthly-dues/dues-directory";
import type { DuesRecord } from "@/components/monthly-dues/contracts";
import { can } from "@/lib/auth/permissions";
import { requireModulePermission } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import {
  createDuesMember,
  getDuesPaymentReceipt,
  getMonthlyDuesCashBook,
  getMonthlyDuesPeriods,
  recordMonthlyDuesCashExpense,
  searchDuesMembers,
  ensureDuesRegister,
} from "./actions";
import { RegisterForm } from "./register-form";

export const dynamic = "force-dynamic";

function nextMonthOf(period: string): string {
  const [year, month] = period.split("-").map(Number);
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
}

export default async function MonthlyDuesPage() {
  const user = await requireModulePermission("monthly_dues", "read");
  const periodResult = await getMonthlyDuesPeriods();
  if (periodResult.error) {
    return <ModuleShell title="Uang Kas Bulanan"><main className="module-page">
      <Status kind="error" title="Periode kas belum dapat dimuat">{periodResult.error} Data tidak akan diasumsikan kosong atau dibuka otomatis.</Status>
    </main></ModuleShell>;
  }

  const periods = periodResult.periods.slice(0, 12);
  const openedPeriods = periods.map(item => item.dues_month);
  const currentMonth = openedPeriods[0] ?? "";
  const supabase = await createClient();
  const rows: DuesRecord[] = [];
  if (openedPeriods.length) {
    let offset = 0;
    while (true) {
      const { data, error } = await supabase
        .from("monthly_dues_summary")
        .select("id, member_id, full_name, dues_month, reference_amount, paid_amount, remaining_amount, payment_status")
        .in("dues_month", openedPeriods)
        .order("dues_month", { ascending: false })
        .order("full_name", { ascending: true })
        .range(offset, offset + 999);
      if (error) {
        return <ModuleShell title="Uang Kas Bulanan"><main className="module-page">
          <Status kind="error" title="Daftar pembayaran belum dapat dimuat">Data periode resmi tersedia, tetapi daftar anggota gagal dibaca. Silakan muat ulang halaman.</Status>
        </main></ModuleShell>;
      }
      rows.push(...((data ?? []) as DuesRecord[]));
      if ((data?.length ?? 0) < 1000) break;
      offset += 1000;
    }
  }

  const canOpenPeriod = ["ketua_pemuda", "wakil_ketua_pemuda", "bendahara"].includes(user.role);
  const canRecord = can(user.role, "monthly_dues", "create");
  const canViewFinance = can(user.role, "general_finance", "read");
  const nextMonth = currentMonth ? nextMonthOf(currentMonth) : "";

  return <ModuleShell title="Uang Kas Bulanan"><main className="module-page">
    <div className="module-page-head">
      <div><p className="eyebrow">MONTHLY CONTRIBUTION REGISTER</p><h1>Uang Kas Bulanan</h1>
        <p>Pencatatan pembayaran sukarela. Acuan Rp10.000 per anggota per bulan, bukan tagihan wajib.</p>
      </div>
    </div>
    {canOpenPeriod && nextMonth && <RegisterForm nextMonth={nextMonth} />}
    <DuesDirectory
      rows={rows}
      currentMonth={currentMonth}
      canRecord={canRecord}
      canViewFinance={canViewFinance}
      openedPeriods={openedPeriods}
      searchMembers={searchDuesMembers}
      ensureRegister={ensureDuesRegister}
      createMember={createDuesMember}
      getReceipt={getDuesPaymentReceipt}
      getCashBook={getMonthlyDuesCashBook}
      recordExpense={recordMonthlyDuesCashExpense}
    />
  </main></ModuleShell>;
}
