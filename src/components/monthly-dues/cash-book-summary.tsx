import { formatTotalsRupiah } from "./period-totals-contract";
import type { MonthlyDuesCashBookResult } from "@/app/dashboard/uang-kas-bulanan/actions";

/** Summary only: never calculate a balance from a paginated movements page. */
export function CashBookSummary({ period, dataStatus, result }: { period: string; dataStatus: "available" | "historical_empty"; result: MonthlyDuesCashBookResult }) {
  const summary = result.summary;
  const validAmount = (value: unknown): value is string | number | null => value === null ||
    ((typeof value === "number" && Number.isFinite(value) && value >= 0 && /^\d+(?:\.\d{1,2})?$/.test(String(value))) ||
     (typeof value === "string" && /^\d+(?:\.\d{1,2})?$/.test(value)));
  const valid = !result.error && summary && summary.dues_month === period && summary.data_status === dataStatus &&
    (summary.data_status === "available" || summary.data_status === "historical_empty") &&
    (summary.cash_balance_status === "available" || summary.cash_balance_status === "historical_gap") &&
    [summary.opening_balance, summary.income_amount, summary.expense_amount, summary.closing_balance].every(validAmount) &&
    (summary.cash_balance_status !== "available" || (summary.opening_balance !== null && summary.closing_balance !== null)) &&
    (summary.cash_balance_status !== "historical_gap" || (summary.opening_balance === null && summary.closing_balance === null)) &&
    (summary.data_status !== "historical_empty" || [summary.opening_balance, summary.income_amount, summary.expense_amount, summary.closing_balance].every(value => value === null));
  if (!valid || !summary) return <section className="bank-panel" aria-labelledby="cash-book-title"><h2 id="cash-book-title">Pembukuan kas</h2><p role="alert">Pembukuan kas belum dapat diverifikasi. Saldo tidak dianggap nol.</p></section>;
  const display = (value: string | number | null) => value === null ? "Tidak diketahui" : formatTotalsRupiah(value);
  return <section className="bank-panel" aria-labelledby="cash-book-title">
    <div className="bank-section-title"><div><p className="eyebrow">PEMBUKUAN KAS</p><h2 id="cash-book-title">Saldo dan mutasi periode</h2><p>Pembukuan kas terpisah dari rekap iuran anggota.</p></div></div>
    {summary.cash_balance_status === "historical_gap" && <p role="status">Saldo tidak diketahui karena data historis belum tersedia.</p>}
    <dl className="dues-totals"><div><dt>Saldo awal</dt><dd>{display(summary.opening_balance)}</dd></div><div><dt>Pemasukan tercatat</dt><dd>{display(summary.income_amount)}</dd></div><div><dt>Pengeluaran tercatat</dt><dd>{display(summary.expense_amount)}</dd></div><div><dt>Saldo akhir</dt><dd>{display(summary.closing_balance)}</dd></div></dl>
    <h3>Mutasi tercatat</h3>
    {result.movements.length ? <ul>{result.movements.map(item => <li key={item.movement_key}>{item.description} · {display(validAmount(item.amount) ? item.amount : null)} · {item.recorded_by ?? "Nama historis tidak tersedia"}</li>)}</ul> : <p>Tidak ada mutasi pada halaman ini.</p>}
    {result.hasMore && <p>Hanya halaman pertama mutasi yang ditampilkan; jumlah di atas berasal dari ringkasan resmi.</p>}
    <p>Pencatatan pengeluaran belum tersedia sampai pengujian integrasi disetujui.</p>
  </section>;
}
