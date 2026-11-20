import { can } from "@/lib/auth/permissions";
import type { AppRole } from "@/lib/auth/roles";
import { dashboardNavigation } from "./dashboard-navigation";
import { DashboardShell } from "./dashboard-shell";
import { DashboardContentClient } from "./dashboard-content-client";

type DashboardStats = { members: number | null; events: number | null; monthlyCollected: number | null; newMessages: number | null };

// This server wrapper preserves the existing page API and filters navigation before it reaches the browser.
export function DashboardHomeClient({ role, stats }: { role: AppRole; stats: DashboardStats }) {
  const items = dashboardNavigation.filter(item => can(role, item.module));
  const date = new Date();
  const todayLabel = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(date);
  const monthLabel = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(date);
  return <DashboardShell items={items}><DashboardContentClient stats={stats} items={items} todayLabel={todayLabel} monthLabel={monthLabel} /></DashboardShell>;
}
