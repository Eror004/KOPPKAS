import { ModuleShell } from "@/components/module-shell";
import { UsersRound } from "lucide-react";
import { requireModulePermission } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { MemberForm } from "./member-form";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const user = await requireModulePermission("members", "read");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("members")
    .select("id, full_name, gender, phone, created_at")
    .is("archived_at", null)
    .order("full_name", { ascending: true });

  const members = data ?? [];
  const male = members.filter((member) => member.gender === "laki_laki");
  const female = members.filter((member) => member.gender === "perempuan");
  const incomplete = members.filter((member) => !member.gender);

  return (
    <ModuleShell title="Keanggotaan"><main className="module-page">
      <div className="module-page-head"><div><p className="eyebrow">ORGANIZATION DIRECTORY</p><h1>Keanggotaan</h1><p>Kelola data anggota dalam satu direktori organisasi.</p></div><div className="module-total"><UsersRound size={19} /><strong>{members.length}</strong><span>ANGGOTA AKTIF</span></div></div>
      {error && <div className="module-alert" role="alert">Data anggota belum dapat dimuat. Pastikan database KOPPKAS sudah disiapkan.</div>}
      <div className="member-summary">
        <section className="member-group male"><div className="member-group-head"><span className="member-group-icon"><UsersRound size={18} /></span><div><h2>Laki-laki</h2><p>Anggota dengan data jenis kelamin laki-laki</p></div><strong>{male.length}</strong></div><MemberRows members={male} /></section>
        <section className="member-group female"><div className="member-group-head"><span className="member-group-icon"><UsersRound size={18} /></span><div><h2>Perempuan</h2><p>Anggota dengan data jenis kelamin perempuan</p></div><strong>{female.length}</strong></div><MemberRows members={female} /></section>
        <section className="member-group incomplete"><div className="member-group-head"><span className="member-group-icon"><UsersRound size={18} /></span><div><h2>Belum dilengkapi</h2><p>Anggota yang dibuat melalui pencatatan kas</p></div><strong>{incomplete.length}</strong></div><MemberRows members={incomplete} /></section>
      </div>
      {user.role === "sekretaris" && <MemberForm />}
    </main></ModuleShell>
  );
}

function MemberRows({ members }: { members: Array<{ id: string; full_name: string; phone: string | null }> }) {
  if (!members.length) return <div className="module-empty">Belum ada anggota dalam kelompok ini.</div>;
  return <div className="member-table">{members.map((member) => <div className="member-row" key={member.id}><span className="member-initial">{member.full_name.slice(0,1).toUpperCase()}</span><div><strong>{member.full_name}</strong><small>{member.phone || "Kontak belum ditambahkan"}</small></div></div>)}</div>;
}