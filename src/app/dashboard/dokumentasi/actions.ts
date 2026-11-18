"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireModulePermission } from "@/lib/auth/require-role";

export type MediaActionState = { success?: string; error?: string };

export async function createMediaAsset(formData: FormData): Promise<MediaActionState> {
  const user = await requireModulePermission("media", "create");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const storagePath = String(formData.get("storage_path") ?? "");

  if (title.length < 3 || title.length > 160) return { error: "Judul arsip harus berisi 3–160 karakter." };
  if (description.length > 1000) return { error: "Deskripsi maksimal 1.000 karakter." };
  if (
    storagePath.length > 512 ||
    !storagePath.startsWith(`${user.profile.id}/`) ||
    storagePath.includes("..") ||
    storagePath.includes("\\")
  ) {
    return { error: "Lokasi file tidak valid." };
  }

  const supabase = await createClient();
  const { error: storageError } = await supabase.storage.from("koppkas-documents").createSignedUrl(storagePath, 60);
  if (storageError) return { error: "File tidak ditemukan atau tidak dapat diverifikasi." };

  const { error } = await supabase.from("media_assets").insert({
    title,
    description: description || null,
    storage_path: storagePath,
    visibility: "internal",
    uploaded_by: user.profile.id,
  });
  if (error) return { error: "Metadata arsip gagal disimpan. File yang gagal didaftarkan akan dibersihkan." };

  revalidatePath("/dashboard/dokumentasi");
  return { success: "Dokumentasi berhasil diunggah dan disimpan secara privat." };
}
