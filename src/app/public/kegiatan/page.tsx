import Link from "next/link";
import { ArrowLeft, CalendarDays, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PublicEventsPage() {
  let events: Array<{ id: string; title: string; description: string | null; location: string | null; starts_at: string | null; status: string }> = [];
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("events")
      .select("id, title, description, location, starts_at, status")
      .in("status", ["terbit", "berlangsung", "menunggu_laporan", "selesai"])
      .order("starts_at", { ascending: false }).limit(50);
    events = data ?? [];
  } catch {
    // Public listing remains gracefully empty until backend connection.
  }

  return (
    <main className="public-events">
      <header><Link href="/public"><ArrowLeft size={16} /> PEMUDA KAMPUNG SAWAH KAUM</Link><Link href="/public/contact">Hubungi pengurus</Link></header>
      <section className="public-events-content"><p className="eyebrow">PROGRAM & AKTIVITAS</p><h1>Kegiatan<br /><span>organisasi.</span></h1><p className="public-events-lead">Informasi kegiatan yang telah disetujui untuk ditampilkan kepada masyarakat.</p>
        <div className="public-event-list">{events.length ? events.map((event) => <article key={event.id}><span className="public-event-date"><CalendarDays size={17} />{event.starts_at ? new Date(event.starts_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "Jadwal menyusul"}</span><div><h2>{event.title}</h2><p>{event.description || "Informasi kegiatan akan diperbarui oleh pengurus."}</p>{event.location && <small><MapPin size={13} /> {event.location}</small>}</div></article>) : <p className="public-empty">Belum ada kegiatan yang diterbitkan.</p>}</div>
      </section>
      <footer>© 2026 PEMUDA KAMPUNG SAWAH KAUM · RT 01 / RW 01</footer>
    </main>
  );
}