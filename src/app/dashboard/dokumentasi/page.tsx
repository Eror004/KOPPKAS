import { FolderKanban } from "lucide-react";
import { ModuleShell } from "@/components/module-shell";
import { requireModulePermission } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DocumentationPage() {
  await requireModulePermission("media", "read");
  const supabase = await createClient();
  const { data, error } = await supabase.from("media_assets")
    .select("id, title, description, storage_path, visibility, created_at")
    .order("created_at", { ascending: false }).limit(100);

  return (
    <ModuleShell title="Dokumentasi">
      <main className="module-page">
        <div className="module-page-head"><div><p className="eyebrow">ORGANIZATION ARCHIVE</p><h1>Dokumentasi</h1><p>Arsip foto, video, dan dokumen kegiatan organisasi.</p></div><div className="module-total"><FolderKanban size={19} /><strong>{data?.length ?? 0}</strong><span>ARSIP TERSIMPAN</span></div></div>
        {error && <div className="module-alert" role="alert">Arsip belum dapat dimuat.</div>}
        <section className="module-table-panel"><div className="module-table-heading"><div><p className="eyebrow">MEDIA LIBRARY</p><h2>Arsip terbaru</h2></div><span>100 ITEM TERBARU</span></div>
          {data?.length ? <div className="announcement-list">{data.map((item) => <article key={item.id}><span className="announcement-status">{item.visibility === "public" ? "PUBLIK" : "INTERNAL"}</span><div><strong>{item.title}</strong><p>{item.description || item.storage_path}</p><small>{new Date(item.created_at).toLocaleDateString("id-ID")}</small></div></article>)}</div> : <div className="module-empty">Belum ada dokumentasi. Penyimpanan file akan diaktifkan setelah bucket dan kebijakan Storage disiapkan.</div>}
        </section>
      </main>
    </ModuleShell>
  );
}