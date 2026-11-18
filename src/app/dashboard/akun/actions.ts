"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireModulePermission } from "@/lib/auth/require-role";
import { isAppRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";

const accountPath = "/dashboard/akun";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidPattern = /^[0-9a-f-]{36}$/i;

function finish(kind: "success" | "error", message: string): never {
  redirect(`${accountPath}?${kind}=${encodeURIComponent(message)}`);
}

export async function createAccount(formData: FormData) {
  await requireModulePermission("accounts", "create");

  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "");

  if (fullName.length < 2 || fullName.length > 120) finish("error", "Nama harus berisi 2–120 karakter.");
  if (!emailPattern.test(email) || email.length > 254) finish("error", "Alamat email tidak valid.");
  if (password.length < 5 || password.length > 128) finish("error", "Password harus berisi 5–128 karakter.");
  if (!isAppRole(role)) finish("error", "Jabatan akun tidak valid.");

  const admin = createAdminClient();
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !created.user) finish("error", "Akun gagal dibuat. Periksa email dan konfigurasi Auth.");

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    full_name: fullName,
    role,
    is_active: true,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    finish("error", "Profil akun gagal dibuat. Pembuatan akun dibatalkan.");
  }

  revalidatePath(accountPath);
  finish("success", "Akun baru berhasil dibuat.");
}

export async function updateAccount(formData: FormData) {
  const actor = await requireModulePermission("accounts", "manage");
  const targetId = String(formData.get("user_id") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const role = String(formData.get("role") ?? "");
  const isActive = ["on", "true"].includes(String(formData.get("is_active") ?? ""));

  if (!uuidPattern.test(targetId)) finish("error", "Akun tujuan tidak valid.");
  if (fullName.length < 2 || fullName.length > 120) finish("error", "Nama harus berisi 2–120 karakter.");
  if (!isAppRole(role)) finish("error", "Jabatan akun tidak valid.");
  if (targetId === actor.profile.id && (role !== actor.role || !isActive)) {
    finish("error", "Ketua tidak dapat menurunkan jabatan atau menonaktifkan akunnya sendiri.");
  }

  const admin = createAdminClient();
  const { data: target, error: targetError } = await admin.from("profiles")
    .select("id,role,is_active")
    .eq("id", targetId)
    .maybeSingle();

  if (targetError || !target) finish("error", "Akun tidak ditemukan.");

  if (target.role === "ketua_pemuda" && (role !== "ketua_pemuda" || !isActive)) {
    const { count, error } = await admin.from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "ketua_pemuda")
      .eq("is_active", true);
    if (error || (count ?? 0) <= 1) {
      finish("error", "Minimal harus ada satu akun Ketua Pemuda yang aktif.");
    }
  }

  const { error } = await admin.from("profiles")
    .update({ full_name: fullName, role, is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", targetId);

  if (error) finish("error", "Perubahan akun gagal disimpan.");
  revalidatePath(accountPath);
  finish("success", "Data dan hak akses akun berhasil diperbarui.");
}

export async function resetAccountPassword(formData: FormData) {
  await requireModulePermission("accounts", "manage");
  const targetId = String(formData.get("user_id") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!uuidPattern.test(targetId)) finish("error", "Akun tujuan tidak valid.");
  if (password.length < 5 || password.length > 128) finish("error", "Password baru harus berisi 5–128 karakter.");

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(targetId, { password });
  if (error) finish("error", "Password akun gagal diperbarui.");
  const { error: unlockError } = await admin.from("login_protection_attempts").delete().eq("user_id", targetId);
  if (unlockError) finish("error", "Password berubah, tetapi status penguncian belum dapat direset. Periksa migrasi perlindungan login.");

  revalidatePath(accountPath);
  finish("success", "Password akun berhasil diperbarui dan status penguncian direset. Sampaikan password sementara melalui kanal aman.");
}

export async function unlockAccount(formData: FormData) {
  await requireModulePermission("accounts", "manage");
  const targetId = String(formData.get("user_id") ?? "");
  if (!uuidPattern.test(targetId)) finish("error", "Akun tujuan tidak valid.");

  const admin = createAdminClient();
  const { error } = await admin.from("login_protection_attempts").delete().eq("user_id", targetId);
  if (error) finish("error", "Status penguncian gagal direset. Pastikan migrasi perlindungan login sudah diterapkan.");

  revalidatePath(accountPath);
  finish("success", "Status penguncian login berhasil direset oleh Ketua Pemuda.");
}
