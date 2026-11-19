import { ArrowLeft, MessageCircle } from "lucide-react";
import Link from "next/link";

export default function PublicContactPage() {
  return (
    <main className="contact-shell">
      <header className="contact-header"><Link href="/"><ArrowLeft size={17} /> KOPPKAS</Link><span>PUBLIC CONTACT CENTER</span></header>
      <section className="contact-content">
        <p className="eyebrow">KANAL RESMI ORGANISASI</p>
        <h1>Hubungi<br /><span>KOPPKAS.</span></h1>
        <p className="contact-lead">Untuk saat ini, komunikasi publik hanya melalui WhatsApp resmi organisasi.</p>
        <div className="contact-form contact-whatsapp">
          <MessageCircle size={26} />
          <h2>WhatsApp resmi</h2>
          <p>Nomor WhatsApp resmi organisasi belum dikonfigurasi. Kanal ini akan diaktifkan setelah nomor resmi ditetapkan oleh pengurus.</p>
          <button type="button" disabled>WhatsApp belum tersedia</button>
        </div>
      </section>
      <footer className="contact-footer">KOPPKAS · KELOMPOK PENGGERAK PEMUDA KAMPUNG SAWAH 01</footer>
    </main>
  );
}
