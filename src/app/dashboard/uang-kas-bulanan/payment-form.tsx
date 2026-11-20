"use client";

import { useActionState, useRef } from "react";
import { recordDuesPayment, type DuesActionState } from "./actions";

const initialState: DuesActionState = {};
const uuidPattern = /^[0-9a-f-]{36}$/i;

export function PaymentForm({ monthlyDuesId }: { monthlyDuesId: string }) {
  const idempotencyKeyRef = useRef<string | null>(null);
  const [state, action, pending] = useActionState(async (previous: DuesActionState, formData: FormData) => {
    const existingKey = String(formData.get("idempotency_key") ?? "");
    const key = uuidPattern.test(existingKey) ? existingKey : idempotencyKeyRef.current ?? crypto.randomUUID();
    idempotencyKeyRef.current = key;
    formData.set("idempotency_key", key);
    const result = await recordDuesPayment(previous, formData);
    if (result.success) idempotencyKeyRef.current = null;
    return result;
  }, initialState);

  return (
    <form action={action} className="payment-form" aria-busy={pending}>
      <input type="hidden" name="monthly_dues_id" value={monthlyDuesId} />
      <input type="hidden" name="idempotency_key" value="" readOnly />
      <input aria-label="Nominal pembayaran" name="amount" type="number" min="0.01" max="9999999999999.99" step="0.01" required placeholder="Nominal Rp" />
      <input aria-label="Catatan pembayaran" name="note" maxLength={500} placeholder="Catatan (opsional)" />
      <label className="payment-confirm"><input type="checkbox" required /> <span>Saya sudah memeriksa nominal pembayaran sukarela ini.</span></label>
      <button className="payment-submit" type="submit" disabled={pending}>{pending ? "Menyimpan..." : "Catat"}</button>
      {state.error && <span className="payment-feedback error" role="alert">{state.error}</span>}
      {state.success && <span className="payment-feedback success" role="status">{state.success}</span>}
    </form>
  );
}
