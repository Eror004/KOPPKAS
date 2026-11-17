"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireModulePermission } from "@/lib/auth/require-role";

export type EventActionState = { success?: string; error?: string };

export async function createEvent(_previous: EventActionState, formData: FormData): Promise<EventActionState> {
  const user = await requireModulePermission("events", "create");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const startsAt = String(formData.get("starts_at") ?? "").trim();

  if (title.length < 3 || title.length > 160) return { error: "Nama kegiatan harus berisi 3–160 karakter." };
  if (description.length > 5000 || location.length > 180) return { error: "Deskripsi atau lokasi terlalu panjang." };
  const date = startsAt ? new Date(startsAt) : null;
  if (date && Number.isNaN(date.getTime())) return { error: "Tanggal kegiatan tidak valid." };

  const supabase = await createClient();
  const { error } = await supabase.from("events").insert({
    title, description: description || null, location: location || null,
    starts_at: date?.toISOString() ?? null, status: "draft", created_by: user.profile.id,
  });
  if (error) return { error: "Kegiatan gagal disimpan. Periksa koneksi dan hak akses." };
  revalidatePath("/dashboard/kegiatan");
  return { success: "Draft kegiatan berhasil dibuat. Publikasi tetap memerlukan persetujuan Ketua atau Wakil Ketua." };
}