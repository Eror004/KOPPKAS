import { createClient } from "@/lib/supabase/server";
import { PublicInfoShell } from "@/components/public-info-shell";

export const dynamic = "force-dynamic";

export default async function PublicInformationPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("announcements")
    .select("id,title,body,published_at")
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(50);

  return (
    <PublicInfoShell
      eyebrow="PUBLIC INFORMATION"
      title="Informasi"
      accent="Organisasi."
      lead="Pengumuman resmi yang telah diterbitkan oleh pengurus KOPPKAS."
    >
      <section className="public-info-panel">
        <p className="eyebrow">PENGUMUMAN TERBIT</p>
        {error ? (
          <p role="alert">Informasi belum dapat dimuat. Silakan coba kembali beberapa saat lagi.</p>
        ) : data?.length ? (
          <div className="public-info-list">
            {data.map((item) => (
              <article key={item.id}>
                <time>{item.published_at ? new Date(item.published_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }) : "Informasi"}</time>
                <h2>{item.title}</h2>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        ) : (
          <p>Belum ada pengumuman yang diterbitkan.</p>
        )}
      </section>
    </PublicInfoShell>
  );
}
