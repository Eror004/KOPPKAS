import { Wallet } from "lucide-react";
import { ModuleShell } from "@/components/module-shell";
import { requireModulePermission } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { formatRupiah } from "@/lib/finance/format";
import { EventFinanceForm } from "./entry-form";

export const dynamic = "force-dynamic";

export default async function EventFinancePage() {
  const user = await requireModulePermission("event_finance", "read");
  const supabase = await createClient();
  const [{ data: events }, { data: entries, error: entriesError }, { data: balances, error: balanceError }] = await Promise.all([
    supabase.from("events").select("id,title").in("status", ["terbit", "berlangsung"]).order("created_at", { ascending: false }),
    supabase.from("event_ledger_entries").select("id,event_id,direction,amount,description,occurred_at,events(title)").order("occurred_at", { ascending: false }).limit(100),
    supabase.from("event_ledger_balance_summary").select("total_in,total_out,net_balance,transaction_count").maybeSingle(),
  ]);

  const rows = entries ?? [];
  const totalIn = Number(balances?.total_in ?? 0);
  const totalOut = Number(balances?.total_out ?? 0);
  const netBalance = Number(balances?.net_balance ?? 0);
  const transactionCount = Number(balances?.transaction_count ?? 0);
  const hasError = Boolean(entriesError || balanceError);

  return (
    <ModuleShell title="Keuangan Kegiatan">
      <main className="module-page">
        <div className="module-page-head"><div><p className="eyebrow">INDEPENDENT EVENT LEDGERS</p><h1>Keuangan Kegiatan</h1><p>Setiap kegiatan memiliki pembukuan sendiri. Surplus positif baru dipindahkan setelah laporan akhir disetujui.</p></div><div className="module-total"><Wallet size={19} /><strong>{formatRupiah(netBalance)}</strong><span>SALDO BERSIH KESELURUHAN</span></div></div>
        {hasError && <div className="module-alert" role="alert">Ringkasan atau daftar transaksi kegiatan belum dapat dimuat lengkap.</div>}
        <div className="dues-stats"><div><span>UANG MASUK (SEMUA)</span><strong>{formatRupiah(totalIn)}</strong></div><div><span>UANG KELUAR (SEMUA)</span><strong>{formatRupiah(totalOut)}</strong></div><div><span>KEGIATAN</span><strong>{events?.length ?? 0}</strong></div><div><span>SELURUH TRANSAKSI</span><strong>{transactionCount}</strong></div></div>
        {user.role !== "sekretaris" && events?.length ? <EventFinanceForm events={events} /> : null}
        <section className="module-table-panel"><div className="module-table-heading"><div><p className="eyebrow">EVENT LEDGER</p><h2>Transaksi kegiatan terbaru</h2></div><span>{Math.min(rows.length, 100)} DARI {transactionCount} TRANSAKSI</span></div>
          {rows.length ? <div className="responsive-table"><table><thead><tr><th>KEGIATAN</th><th>TANGGAL</th><th>KETERANGAN</th><th>ARAH</th><th>NOMINAL</th></tr></thead><tbody>{rows.map((row) => { const event = Array.isArray(row.events) ? row.events[0] : row.events; return <tr key={row.id}><td>{event?.title ?? "Kegiatan"}</td><td>{new Date(row.occurred_at).toLocaleDateString("id-ID")}</td><td>{row.description}</td><td>{row.direction.toUpperCase()}</td><td>{formatRupiah(row.amount)}</td></tr>; })}</tbody></table></div> : <div className="module-empty">Belum ada transaksi pada buku kegiatan.</div>}
        </section>
      </main>
    </ModuleShell>
  );
}
