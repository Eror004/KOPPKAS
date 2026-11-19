import { requireUser } from "@/lib/auth/require-user";
import { DashboardHomeClient } from "@/components/dashboard-home-client";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const currentMonth = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }).slice(0, 7) + "-01";

  const [members, events, dues, inbox] = await Promise.all([
    can(user.role, "members", "read")
      ? supabase.from("members").select("id", { count: "exact", head: true }).is("archived_at", null)
      : Promise.resolve({ count: null, error: null }),
    can(user.role, "events", "read")
      ? supabase.from("events").select("id", { count: "exact", head: true })
      : Promise.resolve({ count: null, error: null }),
    can(user.role, "monthly_dues", "read")
      ? supabase.from("monthly_dues_summary").select("paid_amount").eq("dues_month", currentMonth)
      : Promise.resolve({ data: null, error: null }),
    can(user.role, "inbox", "read")
      ? supabase.from("public_messages").select("id", { count: "exact", head: true }).eq("status", "baru")
      : Promise.resolve({ count: null, error: null }),
  ]);

  const stats = {
    members: members.error ? null : members.count,
    events: events.error ? null : events.count,
    monthlyCollected: dues.error || !dues.data
      ? (can(user.role, "monthly_dues", "read") ? null : null)
      : dues.data.reduce((sum, row) => sum + Number(row.paid_amount), 0),
    newMessages: inbox.error ? null : inbox.count,
  };

  return <DashboardHomeClient role={user.role} stats={stats} />;
}
