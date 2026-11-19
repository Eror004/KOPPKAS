"use client";

import { useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, Send } from "lucide-react";
import Link from "next/link";

type ContactState = { success?: boolean; error?: string };

export default function PublicContactPage() {
  const [state, setState] = useState<ContactState>({});
  const [pending, setPending] = useState(false);

  async function submitContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const website = String(values.get("website") ?? "").trim();

    if (website) {
      setState({ success: true });
      form.reset();
      return;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !publishableKey) {
      setState({ error: "Layanan kontak sementara tidak tersedia. Silakan gunakan WhatsApp resmi organisasi." });
      return;
    }

    setPending(true);
    setState({});
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/public-contact-submit`, {
        method: "POST",
        headers: {
          apikey: publishableKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          senderName: String(values.get("sender_name") ?? ""),
          senderContact: String(values.get("sender_contact") ?? ""),
          category: String(values.get("category") ?? ""),
          subject: String(values.get("subject") ?? ""),
          message: String(values.get("message") ?? ""),
          website,
        }),
      });
      const result = await response.json() as { success?: boolean; error?: string };
      if (!response.ok || result.success !== true) {
        setState({ error: result.error ?? "Pesan belum dapat dikirim. Silakan coba kembali nanti." });
        return;
      }
      form.reset();
      setState({ success: true });
    } catch {
      setState({ error: "Pesan belum dapat dikirim. Periksa koneksi atau gunakan WhatsApp resmi organisasi." });
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="contact-shell">
      <header className="contact-header"><Link href="/"><ArrowLeft size={17} /> KOPPKAS</Link><span>PUBLIC CONTACT CENTER</span></header>
      <section className="contact-content">
        <p className="eyebrow">SUARA WARGA · RUANG ASPIRASI</p>
        <h1>Ada yang ingin<br /><span>disampaikan?</span></h1>
        <p className="contact-lead">Kirim pertanyaan, saran, atau laporan kepada pengurus Pemuda Kampung Sawah Kaum. Pesan akan diteruskan ke INBOX pengurus.</p>
        {state.success ? (
          <div className="contact-form contact-whatsapp"><CheckCircle2 size={26} /><h2>Pesan berhasil dikirim.</h2><p>Terima kasih sudah menghubungi kami. Pengurus akan meninjau pesan yang masuk.</p><button onClick={() => setState({})}>Kirim pesan lain</button></div>
        ) : (
          <form onSubmit={submitContact} className="contact-form">
            <div className="contact-form-grid">
              <label>Nama lengkap<input name="sender_name" minLength={2} maxLength={120} required placeholder="Nama kamu" /></label>
              <label>Kontak yang bisa dihubungi<input name="sender_contact" minLength={5} maxLength={160} required placeholder="WhatsApp atau email" /></label>
            </div>
            <label>Kategori pesan<select name="category" required defaultValue=""><option value="" disabled>Pilih kategori</option><option value="Pertanyaan">Pertanyaan</option><option value="Saran">Saran</option><option value="Aspirasi">Aspirasi</option><option value="Laporan">Laporan</option><option value="Lainnya">Lainnya</option></select></label>
            <label>Subjek<input name="subject" minLength={3} maxLength={160} required placeholder="Ringkasan pesan" /></label>
            <label>Isi pesan<textarea name="message" minLength={10} maxLength={5000} required rows={6} placeholder="Ceritakan hal yang ingin disampaikan..." /></label>
            <label className="contact-honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
            {state.error && <p className="contact-error" role="alert">{state.error}</p>}
            <button type="submit" disabled={pending}>{pending ? "Mengirim pesan..." : "Kirim pesan"} <Send size={16} /></button>
            <p className="contact-privacy">Informasi kontak digunakan untuk keperluan tindak lanjut pesan oleh pengurus.</p>
          </form>
        )}
      </section>
      <footer className="contact-footer">PEMUDA KAMPUNG SAWAH KAUM · RT 01 / RW 01</footer>
    </main>
  );
}
