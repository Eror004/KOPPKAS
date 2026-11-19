"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { can, type ModuleKey } from "@/lib/auth/permissions";
import { ROLE_LABELS, type AppRole } from "@/lib/auth/roles";
import {
  Activity, Bell, BookOpenText, CalendarDays, ChevronDown, ChevronRight,
  CircleHelp, Command, ContactRound, FileText, FolderKanban, HandCoins,
  House, Inbox, Landmark, Menu, MessageSquareText, MoreHorizontal, Search,
  ShieldCheck, UsersRound, Wallet, X
} from "lucide-react";

type NavItem = { label: string; icon: typeof House };
const primaryNav: NavItem[] = [
  { label: "Beranda", icon: House }, { label: "Keanggotaan", icon: UsersRound },
  { label: "Struktur", icon: ContactRound }, { label: "Kegiatan", icon: CalendarDays },
];
const financeNav: NavItem[] = [
  { label: "Uang Kas Bulanan", icon: HandCoins }, { label: "Keuangan", icon: Wallet },
  { label: "Uang Keseluruhan", icon: Landmark },
];
const workspaceNav: NavItem[] = [
  { label: "Surat & Dokumen", icon: FileText }, { label: "Pengumuman", icon: MessageSquareText },
  { label: "Dokumentasi", icon: FolderKanban }, { label: "Laporan", icon: BookOpenText },
];
const utilityNav: NavItem[] = [
  { label: "Inbox", icon: Inbox }, { label: "Notifikasi", icon: Bell },
  { label: "Riwayat Aktivitas", icon: Activity },
];
const accountNav: NavItem[] = [{ label: "Manajemen Akun", icon: ShieldCheck }];
const allModules = [...primaryNav, ...financeNav, ...workspaceNav, ...utilityNav, ...accountNav];
const moduleByLabel: Record<string, ModuleKey> = {
  Beranda: "dashboard", Keanggotaan: "members", Struktur: "structure", Kegiatan: "events",
  "Uang Kas Bulanan": "monthly_dues", Keuangan: "general_finance", "Uang Keseluruhan": "general_finance",
  "Surat & Dokumen": "letters", Pengumuman: "announcements", Dokumentasi: "media", Laporan: "reports",
  Inbox: "inbox", Notifikasi: "notifications", "Riwayat Aktivitas": "activity", "Manajemen Akun": "accounts",
};
const routes: Record<string, string> = {
  Beranda: "/dashboard", Keanggotaan: "/dashboard/keanggotaan", Struktur: "/dashboard/struktur",
  Kegiatan: "/dashboard/kegiatan", "Uang Kas Bulanan": "/dashboard/uang-kas-bulanan",
  Keuangan: "/dashboard/keuangan", "Uang Keseluruhan": "/dashboard/uang-keseluruhan",
  "Surat & Dokumen": "/dashboard/surat-dokumen", Pengumuman: "/dashboard/pengumuman",
  Dokumentasi: "/dashboard/dokumentasi", Laporan: "/dashboard/laporan", Inbox: "/dashboard/inbox",
  Notifikasi: "/dashboard/notifikasi", "Riwayat Aktivitas": "/dashboard/riwayat-aktivitas",
  "Manajemen Akun": "/dashboard/akun",
};

function NavGroup({ title, items, role, onSelect }: {
  title: string; items: NavItem[]; role: AppRole; onSelect: (label: string) => void;
}) {
  const visible = items.filter((item) => can(role, moduleByLabel[item.label]));
  if (!visible.length) return null;
  return (
    <section className="nav-group" aria-label={title}>
      <p className="nav-caption">{title}</p>
      {visible.map(({ label, icon: Icon }) => (
        <button key={label} className="nav-link" onClick={() => onSelect(label)}>
          <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
        </button>
      ))}
    </section>
  );
}

export function DashboardHomeClient({ role }: { role: AppRole }) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchResults = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("id");
    return query ? allModules.filter((item) => can(role, moduleByLabel[item.label]) && item.label.toLocaleLowerCase("id").includes(query)) : [];
  }, [role, search]);

  const chooseModule = (label: string) => {
    setMobileOpen(false);
    const route = routes[label];
    if (route) router.push(route);
  };

  const quickAccess = [
    { label: "Uang Kas Bulanan", description: "Catat pembayaran dan pantau status anggota", icon: HandCoins, module: "monthly_dues" as ModuleKey, primary: true },
    { label: "Keanggotaan", description: "Data anggota dan kelengkapan profil", icon: UsersRound, module: "members" as ModuleKey },
    { label: "Kegiatan", description: "Program kerja dan kepanitiaan", icon: CalendarDays, module: "events" as ModuleKey },
    { label: "Keuangan", description: "Pembukuan organisasi", icon: Wallet, module: "general_finance" as ModuleKey },
  ].filter((item) => can(role, item.module, "read"));

  return (
    <main className="app-shell">
      <aside className={"sidebar " + (mobileOpen ? "sidebar-open" : "")}>
        <div className="brand">
          <div className="brand-mark"><Command size={21} strokeWidth={2.3} /></div>
          <div><strong>KOPPKAS</strong><span>PEMUDA KAMPUNG SAWAH KAUM</span></div>
          <button className="mobile-close icon-button" onClick={() => setMobileOpen(false)} aria-label="Tutup menu"><X size={19} /></button>
        </div>
        <div className="workspace-switch">
          <div className="workspace-avatar">PK</div>
          <div className="workspace-copy"><strong>Ruang Organisasi</strong><span>Kampung Sawah Kaum</span></div>
          <ChevronDown size={16} />
        </div>
        <nav className="sidebar-nav" aria-label="Navigasi utama">
          <NavGroup title="UTAMA" items={primaryNav} role={role} onSelect={chooseModule} />
          <NavGroup title="KEUANGAN" items={financeNav} role={role} onSelect={chooseModule} />
          <NavGroup title="ADMINISTRASI" items={workspaceNav} role={role} onSelect={chooseModule} />
          <NavGroup title="KOMUNIKASI & SISTEM" items={utilityNav} role={role} onSelect={chooseModule} />
          <NavGroup title="PENGELOLAAN AKUN" items={accountNav} role={role} onSelect={chooseModule} />
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card"><div className="help-icon"><CircleHelp size={17} /></div><div><strong>Pusat bantuan</strong><span>Panduan penggunaan sistem</span></div><ChevronRight size={15} /></div>
          <div className="profile-row">
            <div className="profile-avatar">KP</div>
            <div className="profile-copy"><strong>{ROLE_LABELS[role]}</strong><span>Pengurus aktif</span></div>
            <MoreHorizontal size={19} />
          </div>
        </div>
      </aside>
      {mobileOpen && <button className="mobile-scrim" aria-label="Tutup navigasi" onClick={() => setMobileOpen(false)} />}
      <section className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Buka menu"><Menu size={21} /></button>
            <div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>Beranda</strong></div>
          </div>
          <div className="topbar-actions">
            <div className="search-wrap">
              <label className="search-box"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari menu..." aria-label="Cari menu" /><kbd>MENU</kbd></label>
              {search.trim() && <div className="search-results" role="listbox" aria-label="Hasil pencarian menu">
                {searchResults.length ? searchResults.map((item) => <button key={item.label} onClick={() => { chooseModule(item.label); setSearch(""); }}>{item.label}<ChevronRight size={14} /></button>) : <p>Menu tidak ditemukan</p>}
              </div>}
            </div>
            <div className="top-avatar" aria-label={ROLE_LABELS[role]}>KP</div>
          </div>
        </header>
        <div className="content dashboard-content">
          <section className="welcome-row">
            <div>
              <p className="eyebrow">PANEL PENGURUS / {ROLE_LABELS[role].toLocaleUpperCase("id")}</p>
              <h1>Selamat datang<br /><span>di ruang organisasi.</span></h1>
              <p className="welcome-subtitle">Kelola kegiatan, administrasi, keanggotaan, dan keuangan Pemuda Kampung Sawah Kaum dari satu tempat.</p>
            </div>
            <div className="welcome-stamp"><ShieldCheck size={19} /><span>AKSES SESUAI<br />WEWENANG JABATAN</span></div>
          </section>
          <section className="dues-feature" aria-label="Akses cepat uang kas bulanan">
            <div className="dues-feature-icon"><HandCoins size={22} /></div>
            <div className="dues-feature-copy">
              <p className="eyebrow">OPERASIONAL RUTIN</p>
              <h2>Uang Kas Bulanan</h2>
              <p>Pencatatan pembayaran sukarela, pemantauan status bulanan, dan rekap kas anggota.</p>
            </div>
            {can(role, "monthly_dues", "read") && <button onClick={() => chooseModule("Uang Kas Bulanan")}>Buka modul <ChevronRight size={16} /></button>}
          </section>
          <section className="section-heading">
            <div><p className="eyebrow">AKSES MODUL</p><h2>Ruang kerja</h2></div>
            <span className="section-note">Menu ditampilkan sesuai hak akses jabatan</span>
          </section>
          <div className="quick-grid">
            {quickAccess.map(({ label, description, icon: Icon, primary }) => (
              <button className={"quick-card " + (primary ? "quick-card-primary" : "")} key={label} onClick={() => chooseModule(label)}>
                <span className="quick-card-icon"><Icon size={21} strokeWidth={1.8} /></span>
                <span className="quick-card-copy"><strong>{label}</strong><small>{description}</small></span>
                <ChevronRight size={17} className="quick-card-arrow" />
              </button>
            ))}
          </div>
          <section className="dashboard-lower">
            <div className="dashboard-note">
              <div className="dashboard-note-icon"><Activity size={19} /></div>
              <div><strong>Aktivitas organisasi</strong><p>Gunakan modul terkait untuk melihat catatan dan pembaruan operasional. Ringkasan aktivitas akan ditampilkan di sini setelah sumber datanya tersedia.</p></div>
            </div>
            <div className="dashboard-note">
              <div className="dashboard-note-icon"><ShieldCheck size={19} /></div>
              <div><strong>Ruang kerja terlindungi</strong><p>Menu dan tindakan dibatasi berdasarkan jabatan. Jika membutuhkan akses tambahan, hubungi Ketua Pemuda.</p></div>
            </div>
          </section>
          <footer className="footer"><span>© 2026 KOPPKAS · PEMUDA KAMPUNG SAWAH KAUM</span><span>BERSAMA MEMBANGUN ORGANISASI</span></footer>
        </div>
      </section>
    </main>
  );
}
