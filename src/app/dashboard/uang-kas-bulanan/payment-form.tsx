"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { recordDuesPayment } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button className="payment-submit" type="submit" disabled={pending}>{pending ? "Menyimpan..." : "Catat pembayaran"}</button>;
}

export function PaymentForm({ monthlyDuesId }: { monthlyDuesId: string }) {
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  return (
    <form action={async (formData) => { await recordDuesPayment(formData); setIdempotencyKey(crypto.randomUUID()); }} className="payment-form">
      <input type="hidden" name="monthly_dues_id" value={monthlyDuesId} />
      <input type="hidden" name="idempotency_key" value={idempotencyKey} />
      <input aria-label="Nominal pembayaran" name="amount" type="number" min="1" max="9999999999999.99" step="0.01" required placeholder="Nominal Rp" />
      <input aria-label="Catatan pembayaran" name="note" maxLength={500} placeholder="Catatan (opsional)" />
      <SubmitButton />
    </form>
  );
}