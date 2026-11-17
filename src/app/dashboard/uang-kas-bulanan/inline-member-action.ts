"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireModulePermission } from "@/lib/auth/require-role";
import type { DuesActionState } from "./actions";

export async function createInlineDuesMember(_previous: DuesActionState, formData: FormData): Promise<DuesActionState> {
  await requireModulePermission("monthly_dues", "create");
  const fullName = String(formData.get("full_name") ?? "").trim();
  if (fullName.length < 2 || fullName.length > 120) return { error: "Nama harus berisi 2–120 karakter." };

  const duesMonth = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }).slice(0, 7) + "-01";
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_member_and_monthly_dues", {
    p_full_name: fullName,
    p_dues_month: duesMonth,
  });

  if (error) return { error: "Anggota baru gagal ditambahkan ke daftar kas." };
  revalidatePath("/dashboard/uang-kas-bulanan");
  revalidatePath("/dashboard/keanggotaan");
  return { success: "Anggota berhasil ditambahkan. Jenis kelamin dapat dilengkapi nanti di Keanggotaan." };
}