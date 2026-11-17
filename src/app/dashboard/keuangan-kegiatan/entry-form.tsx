"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { createEventFinanceEntry, type EventFinanceState } from "./actions";

const initialState: EventFinanceState = {};

export function EventFinanceForm({ events }: { events: Array<{ id: string; title: string }> }) {
  const [state, action, pending] = useActionState(createEventFinanceEntry, initialState);
  return (
    <form action={action} className="module-form">
      <div className="module-form-heading"><div><p className="eyebrow">EVENT BOOKKEEPING</p><h3>Catat transaksi kegiatan</h3></div><span className="event-form-icon"><Plus size={18} /></span></div>
      <label>Kegiatan<select name="event_id" defaultValue="" required><option value="" disabled>Pilih kegiatan</option>{events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}</select></label>
      <label>Jenis transaksi<select name="direction" defaultValue="masuk"><option value="masuk">Uang masuk</option><option value="keluar">Uang keluar</option></select></label>
      <label>Nominal<input name="amount" type="number" min="1" max="9999999999999.99" step="0.01" required placeholder="Nominal rupiah" /></label>
      <label>Keterangan<input name="description" minLength={2} maxLength={240} required placeholder="Keterangan transaksi" /></label>
      {state.error && <p className="form-feedback error" role="alert">{state.error}</p>}
      {state.success && <p className="form-feedback success" role="status">{state.success}</p>}
      <button type="submit" disabled={pending}><Plus size={16} /> {pending ? "Menyimpan..." : "Simpan transaksi"}</button>
    </form>
  );
}