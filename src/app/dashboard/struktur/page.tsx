import { ContactRound, Plus, Save } from "lucide-react";
import { ModuleShell } from "@/components/module-shell";
import { requireModulePermission } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { createPosition, updatePosition } from "./actions";

export const dynamic = "force-dynamic";

type StructurePageProps = { searchParams: Promise<{ success?: string; error?: string }> };

export default async function StructurePage({ searchParams }: StructurePageProps) {
  const user = await requireModulePermission("structure", "read");
  const query = await searchParams;
  const isSecretary = user.role === "sekretaris";
  const supabase = await createClient();
  const positionsQuery = supabase.from("organization_positions")
    .select("id, position_name, sort_order, is_active, member_id, members(full_name)")
    .order("sort_order", { ascending: true });
  const [{ data, error }, { data: members }] = await Promise.all([
    isSecretary ? positionsQuery : positionsQuery.eq("is_active", true),
    isSecretary
      ? supabase.from("members").select("id,full_name").is("archived_at", null).order("full_name")
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);

  return (
    <ModuleShell title="Struktur Organisasi">
      <main className="module-page">
        <div className="module-page-head"><div><p className="eyebrow">ORGANIZATION STRUCTURE</p><h1>Struktur Organisasi</h1><p>Susunan jabatan dan penanggung jawab organisasi.</p></div><div className="module-total"><ContactRound size={19} /><strong>{data?.filter((position) => position.is_active).length ?? 0}</strong><span>POSISI AKTIF</span></div></div>
        {query.error && <p className="form-feedback error" role="alert">{query.error}</p>}
        {query.success && <p className="form-feedback success" role="status">{query.success}</p>}
        {error && <div className="module-alert" role="alert">Data struktur belum dapat dimuat.</div>}
        {isSecretary ? (
          <>
            <form action={createPosition} className="module-form">
              <div className="module-form-heading"><div><p className="eyebrow">STRUKTUR ORGANISASI</p><h3>Tambah jabatan</h3></div><span className="add-member-icon"><Plus size={18} /></span></div>
              <label>Nama jabatan<input name="position_name" minLength={2} maxLength={100} required placeholder="Contoh: Ketua Pemuda" /></label>
              <label>Penanggung jawab<select name="member_id" defaultValue=""><option value="">Belum ditentukan</option>{members?.map((member) => <option key={member.id} value={member.id}>{member.full_name}</option>)}</select></label>
              <label>Urutan tampilan<input name="sort_order" type="number" min={0} max={999} defaultValue={0} required /></label>
              <input type="hidden" name="is_active" value="on" />
              <button type="submit"><Plus size={16} /> Tambah jabatan</button>
            </form>
            <section className="module-table-panel" style={{ marginTop: 20 }}>
              <div className="module-table-heading"><div><p className="eyebrow">STRUCTURE EDITOR</p><h2>Kelola jabatan</h2></div><span>{data?.length ?? 0} POSISI</span></div>
              {data?.length ? data.map((position) => (
                <form action={updatePosition} className="module-form" key={position.id} style={{ maxWidth: "none", margin: 12 }}>
                  <input type="hidden" name="position_id" value={position.id} />
                  <label>Nama jabatan<input name="position_name" defaultValue={position.position_name} minLength={2} maxLength={100} required /></label>
                  <label>Penanggung jawab<select name="member_id" defaultValue={position.member_id ?? ""}><option value="">Belum ditentukan</option>{members?.map((member) => <option key={member.id} value={member.id}>{member.full_name}</option>)}</select></label>
                  <label>Urutan tampilan<input name="sort_order" type="number" min={0} max={999} defaultValue={position.sort_order} required /></label>
                  <label>Status<select name="is_active" defaultValue={position.is_active ? "on" : "off"}><option value="on">Aktif</option><option value="off">Nonaktif</option></select></label>
                  <button type="submit"><Save size={15} /> Simpan perubahan</button>
                </form>
              )) : <div className="module-empty">Belum ada posisi organisasi. Tambahkan jabatan pertama di atas.</div>}
            </section>
          </>
        ) : (
          <section className="structure-list">{data?.length ? data.map((position) => {
            const member = Array.isArray(position.members) ? position.members[0] : position.members;
            return <article key={position.id}><span>{String(position.sort_order + 1).padStart(2,"0")}</span><div><strong>{position.position_name}</strong><small>{member?.full_name ?? "Belum ditentukan"}</small></div></article>;
          }) : <div className="module-empty">Struktur organisasi belum diinput.</div>}</section>
        )}
      </main>
    </ModuleShell>
  );
}
