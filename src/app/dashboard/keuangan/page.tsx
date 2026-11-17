import Link from "next/link";
import { ArrowUpRight, HandCoins, Landmark, Wallet } from "lucide-react";
import { ModuleShell } from "@/components/module-shell";
import { requireModulePermission } from "@/lib/auth/require-role";

export const dynamic = "force-dynamic";

export default async function FinanceHubPage() {
  await requireModulePermission("general_finance", "read");
  return (
    <ModuleShell title="Keuangan">
      <main className="module-page">
        <div className="module-page-head"><div><p className="eyebrow">FINANCIAL MANAGEMENT</p><h1>Keuangan</h1><p>Pusat akses pembukuan organisasi, kas bulanan, dan keuangan kegiatan yang dikelola secara terpisah.</p></div><div className="module-total"><Wallet size={19} /><strong>03</strong><span>BUKU KEUANGAN</span></div></div>
        <div className="finance-hub-grid">
          <Link href="/dashboard/uang-keseluruhan"><span><Landmark size={21} /></span><div><small>LEDGER UTAMA</small><strong>Uang Keseluruhan</strong><p>Saldo dan seluruh transaksi kas organisasi.</p></div><ArrowUpRight size={17} /></Link>
          <Link href="/dashboard/uang-kas-bulanan"><span><HandCoins size={21} /></span><div><small>REGISTER ANGGOTA</small><strong>Uang Kas Bulanan</strong><p>Pembayaran sukarela anggota per bulan.</p></div><ArrowUpRight size={17} /></Link>
          <Link href="/dashboard/keuangan-kegiatan"><span><Wallet size={21} /></span><div><small>EVENT ACCOUNTING</small><strong>Keuangan Kegiatan</strong><p>Pembukuan terpisah untuk setiap kegiatan.</p></div><ArrowUpRight size={17} /></Link>
        </div>
      </main>
    </ModuleShell>
  );
}