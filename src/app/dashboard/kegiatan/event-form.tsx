"use client";

import { useActionState } from "react";
import { CalendarPlus } from "lucide-react";
import { createEvent, type EventActionState } from "./actions";

const initialState: EventActionState = {};

export function EventForm() {
  const [state, action, pending] = useActionState(createEvent, initialState);
  return (
    <form action={action} className="module-form event-create-form">
      <div className="module-form-heading"><div><p className="eyebrow">NEW PROGRAM</p><h3>Buat kegiatan</h3></div><span className="event-form-icon"><CalendarPlus size={18} /></span></div>
      <label>Nama kegiatan<input name="title" minLength={3} maxLength={160} required placeholder="Contoh: Kerja Bakti Lingkungan" /></label>
      <label>Lokasi<input name="location" maxLength={180} placeholder="Lokasi kegiatan" /></label>
      <label>Waktu mulai<input name="starts_at" type="datetime-local" /></label>
      <label>Deskripsi<textarea name="description" maxLength={5000} rows={3} placeholder="Tujuan dan gambaran kegiatan" /></label>
      {state.error && <p className="form-feedback error" role="alert">{state.error}</p>}
      {state.success && <p className="form-feedback success" role="status">{state.success}</p>}
      <button type="submit" disabled={pending}><CalendarPlus size={16} /> {pending ? "Menyimpan..." : "Simpan sebagai draft"}</button>
    </form>
  );
}