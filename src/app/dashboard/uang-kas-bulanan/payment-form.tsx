"use client";

import { useActionState, useState } from "react";
import { recordDuesPayment, type DuesActionState } from "./actions";

const initialState: DuesActionState = {};

export function PaymentForm({ monthlyDuesId }: { monthlyDuesId: string }) {
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [state, action, pending] = useActionState(recordDuesPayment, initialState);
  return (
    <form action={async (formData) => { await action(formData); setIdempotencyKey(crypto.randomUUID()); }} className="payment-form">
      <input type="hidden" name="monthly_dues_id" value={monthlyDuesId} />
      <input type="hidden" name="idempotency_key" value={idempotencyKey} />
      <input aria-label="Nominal pembayaran" name="amount" type="number" min="1" max="9999999999999.99" step="0.01" required placeholder="Nominal Rp" />
      <input aria-label="Catatan pembayaran" name="note" maxLength={500} placeholder="Catatan (opsional)" />
      <button className="payment-submit" type="submit" disabled={pending}>{pending ? "Menyimpan..." : "Catat"}</button>
      {state.error && <span className="payment-feedback error" role="alert">{state.error}</span>}
      {state.success && <span className="payment-feedback success" role="status">{state.success}</span>}
    </form>
  );
}
