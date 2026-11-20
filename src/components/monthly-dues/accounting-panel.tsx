import { History, LockKeyhole } from "lucide-react";
import { formatContribution, periodLabel } from "./contracts";
import { HISTORICAL_OCTOBER_AMOUNT, HISTORICAL_OCTOBER_PERIOD, runningBalance, type AccountingState, type PeriodPresentation } from "./accounting-contract";

const unavailable: AccountingState = { kind: "unavailable" };
export function AccountingPanel({ period, state = unavailable, periodData }: { period: string; state?: AccountingState; periodData?: PeriodPresentation }) {
  const october = period === HISTORICAL_OCTOBER_PERIOD;
  const currentPeriod = periodData?.period === period ? periodData : undefined;
  const snapshot = currentPeriod?.status !== "unopened" && state.kind === "ready" && state.snapshot.period === period ? state.snapshot : null;
  const balance = snapshot ? runningBalance(period, snapshot) : null;
  const totals = currentPeriod?.status === "opened" ? currentPeriod : undefined;
  return <section className="bank-panel accounting-panel" aria-labelledby="accounting-title">
    <div className="bank-section-title"><div><p className="eyebrow">PEMBUKUAN TERPISAH</p><h2 id="accounting-title">Saldo dan pengeluaran</h2><p>Periode {periodLabel(period)} · bukan bagian dari ringkasan iuran.</p></div><History size={20} aria-hidden="true" /></div>
    <div className="accounting-state" aria-label="Status pembukaan periode">
      <strong>Status periode: {currentPeriod ? currentPeriod.status === "opened" ? "Sudah dibuka" : "Belum dibuka" : "Belum terverifikasi"}</strong>
      <p>Pengurus membuka setiap periode secara eksplisit. Saldo pembukaan periode berikutnya berasal dari saldo akhir periode sebelumnya; iuran dan status anggota tetap terpisah per bulan.</p>
      <button type="button" disabled>Buka periode</button>
      <p>Pembukaan periode belum tersedia: menunggu kontrak backend dan izin final.</p>
    </div>
    <div className="accounting-balances">
      {october ? <div className="accounting-opening"><span><LockKeyhole size={15} aria-hidden="true" /> SALDO AWAL HISTORIS · OKTOBER 2026</span><strong>{formatContribution(HISTORICAL_OCTOBER_AMOUNT)}</strong><p>Keputusan resmi pemilik: dana sudah dimiliki sebelum KOPPKAS. Bukan iuran baru atau pemasukan November. Catatan ini permanen dan hanya dibaca; sumber backend belum terhubung.</p></div> : <div className="accounting-opening"><span>SALDO AWAL PERIODE INI</span><strong>{totals ? formatContribution(totals.opening) : snapshot && balance !== null ? formatContribution(snapshot.openingAmount) : "—"}</strong><p>{totals ? "Saldo awal periode ini berasal dari data pembukuan." : snapshot && balance !== null ? "Saldo awal berasal dari snapshot periode ini." : period === "2026-11-01" ? "Pembukuan November belum tersedia di UI; status pembukaan periode belum terverifikasi oleh backend." : "Saldo awal dan status pembukaan periode ini belum terhubung ke backend."}</p></div>}
      <div className="accounting-current"><span>SALDO BERJALAN</span><strong>{balance === null ? "—" : formatContribution(balance)}</strong><p>{balance === null ? "Menunggu saldo dan seluruh mutasi periode dari backend." : "Dihitung dari snapshot periode dan mutasi lengkap."}</p></div>
    </div>
    <div className="accounting-period-totals" aria-label={`Ringkasan pembukuan ${periodLabel(period)}`}>
      <div><span>PEMASUKAN · {periodLabel(period)}</span><strong>{totals ? formatContribution(totals.income) : "—"}</strong><small>{totals ? "Pemasukan aktual" : "Belum terhubung"}</small></div>
      <div><span>PENGELUARAN · {periodLabel(period)}</span><strong>{totals ? formatContribution(totals.expenses) : "—"}</strong><small>{totals ? "Pengeluaran aktual" : "Belum terhubung"}</small></div>
      <div><span>SALDO AKHIR · {periodLabel(period)}</span><strong>{totals ? formatContribution(totals.closing) : "—"}</strong><small>{totals ? "Saldo akhir dari data pembukuan" : "Menunggu data resmi"}</small></div>
    </div>
    {state.kind === "loading" && <p role="status" className="accounting-state">Memuat pembukuan…</p>}
    {state.kind === "error" && <p role="alert" className="accounting-state">{state.message}</p>}
    {snapshot && balance === null && <p role="alert" className="accounting-state">Saldo tidak dapat ditampilkan: data periode tidak lengkap atau tidak konsisten.</p>}
    <div className="accounting-grid"><div><h3>Catat pengeluaran</h3><p>Belum tersedia. Formulir menunggu kontrak backend, izin, dan identitas pencatat yang terverifikasi.</p><fieldset disabled className="accounting-form"><label>Nominal pengeluaran<input type="number" min="0.01" step="0.01" required placeholder="Rp" /></label><label>Tanggal dan waktu<input type="datetime-local" required /></label><label>Keterangan atau tujuan<input type="text" minLength={2} maxLength={240} required /></label><label>Periode pembukuan<input value={periodLabel(period)} readOnly /></label><label>Identitas pencatat<input placeholder="Menunggu identitas terverifikasi" /></label><button type="button">Simpan pengeluaran</button></fieldset></div>
      <div><h3>Riwayat mutasi</h3>{october && <div className="accounting-history-opening"><strong>Saldo awal historis</strong><span>Oktober 2026 · {formatContribution(HISTORICAL_OCTOBER_AMOUNT)}</span><small>Catatan permanen, bukan transaksi pemasukan baru.</small></div>}
        {snapshot && balance !== null ? snapshot.mutations.length ? <ul className="accounting-mutations">{snapshot.mutations.map(item => <li key={item.id}><details><summary>{item.description} · {item.direction === "out" ? "−" : "+"}{formatContribution(item.amount)}</summary><p>Periode: {periodLabel(item.period)}</p><p>Waktu: {item.occurredAt}</p><p>Pencatat: {item.recordedBy}</p><p>Referensi: {item.id}</p></details></li>)}</ul> : <p>Tidak ada mutasi dalam snapshot periode ini.</p> : <p>Riwayat dan detail pengeluaran belum terhubung. Tidak ada transaksi contoh yang ditampilkan.</p>}
      </div></div>
  </section>;
}
