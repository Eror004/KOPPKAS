"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { History, LockKeyhole } from "lucide-react";
import type { DuesActionState, MonthlyDuesCashBookResult } from "./backend-contract";
import { formatContribution, periodLabel } from "./contracts";
import { officialCashSummary } from "./accounting-contract";

type CashBookAction = (duesMonth: string, page?: number, pageSize?: number) => Promise<MonthlyDuesCashBookResult>;
type ExpenseAction = (previous: DuesActionState, formData: FormData) => Promise<DuesActionState>;

export function AccountingPanel({ period, canViewFinance, getCashBook, recordExpense }: {
  period: string;
  canViewFinance: boolean;
  getCashBook?: CashBookAction;
  recordExpense?: ExpenseAction;
}) {
  const [result, setResult] = useState<MonthlyDuesCashBookResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const router = useRouter();
  const keyRef = useRef<string | null>(null);
  const [expenseState, expenseAction, expensePending] = useActionState(async (previous: DuesActionState, formData: FormData) => {
    if (!recordExpense) return { error: "Aksi pengeluaran tidak tersedia." };
    const existingKey = String(formData.get("idempotency_key") ?? "");
    const key = /^[0-9a-f-]{36}$/i.test(existingKey) ? existingKey : keyRef.current ?? crypto.randomUUID();
    keyRef.current = key;
    formData.set("idempotency_key", key);
    const localDate = String(formData.get("spent_at") ?? "");
    formData.set("spent_at", localDate ? `${localDate}:00+07:00` : "");
    const next = await recordExpense(previous, formData);
    if (next.success) { keyRef.current = null; router.refresh(); }
    return next;
  }, {});

  useEffect(() => {
    let active = true;
    if (!canViewFinance || !getCashBook || !period) {
      setResult(null); setLoadError(""); setLoading(false);
      return () => { active = false; };
    }
    setLoading(true); setLoadError(""); setResult(null);
    getCashBook(period, 0, 50).then(value => {
      if (!active) return;
      setResult(value);
      setLoadError(value.error ?? "");
    }).catch(() => { if (active) setLoadError("Pembukuan belum dapat dimuat."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [period, canViewFinance, getCashBook]);

  const summary = result ? officialCashSummary(period, result) : null;
  async function loadMore() {
    if (!getCashBook || !result || !result.hasMore || loading) return;
    setLoading(true);
    try {
      const next = await getCashBook(period, (result.page ?? 0) + 1, result.pageSize ?? 50);
      if (next.error) setLoadError(next.error);
      else setResult(current => current ? { ...next, movements: [...current.movements, ...next.movements] } : next);
    } catch { setLoadError("Mutasi berikutnya belum dapat dimuat."); }
    finally { setLoading(false); }
  }

  return <section className="bank-panel accounting-panel" aria-labelledby="accounting-title">
    <div className="bank-section-title"><div><p className="eyebrow">PEMBUKUAN TERPISAH</p><h2 id="accounting-title">Saldo dan pengeluaran</h2><p>Periode {periodLabel(period)} · terpisah dari status iuran anggota.</p></div><History size={20} aria-hidden="true" /></div>
    {!canViewFinance ? <div className="bank-unavailable" role="note"><LockKeyhole size={20} /><h3>Akses buku kas terbatas</h3><p>Ringkasan saldo dan pengeluaran hanya tersedia bagi pengurus yang memiliki izin pembukuan.</p></div> : <>
      {loading && !result && <p role="status">Memuat pembukuan resmi…</p>}
      {loadError && <p role="alert" className="accounting-state">{loadError}</p>}
      {summary ? <>
        <div className="accounting-balances">
          <div className="accounting-opening"><span>SALDO AWAL</span><strong>{formatContribution(summary.opening_balance)}</strong><p>Saldo awal dari periode pembukuan resmi.</p></div>
          <div className="accounting-current"><span>SALDO AKHIR</span><strong>{formatContribution(summary.closing_balance)}</strong><p>Saldo akhir resmi, bukan hasil penjumlahan halaman mutasi.</p></div>
        </div>
        <div className="accounting-period-totals">
          <div><span>PEMASUKAN</span><strong>{formatContribution(summary.income_amount)}</strong></div>
          <div><span>PENGELUARAN</span><strong>{formatContribution(summary.expense_amount)}</strong></div>
          <div><span>SALDO AKHIR</span><strong>{formatContribution(summary.closing_balance)}</strong></div>
        </div>
        <div className="accounting-grid">
          <div><h3>Catat pengeluaran</h3>
            {recordExpense ? <form action={expenseAction} className="accounting-form">
              <input type="hidden" name="dues_month" value={period} />
              <input type="hidden" name="idempotency_key" value="" readOnly />
              <label>Nominal pengeluaran<input name="amount" type="number" min="0.01" step="0.01" required disabled={expensePending} placeholder="Rp" /></label>
              <label>Tanggal dan waktu<input name="spent_at" type="datetime-local" required disabled={expensePending} /></label>
              <label>Keterangan atau tujuan<input name="description" type="text" minLength={2} maxLength={240} required disabled={expensePending} /></label>
              <button type="submit" disabled={expensePending}>{expensePending ? "Menyimpan..." : "Simpan pengeluaran"}</button>
              {expenseState.error && <p role="alert">{expenseState.error} Jika hasil transaksi belum pasti, jangan kirim dengan kunci baru.</p>}
              {expenseState.success && <p role="status">{expenseState.success}</p>}
            </form> : <p>Formulir pengeluaran belum tersedia.</p>}
          </div>
          <div><h3>Riwayat mutasi</h3>
            {result?.movements.length ? <ul className="accounting-mutations">{result.movements.map(item => <li key={item.movement_key}><div><strong>{item.description}</strong><span>{item.movement_type.replaceAll("_", " ")} · {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(item.occurred_at))}</span><small>{item.recorded_by ?? "Pencatat tidak tersedia"}{item.note ? ` · ${item.note}` : ""}</small></div><strong>{item.movement_type === "pengeluaran" ? "−" : item.movement_type === "saldo_awal" ? "" : "+"}{formatContribution(item.amount)}</strong></li>)}</ul> : <p>Belum ada mutasi pada periode ini.</p>}
            {result?.hasMore && <button type="button" onClick={loadMore} disabled={loading}>{loading ? "Memuat..." : "Muat mutasi berikutnya"}</button>}
            {result && <small>{result.movements.length} dari {result.movementCount ?? result.movements.length} mutasi ditampilkan.</small>}
          </div>
        </div>
      </> : !loading && !loadError && <p role="status">Ringkasan buku kas periode ini belum tersedia.</p>}
    </>}
  </section>;
}
