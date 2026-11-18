import { ModuleShell } from "@/components/module-shell";
import { CalendarDays } from "lucide-react";
import { requireModulePermission } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { EventForm } from "./event-form";
import { EventWorkflowControls } from "./workflow-controls";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  draft: "Draft", menunggu_persetujuan: "Menunggu persetujuan", terbit: "Terbit",
  berlangsung: "Berlangsung", menunggu_laporan: "Menunggu laporan", selesai: "Selesai", dibatalkan: "Dibatalkan",
};

type EventsPageProps = { searchParams: Promise<{ success?: string; error?: string }> };

export default async function EventsPage({ searchParams }: EventsPageProps) {
  const user = await requireModulePermission("events", "read");
  const query = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.from("events")
    .select("id,title,location,starts_at,status,created_at,created_by,final_report,final_report_by,final_report_submitted_at,financial_report,financial_report_by")
    .order("created_at", { ascending: false });

  return (
    <ModuleShell title="Kegiatan"><main className="module-page">
      <div className="module-page-head"><div><p className="eyebrow">PROGRAM & ACTIVITY WORKSPACE</p><h1>Kegiatan</h1><p>Ruang kerja setiap kegiatan, mulai dari persiapan hingga laporan akhir.</p></div><div className="module-total"><CalendarDays size={19} /><strong>{data?.length ?? 0}</strong><span>PROGRAM TERCATAT</span></div></div>
      {query.error && <p className="form-feedback error" role="alert">{query.error}</p>}
      {query.success && <p className="form-feedback success" role="status">{query.success}</p>}
      {error && <div className="module-alert" role="alert">Data kegiatan belum dapat dimuat. Periksa konfigurasi backend.</div>}
      <EventForm />
      <section className="module-table-panel"><div className="module-table-heading"><div><p className="eyebrow">EVENT REGISTER</p><h2>Daftar kegiatan</h2></div><span>WORKSPACE ORGANISASI</span></div>
        {data?.length ? <div className="event-list">{data.map((event) => <div className="event-workspace-item" key={event.id}>
          <article className="event-row">
            <span className="event-date"><CalendarDays size={17} />{event.starts_at ? new Date(event.starts_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short" }) : "—"}</span>
            <div><strong>{event.title}</strong><small>{event.location || "Lokasi belum ditentukan"}</small></div>
            <span className="event-status">{statusLabels[event.status] ?? event.status}</span>
          </article>
          <EventWorkflowControls event={event} actorId={user.profile.id} role={user.role} />
        </div>)}</div> : <div className="module-empty">Belum ada kegiatan. Daftar program akan tampil setelah kegiatan dibuat.</div>}
      </section>
    </main></ModuleShell>
  );
}
