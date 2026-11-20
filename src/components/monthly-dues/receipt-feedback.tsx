"use client";

import { useState } from "react";
import type { DuesPaymentReceipt, ReceiptResult } from "./backend-contract";
import { formatContribution, periodLabel } from "./contracts";

function validReceipt(receipt: DuesPaymentReceipt, transactionId: string): boolean {
  return receipt.payment_id === transactionId && Boolean(receipt.payment_reference && receipt.member_id && receipt.member_name)
    && Number.isFinite(Number(receipt.amount)) && Number(receipt.amount) > 0
    && Number.isFinite(Date.parse(receipt.paid_at)) && /^\d{4}-(0[1-9]|1[0-2])-01$/.test(receipt.dues_month)
    && ["lunas", "kurang", "belum_bayar"].includes(receipt.status_after_transaction);
}

/** Read only: receipt retrieval is separate from payment persistence and may be retried. */
export function ReceiptFeedback({ transactionId, getReceipt }: { transactionId: string; getReceipt?: (transactionId: string) => Promise<ReceiptResult> }) {
  const [receipt, setReceipt] = useState<DuesPaymentReceipt | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadReceipt() {
    if (!getReceipt || loading) return;
    setLoading(true);
    setError("");
    try {
      const result = await getReceipt(transactionId);
      if (result.error || !result.receipt || !validReceipt(result.receipt, transactionId)) {
        setError(result.error || "Bukti transaksi belum dapat dimuat.");
      } else {
        setReceipt(result.receipt);
      }
    } catch {
      setError("Bukti transaksi belum dapat dimuat.");
    } finally { setLoading(false); }
  }

  if (!getReceipt) return <p className="receipt-message" role="status">Pembayaran tercatat. Pengambilan bukti belum terhubung.</p>;
  return <section className="receipt-feedback" aria-label="Bukti pembayaran">
    {!receipt && <><p className="receipt-message">Pembayaran tercatat. Pengambilan bukti dilakukan terpisah.</p><button type="button" disabled={loading} onClick={loadReceipt}>{loading ? "Memuat bukti..." : error ? "Coba ambil bukti lagi" : "Ambil bukti transaksi"}</button>{error && <p role="alert">{error} Pembayaran tetap tercatat; jangan kirim ulang hanya untuk mengambil bukti.</p>}</>}
    {receipt && <div className="receipt-paper"><p className="eyebrow">BUKTI PEMBAYARAN</p><h3>Transaksi tercatat</h3><strong className="receipt-amount">{formatContribution(receipt.amount)}</strong><dl>
      <div><dt>Referensi</dt><dd>{receipt.payment_reference}</dd></div><div><dt>Anggota</dt><dd>{receipt.member_name}</dd></div>
      <div><dt>Waktu transaksi</dt><dd>{new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(receipt.paid_at))} WIB</dd></div>
      <div><dt>Periode</dt><dd>{periodLabel(receipt.dues_month)}</dd></div><div><dt>Status setelah transaksi</dt><dd>{receipt.status_after_transaction.replace("_", " ").toUpperCase()}</dd></div>
      {receipt.note && <div><dt>Catatan</dt><dd>{receipt.note}</dd></div>}{(receipt.recorded_by_name || receipt.recorded_by) && <div><dt>Dicatat oleh</dt><dd>{receipt.recorded_by_name || receipt.recorded_by}</dd></div>}
    </dl></div>}
  </section>;
}
