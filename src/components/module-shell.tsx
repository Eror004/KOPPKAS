import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/require-user";
import { DashboardShell } from "./dashboard-shell";
import { dashboardNavigation } from "./dashboard-navigation";

export async function ModuleShell({ title, children }: { title: string; children: React.ReactNode }) {
  const user = await requireUser();
  const visibleNavigation = dashboardNavigation.filter((item) => can(user.role, item.module));
  return <DashboardShell items={visibleNavigation}>
    <header className="foundation-module-header"><span>WORKSPACE</span><span aria-hidden="true">/</span><strong>{title}</strong></header>
    {children}
    <footer className="module-shell-footer">© 2026 KOPPKAS · PEMUDA KAMPUNG SAWAH KAUM</footer>
  </DashboardShell>;
}
