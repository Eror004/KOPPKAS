import Link from "next/link";
import { FileText } from "lucide-react";
import { requireModulePermission } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { LetterForm } from "./letter-form";
import { LetterWorkflowControls } from "./workflow-controls";
import { ModuleShell } from "@/components/module-shell";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  draft: "Draft", menunggu_persetujuan: "Menunggu persetujuan", terbit: "Terbit", dibatalkan: "Dibatalkan",
};

type LettersPageProps = { searchParams: Promise<{ success?: string; error?: string }> };

export default async function LettersPage({ searchParams }: LettersPageProps) {
  const user = await requireModulePermission("letters", "read");
  const query = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.from("official_letters")
    .select("id,letter_number,category,subject,body,status,created_at,created_by")
    .order("created_at", { ascending: false }).limit(100);

  return (
    <ModuleShell title="Surat & Dokumen">
      <main className="module-page">
        <div className="module-page-head"><div><p className="eyebrow">OFFICIAL CORRESPONDENCE</p><h1>Surat & Dokumen</h1><p>Penomoran surat berurutan dalam satu tahun dan tidak digunakan ulang setelah pembatalan.</p></div><div className="module-total"><FileText size={19} /><strong>{data?.length ?? 0}</strong><span>SURAT TERCATAT</span></div></div>
        {query.error && <p className="form-feedback error" role="alert">{query.error}</p>}
        {query.success && <p className="form-feedback success" role="status">{query.success}</p>}
        {error && <div className="module-alert" role="alert">Daftar surat belum dapat dimuat. Periksa konfigurasi database dan hak akses kategori.</div>}
        <LetterForm financialOnly={user.role === "bendahara"} />
        <section className="module-table-panel letter-list-panel"><div className="module-table-heading"><div><p className="eyebrow">DOCUMENT REGISTER</p><h2>Daftar surat</h2></div><span>100 SURAT TERBARU</span></div>
          {data?.length ? <div className="responsive-table"><table><thead><tr><th>NOMOR SURAT</th><th>PERIHAL</th><th>KATEGORI</th><th>STATUS</th><th>VERIFIKASI</th><th>ALUR</th></tr></thead><tbody>{data.map((letter) => <tr key={letter.id}>
            <td>{letter.letter_number}</td><td>{letter.subject}</td><td>{letter.category === "keuangan" ? "Keuangan" : "Umum"}</td><td>{statusLabels[letter.status] ?? letter.status}</td>
            <td>{letter.status === "terbit" && letter.category === "umum" ? <Link href={`/verifikasi-surat/${letter.id}`}>Lihat verifikasi</Link> : "—"}</td>
            <td><LetterWorkflowControls letter={letter} actorId={user.profile.id} role={user.role} /></td>
          </tr>)}</tbody></table></div> : <div className="module-empty">Belum ada surat yang dibuat.</div>}
        </section>
      </main>
    </ModuleShell>
  );
}
