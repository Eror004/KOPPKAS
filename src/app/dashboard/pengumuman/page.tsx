import { Megaphone } from "lucide-react";
import { ModuleShell } from "@/components/module-shell";
import { requireModulePermission } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { AnnouncementForm } from "./announcement-form";

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  await requireModulePermission("announcements", "read");
  const supabase = await createClient();
  const { data, error } = await supabase.from("announcements")
    .select("id, title, body, is_published, created_at")
    .order("created_at", { ascending: false }).limit(100);

  return (
    <ModuleShell title="Pengumuman">
      <main className="module-page">
        <div className="module-page-head"><div><p className="eyebrow">COMMUNITY INFORMATION</p><h1>Pengumuman</h1><p>Kelola informasi organisasi. Draft belum tampil di website publik sampai diterbitkan.</p></div><div className="module-total"><Megaphone size={19} /><strong>{data?.length ?? 0}</strong><span>INFORMASI TERCATAT</span></div></div>
        {error && <div className="module-alert" role="alert">Data pengumuman belum dapat dimuat.</div>}
        <AnnouncementForm />
        <section className="module-table-panel announcement-list-panel"><div className="module-table-heading"><div><p className="eyebrow">ANNOUNCEMENT REGISTER</p><h2>Daftar pengumuman</h2></div><span>100 TERBARU</span></div>
          {data?.length ? <div className="announcement-list">{data.map((item) => <article key={item.id}><span className={item.is_published ? "announcement-status published" : "announcement-status"}>{item.is_published ? "DITERBITKAN" : "DRAFT"}</span><div><strong>{item.title}</strong><p>{item.body}</p><small>{new Date(item.created_at).toLocaleDateString("id-ID")}</small></div></article>)}</div> : <div className="module-empty">Belum ada pengumuman.</div>}
        </section>
      </main>
    </ModuleShell>
  );
}