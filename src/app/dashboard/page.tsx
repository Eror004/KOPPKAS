import { requireUser } from "@/lib/auth/require-user";
import { DashboardHomeClient } from "@/components/dashboard-home-client";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [members, events, inbox] = await Promise.all([
    can(user.role, "members", "read")
      ? supabase.from("members").select("id", { count: "exact", head: true }).is("archived_at", null)
      : Promise.resolve({ count: null, error: null }),
    can(user.role, "events", "read")
      ? supabase.from("events").select("id", { count: "exact", head: true })
      : Promise.resolve({ count: null, error: null }),
    can(user.role, "inbox", "read")
      ? supabase.from("public_messages").select("id", { count: "exact", head: true }).eq("status", "baru")
      : Promise.resolve({ count: null, error: null }),
  ]);

  const stats = {
    members: members.error ? null : members.count,
    events: events.error ? null : events.count,
    monthlyCollected: { kind: "unavailable" as const },
    newMessages: inbox.error ? null : inbox.count,
  };

  return <DashboardHomeClient role={user.role} stats={stats} />;
}
