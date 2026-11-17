"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireModulePermission } from "@/lib/auth/require-role";

export type AnnouncementState = { success?: string; error?: string };

export async function createAnnouncement(_previous: AnnouncementState, formData: FormData): Promise<AnnouncementState> {
  const user = await requireModulePermission("announcements", "create");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (title.length < 3 || title.length > 180) return { error: "Judul harus berisi 3–180 karakter." };
  if (body.length < 10 || body.length > 10000) return { error: "Isi pengumuman harus berisi 10–10.000 karakter." };

  const supabase = await createClient();
  const { error } = await supabase.from("announcements").insert({
    title, body, is_published: false, created_by: user.profile.id,
  });

  if (error) return { error: "Pengumuman gagal disimpan." };
  revalidatePath("/dashboard/pengumuman");
  return { success: "Draft pengumuman berhasil disimpan." };
}