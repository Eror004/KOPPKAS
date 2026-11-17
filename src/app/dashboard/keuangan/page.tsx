import { Landmark } from "lucide-react";
import { requireModulePermission } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { formatRupiah } from "@/lib/finance/format";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  await requireModulePermission("general_finance", "read");
  const supabase = await createClient();
  const { data, error } = await supabase.from("general_ledger_entries")
    .select("id, occurred_at, direction, amount, description, source_type")
    .order("occurred_at", { ascending: false })
    .limit(100);

  const entries = data ?? [];
  const balance = entries.reduce((sum, entry) => {
    const amount = Number(entry.amount);
    return entry.direction === "masuk" || entry.direction === "transfer_masuk" ? sum + amount : sum - amount;
  }, 0);

  return (
    <main className="module-page">
      <div className="module-page-head"><div><p className="eyebrow">ORGANIZATION FINANCIAL LEDGER</p><h1>Uang Keseluruhan</h1><p>Buku kas organisasi utama. Pembayaran kas bulanan terhubung ke buku ini tepat satu kali.</p></div><div className="module-total"><Landmark size={19} /><strong>{formatRupiah(balance)}</strong><span>SALDO DARI 100 TRANSAKSI TERBARU</span></div></div>
      {error && <div className="module-alert" role="alert">Buku keuangan belum dapat dimuat. Pastikan database KOPPKAS sudah terhubung.</div>}
      <section className="module-table-panel"><div className="module-table-heading"><div><p className="eyebrow">GENERAL LEDGER</p><h2>Riwayat transaksi</h2></div><span>100 TRANSAKSI TERBARU</span></div>
        {entries.length ? <div className="responsive-table"><table><thead><tr><th>TANGGAL</th><th>KETERANGAN</th><th>SUMBER</th><th>ARAH</th><th>NOMINAL</th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.id}><td>{new Date(entry.occurred_at).toLocaleDateString("id-ID")}</td><td>{entry.description}</td><td>{entry.source_type}</td><td>{entry.direction.replace("_", " ").toUpperCase()}</td><td>{formatRupiah(entry.amount)}</td></tr>)}</tbody></table></div> : <div className="module-empty">Belum ada transaksi. Saldo akan dihitung dari seluruh buku transaksi, bukan angka contoh.</div>}
      </section>
    </main>
  );
}