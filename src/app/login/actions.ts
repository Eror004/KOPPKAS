"use server";

import { redirect } from "next/navigation";
import { createAuthClient } from "@/lib/supabase/auth";

export type LoginState = { error?: string };

function getLoginErrorMessage(error: { code?: string; status?: number; message?: string }) {
  const code = error.code?.toLowerCase() ?? "";
  const message = error.message?.toLowerCase() ?? "";

  if (code === "email_not_confirmed" || message.includes("email not confirmed")) {
    return "Email akun belum dikonfirmasi. Hubungi Ketua Pemuda.";
  }
  if (code === "user_banned" || message.includes("user is banned")) {
    return "Akun sedang dinonaktifkan. Hubungi Ketua Pemuda.";
  }
  if (message.includes("15 menit")) {
    return "Akun terkunci sementara. Coba lagi setelah 15 menit.";
  }
  if (message.includes("verifikasi tambahan")) {
    return "Akun memerlukan verifikasi tambahan oleh Ketua Pemuda.";
  }
  if (error.status === 429 || code.includes("rate_limit") || message.includes("too many requests")) {
    return "Terlalu banyak percobaan login. Tunggu sebentar lalu coba lagi.";
  }
  if (code === "invalid_credentials" || message.includes("invalid login credentials")) {
    return "Email atau password tidak sesuai. Periksa kembali lalu coba lagi.";
  }

  return "Login belum berhasil diproses oleh layanan autentikasi. Coba lagi beberapa saat.";
}

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
      // Log only non-sensitive diagnostics. Never log credentials or tokens.
      console.error("[auth] signInWithPassword failed", {
        code: error.code,
        status: error.status,
      });
      return { error: getLoginErrorMessage(error) };
    }
  } catch (error) {
    console.error("[auth] sign-in handler failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return { error: "Layanan autentikasi sedang bermasalah. Coba lagi beberapa saat atau hubungi administrator." };
  }

  redirect("/dashboard");
}
