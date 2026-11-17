"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireModulePermission } from "@/lib/auth/require-role";

export type MemberActionState = { success?: string; error?: string };

export async function createMember(_previous: MemberActionState, formData: FormData): Promise<MemberActionState> {
  const user = await requireModulePermission("members", "create");
  if (user.role !== "sekretaris") return { error: "Hanya Sekretaris yang dapat menambah data anggota melalui formulir ini." };

  const fullName = String(formData.get("full_name") ?? "").trim();
  const gender = String(formData.get("gender") ?? "");
  const phone = String(formData.get("phone") ?? "").trim();

  if (fullName.length < 2 || fullName.length > 120) return { error: "Nama harus berisi 2–120 karakter." };
  if (gender !== "laki_laki" && gender !== "perempuan") return { error: "Jenis kelamin wajib dipilih." };
  if (phone.length > 40) return { error: "Nomor kontak terlalu panjang." };

  const supabase = await createClient();
  const { error } = await supabase.from("members").insert({
    full_name: fullName,
    gender,
    phone: phone || null,
    created_by: user.profile.id,
  });

  if (error) return { error: "Data anggota gagal disimpan. Periksa koneksi dan hak akses." };
  revalidatePath("/dashboard/keanggotaan");
  return { success: "Anggota berhasil ditambahkan." };
}