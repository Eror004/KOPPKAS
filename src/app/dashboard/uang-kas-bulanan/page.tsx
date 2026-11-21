import { ModuleShell } from "@/components/module-shell";
import { Status } from "@/components/ui/status";
import { MonthlyBook } from "@/components/monthly-dues/monthly-book";
import { formatContribution, periodLabel } from "@/components/monthly-dues/contracts";
import { readReceipt } from "./receipt-read";
import { requireModulePermission } from "@/lib/auth/require-role";
import { readMonthlyBook } from "./book-read";
import { getMonthlyDuesPeriodTotals } from "./actions";
import { LifecycleSync } from "@/components/monthly-dues/lifecycle-sync";
import { formatTotalsRupiah, hasReferenceTotalMismatch } from "@/components/monthly-dues/period-totals-contract";

export const dynamic = "force-dynamic";
type Query = { month?: string | string[]; before?: string | string[]; after?: string | string[]; receipt?: string | string[] };
const onlyString = (value: string | string[] | undefined) => typeof value === "string" ? value : undefined;
const formatTime = (value: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value)) + " WIB";

export default async function MonthlyDuesPage({ searchParams }: { searchParams: Promise<Query> }) {
  const user = await requireModulePermission("monthly_dues", "read");
  const params = await searchParams;
  const before = onlyString(params.before);
  const result = await readMonthlyBook({ month: onlyString(params.month), before, after: onlyString(params.after) });
  const href = (values: Record<string, string>) => `?${new URLSearchParams(values).toString()}`;
  const selected = result.selected;
  const receiptQuery = onlyString(params.receipt);
  const receiptResult = receiptQuery ? await readReceipt(receiptQuery) : undefined;
  const totals = selected ? await getMonthlyDuesPeriodTotals(selected.dues_month) : undefined;
  const wibParts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const currentMonth = `${wibParts.find(part => part.type === "year")?.value}-${wibParts.find(part => part.type === "month")?.value}-01`;
  const currentActive = result.activeMonth === currentMonth;
  const maySync = user.role === "ketua_pemuda" || user.role === "wakil_ketua_pemuda" || user.role === "bendahara";
  const totalsMismatch = !!selected && !!totals && (totals.kind === "available" || totals.kind === "historical_empty") && (totals.totals.data_status !== selected.data_status || totals.totals.status !== selected.status);

  return <ModuleShell title="Uang Kas Bulanan"><main className="module-page">
    <div className="module-page-head"><div><p className="eyebrow">KONTRIBUSI SUKARELA</p><h1>Uang Kas Bulanan</h1>
      <p>Acuan Rp10.000 per anggota setiap bulan, bukan tagihan wajib.</p></div></div>
    <div className="sprint-module dues-bank">
      {maySync && <LifecycleSync actorId={user.profile.id} />}
      {result.error && <Status kind="error" title="Data buku belum dapat dimuat">{result.error}</Status>}
      {!result.error && !currentActive && <p role="status">Periode bulan berjalan menunggu aktivasi pengurus.</p>}
      {result.activeMonth && <section className="bank-panel" aria-label="Periode berstatus aktif"><p className="eyebrow">PERIODE BERSTATUS AKTIF</p><h2>{periodLabel(result.activeMonth)}</h2><p>{currentActive ? "Pilih buku di bawah untuk melihat isinya." : "Status periode sebelumnya belum diperbarui; periode bulan berjalan menunggu aktivasi pengurus."} Pencatatan sementara belum tersedia.</p></section>}
      <section className="bank-panel monthly-book-panel" aria-labelledby="book-heading">
        <div className="bank-section-title"><div><p className="eyebrow">BUKU KAS BULANAN</p><h2 id="book-heading">Buku iuran</h2>
          <p>Pilih periode untuk melihat pembayaran yang tercatat. Buku tertutup hanya dapat dibaca.</p></div></div>
        {result.periods.length > 0 && <form method="get" className="monthly-book-picker">
          {before && <input type="hidden" name="before" value={before} />}
          <label htmlFor="monthly-book-period">Pilih buku bulanan</label>
          <select id="monthly-book-period" name="month" defaultValue={selected?.dues_month ?? ""} required>
            <option value="">Pilih periode</option>
            {selected && !result.periods.some(period => period.dues_month === selected.dues_month) && <option value={selected.dues_month}>{periodLabel(selected.dues_month)} · {selected.status === "active" ? "AKTIF" : "DITUTUP"}</option>}
            {result.periods.map(period => <option value={period.dues_month} key={period.dues_month}>{periodLabel(period.dues_month)} · {period.status === "active" ? "AKTIF" : "DITUTUP"}</option>)}
          </select>
          <button type="submit">Lihat buku</button>
        </form>}
        <nav className="monthly-book-pagination" aria-label="Halaman periode">
          {before && <a href="?">Periode terbaru</a>}
          {result.nextPeriodCursor && <a href={href({ before: result.nextPeriodCursor })}>Periode lebih lama</a>}
        </nav>
        {!result.error && !result.periods.length && !before && <p role="status">Belum ada periode tercatat.</p>}
        {selected && <div className="monthly-book-content">
          <h3>{periodLabel(selected.dues_month)} · {selected.status === "active" ? "AKTIF" : "DITUTUP — READ-ONLY"}</h3>
          <p>Status ketersediaan data: {selected.data_status === "available" ? "TERSEDIA" : "DATA HISTORIS TIDAK TERSEDIA"}.</p>
          {selected.closed_effective_at && <p>Batas efektif penutupan: {formatTime(selected.closed_effective_at)}.</p>}
          {selected.closed_processed_at && <p>Penutupan diproses: {formatTime(selected.closed_processed_at)}.</p>}
          {selected.data_status === "historical_empty" && <MonthlyBook data={{ kind: "historical_unavailable" }} />}
          {result.rows && <><MonthlyBook data={{ kind: "available", rows: result.rows }} />
            <nav className="monthly-book-pagination" aria-label="Halaman pembayaran">
              {onlyString(params.after) && <a href={href({ month: selected.dues_month })}>Halaman pertama</a>}
              {result.nextPaymentCursor && <a href={href({ month: selected.dues_month, after: result.nextPaymentCursor })}>Pembayaran berikutnya</a>}
            </nav>
          </>}
        </div>}
      </section>
      {<section className="bank-panel" aria-labelledby="receipt-heading">
        <div className="bank-section-title"><div><p className="eyebrow">BUKTI PEMBAYARAN</p><h2 id="receipt-heading">Cari struk</h2><p>Gunakan ID atau referensi transaksi lengkap.</p></div></div>
        <form method="get" className="monthly-book-picker">
          {selected && <input type="hidden" name="month" value={selected.dues_month} />}
          <label htmlFor="receipt-search">ID atau referensi transaksi</label>
          <input id="receipt-search" name="receipt" defaultValue={receiptQuery ?? ""} maxLength={43} required />
          <button type="submit">Cari struk</button>
        </form>
        {receiptResult?.error && <p role="alert">{receiptResult.error}</p>}
        {receiptResult?.receipt && <div className="receipt-paper"><h3>Transaksi tercatat</h3><dl>
          <div><dt>Referensi</dt><dd>{receiptResult.receipt.payment_reference}</dd></div>
          <div><dt>ID transaksi</dt><dd>{receiptResult.receipt.payment_id}</dd></div>
          <div><dt>Anggota saat transaksi</dt><dd>{receiptResult.receipt.member_name || "Nama historis tidak tersedia"}</dd></div>
          <div><dt>Pencatat saat transaksi</dt><dd>{receiptResult.receipt.recorded_by_name || "Nama historis tidak tersedia"}</dd></div>
          <div><dt>Nominal</dt><dd>{formatContribution(receiptResult.receipt.amount)}</dd></div>
          <div><dt>Waktu transaksi</dt><dd>{formatTime(receiptResult.receipt.paid_at)}</dd></div>
          <div><dt>Buku</dt><dd>{periodLabel(receiptResult.receipt.dues_month)}</dd></div>
          <div><dt>Status setelah transaksi</dt><dd>{receiptResult.receipt.status_after_transaction === "lunas" ? "LUNAS" : "BELUM LUNAS"}</dd></div>
        </dl></div>}
      </section>}
      <section className="bank-panel" aria-labelledby="dues-summary-heading"><div className="bank-section-title"><div><p className="eyebrow">REKAP IURAN</p><h2 id="dues-summary-heading">Ringkasan bulanan</h2></div></div>
        {!selected && <p role="status">Pilih buku untuk melihat ringkasan. Total iuran belum tersedia dari rekap resmi dan tidak dianggap nol.</p>}
        {selected && totalsMismatch && <p role="alert">Rekap iuran tidak sesuai dengan periode buku. Data tidak dianggap nol.</p>}
        {selected && !totalsMismatch && totals?.kind === "not_found" && <p role="alert">Rekap iuran untuk periode ini tidak ditemukan. Data tidak dianggap nol.</p>}
        {selected && !totalsMismatch && totals?.kind === "malformed" && <p role="alert">Data rekap iuran tidak sesuai kontrak dan tidak dapat ditampilkan. Data tidak dianggap nol.</p>}
        {selected && !totalsMismatch && (!totals || totals.kind === "error" || totals.kind === "invalid") && <p role="alert">Rekap iuran belum tersedia atau gagal dimuat. Data tidak dianggap nol; silakan coba lagi.</p>}
        {selected && !totalsMismatch && totals?.kind === "historical_empty" && <p role="status">DATA HISTORIS TIDAK TERSEDIA. Jumlah anggota dan total iuran tidak dianggap nol.</p>}
        {selected && !totalsMismatch && totals?.kind === "available" && hasReferenceTotalMismatch(totals.totals) && <p role="alert">Total acuan backend tidak sesuai dengan Rp10.000 per anggota terdaftar. Mohon verifikasi data bersama pengelola backend.</p>}
        {selected && !totalsMismatch && totals?.kind === "available" && (totals.totals.member_count === 0 || (typeof totals.totals.member_count === "string" && /^0+$/.test(totals.totals.member_count))) && <p role="status">Belum ada anggota terdaftar pada periode ini.</p>}
        {selected && !totalsMismatch && totals?.kind === "available" && <dl className="dues-totals">
          <div><dt>Anggota terdaftar</dt><dd>{totals.totals.member_count}</dd></div>
          <div><dt>LUNAS</dt><dd>{totals.totals.paid_member_count}</dd></div>
          <div><dt>BELUM LUNAS</dt><dd>{totals.totals.unpaid_member_count}</dd></div>
          <div><dt>Total iuran tercatat</dt><dd>{formatTotalsRupiah(totals.totals.total_paid_amount)}</dd></div>
          <div><dt>Total acuan sukarela</dt><dd>{formatTotalsRupiah(totals.totals.total_reference_amount)}</dd></div>
          <div><dt>Selisih terhadap acuan, bukan tagihan</dt><dd>{formatTotalsRupiah(totals.totals.total_remaining_amount)}</dd></div>
        </dl>}
      </section>
    </div>
  </main></ModuleShell>;
}
