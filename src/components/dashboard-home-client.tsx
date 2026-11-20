import { can } from "@/lib/auth/permissions";
import type { AppRole } from "@/lib/auth/roles";
import { dashboardNavigation } from "./dashboard-navigation";
import { DashboardShell } from "./dashboard-shell";
import { DashboardContentClient } from "./dashboard-content-client";

type DashboardStats = { members: number | null; events: number | null; monthlyCollected: number | null; newMessages: number | null };

// This server wrapper preserves the existing page API and filters navigation before it reaches the browser.
export function DashboardHomeClient({ role, stats }: { role: AppRole; stats: DashboardStats }) {
  const items = dashboardNavigation.filter(item => can(role, item.module));
  return <DashboardShell items={items}><DashboardContentClient stats={stats} items={items} /></DashboardShell>;
}
