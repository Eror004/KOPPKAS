import { approveEvent, approveEventFinalReport, cancelEvent, startEvent, submitEventFinancialReport, submitEventFinalReport, submitEventForApproval } from "./actions";
import type { AppRole } from "@/lib/auth/roles";

type EventWorkflowItem = {
  id: string;
  created_by: string;
  status: string;
  financial_report: string | null;
  financial_report_by: string | null;
  final_report: string | null;
  final_report_by: string | null;
  final_report_submitted_at: string | null;
};

export function EventWorkflowControls({
  event,
  actorId,
  role,
}: {
  event: EventWorkflowItem;
  actorId: string;
  role: AppRole;
}) {
  const isLeader = role === "ketua_pemuda" || role === "wakil_ketua_pemuda";
  const isSecretary = role === "sekretaris";
  const isCreator = event.created_by === actorId;
  const canCancel = isLeader && event.status !== "selesai" && event.status !== "dibatalkan";

  return (
    <details className="event-workflow-controls">
      <summary>Kelola alur kegiatan</summary>
      <div className="event-workflow-body">
        {event.status === "draft" && (isCreator || isSecretary) && (
          <form action={submitEventForApproval} className="module-form">
            <input type="hidden" name="event_id" value={event.id} />
            <p>Ajukan draft agar dapat ditinjau Ketua atau Wakil Ketua.</p>
            <button type="submit">Ajukan persetujuan</button>
          </form>
        )}

        {event.status === "menunggu_persetujuan" && isLeader && (
          <form action={approveEvent} className="module-form">
            <input type="hidden" name="event_id" value={event.id} />
            <p>Setujui dan terbitkan kegiatan ini.</p>
            <button type="submit">Setujui & terbitkan</button>
          </form>
        )}

        {event.status === "terbit" && (isCreator || isSecretary || isLeader) && (
          <form action={startEvent} className="module-form">
            <input type="hidden" name="event_id" value={event.id} />
            <p>Tandai kegiatan sudah mulai berlangsung.</p>
            <button type="submit">Mulai kegiatan</button>
          </form>
        )}

        {event.status === "berlangsung" && role === "bendahara" && !event.financial_report_by && (
          <form action={submitEventFinancialReport} className="module-form">
            <input type="hidden" name="event_id" value={event.id} />
            <label>Laporan keuangan Bendahara<textarea name="financial_report" minLength={10} maxLength={10000} rows={4} required placeholder="Ringkasan pemasukan, pengeluaran, bukti transaksi dan saldo akhir kegiatan..." /></label>
            <button type="submit">Serahkan laporan keuangan</button>
          </form>
        )}

        {event.status === "berlangsung" && isCreator && event.financial_report_by && !event.final_report_submitted_at && event.financial_report_by !== actorId && (
          <form action={submitEventFinalReport} className="module-form">
            <input type="hidden" name="event_id" value={event.id} />
            <label>Laporan kegiatan Ketua Panitia<textarea name="final_report" minLength={10} maxLength={10000} rows={4} required placeholder="Pelaksanaan kegiatan, hasil, peserta, evaluasi dan dokumentasi..." /></label>
            <button type="submit">Serahkan laporan akhir</button>
          </form>
        )}

        {event.financial_report_by && <p className="event-report-state">Laporan Bendahara: sudah diserahkan</p>}
        {event.final_report_submitted_at && <p className="event-report-state">Laporan Ketua Panitia: sudah diserahkan</p>}

        {(isLeader || role === "bendahara") && (event.final_report || event.financial_report) && <details className="event-report-review"><summary>Tinjau isi laporan</summary>{event.final_report && <section><strong>Laporan Ketua Panitia</strong><p>{event.final_report}</p></section>}{event.financial_report && <section><strong>Laporan Bendahara</strong><p>{event.financial_report}</p></section>}</details>}

        {event.status === "menunggu_laporan" && (isLeader || role === "bendahara") && (
          <form action={approveEventFinalReport} className="module-form">
            <input type="hidden" name="event_id" value={event.id} />
            <p>Periksa laporan Ketua Panitia, laporan Bendahara dan buku kas sebelum menyelesaikan kegiatan.</p>
            <button type="submit">Setujui laporan & selesaikan</button>
          </form>
        )}

        {canCancel && (
          <form action={cancelEvent} className="module-form">
            <input type="hidden" name="event_id" value={event.id} />
            <label>Alasan pembatalan<input name="reason" minLength={3} maxLength={500} required placeholder="Alasan pembatalan kegiatan" /></label>
            <button type="submit" className="secondary-button">Batalkan kegiatan</button>
          </form>
        )}
      </div>
    </details>
  );
}
