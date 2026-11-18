"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Activity, BookOpenText, CalendarDays, ChevronRight, ContactRound, FileText,
  FolderKanban, HandCoins, House, Inbox, Landmark, Menu, Megaphone,
  MoreHorizontal, ShieldCheck, UsersRound, Wallet, X
} from "lucide-react";

type Item = { href: string; label: string };
const iconFor: Record<string, typeof House> = {
  "/dashboard": House, "/dashboard/keanggotaan": UsersRound,
  "/dashboard/struktur": ContactRound, "/dashboard/kegiatan": CalendarDays,
  "/dashboard/keuangan": Wallet, "/dashboard/uang-keseluruhan": Landmark,
  "/dashboard/uang-kas-bulanan": HandCoins, "/dashboard/keuangan-kegiatan": HandCoins,
  "/dashboard/surat-dokumen": FileText, "/dashboard/pengumuman": Megaphone,
  "/dashboard/dokumentasi": FolderKanban, "/dashboard/laporan": BookOpenText,
  "/dashboard/riwayat-aktivitas": Activity, "/dashboard/inbox": Inbox,
  "/dashboard/notifikasi": Inbox, "/dashboard/akun": ShieldCheck,
};
const mobilePrimary = ["/dashboard", "/dashboard/keanggotaan", "/dashboard/kegiatan", "/dashboard/uang-kas-bulanan"];

export function ModuleNavigation({ items }: { items: Item[] }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const primary = mobilePrimary.map((href) => items.find((item) => item.href === href)).filter((item): item is Item => Boolean(item));
  const extras = items.filter((item) => !mobilePrimary.includes(item.href));
  const renderLink = (item: Item) => {
    const Icon = iconFor[item.href] ?? Menu;
    const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
    return <Link href={item.href} key={item.href} className={"module-nav-link " + (active ? "active" : "")} aria-current={active ? "page" : undefined} onClick={() => setMoreOpen(false)}>
      <Icon size={18} strokeWidth={1.8} /><span>{item.label}</span>
    </Link>;
  };
  return <>
    <aside className="module-shell-sidebar">
      <div className="module-sidebar-heading"><span className="module-sidebar-mark">K</span><div><strong>KOPPKAS</strong><small>RUANG ORGANISASI</small></div></div>
      <p className="module-sidebar-caption">NAVIGASI UTAMA</p>
      <nav aria-label="Navigasi modul" className="module-sidebar-links">{items.map(renderLink)}</nav>
      <Link href="/dashboard" className="module-sidebar-return"><ChevronRight size={16} /> Kembali ke beranda</Link>
    </aside>
    <nav className="module-mobile-nav" aria-label="Navigasi cepat">
      {primary.map((item) => {
        const Icon = iconFor[item.href] ?? Menu;
        const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
        return <Link href={item.href} key={item.href} className={"module-nav-link " + (active ? "active" : "")} aria-current={active ? "page" : undefined}>
          <Icon size={18} strokeWidth={1.8} /><span>{item.label === "Keanggotaan" ? "Anggota" : item.label === "Kegiatan" ? "Kegiatan" : item.label === "Uang Kas Bulanan" ? "Kas Bulanan" : "Beranda"}</span>
        </Link>;
      })}
      <button type="button" className={"module-nav-link module-more-button " + (moreOpen ? "active" : "")} aria-expanded={moreOpen} aria-controls="module-more-menu" onClick={() => setMoreOpen((value) => !value)}>
        {moreOpen ? <X size={18} /> : <MoreHorizontal size={18} />}<span>Lainnya</span>
      </button>
    </nav>
    {moreOpen && <><button className="module-more-scrim" aria-label="Tutup menu lainnya" onClick={() => setMoreOpen(false)} /><div className="module-more-menu" id="module-more-menu">
      <p>MODUL LAINNYA</p>{extras.map(renderLink)}
    </div></>}
  </>;
}
