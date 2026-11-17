import Link from "next/link";
import { Activity, ArrowLeft, BookOpenText, CalendarDays, Command, ContactRound, FileText, FolderKanban, HandCoins, House, Inbox, Landmark, Megaphone, UsersRound, Wallet } from "lucide-react";

const navigation = [
  { href: "/", label: "Beranda", icon: House },
  { href: "/dashboard/keanggotaan", label: "Anggota", icon: UsersRound },
  { href: "/dashboard/struktur", label: "Struktur", icon: ContactRound },
  { href: "/dashboard/kegiatan", label: "Kegiatan", icon: CalendarDays },
  { href: "/dashboard/uang-kas-bulanan", label: "Kas Bulanan", icon: HandCoins },
  { href: "/dashboard/keuangan", label: "Keuangan", icon: Wallet },
  { href: "/dashboard/uang-keseluruhan", label: "Uang Keseluruhan", icon: Landmark },
  { href: "/dashboard/keuangan-kegiatan", label: "Kas Kegiatan", icon: HandCoins },
  { href: "/dashboard/surat-dokumen", label: "Surat", icon: FileText },
  { href: "/dashboard/pengumuman", label: "Pengumuman", icon: Megaphone },
  { href: "/dashboard/dokumentasi", label: "Dokumentasi", icon: FolderKanban },
  { href: "/dashboard/laporan", label: "Laporan", icon: BookOpenText },
  { href: "/dashboard/riwayat-aktivitas", label: "Aktivitas", icon: Activity },
  { href: "/dashboard/inbox", label: "INBOX", icon: Inbox },
];

export function ModuleShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="module-shell">
      <header className="module-shell-header">
        <Link href="/" className="module-shell-brand"><span><Command size={17} /></span><strong>KOPPKAS</strong></Link>
        <div className="module-shell-current">WORKSPACE <span>/</span> {title.toUpperCase()}</div>
        <Link href="/" className="module-shell-back"><ArrowLeft size={15} /> Dashboard</Link>
      </header>
      <nav className="module-shell-nav" aria-label="Navigasi modul">
        {navigation.map(({ href, label, icon: Icon }) => <Link href={href} key={href}><Icon size={16} /><span>{label}</span></Link>)}
      </nav>
      {children}
      <footer className="module-shell-footer">© 2026 KOPPKAS · PEMUDA KAMPUNG SAWAH KAUM</footer>
    </div>
  );
}