import { ModuleShell } from "@/components/module-shell";
import { MemberDirectory } from "@/components/members/member-directory";
import type { MemberRecord } from "@/components/members/contracts";
import { Status } from "@/components/ui/status";
import { can } from "@/lib/auth/permissions";
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

  const canCreate = can(user.role, "members", "create") && user.role === "sekretaris";
  return <ModuleShell title="Keanggotaan"><main className="module-page">
    {error ? <Status kind="error" title="Data anggota belum dapat dimuat">Silakan coba muat ulang halaman.</Status> : <MemberDirectory members={(data ?? []) as MemberRecord[]} canCreate={canCreate} canEdit={can(user.role, "members", "update")} createForm={canCreate ? <MemberForm /> : undefined} />}
  </main></ModuleShell>;
}
