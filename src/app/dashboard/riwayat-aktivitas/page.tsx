import { Activity } from "lucide-react";
import { ModuleShell } from "@/components/module-shell";
import { requireModulePermission } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  await requireModulePermission("activity", "read");
  const supabase = await createClient();
  const { data, error } = await supabase.from("activity_logs")
    .select("id, action, resource_type, resource_id, metadata, created_at")
    .order("created_at", { ascending: false }).limit(100);

  return (
    <ModuleShell title="Riwayat Aktivitas">
      <main className="module-page">
        <div className="module-page-head"><div><p className="eyebrow">AUDIT & ACCOUNTABILITY</p><h1>Riwayat Aktivitas</h1><p>Catatan aktivitas penting yang terjadi di dalam sistem.</p></div><div className="module-total"><Activity size={19} /><strong>{data?.length ?? 0}</strong><span>AKTIVITAS TERBARU</span></div></div>
        {error && <div className="module-alert" role="alert">Riwayat aktivitas belum dapat dimuat.</div>}
        <section className="module-table-panel"><div className="module-table-heading"><div><p className="eyebrow">SYSTEM AUDIT TRAIL</p><h2>100 aktivitas terbaru</h2></div></div>
          {data?.length ? <div className="event-list">{data.map((item) => <article className="event-row" key={item.id}><span className="event-date">{new Date(item.created_at).toLocaleDateString("id-ID")}</span><div><strong>{item.action.toUpperCase()} · {item.resource_type}</strong><small>{Array.isArray(item.metadata?.changed_fields) ? item.metadata.changed_fields.join(", ") : "Perubahan tercatat"}</small></div></article>)}</div> : <div className="module-empty">Belum ada aktivitas yang tercatat.</div>}
        </section>
      </main>
    </ModuleShell>
  );
}