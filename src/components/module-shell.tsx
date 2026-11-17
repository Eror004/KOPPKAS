import Link from "next/link";
import { ArrowLeft, CalendarDays, Command, FileText, HandCoins, House, Inbox, Landmark, Megaphone, UsersRound } from "lucide-react";

const navigation = [
  { href: "/", label: "Beranda", icon: House },
  { href: "/dashboard/keanggotaan", label: "Anggota", icon: UsersRound },
  { href: "/dashboard/kegiatan", label: "Kegiatan", icon: CalendarDays },
  { href: "/dashboard/uang-kas-bulanan", label: "Kas Bulanan", icon: HandCoins },
  { href: "/dashboard/keuangan", label: "Keuangan", icon: Landmark },
  { href: "/dashboard/surat-dokumen", label: "Surat", icon: FileText },
  { href: "/dashboard/pengumuman", label: "Pengumuman", icon: Megaphone },
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