"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireModulePermission } from "@/lib/auth/require-role";

export type LetterActionState = { success?: string; error?: string };

export async function createOfficialLetter(_previous: LetterActionState, formData: FormData): Promise<LetterActionState> {
  const user = await requireModulePermission("letters", "create");
  const category = String(formData.get("category") ?? "umum");
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (category !== "umum" && category !== "keuangan") return { error: "Kategori surat tidak valid." };
  if (user.role === "bendahara" && category !== "keuangan") return { error: "Bendahara hanya dapat membuat surat administrasi keuangan." };
  if (user.role !== "bendahara" && category === "keuangan") return { error: "Surat administrasi keuangan hanya dibuat oleh Bendahara." };
  if (subject.length < 3 || subject.length > 180) return { error: "Perihal harus berisi 3–180 karakter." };
  if (body.length < 10 || body.length > 20000) return { error: "Isi surat harus berisi 10–20.000 karakter." };

  const supabase = await createClient();
  const { error } = await supabase.from("official_letters").insert({
    category, subject, body, created_by: user.profile.id, status: "draft",
  });

  if (error) return { error: "Surat gagal disimpan. Pastikan migrasi penomoran surat sudah diterapkan." };
  revalidatePath("/dashboard/surat-dokumen");
  return { success: "Draft surat berhasil dibuat. Nomor surat dialokasikan otomatis oleh database." };
}