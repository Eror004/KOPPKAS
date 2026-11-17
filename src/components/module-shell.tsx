import Link from "next/link";
import { Activity, ArrowLeft, BookOpenText, CalendarDays, Command, ContactRound, FileText, FolderKanban, HandCoins, House, Inbox, Landmark, Megaphone, UsersRound, Wallet } from "lucide-react";
import { can, type ModuleKey } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/require-user";

const navigation: Array<{ href: string; label: string; icon: typeof House; module: ModuleKey }> = [
  { href: "/dashboard", label: "Beranda", icon: House, module: "dashboard" },
  { href: "/dashboard/keanggotaan", label: "Anggota", icon: UsersRound, module: "members" },
  { href: "/dashboard/struktur", label: "Struktur", icon: ContactRound, module: "structure" },
  { href: "/dashboard/kegiatan", label: "Kegiatan", icon: CalendarDays, module: "events" },
  { href: "/dashboard/keuangan", label: "Keuangan", icon: Wallet, module: "general_finance" },
  { href: "/dashboard/uang-keseluruhan", label: "Uang Keseluruhan", icon: Landmark, module: "general_finance" },
  { href: "/dashboard/uang-kas-bulanan", label: "Kas Bulanan", icon: HandCoins, module: "monthly_dues" },
  { href: "/dashboard/keuangan-kegiatan", label: "Kas Kegiatan", icon: HandCoins, module: "event_finance" },
  { href: "/dashboard/surat-dokumen", label: "Surat", icon: FileText, module: "letters" },
  { href: "/dashboard/pengumuman", label: "Pengumuman", icon: Megaphone, module: "announcements" },
  { href: "/dashboard/dokumentasi", label: "Dokumentasi", icon: FolderKanban, module: "media" },
  { href: "/dashboard/laporan", label: "Laporan", icon: BookOpenText, module: "reports" },
  { href: "/dashboard/riwayat-aktivitas", label: "Aktivitas", icon: Activity, module: "activity" },
  { href: "/dashboard/inbox", label: "INBOX", icon: Inbox, module: "inbox" },
  { href: "/dashboard/notifikasi", label: "Notifikasi", icon: Inbox, module: "notifications" },
];

export async function ModuleShell({ title, children }: { title: string; children: React.ReactNode }) {
  const user = await requireUser();
  const visibleNavigation = navigation.filter((item) => can(user.role, item.module));

  return (
    <div className="module-shell">
      <header className="module-shell-header">
        <Link href="/dashboard" className="module-shell-brand"><span><Command size={17} /></span><strong>KOPPKAS</strong></Link>
        <div className="module-shell-current">WORKSPACE <span>/</span> {title.toUpperCase()}</div>
        <Link href="/dashboard" className="module-shell-back"><ArrowLeft size={15} /> Dashboard</Link>
      </header>
      <nav className="module-shell-nav" aria-label="Navigasi modul">
        {visibleNavigation.map(({ href, label, icon: Icon }) => <Link href={href} key={href}><Icon size={16} /><span>{label}</span></Link>)}
      </nav>
      {children}
      <footer className="module-shell-footer">© 2026 KOPPKAS · PEMUDA KAMPUNG SAWAH KAUM</footer>
    </div>
  );
}