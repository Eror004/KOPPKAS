"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireModulePermission } from "@/lib/auth/require-role";

export async function markNotificationRead(formData: FormData) {
  const user = await requireModulePermission("notifications", "update");
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;

  const supabase = await createClient();
  const { error } = await supabase.from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("recipient_id", user.profile.id);
  if (error) return;
  revalidatePath("/dashboard/notifikasi");
}