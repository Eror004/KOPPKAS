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

import { redirect } from "next/navigation";

const letterPath = "/dashboard/surat-dokumen";
const letterUuidPattern = /^[0-9a-f-]{36}$/i;

function finishLetterAction(kind: "success" | "error", message: string): never {
  redirect(`${letterPath}?${kind}=${encodeURIComponent(message)}`);
}

async function loadLetterForAction(id: string) {
  if (!letterUuidPattern.test(id)) finishLetterAction("error", "Data surat tidak valid.");
  const supabase = await createClient();
  const { data, error } = await supabase.from("official_letters")
    .select("id,created_by,category,status")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) finishLetterAction("error", "Surat tidak ditemukan atau tidak dapat diakses.");
  return { supabase, letter: data };
}

export async function submitLetterForApproval(formData: FormData) {
  const actor = await requireModulePermission("letters", "create");
  const { supabase, letter } = await loadLetterForAction(String(formData.get("letter_id") ?? ""));
  if (letter.status !== "draft") finishLetterAction("error", "Hanya draft yang dapat diajukan.");
  if (letter.created_by !== actor.profile.id && !(actor.role === "sekretaris" && letter.category === "umum")) {
    finishLetterAction("error", "Hanya pembuat surat atau Sekretaris untuk surat umum yang dapat mengajukan.");
  }
  const { error } = await supabase.from("official_letters").update({
    status: "menunggu_persetujuan",
    updated_at: new Date().toISOString(),
  }).eq("id", letter.id);
  if (error) finishLetterAction("error", "Pengajuan surat gagal disimpan.");
  revalidatePath(letterPath);
  finishLetterAction("success", "Surat diajukan untuk persetujuan Ketua atau Wakil Ketua.");
}

export async function approveLetter(formData: FormData) {
  const actor = await requireModulePermission("letters", "approve");
  const { supabase, letter } = await loadLetterForAction(String(formData.get("letter_id") ?? ""));
  if (letter.status !== "menunggu_persetujuan") finishLetterAction("error", "Surat tidak sedang menunggu persetujuan.");
  const { error } = await supabase.from("official_letters").update({
    status: "terbit",
    approved_by: actor.profile.id,
    approved_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", letter.id);
  if (error) finishLetterAction("error", "Persetujuan surat gagal disimpan.");
  revalidatePath(letterPath);
  finishLetterAction("success", "Surat disetujui dan diterbitkan.");
}

export async function cancelLetter(formData: FormData) {
  const actor = await requireModulePermission("letters", "approve");
  const { supabase, letter } = await loadLetterForAction(String(formData.get("letter_id") ?? ""));
  const reason = String(formData.get("reason") ?? "").trim();
  if (letter.status === "dibatalkan") finishLetterAction("error", "Surat sudah dibatalkan.");
  if (reason.length < 3 || reason.length > 500) finishLetterAction("error", "Alasan pembatalan harus berisi 3–500 karakter.");
  const { error } = await supabase.from("official_letters").update({
    status: "dibatalkan",
    cancellation_reason: reason,
    cancelled_by: actor.profile.id,
    cancelled_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", letter.id);
  if (error) finishLetterAction("error", "Pembatalan surat gagal disimpan.");
  revalidatePath(letterPath);
  finishLetterAction("success", "Surat dibatalkan. Nomor surat tetap tercatat dan tidak digunakan ulang.");
}
