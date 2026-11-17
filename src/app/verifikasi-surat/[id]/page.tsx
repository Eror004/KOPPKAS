import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, FileCheck2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function VerifyLetterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("official_letters")
      .select("letter_number, subject, body, category, status, approved_at, created_at")
      .eq("id", id).eq("status", "terbit").maybeSingle();
    if (error || !data) notFound();

    return (
      <main className="verify-shell">
        <header><Link href="/public">KOPPKAS · PEMUDA KAMPUNG SAWAH KAUM</Link><span>VERIFIKASI DOKUMEN</span></header>
        <section className="verify-document">
          <div className="verify-status"><CheckCircle2 size={19} /> DOKUMEN TERVERIFIKASI</div>
          <div className="verify-icon"><FileCheck2 size={24} /></div>
          <p className="eyebrow">OFFICIAL LETTER</p>
          <h1>{data.subject}</h1>
          <dl><div><dt>Nomor surat</dt><dd>{data.letter_number}</dd></div><div><dt>Kategori</dt><dd>{data.category === "keuangan" ? "Administrasi keuangan" : "Umum"}</dd></div><div><dt>Status</dt><dd>Terbit</dd></div><div><dt>Tanggal diterbitkan</dt><dd>{new Date(data.approved_at ?? data.created_at).toLocaleDateString("id-ID", { dateStyle: "long" })}</dd></div></dl>
          <article>{data.body}</article>
          <p className="verify-disclaimer">Halaman ini memverifikasi bahwa nomor dan dokumen tercatat sebagai surat terbit pada sistem KOPPKAS. Tanda tangan digital pada sistem bukan sertifikat tanda tangan elektronik tersertifikasi.</p>
        </section>
      </main>
    );
  } catch {
    notFound();
  }
}