import { can, type ModuleKey } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/require-user";
import { ModuleNavigation } from "@/components/module-navigation";

const navigation: Array<{ href: string; label: string; module: ModuleKey }> = [
  { href: "/dashboard", label: "Beranda", module: "dashboard" },
  { href: "/dashboard/keanggotaan", label: "Keanggotaan", module: "members" },
  { href: "/dashboard/struktur", label: "Struktur", module: "structure" },
  { href: "/dashboard/kegiatan", label: "Kegiatan", module: "events" },
  { href: "/dashboard/keuangan", label: "Keuangan", module: "general_finance" },
  { href: "/dashboard/uang-keseluruhan", label: "Uang Keseluruhan", module: "general_finance" },
  { href: "/dashboard/uang-kas-bulanan", label: "Uang Kas Bulanan", module: "monthly_dues" },
  { href: "/dashboard/keuangan-kegiatan", label: "Kas Kegiatan", module: "event_finance" },
  { href: "/dashboard/surat-dokumen", label: "Surat & Dokumen", module: "letters" },
  { href: "/dashboard/pengumuman", label: "Pengumuman", module: "announcements" },
  { href: "/dashboard/dokumentasi", label: "Dokumentasi", module: "media" },
  { href: "/dashboard/laporan", label: "Laporan", module: "reports" },
  { href: "/dashboard/riwayat-aktivitas", label: "Aktivitas", module: "activity" },
  { href: "/dashboard/inbox", label: "INBOX", module: "inbox" },
  { href: "/dashboard/notifikasi", label: "Notifikasi", module: "notifications" },
];

export async function ModuleShell({ title, children }: { title: string; children: React.ReactNode }) {
  const user = await requireUser();
  const visibleNavigation = navigation.filter((item) => can(user.role, item.module));
  return (
    <div className="module-shell">
      <ModuleNavigation items={visibleNavigation.map(({ href, label }) => ({ href, label }))} />
      <div className="module-shell-main">
        <header className="module-shell-header">
          <Link href="/dashboard" className="module-shell-brand"><span><Command size={18} /></span><strong>KOPPKAS</strong></Link>
          <div className="module-shell-current"><span>RUANG KERJA</span><i aria-hidden="true">/</i>{title}</div>
          <div className="module-shell-role">{user.role.replaceAll("_", " ")}</div>
        </header>
        <main className="module-shell-content">{children}</main>
        <footer className="module-shell-footer">© 2026 KOPPKAS · PEMUDA KAMPUNG SAWAH KAUM</footer>
      </div>
    </div>
  );
}
