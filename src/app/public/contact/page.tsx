"use client";

import { useActionState } from "react";
import { ArrowLeft, CheckCircle2, Send } from "lucide-react";
import Link from "next/link";
import { submitContact, type ContactState } from "./actions";

const initialState: ContactState = {};

export default function PublicContactPage() {
  const [state, action, pending] = useActionState(submitContact, initialState);

  return (
    <main className="contact-shell">
      <header className="contact-header"><Link href="/"><ArrowLeft size={17} /> KOPPKAS</Link><span>PUBLIC CONTACT CENTER</span></header>
      <section className="contact-content">
        <p className="eyebrow">SUARA WARGA · RUANG ASPIRASI</p>
        <h1>Ada yang ingin<br /><span>disampaikan?</span></h1>
        <p className="contact-lead">Kirim pertanyaan, saran, atau laporan kepada pengurus Pemuda Kampung Sawah Kaum. Pesan akan diteruskan ke INBOX pengurus.</p>
        {state.success ? (
          <div className="contact-success"><CheckCircle2 size={26} /><h2>Pesan berhasil dikirim.</h2><p>Terima kasih sudah menghubungi kami. Pengurus akan meninjau pesan yang masuk.</p><button onClick={() => window.location.reload()}>Kirim pesan lain</button></div>
        ) : (
          <form action={action} className="contact-form">
            <div className="contact-form-grid">
              <label>Nama lengkap<input name="sender_name" minLength={2} maxLength={120} required placeholder="Nama kamu" autoComplete="name" /></label>
              <label>Nomor WhatsApp<input name="sender_contact" type="tel" inputMode="tel" autoComplete="tel" minLength={8} maxLength={32} required placeholder="Contoh: 08xxxxxxxxxx" aria-describedby="whatsapp-help" /></label>
            </div>
            <p id="whatsapp-help" className="contact-privacy">Gunakan nomor WhatsApp aktif agar pengurus dapat menghubungi kamu. Kanal kontak organisasi saat ini hanya WhatsApp.</p>
            <label>Kategori pesan<select name="category" required defaultValue=""><option value="" disabled>Pilih kategori</option><option value="Pertanyaan">Pertanyaan</option><option value="Saran">Saran</option><option value="Aspirasi">Aspirasi</option><option value="Laporan">Laporan</option><option value="Lainnya">Lainnya</option></select></label>
            <label>Subjek<input name="subject" minLength={3} maxLength={160} required placeholder="Ringkasan pesan" /></label>
            <label>Isi pesan<textarea name="message" minLength={10} maxLength={5000} required rows={6} placeholder="Ceritakan hal yang ingin disampaikan..." /></label>
            <label className="contact-honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
            {state.error && <p className="contact-error" role="alert">{state.error}</p>}
            <button type="submit" disabled={pending}>{pending ? "Mengirim pesan..." : "Kirim pesan"} <Send size={16} /></button>
            <p className="contact-privacy">Informasi kontak digunakan hanya untuk keperluan tindak lanjut pesan oleh pengurus.</p>
          </form>
        )}
      </section>
      <footer className="contact-footer">PEMUDA KAMPUNG SAWAH KAUM · RT 01 / RW 01</footer>
    </main>
  );
}
