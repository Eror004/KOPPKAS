"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireModulePermission } from "@/lib/auth/require-role";

const path = "/dashboard/struktur";
const uuidPattern = /^[0-9a-f-]{36}$/i;

function finish(kind: "success" | "error", message: string): never {
  redirect(`${path}?${kind}=${encodeURIComponent(message)}`);
}

function parsePosition(formData: FormData) {
  const positionName = String(formData.get("position_name") ?? "").trim();
  const memberId = String(formData.get("member_id") ?? "").trim();
  const sortOrder = Number(formData.get("sort_order") ?? 0);
  const isActive = formData.get("is_active") === "on";
  if (positionName.length < 2 || positionName.length > 100) finish("error", "Nama jabatan harus berisi 2–100 karakter.");
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 999) finish("error", "Urutan harus berupa angka 0–999.");
  if (memberId && !uuidPattern.test(memberId)) finish("error", "Anggota yang dipilih tidak valid.");
  return { position_name: positionName, member_id: memberId || null, sort_order: sortOrder, is_active: isActive };
}

export async function createPosition(formData: FormData) {
  await requireModulePermission("structure", "create");
  const values = parsePosition(formData);
  const supabase = await createClient();
  const { error } = await supabase.from("organization_positions").insert(values);
  if (error) finish("error", "Jabatan gagal ditambahkan. Pastikan nama jabatan belum digunakan.");
  revalidatePath(path);
  finish("success", "Jabatan berhasil ditambahkan.");
}

export async function updatePosition(formData: FormData) {
  await requireModulePermission("structure", "update");
  const id = String(formData.get("position_id") ?? "");
  if (!uuidPattern.test(id)) finish("error", "Data jabatan tidak valid.");
  const values = parsePosition(formData);
  const supabase = await createClient();
  const { error } = await supabase.from("organization_positions").update({
    ...values,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) finish("error", "Perubahan struktur gagal disimpan.");
  revalidatePath(path);
  finish("success", "Struktur organisasi berhasil diperbarui.");
}
