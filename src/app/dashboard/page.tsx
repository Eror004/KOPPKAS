import { requireUser } from "@/lib/auth/require-user";
import { DashboardHomeClient } from "@/components/dashboard-home-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  return <DashboardHomeClient role={user.role} />;
}