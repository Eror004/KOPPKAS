"use client";

import { useActionState } from "react";
import { recordDuesPayment, type DuesActionState } from "./actions";

const initialState: DuesActionState = {};
const uuidPattern = /^[0-9a-f-]{36}$/i;

async function submitWithIdempotency(
  previous: DuesActionState,
  formData: FormData,
): Promise<DuesActionState> {
  const existingKey = String(formData.get("idempotency_key") ?? "");
  if (!uuidPattern.test(existingKey)) {
    formData.set("idempotency_key", crypto.randomUUID());
  }
  return recordDuesPayment(previous, formData);
}

export function PaymentForm({ monthlyDuesId }: { monthlyDuesId: string }) {
  const [state, action, pending] = useActionState(submitWithIdempotency, initialState);

  return (
    <form action={action} className="payment-form">
      <input type="hidden" name="monthly_dues_id" value={monthlyDuesId} />
      <input type="hidden" name="idempotency_key" value="" readOnly />
      <input aria-label="Nominal pembayaran" name="amount" type="number" min="1" max="9999999999999.99" step="0.01" required placeholder="Nominal Rp" />
      <input aria-label="Catatan pembayaran" name="note" maxLength={500} placeholder="Catatan (opsional)" />
      <button className="payment-submit" type="submit" disabled={pending}>{pending ? "Menyimpan..." : "Catat"}</button>
      {state.error && <span className="payment-feedback error" role="alert">{state.error}</span>}
      {state.success && <span className="payment-feedback success" role="status">{state.success}</span>}
    </form>
  );
}
