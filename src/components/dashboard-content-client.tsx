"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { dashboardCashDisplay, type DashboardCashState } from "./monthly-dues/dashboard-cash-state";
import type { ModuleKey } from "@/lib/auth/permissions";
import type { NavigationItem } from "./dashboard-navigation";
import { Status } from "./ui/status";
import { ArrowDownRight, ArrowUpRight, Bell, CalendarDays, ChevronRight, HandCoins, Inbox, Search, ShieldCheck, UsersRound } from "lucide-react";

type DashboardStats = {
  members: number | null;
  events: number | null;
  monthlyCollected: DashboardCashState;
  newMessages: number | null;
};

export function DashboardContentClient({ stats, items, todayLabel, monthLabel }: { stats: DashboardStats; items: NavigationItem[]; todayLabel: string; monthLabel: string }) {
  const has = (module: ModuleKey) => items.some(item => item.module === module);
  const cashDisplay = dashboardCashDisplay(has("monthly_dues") ? stats.monthlyCollected : { kind: "restricted" });
  const router = useRouter();
  const [active, setActive] = useState("Beranda");
  const [search, setSearch] = useState("");

  const searchResults = search.trim() ? items.filter((item) => item.label.toLowerCase().includes(search.trim().toLowerCase())) : [];
  const quickAccessCount = [
    has("members"),
    has("events"),
    has("monthly_dues"),
    has("inbox"),
  ].filter(Boolean).length;

  const chooseModule = (label: string) => {
    setActive(label);
    const item = items.find(item => item.label === label);
    if (item) router.push(item.href);
  };

  return (
    <main className="dashboard-home">
      <section className="dashboard-main-panel">
        <header className="topbar">
          <div className="topbar-left">
            <div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>{active}</strong></div>
          </div>
          <div className="topbar-actions">
            <div className="search-wrap"><label className="search-box"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari menu..." aria-label="Cari menu" /></label>{search.trim() && <div className="search-results">{searchResults.length ? searchResults.map((item) => <button key={item.label} onClick={() => { chooseModule(item.label); setSearch(""); }}>{item.label}<ChevronRight size={14} /></button>) : <p>Menu tidak ditemukan</p>}</div>}</div>
            {has("notifications") && <button className="icon-button notification-button" aria-label="Notifikasi" onClick={() => chooseModule("Notifikasi")}><Bell size={19} /></button>}
            <div className="top-avatar">KP</div>
          </div>
        </header>

        <div className="content">
          {(
            <>
              <div className="welcome-row">
                <div><p className="eyebrow">{todayLabel}</p><h1>Ruang kendali<br /><span>organisasi.</span></h1><p className="welcome-subtitle">Satu ruang untuk mengelola kegiatan, administrasi, dan keuangan Pemuda Kampung Sawah Kaum.</p></div>
                <div className="welcome-stamp"><ShieldCheck size={18} /><span>ORGANIZATION<br />WORKSPACE</span></div>
              </div>

              <div className="section-heading"><div><p className="eyebrow">OVERVIEW</p><h2>Ringkasan organisasi</h2></div><span className="period-button">{monthLabel}</span></div>

              <div className="metric-grid">
                <article className="metric-card members-card"><div className="metric-top"><span>KEANGGOTAAN</span><UsersRound size={18} /></div><div className="metric-value">{stats.members ?? "—"}</div><div className="metric-foot"><span>{stats.members === null ? "Data anggota belum tersedia" : "Anggota aktif"}</span><span className="metric-arrow"><ArrowUpRight size={16} /></span></div><div className="metric-line blue-line" /></article>
                <article className="metric-card activity-card"><div className="metric-top"><span>KEGIATAN</span><CalendarDays size={18} /></div><div className="metric-value">{stats.events ?? "—"}</div><div className="metric-foot"><span>{stats.events === null ? "Data kegiatan belum tersedia" : "Kegiatan tercatat"}</span><span className="metric-arrow"><ArrowUpRight size={16} /></span></div><div className="metric-line cyan-line" /></article>
                <article className="metric-card cash-card"><div className="metric-top"><span>KAS BULANAN</span><HandCoins size={18} /></div><div className="metric-value">{cashDisplay.value}</div><div className="metric-foot"><span>{cashDisplay.label}</span><span className="metric-arrow"><ArrowDownRight size={16} /></span></div><div className="metric-line pink-line" /></article>
                <article className="metric-card inbox-card"><div className="metric-top"><span>PESAN MASUK</span><Inbox size={18} /></div><div className="metric-value">{stats.newMessages ?? "—"}</div><div className="metric-foot"><span>{stats.newMessages === null ? "Data inbox belum tersedia" : "Pesan baru"}</span><span className="metric-arrow"><ArrowUpRight size={16} /></span></div><div className="metric-line orange-line" /></article>
              </div>

              <div className="dashboard-grid">
                <section className="panel-card activity-panel">
                  <div className="panel-heading"><div><p className="eyebrow">PUSAT AKTIVITAS</p><h3>Aktivitas terbaru</h3></div>{has("activity") && <button className="text-button" onClick={() => chooseModule("Riwayat Aktivitas")}>Lihat riwayat <ChevronRight size={15} /></button>}</div>
                  <Status kind="empty" title="Riwayat tidak ditampilkan di ringkasan">{has("activity") ? "Buka riwayat untuk melihat aktivitas organisasi." : "Riwayat aktivitas tidak tersedia untuk akun ini."}</Status>
                </section>
                <section className="panel-card quick-panel">
                  <div className="panel-heading"><div><p className="eyebrow">AKSES CEPAT</p><h3>Mulai dari sini</h3></div><span className="panel-count">{String(quickAccessCount).padStart(2, "0")}</span></div>
                  <div className="quick-list">
                    {has("members") && <button onClick={() => chooseModule("Keanggotaan")}><span className="quick-icon q-blue"><UsersRound size={18} /></span><span><strong>Kelola anggota</strong><small>Data dan kelengkapan anggota</small></span><ChevronRight size={16} /></button>}
                    {has("events") && <button onClick={() => chooseModule("Kegiatan")}><span className="quick-icon q-cyan"><CalendarDays size={18} /></span><span><strong>Ruang kegiatan</strong><small>Program dan kepanitiaan</small></span><ChevronRight size={16} /></button>}
                    {has("monthly_dues") && <button onClick={() => chooseModule("Uang Kas Bulanan")}><span className="quick-icon q-pink"><HandCoins size={18} /></span><span><strong>Kas bulanan</strong><small>Pencatatan pembayaran anggota</small></span><ChevronRight size={16} /></button>}
                    {has("inbox") && <button onClick={() => chooseModule("Inbox")}><span className="quick-icon q-orange"><Inbox size={18} /></span><span><strong>Public inbox</strong><small>Pesan dari masyarakat</small></span><ChevronRight size={16} /></button>}
                  </div>
                </section>
              </div>


            </>
          )}
          <footer className="footer"><span>© 2026 KOPPKAS · PEMUDA KAMPUNG SAWAH KAUM</span><span>BUILDING A BETTER COMMUNITY</span></footer>
        </div>
      </section>
    </main>
  );
}