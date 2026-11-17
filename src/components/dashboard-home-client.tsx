"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { can, type ModuleKey } from "@/lib/auth/permissions";
import { ROLE_LABELS, type AppRole } from "@/lib/auth/roles";
import {
  Activity, ArrowDownRight, ArrowUpRight, Bell, BookOpenText, CalendarDays,
  ChevronDown, ChevronRight, CircleHelp, Command, ContactRound, FileCheck2,
  FileText, FolderKanban, HandCoins, House, Inbox, Landmark, LayoutGrid,
  Menu, MessageSquareText, MoreHorizontal, Search, ShieldCheck,
  UsersRound, Wallet, X
} from "lucide-react";

type NavItem = { label: string; icon: typeof House; section?: string };

const primaryNav: NavItem[] = [
  { label: "Beranda", icon: House },
  { label: "Keanggotaan", icon: UsersRound },
  { label: "Struktur", icon: ContactRound },
  { label: "Kegiatan", icon: CalendarDays },
];
const financeNav: NavItem[] = [
  { label: "Uang Keseluruhan", icon: Landmark },
  { label: "Uang Kas Bulanan", icon: HandCoins },
  { label: "Keuangan", icon: Wallet },
];
const workspaceNav: NavItem[] = [
  { label: "Surat & Dokumen", icon: FileText },
  { label: "Pengumuman", icon: MessageSquareText },
  { label: "Dokumentasi", icon: FolderKanban },
  { label: "Laporan", icon: BookOpenText },
];
const utilityNav: NavItem[] = [
  { label: "Inbox", icon: Inbox },
  { label: "Notifikasi", icon: Bell },
  { label: "Riwayat Aktivitas", icon: Activity },
];
const allModules = [...primaryNav, ...financeNav, ...workspaceNav, ...utilityNav];
const moduleByLabel: Record<string, ModuleKey> = {
  "Beranda": "dashboard", "Keanggotaan": "members", "Struktur": "structure", "Kegiatan": "events",
  "Uang Keseluruhan": "general_finance", "Keuangan": "general_finance", "Uang Kas Bulanan": "monthly_dues",
  "Surat & Dokumen": "letters", "Pengumuman": "announcements", "Dokumentasi": "media", "Laporan": "reports",
  "Inbox": "inbox", "Notifikasi": "notifications", "Riwayat Aktivitas": "activity",
};

function NavGroup({ title, items, active, role, onSelect }: {
  title: string; items: NavItem[]; active: string; role: AppRole; onSelect: (label: string) => void;
}) {
  return (
    <div className="nav-group">
      <p className="nav-caption">{title}</p>
      {items.filter((item) => can(role, moduleByLabel[item.label])).map(({ label, icon: Icon }) => (
        <button key={label} className={`nav-link ${active === label ? "active" : ""}`} onClick={() => onSelect(label)}>
          <Icon size={18} strokeWidth={1.8} />
          <span>{label}</span>
          {label === "Inbox" && <span className="nav-dot" aria-label="Pesan baru" />}
        </button>
      ))}
    </div>
  );
}

function EmptyModule({ name }: { name: string }) {
  return (
    <section className="module-placeholder">
      <div className="placeholder-icon"><LayoutGrid size={22} /></div>
      <p className="eyebrow">RUANG KERJA MODUL</p>
      <h2>{name}</h2>
      <p>Modul ini akan dibangun bertahap sesuai alur kerja dan hak akses setiap jabatan.</p>
    </section>
  );
}

export function DashboardHomeClient({ role }: { role: AppRole }) {
  const router = useRouter();
  const [active, setActive] = useState("Beranda");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");

  const searchResults = search.trim() ? allModules.filter((item) => can(role, moduleByLabel[item.label]) && item.label.toLowerCase().includes(search.trim().toLowerCase())) : [];

  const chooseModule = (label: string) => {
    setActive(label);
    setMobileOpen(false);
    const routes: Record<string, string> = {
      "Beranda": "/dashboard",
      "Keanggotaan": "/dashboard/keanggotaan",
      "Struktur": "/dashboard/struktur",
      "Kegiatan": "/dashboard/kegiatan",
      "Uang Keseluruhan": "/dashboard/uang-keseluruhan",
      "Keuangan": "/dashboard/keuangan",
      "Uang Kas Bulanan": "/dashboard/uang-kas-bulanan",
      "Inbox": "/dashboard/inbox",
      "Notifikasi": "/dashboard/notifikasi",
      "Surat & Dokumen": "/dashboard/surat-dokumen",
      "Pengumuman": "/dashboard/pengumuman",
      "Dokumentasi": "/dashboard/dokumentasi",
      "Laporan": "/dashboard/laporan",
      "Riwayat Aktivitas": "/dashboard/riwayat-aktivitas",
    };
    if (routes[label]) router.push(routes[label]);
  };

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><Command size={21} strokeWidth={2.3} /></div>
          <div><strong>KOPPKAS</strong><span>ORGANIZATION HUB</span></div>
          <button className="mobile-close icon-button" onClick={() => setMobileOpen(false)} aria-label="Tutup menu"><X size={19} /></button>
        </div>
        <div className="workspace-switch">
          <div className="workspace-avatar">PK</div>
          <div className="workspace-copy"><strong>Pemuda Kampung</strong><span>Sawah Kaum · RT 01 / RW 01</span></div>
          <ChevronDown size={16} />
        </div>
        <nav className="sidebar-nav" aria-label="Navigasi utama">
          <NavGroup title="MENU UTAMA" items={primaryNav} active={active} role={role} onSelect={chooseModule} />
          <NavGroup title="KEUANGAN" items={financeNav} active={active} role={role} onSelect={chooseModule} />
          <NavGroup title="ADMINISTRASI" items={workspaceNav} active={active} role={role} onSelect={chooseModule} />
          <NavGroup title="PUSAT INFORMASI" items={utilityNav} active={active} role={role} onSelect={chooseModule} />
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card"><div className="help-icon"><CircleHelp size={17} /></div><div><strong>Butuh bantuan?</strong><span>Pusat panduan penggunaan</span></div><ChevronRight size={15} /></div>
          <div className="profile-row">
            <div className="profile-avatar">KP</div>
            <div className="profile-copy"><strong>{ROLE_LABELS[role]}</strong><span>Akun pengurus aktif</span></div>
            <MoreHorizontal size={19} />
          </div>
        </div>
      </aside>

      {mobileOpen && <button className="mobile-scrim" aria-label="Tutup navigasi" onClick={() => setMobileOpen(false)} />}

      <section className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Buka menu"><Menu size={21} /></button>
            <div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>{active}</strong></div>
          </div>
          <div className="topbar-actions">
            <div className="search-wrap"><label className="search-box"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari menu..." aria-label="Cari menu" /><kbd>⌘ K</kbd></label>{search.trim() && <div className="search-results">{searchResults.length ? searchResults.map((item) => <button key={item.label} onClick={() => { chooseModule(item.label); setSearch(""); }}>{item.label}<ChevronRight size={14} /></button>) : <p>Menu tidak ditemukan</p>}</div>}</div>
            <button className="icon-button notification-button" aria-label="Notifikasi"><Bell size={19} /><i /></button>
            <div className="top-avatar">KP</div>
          </div>
        </header>

        <div className="content">
          {active === "Beranda" ? (
            <>
              <div className="welcome-row">
                <div><p className="eyebrow">SELASA, 17 NOVEMBER 2026</p><h1>Ruang kendali<br /><span>organisasi.</span></h1><p className="welcome-subtitle">Satu ruang untuk mengelola kegiatan, administrasi, dan keuangan Pemuda Kampung Sawah Kaum.</p></div>
                <div className="welcome-stamp"><ShieldCheck size={18} /><span>ORGANIZATION<br />WORKSPACE</span></div>
              </div>

              <div className="section-heading"><div><p className="eyebrow">OVERVIEW</p><h2>Ringkasan organisasi</h2></div><button className="period-button">November 2026 <ChevronDown size={15} /></button></div>

              <div className="metric-grid">
                <article className="metric-card members-card"><div className="metric-top"><span>KEANGGOTAAN</span><UsersRound size={18} /></div><div className="metric-value">—</div><div className="metric-foot"><span>Data anggota belum dimuat</span><span className="metric-arrow"><ArrowUpRight size={16} /></span></div><div className="metric-line blue-line" /></article>
                <article className="metric-card activity-card"><div className="metric-top"><span>KEGIATAN</span><CalendarDays size={18} /></div><div className="metric-value">—</div><div className="metric-foot"><span>Belum ada data kegiatan</span><span className="metric-arrow"><ArrowUpRight size={16} /></span></div><div className="metric-line cyan-line" /></article>
                <article className="metric-card cash-card"><div className="metric-top"><span>KAS BULANAN</span><HandCoins size={18} /></div><div className="metric-value">—</div><div className="metric-foot"><span>Menunggu koneksi data</span><span className="metric-arrow"><ArrowDownRight size={16} /></span></div><div className="metric-line pink-line" /></article>
                <article className="metric-card inbox-card"><div className="metric-top"><span>PESAN MASUK</span><Inbox size={18} /></div><div className="metric-value">—</div><div className="metric-foot"><span>Inbox belum terhubung</span><span className="metric-arrow"><ArrowUpRight size={16} /></span></div><div className="metric-line orange-line" /></article>
              </div>

              <div className="dashboard-grid">
                <section className="panel-card activity-panel">
                  <div className="panel-heading"><div><p className="eyebrow">PUSAT AKTIVITAS</p><h3>Aktivitas terbaru</h3></div><button className="text-button" onClick={() => chooseModule("Riwayat Aktivitas")}>Lihat riwayat <ChevronRight size={15} /></button></div>
                  <div className="empty-state"><div className="empty-art"><Activity size={25} /></div><strong>Belum ada aktivitas</strong><span>Aktivitas organisasi akan muncul di sini setelah sistem digunakan.</span></div>
                </section>
                <section className="panel-card quick-panel">
                  <div className="panel-heading"><div><p className="eyebrow">AKSES CEPAT</p><h3>Mulai dari sini</h3></div><span className="panel-count">04</span></div>
                  <div className="quick-list">
                    {can(role, "members", "read") && <button onClick={() => chooseModule("Keanggotaan")}><span className="quick-icon q-blue"><UsersRound size={18} /></span><span><strong>Kelola anggota</strong><small>Data dan kelengkapan anggota</small></span><ChevronRight size={16} /></button>}
                    {can(role, "events", "read") && <button onClick={() => chooseModule("Kegiatan")}><span className="quick-icon q-cyan"><CalendarDays size={18} /></span><span><strong>Ruang kegiatan</strong><small>Program dan kepanitiaan</small></span><ChevronRight size={16} /></button>}
                    {can(role, "monthly_dues", "read") && <button onClick={() => chooseModule("Uang Kas Bulanan")}><span className="quick-icon q-pink"><HandCoins size={18} /></span><span><strong>Kas bulanan</strong><small>Pencatatan pembayaran anggota</small></span><ChevronRight size={16} /></button>}
                    {can(role, "inbox", "read") && <button onClick={() => chooseModule("Inbox")}><span className="quick-icon q-orange"><Inbox size={18} /></span><span><strong>Public inbox</strong><small>Pesan dari masyarakat</small></span><ChevronRight size={16} /></button>}
                  </div>
                </section>
              </div>

              <section className="notice-strip"><div className="notice-symbol"><FileCheck2 size={19} /></div><div><strong>Fondasi sistem sedang disiapkan</strong><span>Data, autentikasi, dan kontrol akses akan diaktifkan setelah konfigurasi backend diselesaikan.</span></div><span className="notice-status">BUILD IN PROGRESS</span></section>
            </>
          ) : (
            <div className="module-view">
              <button className="back-link" onClick={() => chooseModule("Beranda")}><ChevronRight size={15} /> Kembali ke beranda</button>
              <EmptyModule name={active} />
            </div>
          )}
          <footer className="footer"><span>© 2026 KOPPKAS · PEMUDA KAMPUNG SAWAH KAUM</span><span>BUILDING A BETTER COMMUNITY</span></footer>
        </div>
      </section>
    </main>
  );
}