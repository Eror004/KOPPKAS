"use client";

import { useActionState } from "react";
import { FilePlus2 } from "lucide-react";
import { createOfficialLetter, type LetterActionState } from "./actions";

const initialState: LetterActionState = {};

export function LetterForm({ financialOnly }: { financialOnly: boolean }) {
  const [state, action, pending] = useActionState(createOfficialLetter, initialState);
  return (
    <form action={action} className="module-form">
      <div className="module-form-heading"><div><p className="eyebrow">CORRESPONDENCE</p><h3>Buat draft surat</h3></div><span className="event-form-icon"><FilePlus2 size={18} /></span></div>
      {!financialOnly && <label>Kategori surat<select name="category" defaultValue="umum"><option value="umum">Surat umum</option><option value="keuangan">Administrasi keuangan</option></select></label>}
      {financialOnly && <input type="hidden" name="category" value="keuangan" />}
      <label>Perihal<input name="subject" minLength={3} maxLength={180} required placeholder="Perihal surat" /></label>
      <label>Isi surat<textarea name="body" minLength={10} maxLength={20000} rows={7} required placeholder="Tulis isi surat..." /></label>
      {state.error && <p className="form-feedback error" role="alert">{state.error}</p>}
      {state.success && <p className="form-feedback success" role="status">{state.success}</p>}
      <button type="submit" disabled={pending}><FilePlus2 size={16} /> {pending ? "Menyimpan..." : "Simpan draft"}</button>
    </form>
  );
}