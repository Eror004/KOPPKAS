import {
  addEventCommitteeMember,
  approveEvent,
  approveEventFinalReport,
  cancelEvent,
  removeEventCommitteeMember,
  startEvent,
  submitEventFinancialReport,
  submitEventFinalReport,
  submitEventForApproval,
  updateEventDetails,
} from "./actions";
import type { AppRole } from "@/lib/auth/roles";

type CommitteeItem = {
  member_id: string;
  committee_role: string;
  members: { full_name: string } | { full_name: string }[] | null;
};

type EventWorkflowItem = {
  id: string;
  created_by: string;
  committee_chair_profile_id: string;
  status: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string | null;
  ends_at: string | null;
  financial_report_by: string | null;
  final_report: string | null;
  final_report_by: string | null;
  final_report_submitted_at: string | null;
  event_committee: CommitteeItem[] | null;
};

function toJakartaDateTime(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value)).replace(" ", "T");
}

export function EventWorkflowControls({
  event,
  actorId,
  role,
  members,
  profiles,
  financialReport,
}: {
  event: EventWorkflowItem;
  actorId: string;
  role: AppRole;
  members: { id: string; full_name: string }[];
  profiles: { id: string; full_name: string; role: string }[];
  financialReport: string | null;
}) {
  const isLeader = role === "ketua_pemuda" || role === "wakil_ketua_pemuda";
  const isSecretary = role === "sekretaris";
  const isCreator = event.created_by === actorId;
  const isChair = event.committee_chair_profile_id === actorId;
  const chairProfile = profiles.find((profile) => profile.id === event.committee_chair_profile_id);
  const canCancel = isLeader && event.status !== "selesai" && event.status !== "dibatalkan";
  const canEdit = (isCreator || isSecretary) && ["draft", "terbit", "berlangsung"].includes(event.status);
  const canManageCommittee = (isCreator || isSecretary || isLeader) &&
    ["draft", "menunggu_persetujuan", "terbit", "berlangsung"].includes(event.status);
  const committee = event.event_committee ?? [];

  return (
    <details className="event-workflow-controls">
      <summary>Kelola alur kegiatan</summary>
      <div className="event-workflow-body">
        {canEdit && (
          <form action={updateEventDetails} className="module-form">
            <input type="hidden" name="event_id" value={event.id} />
            <label>Nama kegiatan<input name="title" defaultValue={event.title} minLength={3} maxLength={160} required /></label>
            <label>Ketua Panitia<select name="committee_chair_profile_id" defaultValue={event.committee_chair_profile_id} required>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name} — {profile.role.replaceAll("_", " ")}</option>)}</select></label>
            <label>Lokasi<input name="location" defaultValue={event.location ?? ""} maxLength={180} /></label>
            <label>Mulai<input name="starts_at" type="datetime-local" defaultValue={toJakartaDateTime(event.starts_at)} /></label>
            <label>Selesai<input name="ends_at" type="datetime-local" defaultValue={toJakartaDateTime(event.ends_at)} /></label>
            <label>Deskripsi<textarea name="description" defaultValue={event.description ?? ""} maxLength={5000} rows={3} /></label>
            <button type="submit">Simpan detail kegiatan</button>
          </form>
        )}

        <section className="event-committee-panel">
          <p className="event-chair-state">Ketua Panitia: <strong>{chairProfile?.full_name ?? "Belum ditentukan"}</strong></p>
          <div className="module-form-heading"><div><p className="eyebrow">EVENT COMMITTEE</p><h3>Panitia kegiatan</h3></div><span>{committee.length} ANGGOTA</span></div>
          {committee.length ? <ul className="event-committee-list">{committee.map((item) => {
            const member = Array.isArray(item.members) ? item.members[0] : item.members;
            return <li key={item.member_id}><div><strong>{member?.full_name ?? "Anggota"}</strong><small>{item.committee_role}</small></div>{canManageCommittee && <form action={removeEventCommitteeMember}><input type="hidden" name="event_id" value={event.id} /><input type="hidden" name="member_id" value={item.member_id} /><button type="submit" className="secondary-button">Hapus</button></form>}</li>;
          })}</ul> : <p className="module-empty">Panitia belum ditentukan.</p>}
          {canManageCommittee && <form action={addEventCommitteeMember} className="module-form">
            <input type="hidden" name="event_id" value={event.id} />
            <label>Anggota<select name="member_id" defaultValue="" required><option value="" disabled>Pilih anggota</option>{members.map((member) => <option key={member.id} value={member.id}>{member.full_name}</option>)}</select></label>
            <label>Posisi panitia<input name="committee_role" minLength={2} maxLength={80} required placeholder="Contoh: Ketua Panitia" /></label>
            <button type="submit">Tambah panitia</button>
          </form>}
        </section>

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

        {event.status === "berlangsung" && isChair && event.financial_report_by && !event.final_report_submitted_at && event.financial_report_by !== actorId && (
          <form action={submitEventFinalReport} className="module-form">
            <input type="hidden" name="event_id" value={event.id} />
            <label>Laporan kegiatan Ketua Panitia<textarea name="final_report" minLength={10} maxLength={10000} rows={4} required placeholder="Pelaksanaan kegiatan, hasil, peserta, evaluasi dan dokumentasi..." /></label>
            <button type="submit">Serahkan laporan akhir</button>
          </form>
        )}

        {event.financial_report_by && <p className="event-report-state">Laporan Bendahara: sudah diserahkan</p>}
        {event.final_report_submitted_at && <p className="event-report-state">Laporan Ketua Panitia: sudah diserahkan</p>}

        {(isLeader || role === "bendahara") && (event.final_report || financialReport) && <details className="event-report-review"><summary>Tinjau isi laporan</summary>{event.final_report && <section><strong>Laporan Ketua Panitia</strong><p>{event.final_report}</p></section>}{financialReport && <section><strong>Laporan Bendahara</strong><p>{financialReport}</p></section>}</details>}

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
