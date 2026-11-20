import { ModuleShell } from "@/components/module-shell";
import { Status } from "@/components/ui/status";
import { requireModulePermission } from "@/lib/auth/require-role";

export const dynamic = "force-dynamic";

export default async function MonthlyDuesPage() {
  await requireModulePermission("monthly_dues", "read");

  // Fail closed until the official opened-period action is available on this branch.
  return <ModuleShell title="Uang Kas Bulanan"><main className="module-page">
    <Status kind="error" title="Periode kas belum dapat dimuat">
      Daftar periode yang dibuka belum terhubung. Pencatatan dan pembukaan periode sementara tidak tersedia agar tidak menampilkan periode yang belum terverifikasi.
    </Status>
  </main></ModuleShell>;
}
