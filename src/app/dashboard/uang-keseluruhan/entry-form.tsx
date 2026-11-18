"use client";

import { useActionState, useRef } from "react";
import { Plus } from "lucide-react";
import { recordManualLedgerEntry, type LedgerActionState } from "./actions";

const initialState: LedgerActionState = {};
const uuidPattern = /^[0-9a-f-]{36}$/i;

export function ManualLedgerForm() {
  const idempotencyKeyRef = useRef<string | null>(null);
  const [state, action, pending] = useActionState(async (previous: LedgerActionState, formData: FormData) => {
    const existingKey = String(formData.get("idempotency_key") ?? "");
    const key = uuidPattern.test(existingKey) ? existingKey : idempotencyKeyRef.current ?? crypto.randomUUID();
    idempotencyKeyRef.current = key;
    formData.set("idempotency_key", key);
    const result = await recordManualLedgerEntry(previous, formData);
    if (result.success) idempotencyKeyRef.current = null;
    return result;
  }, initialState);

  return (
    <form action={action} className="module-form">
      <div className="module-form-heading"><div><p className="eyebrow">GENERAL LEDGER</p><h3>Catat transaksi manual</h3></div><span className="event-form-icon"><Plus size={18} /></span></div>
      <input type="hidden" name="idempotency_key" value="" readOnly />
      <label>Jenis transaksi<select name="direction" defaultValue="masuk"><option value="masuk">Uang masuk</option><option value="keluar">Uang keluar</option></select></label>
      <label>Nominal<input name="amount" type="number" min="1" max="9999999999999.99" step="0.01" required placeholder="Nominal rupiah" /></label>
      <label>Keterangan<input name="description" minLength={2} maxLength={240} required placeholder="Keterangan transaksi" /></label>
      {state.error && <p className="form-feedback error" role="alert">{state.error}</p>}
      {state.success && <p className="form-feedback success" role="status">{state.success}</p>}
      <button type="submit" disabled={pending}><Plus size={16} /> {pending ? "Menyimpan..." : "Simpan transaksi"}</button>
    </form>
  );
}
