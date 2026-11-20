"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Bell, BookOpenText, CalendarDays, ChevronLeft, ChevronRight, Command, ContactRound, FileText, FolderKanban, HandCoins, House, Inbox, Landmark, LayoutGrid, Megaphone, ShieldCheck, UsersRound, Wallet, X, type LucideIcon } from "lucide-react";
import type { NavigationItem } from "./dashboard-navigation";

const icons: Record<string, LucideIcon> = { activity: Activity, bell: Bell, book: BookOpenText, calendar: CalendarDays, contact: ContactRound, file: FileText, folder: FolderKanban, coins: HandCoins, house: House, inbox: Inbox, landmark: Landmark, megaphone: Megaphone, shield: ShieldCheck, users: UsersRound, wallet: Wallet };
const primary = ["/dashboard", "/dashboard/keanggotaan", "/dashboard/kegiatan", "/dashboard/inbox"];

export function DashboardShell({ items, children }: { items: NavigationItem[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key === "Tab") {
        const dialog = document.getElementById("dashboard-menu");
        const focusable = dialog?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
        if (!focusable?.length) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    const onResize = () => { if (window.matchMedia("(min-width: 701px)").matches) setOpen(false); };
    window.addEventListener("resize", onResize);
    document.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("resize", onResize); document.removeEventListener("keydown", onKey); previous?.focus(); };
  }, [open]);
  const groups = [...new Set(items.map(item => item.group))];
  const links = (className: string) => groups.map(group => <div className="foundation-nav-group" key={group}><p>{group}</p>{items.filter(item => item.group === group).map(item => {
    const Icon = icons[item.icon] || LayoutGrid;
    return <Link href={item.href} key={item.href} className={`${className} ${pathname === item.href ? "is-active" : ""}`} aria-current={pathname === item.href ? "page" : undefined} aria-label={item.label} title={collapsed ? item.label : undefined} onClick={() => setOpen(false)}><Icon size={19} aria-hidden="true" /><span>{item.label}</span></Link>;
  })}</div>);
  const bottom = primary.map(href => items.find(item => item.href === href)).filter((item): item is NavigationItem => Boolean(item));
  return <div className={`foundation-shell ${collapsed ? "is-collapsed" : ""}`}>
    <aside className="foundation-sidebar" aria-label="Navigasi desktop">
      <Link href="/dashboard" className="foundation-brand" aria-label="KOPPKAS — Beranda"><span><Command size={20} /></span><strong>KOPPKAS<small>RUANG ORGANISASI</small></strong></Link>
      <button className="foundation-collapse" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"} aria-expanded={!collapsed}>{collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}</button>
      <nav aria-label="Navigasi utama" className="foundation-nav">{links("foundation-link")}</nav>
      <div className="foundation-sidebar-foot">Pemuda Kampung Sawah Kaum</div>
    </aside>
    <div className="foundation-main">{children}</div>
    <nav className="foundation-bottom" aria-label="Navigasi mobile">
      {bottom.map(item => { const Icon = icons[item.icon] || LayoutGrid; return <Link key={item.href} href={item.href} className={pathname === item.href ? "is-active" : ""} aria-current={pathname === item.href ? "page" : undefined}><Icon size={20} aria-hidden="true" /><span>{item.href === "/dashboard/keanggotaan" ? "Anggota" : item.label}</span></Link>; })}
      <button ref={menuRef} className={items.some(item => item.href === pathname && !primary.includes(item.href)) ? "is-active" : undefined} onClick={() => setOpen(true)} aria-expanded={open} aria-controls="dashboard-menu"><LayoutGrid size={20} aria-hidden="true" /><span>Lainnya</span></button>
    </nav>
    {open && <div className="foundation-overlay" onClick={() => setOpen(false)}><div id="dashboard-menu" className="foundation-drawer" role="dialog" aria-modal="true" aria-labelledby="dashboard-menu-title" onClick={event => event.stopPropagation()}><div className="foundation-drawer-head"><div><span>RUANG ORGANISASI</span><h2 id="dashboard-menu-title">Semua menu</h2></div><button ref={closeRef} className="icon-button" onClick={() => setOpen(false)} aria-label="Tutup menu"><X size={20} /></button></div><nav aria-label="Semua menu">{links("foundation-link")}</nav></div></div>}
  </div>;
}
