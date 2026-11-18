import { ModuleShell } from "@/components/module-shell";
import { HandCoins } from "lucide-react";
import { requireModulePermission } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { formatMonth, formatRupiah } from "@/lib/finance/format";
import { RegisterForm } from "./register-form";
import { PaymentForm } from "./payment-form";
import { InlineMemberForm } from "./inline-member-form";

export const dynamic = "force-dynamic";

export default async function MonthlyDuesPage() {
  const user = await requireModulePermission("monthly_dues", "read");
  const supabase = await createClient();
  const currentMonth = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }).slice(0, 7) + "-01";
  const [year, month] = currentMonth.slice(0, 7).split("-").map(Number);
  const historyStart = new Date(Date.UTC(year, month - 12, 1)).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("monthly_dues_summary")
    .select("id, full_name, dues_month, reference_amount, paid_amount, remaining_amount, payment_status")
    .gte("dues_month", historyStart)
    .order("dues_month", { ascending: false })
    .order("full_name", { ascending: true });

  const allRows = data ?? [];
  const rows = allRows.filter((row) => row.dues_month === currentMonth);
  const previousRows = allRows.filter((row) => row.dues_month < currentMonth);
  const paid = rows.filter((row) => row.payment_status === "lunas").length;
  const collected = rows.reduce((sum, row) => sum + Number(row.paid_amount), 0);
  const historicalUnpaid = previousRows.filter((row) => row.payment_status !== "lunas").length;

  const history = new Map<string, { members: number; paid: number; unpaid: number; collected: number }>();
  for (const row of previousRows) {
    const item = history.get(row.dues_month) ?? { members: 0, paid: 0, unpaid: 0, collected: 0 };
    item.members += 1;
    item.paid += row.payment_status === "lunas" ? 1 : 0;
    item.unpaid += row.payment_status === "lunas" ? 0 : 1;
    item.collected += Number(row.paid_amount);
    history.set(row.dues_month, item);
  }
  const historyRows = [...history.entries()].sort(([a], [b]) => b.localeCompare(a));

  return (
    <ModuleShell title="Uang Kas Bulanan"><main className="module-page">
      <div className="module-page-head"><div><p className="eyebrow">MONTHLY CONTRIBUTION REGISTER</p><h1>Uang Kas Bulanan</h1><p>Pencatatan pembayaran sukarela anggota. Acuan Rp10.000 per anggota per bulan, bukan tagihan wajib.</p></div><div className="module-total"><HandCoins size={19} /><strong>{formatRupiah(collected)}</strong><span>TERCATAT BULAN INI</span></div></div>
      {error && <div className="module-alert" role="alert">Data kas belum dapat dimuat. Pastikan migrasi database KOPPKAS telah diterapkan.</div>}
      {["ketua_pemuda", "wakil_ketua_pemuda", "bendahara"].includes(user.role) && <RegisterForm />}
      <InlineMemberForm />
      <div className="dues-stats"><div><span>PERIODE</span><strong>{formatMonth(currentMonth)}</strong></div><div><span>LUNAS</span><strong>{paid} / {rows.length}</strong></div><div><span>BELUM LUNAS</span><strong>{rows.length - paid}</strong></div><div><span>PERIODE LAMA BELUM LUNAS</span><strong>{historicalUnpaid}</strong></div></div>
      <section className="module-table-panel"><div className="module-table-heading"><div><p className="eyebrow">MEMBER PAYMENT STATUS</p><h2>Daftar pembayaran bulan berjalan</h2></div><span>STATUS BERDASARKAN TOTAL PEMBAYARAN</span></div>
        {rows.length ? <div className="responsive-table"><table><thead><tr><th>ANGGOTA</th><th>ACUAN</th><th>TERBAYAR</th><th>SISA ACUAN</th><th>STATUS</th><th>PENCATATAN</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.full_name}</td><td>{formatRupiah(row.reference_amount)}</td><td>{formatRupiah(row.paid_amount)}</td><td>{formatRupiah(row.remaining_amount)}</td><td><span className={`payment-badge ${row.payment_status}`}>{row.payment_status === "lunas" ? "LUNAS" : "BELUM LUNAS"}</span></td><td><PaymentForm monthlyDuesId={row.id} /></td></tr>)}</tbody></table></div> : <div className="module-empty">Belum ada daftar kas untuk periode ini. Buat daftar bulan berjalan setelah database aktif.</div>}
      </section>
      <section className="module-table-panel"><div className="module-table-heading"><div><p className="eyebrow">MONTHLY RECAP</p><h2>Riwayat 12 periode terakhir</h2></div><span>REKAP PEMBAYARAN</span></div>
        {historyRows.length ? <div className="responsive-table"><table><thead><tr><th>PERIODE</th><th>ANGGOTA</th><th>LUNAS</th><th>BELUM LUNAS</th><th>TERCATAT</th></tr></thead><tbody>{historyRows.map(([period, item]) => <tr key={period}><td>{formatMonth(period)}</td><td>{item.members}</td><td>{item.paid}</td><td>{item.unpaid}</td><td>{formatRupiah(item.collected)}</td></tr>)}</tbody></table></div> : <div className="module-empty">Belum ada riwayat periode sebelumnya.</div>}
        <p className="module-footnote">Periode yang belum mencapai acuan tetap merupakan catatan sukarela, bukan tagihan, utang wajib, atau dasar denda.</p>
      </section>
    </main></ModuleShell>
  );
}
