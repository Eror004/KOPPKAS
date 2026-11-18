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
  const canReadEventFinance = ["ketua_pemuda", "wakil_ketua_pemuda", "bendahara"].includes(user.role);
  const [{ data, error }, { data: members, error: membersError }, { data: financeReports, error: financeReportsError }] = await Promise.all([
    supabase.from("events")
      .select("id,title,description,location,starts_at,ends_at,status,created_at,created_by,final_report,final_report_by,final_report_submitted_at,financial_report_by,financial_report_submitted_at,event_committee(member_id,committee_role,members(full_name))")
      .order("created_at", { ascending: false }),
    supabase.from("members").select("id,full_name").is("archived_at", null).order("full_name"),
    canReadEventFinance
      ? supabase.from("event_financial_reports").select("event_id,report")
      : Promise.resolve({ data: [] as { event_id: string; report: string }[] }),
  ]);
  const financeReportByEvent = new Map((financeReports ?? []).map((report) => [report.event_id, report.report]));

  return (
    <ModuleShell title="Kegiatan"><main className="module-page">
      <div className="module-page-head"><div><p className="eyebrow">PROGRAM & ACTIVITY WORKSPACE</p><h1>Kegiatan</h1><p>Ruang kerja setiap kegiatan, mulai dari persiapan hingga laporan akhir.</p></div><div className="module-total"><CalendarDays size={19} /><strong>{data?.length ?? 0}</strong><span>PROGRAM TERCATAT</span></div></div>
      {query.error && <p className="form-feedback error" role="alert">{query.error}</p>}
      {query.success && <p className="form-feedback success" role="status">{query.success}</p>}
      {(error || membersError || (canReadEventFinance && financeReportsError)) && <div className="module-alert" role="alert">Data kegiatan, anggota atau laporan keuangan belum dapat dimuat. Periksa konfigurasi backend.</div>}
      <EventForm />
      <section className="module-table-panel"><div className="module-table-heading"><div><p className="eyebrow">EVENT REGISTER</p><h2>Daftar kegiatan</h2></div><span>WORKSPACE ORGANISASI</span></div>
        {data?.length ? <div className="event-list">{data.map((event) => <div className="event-workspace-item" key={event.id}>
          <article className="event-row">
            <span className="event-date"><CalendarDays size={17} />{event.starts_at ? new Date(event.starts_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short" }) : "—"}</span>
            <div><strong>{event.title}</strong><small>{event.location || "Lokasi belum ditentukan"}</small></div>
            <span className="event-status">{statusLabels[event.status] ?? event.status}</span>
          </article>
          <EventWorkflowControls event={event} actorId={user.profile.id} role={user.role} members={members ?? []} financialReport={financeReportByEvent.get(event.id) ?? null} />
        </div>)}</div> : <div className="module-empty">Belum ada kegiatan. Daftar program akan tampil setelah kegiatan dibuat.</div>}
      </section>
    </main></ModuleShell>
  );
}
