import { ModuleShell } from "@/components/module-shell";
import { Bell, Check } from "lucide-react";
import { requireModulePermission } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { NotificationsRealtime } from "@/components/notifications-realtime";
import { markNotificationRead } from "./actions";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await requireModulePermission("notifications", "read");
  const supabase = await createClient();
  const { data, error } = await supabase.from("notifications")
    .select("id, title, body, priority, resource_type, resource_id, read_at, created_at")
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  const notifications = data ?? [];
  const unread = notifications.filter((item) => !item.read_at).length;

  return (
    <ModuleShell title="Notifikasi"><main className="module-page">
      <NotificationsRealtime userId={user.profile.id} />
      <div className="module-page-head"><div><p className="eyebrow">PERSONAL ACTIVITY FEED</p><h1>Notifikasi</h1><p>Pemberitahuan tersinkron untuk akun dan perangkat yang sedang aktif.</p></div><div className="module-total"><Bell size={19} /><strong>{unread}</strong><span>BELUM DIBACA</span></div></div>
      {error && <div className="module-alert" role="alert">Notifikasi belum dapat dimuat.</div>}
      <section className="module-table-panel"><div className="module-table-heading"><div><p className="eyebrow">YOUR NOTIFICATIONS</p><h2>Terbaru</h2></div><span>100 NOTIFIKASI TERBARU</span></div>
        {notifications.length ? <div className="notification-list">{notifications.map((item) => <article className={`notification-row ${item.read_at ? "is-read" : "is-unread"}`} key={item.id}><span className={`notification-priority ${item.priority}`} /><div className="notification-copy"><strong>{item.title}</strong><p>{item.body}</p><small>{new Date(item.created_at).toLocaleString("id-ID")}</small></div>{!item.read_at && <form action={markNotificationRead}><input type="hidden" name="id" value={item.id} /><button aria-label="Tandai sudah dibaca" title="Tandai sudah dibaca"><Check size={16} /></button></form>}</article>)}</div> : <div className="module-empty">Belum ada notifikasi baru.</div>}
      </section>
    </main></ModuleShell>
  );
}