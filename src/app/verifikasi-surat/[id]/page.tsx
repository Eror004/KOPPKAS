import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, FileCheck2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function VerifyLetterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  let letter: {
    letter_number: string;
    subject: string;
    category: string;
    status: string;
    approved_at: string | null;
    created_at: string;
  } | null = null;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("public_letter_verifications").select("letter_number,subject,category,status,approved_at,created_at").eq("id", id).maybeSingle();
    if (!error && data) letter = data;
  } catch {
    letter = null;
  }

  if (!letter) notFound();

  return (
    <main className="verify-shell">
      <header><Link href="/">KOPPKAS · PEMUDA KAMPUNG SAWAH KAUM</Link><span>VERIFIKASI DOKUMEN</span></header>
      <section className="verify-document">
        <div className="verify-status"><CheckCircle2 size={19} /> DOKUMEN TERVERIFIKASI</div>
        <div className="verify-icon"><FileCheck2 size={24} /></div>
        <p className="eyebrow">OFFICIAL LETTER</p>
        <h1>{letter.subject}</h1>
        <dl><div><dt>Nomor surat</dt><dd>{letter.letter_number}</dd></div><div><dt>Kategori</dt><dd>Umum</dd></div><div><dt>Status</dt><dd>Terbit</dd></div><div><dt>Tanggal diterbitkan</dt><dd>{new Date(letter.approved_at ?? letter.created_at).toLocaleDateString("id-ID", { dateStyle: "long" })}</dd></div></dl>
        <p className="verify-disclaimer">Nomor dan metadata surat umum ini tercatat sebagai surat terbit pada sistem KOPPKAS. Isi surat dan dokumen kategori keuangan tidak ditampilkan pada verifikasi publik. Tanda tangan digital pada sistem bukan sertifikat tanda tangan elektronik tersertifikasi.</p>
      </section>
    </main>
  );
}
