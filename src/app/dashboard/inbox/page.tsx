import { ModuleShell } from "@/components/module-shell";
import { Inbox } from "lucide-react";
import { requireModulePermission } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  await requireModulePermission("inbox", "read");
  const supabase = await createClient();
  const [{ data, error }, { count: newMessages, error: countError }] = await Promise.all([
    supabase.from("public_messages")
      .select("id, sender_name, sender_contact, category, subject, message, status, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("public_messages").select("id", { count: "exact", head: true }).eq("status", "baru"),
  ]);

  const messages = data ?? [];

  return (
    <ModuleShell title="INBOX"><main className="module-page">
      <div className="module-page-head"><div><p className="eyebrow">PUBLIC CONTACT CENTER</p><h1>INBOX</h1><p>Pesan yang dikirim masyarakat melalui halaman kontak publik.</p></div><div className="module-total"><Inbox size={19} /><strong>{newMessages ?? 0}</strong><span>PESAN BARU</span></div></div>
      {(error || countError) && <div className="module-alert" role="alert">Pesan atau jumlah pesan baru belum dapat dimuat. Pastikan migrasi database sudah diterapkan.</div>}
      <section className="module-table-panel"><div className="module-table-heading"><div><p className="eyebrow">COMMUNITY MESSAGES</p><h2>Pesan masuk</h2></div><span>AKSES BACA UNTUK ENAM JABATAN</span></div>
        {messages.length ? <div className="inbox-list">{messages.map((message) => <details className="inbox-item" key={message.id}><summary><span className={`inbox-status ${message.status}`}>{message.status.toUpperCase()}</span><span className="inbox-subject"><strong>{message.subject}</strong><small>{message.sender_name} · {message.category}</small></span><time>{new Date(message.created_at).toLocaleDateString("id-ID")}</time></summary><div className="inbox-detail"><p>{message.message}</p><span>Kontak: {message.sender_contact}</span></div></details>)}</div> : <div className="module-empty">Belum ada pesan dari masyarakat.</div>}
      </section>
      <p className="module-note">Akses baca tersedia untuk keenam jabatan. Hak membalas, mengubah status, menugaskan, dan mengarsipkan pesan belum diaktifkan karena pembagian kewenangannya masih menunggu keputusan organisasi.</p>
    </main></ModuleShell>
  );
}