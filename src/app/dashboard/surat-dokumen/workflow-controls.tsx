import { approveLetter, cancelLetter, submitLetterForApproval, updateLetterDraft } from "./actions";
import type { AppRole } from "@/lib/auth/roles";

type LetterWorkflowItem = {
  id: string;
  created_by: string;
  category: string;
  status: string;
  subject: string;
  body: string;
  letter_number: string | null;
};

export function LetterWorkflowControls({
  letter,
  actorId,
  role,
}: {
  letter: LetterWorkflowItem;
  actorId: string;
  role: AppRole;
}) {
  const isLeader = role === "ketua_pemuda" || role === "wakil_ketua_pemuda";
  const isOwner = letter.created_by === actorId;
  const canSubmit = isOwner || (role === "sekretaris" && letter.category === "umum");
  const canEdit = isOwner || isLeader || (role === "sekretaris" && letter.category === "umum");

  return (
    <details className="letter-workflow-controls">
      <summary>Kelola surat & tinjau isi</summary>
      <div className="letter-workflow-body">
        <div className="letter-preview"><strong>{letter.subject}</strong><p>{letter.body}</p></div>

        {letter.status === "draft" && canEdit && <form action={updateLetterDraft} className="module-form">
          <input type="hidden" name="letter_id" value={letter.id} />
          <label>Perihal<input name="subject" defaultValue={letter.subject} minLength={3} maxLength={180} required /></label>
          <label>Isi surat<textarea name="body" defaultValue={letter.body} minLength={10} maxLength={20000} rows={6} required /></label>
          <button type="submit">Simpan draft</button>
        </form>}

        {letter.status === "draft" && canSubmit && (
          <form action={submitLetterForApproval} className="module-form">
            <input type="hidden" name="letter_id" value={letter.id} />
            <p>Ajukan draft untuk persetujuan dan penerbitan resmi.</p>
            <button type="submit">Ajukan persetujuan</button>
          </form>
        )}

        {letter.status === "menunggu_persetujuan" && isLeader && (
          <form action={approveLetter} className="module-form">
            <input type="hidden" name="letter_id" value={letter.id} />
            <button type="submit">Setujui & terbitkan surat</button>
          </form>
        )}

        {isLeader && letter.status !== "dibatalkan" && (
          <form action={cancelLetter} className="module-form">
            <input type="hidden" name="letter_id" value={letter.id} />
            <label>Alasan pembatalan<input name="reason" minLength={3} maxLength={500} required placeholder="Alasan pembatalan surat" /></label>
            <button type="submit" className="secondary-button">Batalkan surat</button>
          </form>
        )}
      </div>
    </details>
  );
}
