"use server";

import { redirect } from "next/navigation";
import { createAuthClient } from "@/lib/supabase/auth";

export type LoginState = { error?: string };

export async function signIn(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Masukkan alamat email yang valid." };
  }
  if (password.length < 5) {
    return { error: "Email atau password tidak sesuai." };
  }

  try {
    const supabase = await createAuthClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message.includes("15 menit")) return { error: "Akun terkunci sementara. Coba lagi setelah 15 menit." };
      if (error.message.includes("verifikasi tambahan")) return { error: "Akun memerlukan verifikasi tambahan oleh Ketua Pemuda." };
      return { error: "Email atau password tidak sesuai." };
    }
  } catch {
    return { error: "Layanan autentikasi belum dikonfigurasi. Hubungi administrator." };
  }

  redirect("/dashboard");
}
