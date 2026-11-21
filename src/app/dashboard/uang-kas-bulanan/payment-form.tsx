"use client";

import { useActionState, useRef } from "react";
import { recordDuesPayment, type DuesActionState } from "./actions";
import type { ReceiptResult } from "@/components/monthly-dues/backend-contract";
import { ReceiptFeedback } from "@/components/monthly-dues/receipt-feedback";

const initialState: DuesActionState = {};
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function PaymentForm({ monthlyDuesId, getReceipt }: {
  monthlyDuesId: string;
  getReceipt?: (transactionId: string) => Promise<ReceiptResult>;
}) {
  const idempotencyKeyRef = useRef<string | null>(null);
  const [state, action, pending] = useActionState(async (previous: DuesActionState, formData: FormData): Promise<DuesActionState> => {
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
      <input aria-label="Nominal pembayaran" name="amount" type="number" min="0.01" max="9999999999999.99" step="0.01" required placeholder="Nominal Rp" disabled={pending} />
      <input aria-label="Catatan pembayaran" name="note" maxLength={500} placeholder="Catatan (opsional)" disabled={pending} />
      <label className="payment-confirm"><input type="checkbox" required disabled={pending} /> <span>Saya sudah memeriksa nominal pembayaran sukarela ini.</span></label>
      <button className="payment-submit" type="submit" disabled={pending}>{pending ? "Menyimpan..." : "Catat pembayaran"}</button>
      {state.error && <span className="payment-feedback error" role="alert">{state.error} Jika hasil transaksi belum pasti, jangan mengganti kunci dan mengirim pembayaran baru.</span>}
      {state.success && <span className="payment-feedback success" role="status">{state.success}</span>}
      {state.success && state.transactionId && <ReceiptFeedback key={state.transactionId} transactionId={state.transactionId} getReceipt={getReceipt} />}
      {state.success && !state.transactionId && <span className="payment-feedback" role="status">Pembayaran berhasil, tetapi ID transaksi tidak diterima. Jangan kirim ulang.</span>}
    </form>
  );
}
