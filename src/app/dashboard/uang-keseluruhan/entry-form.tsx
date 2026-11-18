"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { recordManualLedgerEntry, type LedgerActionState } from "./actions";

const initialState: LedgerActionState = {};

export function ManualLedgerForm() {
  const [state, action, pending] = useActionState(recordManualLedgerEntry, initialState);
  const [idempotencyKey, setIdempotencyKey] = useState("");

  useEffect(() => {
    setIdempotencyKey(crypto.randomUUID());
  }, []);

  useEffect(() => {
    if (state.success) setIdempotencyKey(crypto.randomUUID());
  }, [state]);

  return (
    <form action={action} className="module-form">
      <div className="module-form-heading"><div><p className="eyebrow">GENERAL LEDGER</p><h3>Catat transaksi manual</h3></div><span className="event-form-icon"><Plus size={18} /></span></div>
      <input type="hidden" name="idempotency_key" value={idempotencyKey} />
      <label>Jenis transaksi<select name="direction" defaultValue="masuk"><option value="masuk">Uang masuk</option><option value="keluar">Uang keluar</option></select></label>
      <label>Nominal<input name="amount" type="number" min="1" max="9999999999999.99" step="0.01" required placeholder="Nominal rupiah" /></label>
      <label>Keterangan<input name="description" minLength={2} maxLength={240} required placeholder="Keterangan transaksi" /></label>
      {state.error && <p className="form-feedback error" role="alert">{state.error}</p>}
      {state.success && <p className="form-feedback success" role="status">{state.success}</p>}
      <button type="submit" disabled={pending || !idempotencyKey}><Plus size={16} /> {pending ? "Menyimpan..." : "Simpan transaksi"}</button>
    </form>
  );
}
