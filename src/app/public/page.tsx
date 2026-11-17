import Link from "next/link";
import { ArrowRight, MessageCircle, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PublicHomePage() {
  let announcements: Array<{ id: string; title: string; body: string; published_at: string | null }> = [];
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("announcements")
      .select("id, title, body, published_at")
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .limit(5);
    announcements = data ?? [];
  } catch {
    // Public information remains readable while the backend is being configured.
  }

  return (
    <main className="public-home">
      <header className="public-home-header"><Link href="/public" className="public-logo"><span>PK</span><strong>PEMUDA KAMPUNG<br />SAWAH KAUM</strong></Link><nav className="public-header-nav"><Link href="/public/kegiatan">Kegiatan</Link><Link href="/public/contact" className="public-contact-link">Hubungi pengurus <ArrowRight size={15} /></Link></nav></header>
      <section className="public-hero"><p className="eyebrow">RT 01 / RW 01 · KAMPUNG SAWAH KAUM</p><h1>Bersama membangun<br /><span>lingkungan yang lebih baik.</span></h1><p>Ruang informasi dan komunikasi resmi Pemuda Kampung Sawah Kaum.</p><div className="public-hero-actions"><Link href="/public/kegiatan" className="public-secondary">Lihat kegiatan</Link><Link href="/public/contact" className="public-primary">Sampaikan pesan <ArrowRight size={17} /></Link></div><div className="public-hero-mark"><ShieldCheck size={24} /><span>TERBUKA · TERHUBUNG · TERORGANISASI</span></div></section>
      <section className="public-announcements"><div><p className="eyebrow">INFORMASI TERKINI</p><h2>Pengumuman</h2></div>{announcements.length ? announcements.map((item) => <article key={item.id}><time>{item.published_at ? new Date(item.published_at).toLocaleDateString("id-ID") : "Informasi"}</time><h3>{item.title}</h3><p>{item.body}</p></article>) : <p className="public-empty">Belum ada pengumuman yang diterbitkan.</p>}</section>
      <footer className="public-footer"><span>© 2026 PEMUDA KAMPUNG SAWAH KAUM</span><Link href="/public/contact"><MessageCircle size={15} /> PUBLIC CONTACT CENTER</Link></footer>
    </main>
  );
}