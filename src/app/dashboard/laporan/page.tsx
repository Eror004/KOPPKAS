import { BookOpenText } from "lucide-react";
import { ModuleShell } from "@/components/module-shell";
import { requireModulePermission } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  await requireModulePermission("reports", "read");
  const supabase = await createClient();
  const { data, error } = await supabase.from("events")
    .select("id, title, status, starts_at, final_report, final_report_approved_at")
    .order("created_at", { ascending: false }).limit(100);

  const completed = (data ?? []).filter((event) => event.status === "selesai").length;
  const waiting = (data ?? []).filter((event) => event.status === "menunggu_laporan").length;

  return (
    <ModuleShell title="Laporan">
      <main className="module-page">
        <div className="module-page-head"><div><p className="eyebrow">ORGANIZATION REPORTS</p><h1>Laporan Kegiatan</h1><p>Ringkasan pelaksanaan program dan status laporan akhir kegiatan.</p></div><div className="module-total"><BookOpenText size={19} /><strong>{data?.length ?? 0}</strong><span>KEGIATAN TERCATAT</span></div></div>
        {error && <div className="module-alert" role="alert">Data laporan belum dapat dimuat.</div>}
        <div className="dues-stats"><div><span>KEGIATAN SELESAI</span><strong>{completed}</strong></div><div><span>MENUNGGU LAPORAN</span><strong>{waiting}</strong></div><div><span>TOTAL KEGIATAN</span><strong>{data?.length ?? 0}</strong></div><div><span>PERIODE</span><strong>Semua</strong></div></div>
        <section className="module-table-panel"><div className="module-table-heading"><div><p className="eyebrow">EVENT REPORT REGISTER</p><h2>Status laporan akhir</h2></div></div>
          {data?.length ? <div className="event-list">{data.map((event) => <article className="event-row" key={event.id}><span className="event-date">{event.starts_at ? new Date(event.starts_at).toLocaleDateString("id-ID") : "—"}</span><div><strong>{event.title}</strong><small>{event.final_report_approved_at ? "Laporan disetujui" : event.final_report ? "Laporan tersedia" : "Belum ada laporan"}</small></div><span className="event-status">{event.status.replaceAll("_"," ")}</span></article>)}</div> : <div className="module-empty">Belum ada laporan kegiatan.</div>}
        </section>
      </main>
    </ModuleShell>
  );
}