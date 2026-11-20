import type { ModuleKey } from "@/lib/auth/permissions";

export type NavigationItem = { href: string; label: string; icon: string; group: string; module: ModuleKey };

// Navigation visibility is a presentation aid; server authorization remains authoritative.
export const dashboardNavigation: NavigationItem[] = [
  { href: "/dashboard", label: "Beranda", icon: "house", group: "Menu utama", module: "dashboard" },
  { href: "/dashboard/keanggotaan", label: "Keanggotaan", icon: "users", group: "Menu utama", module: "members" },
  { href: "/dashboard/struktur", label: "Struktur", icon: "contact", group: "Menu utama", module: "structure" },
  { href: "/dashboard/kegiatan", label: "Kegiatan", icon: "calendar", group: "Menu utama", module: "events" },
  { href: "/dashboard/keuangan", label: "Keuangan", icon: "wallet", group: "Keuangan", module: "general_finance" },
  { href: "/dashboard/uang-keseluruhan", label: "Uang Keseluruhan", icon: "landmark", group: "Keuangan", module: "general_finance" },
  { href: "/dashboard/uang-kas-bulanan", label: "Uang Kas Bulanan", icon: "coins", group: "Keuangan", module: "monthly_dues" },
  { href: "/dashboard/keuangan-kegiatan", label: "Kas Kegiatan", icon: "coins", group: "Keuangan", module: "event_finance" },
  { href: "/dashboard/surat-dokumen", label: "Surat & Dokumen", icon: "file", group: "Administrasi", module: "letters" },
  { href: "/dashboard/pengumuman", label: "Pengumuman", icon: "megaphone", group: "Administrasi", module: "announcements" },
  { href: "/dashboard/dokumentasi", label: "Dokumentasi", icon: "folder", group: "Administrasi", module: "media" },
  { href: "/dashboard/laporan", label: "Laporan", icon: "book", group: "Administrasi", module: "reports" },
  { href: "/dashboard/inbox", label: "Inbox", icon: "inbox", group: "Pusat informasi", module: "inbox" },
  { href: "/dashboard/notifikasi", label: "Notifikasi", icon: "bell", group: "Pusat informasi", module: "notifications" },
  { href: "/dashboard/riwayat-aktivitas", label: "Riwayat Aktivitas", icon: "activity", group: "Pusat informasi", module: "activity" },
  { href: "/dashboard/keamanan-akun", label: "Keamanan Akun", icon: "shield", group: "Pusat informasi", module: "security" },
  { href: "/dashboard/akun", label: "Manajemen Akun", icon: "shield", group: "Administrasi sistem", module: "accounts" },
];
