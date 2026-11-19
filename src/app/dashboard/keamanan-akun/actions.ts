"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireModulePermission } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

const securityPath = "/dashboard/keamanan-akun";
const uuidPattern = /^[0-9a-f-]{36}$/i;

export async function revokeDeviceSession(formData: FormData) {
  await requireModulePermission("security", "update");
  const sessionId = String(formData.get("session_id") ?? "");
  if (!uuidPattern.test(sessionId)) {
    redirect(`${securityPath}?error=${encodeURIComponent("Perangkat tujuan tidak valid.")}`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("revoke_my_app_session", {
    p_session_id: sessionId,
  });

  if (error || data !== true) {
    redirect(`${securityPath}?error=${encodeURIComponent("Sesi tidak dapat dicabut. Muat ulang daftar perangkat lalu coba lagi.")}`);
  }

  revalidatePath(securityPath);
  redirect(`${securityPath}?success=${encodeURIComponent("Perangkat berhasil dikeluarkan dari akun.")}`);
}

export async function revokeOtherDeviceSessions() {
  await requireModulePermission("security", "update");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("revoke_other_app_sessions");

  if (error) {
    redirect(`${securityPath}?error=${encodeURIComponent("Sesi perangkat lain gagal dicabut.")}`);
  }

  revalidatePath(securityPath);
  const count = Number(data ?? 0);
  redirect(`${securityPath}?success=${encodeURIComponent(count ? `${count} perangkat lain berhasil dikeluarkan.` : "Tidak ada sesi perangkat lain yang aktif.")}`);
}
