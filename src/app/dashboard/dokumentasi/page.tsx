import Link from "next/link";
import { FolderKanban, FileText } from "lucide-react";
import { ModuleShell } from "@/components/module-shell";
import { requireModulePermission } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { MediaUploadForm } from "./upload-form";

export const dynamic = "force-dynamic";

export default async function DocumentationPage() {
  const user = await requireModulePermission("media", "read");
  const supabase = await createClient();
  const { data, error } = await supabase.from("media_assets")
    .select("id, title, description, storage_path, visibility, created_at")
    .eq("visibility", "internal")
    .order("created_at", { ascending: false }).limit(100);

  const assets = await Promise.all((data ?? []).map(async (item) => {
    const { data: signed, error: signedError } = await supabase.storage
      .from("koppkas-documents")
      .createSignedUrl(item.storage_path, 600);
    return { ...item, signedUrl: signedError ? null : signed?.signedUrl ?? null };
  }));

  return (
    <ModuleShell title="Dokumentasi">
      <main className="module-page">
        <div className="module-page-head"><div><p className="eyebrow">ORGANIZATION ARCHIVE</p><h1>Dokumentasi</h1><p>Arsip foto, video, dan dokumen kegiatan organisasi dalam penyimpanan privat.</p></div><div className="module-total"><FolderKanban size={19} /><strong>{assets.length}</strong><span>ARSIP TERSIMPAN</span></div></div>
        {error && <div className="module-alert" role="alert">Arsip belum dapat dimuat. Pastikan migrasi Storage sudah diterapkan.</div>}
        <MediaUploadForm userId={user.profile.id} />
        <section className="module-table-panel"><div className="module-table-heading"><div><p className="eyebrow">MEDIA LIBRARY</p><h2>Arsip terbaru</h2></div><span>100 ITEM TERBARU</span></div>
          {assets.length ? <div className="announcement-list">{assets.map((item) => <article key={item.id}><span className="announcement-status">INTERNAL</span><div><strong>{item.title}</strong><p>{item.description || "Dokumentasi organisasi"}</p><small>{new Date(item.created_at).toLocaleDateString("id-ID")}</small>{item.signedUrl ? <Link href={item.signedUrl} target="_blank" rel="noreferrer"><FileText size={14} /> Buka arsip</Link> : <small>File tidak dapat dibuka. Periksa izin Storage.</small>}</div></article>)}</div> : <div className="module-empty">Belum ada dokumentasi. Unggah foto, video, atau dokumen untuk memulai arsip organisasi.</div>}
        </section>
      </main>
    </ModuleShell>
  );
}
