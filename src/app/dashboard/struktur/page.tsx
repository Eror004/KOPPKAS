import { ContactRound } from "lucide-react";
import { ModuleShell } from "@/components/module-shell";
import { requireModulePermission } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function StructurePage() {
  await requireModulePermission("structure", "read");
  const supabase = await createClient();
  const { data, error } = await supabase.from("organization_positions")
    .select("id, position_name, sort_order, members(full_name)")
    .eq("is_active", true).order("sort_order", { ascending: true });

  return (
    <ModuleShell title="Struktur Organisasi">
      <main className="module-page">
        <div className="module-page-head"><div><p className="eyebrow">ORGANIZATION STRUCTURE</p><h1>Struktur Organisasi</h1><p>Susunan jabatan dan penanggung jawab organisasi.</p></div><div className="module-total"><ContactRound size={19} /><strong>{data?.length ?? 0}</strong><span>POSISI AKTIF</span></div></div>
        {error && <div className="module-alert" role="alert">Data struktur belum dapat dimuat.</div>}
        <section className="structure-list">{data?.length ? data.map((position) => {
          const member = Array.isArray(position.members) ? position.members[0] : position.members;
          return <article key={position.id}><span>{String(position.sort_order + 1).padStart(2,"0")}</span><div><strong>{position.position_name}</strong><small>{member?.full_name ?? "Belum ditentukan"}</small></div></article>;
        }) : <div className="module-empty">Struktur organisasi belum diinput.</div>}</section>
      </main>
    </ModuleShell>
  );
}