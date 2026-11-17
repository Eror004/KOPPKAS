"use client";

import { useActionState } from "react";
import { Megaphone } from "lucide-react";
import { createAnnouncement, type AnnouncementState } from "./actions";

const initialState: AnnouncementState = {};

export function AnnouncementForm() {
  const [state, action, pending] = useActionState(createAnnouncement, initialState);
  return (
    <form action={action} className="module-form">
      <div className="module-form-heading"><div><p className="eyebrow">COMMUNITY UPDATE</p><h3>Buat pengumuman</h3></div><span className="event-form-icon"><Megaphone size={18} /></span></div>
      <label>Judul<input name="title" minLength={3} maxLength={180} required placeholder="Judul pengumuman" /></label>
      <label>Isi pengumuman<textarea name="body" minLength={10} maxLength={10000} rows={6} required placeholder="Tulis informasi untuk warga..." /></label>
      {state.error && <p className="form-feedback error" role="alert">{state.error}</p>}
      {state.success && <p className="form-feedback success" role="status">{state.success}</p>}
      <button type="submit" disabled={pending}><Megaphone size={16} /> {pending ? "Menyimpan..." : "Simpan sebagai draft"}</button>
    </form>
  );
}