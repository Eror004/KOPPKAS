import { Landmark } from "lucide-react";
import { ModuleShell } from "@/components/module-shell";
import { requireModulePermission } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { formatRupiah } from "@/lib/finance/format";
import { ManualLedgerForm } from "./entry-form";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const user = await requireModulePermission("general_finance", "read");
  const supabase = await createClient();
  const [{ data, error }, { data: balanceData, error: balanceError }] = await Promise.all([
    supabase.from("general_ledger_entries")
      .select("id, occurred_at, direction, amount, description, source_type")
      .order("occurred_at", { ascending: false })
      .limit(100),
    supabase.from("general_ledger_balance").select("balance").single(),
  ]);

  const entries = data ?? [];
  const balance = Number(balanceData?.balance ?? 0);

  return (
    <ModuleShell title="Uang Keseluruhan"><main className="module-page">
      <div className="module-page-head"><div><p className="eyebrow">ORGANIZATION FINANCIAL LEDGER</p><h1>Uang Keseluruhan</h1><p>Buku kas organisasi utama. Pembayaran kas bulanan dan surplus kegiatan terhubung tepat satu kali.</p></div><div className="module-total"><Landmark size={19} /><strong>{formatRupiah(balance)}</strong><span>SALDO BERJALAN</span></div></div>
      {(error || balanceError) && <div className="module-alert" role="alert">Buku keuangan belum dapat dimuat lengkap. Pastikan database KOPPKAS sudah terhubung.</div>}
      {["ketua_pemuda", "wakil_ketua_pemuda", "bendahara"].includes(user.role) && <ManualLedgerForm />}
      <section className="module-table-panel"><div className="module-table-heading"><div><p className="eyebrow">GENERAL LEDGER</p><h2>Riwayat transaksi</h2></div><span>100 TRANSAKSI TERBARU</span></div>
        {entries.length ? <div className="responsive-table"><table><thead><tr><th>TANGGAL</th><th>KETERANGAN</th><th>SUMBER</th><th>ARAH</th><th>NOMINAL</th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.id}><td>{new Date(entry.occurred_at).toLocaleDateString("id-ID")}</td><td>{entry.description}</td><td>{entry.source_type}</td><td>{entry.direction.replace("_", " ").toUpperCase()}</td><td>{formatRupiah(entry.amount)}</td></tr>)}</tbody></table></div> : <div className="module-empty">Belum ada transaksi. Saldo dihitung dari buku transaksi dan saldo awal yang telah diverifikasi.</div>}
      </section>
    </main></ModuleShell>
  );
}
