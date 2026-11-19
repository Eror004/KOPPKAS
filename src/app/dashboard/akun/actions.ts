"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireModulePermission } from "@/lib/auth/require-role";
import { isAppRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const accountPath = "/dashboard/akun";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidPattern = /^[0-9a-f-]{36}$/i;

function finish(kind: "success" | "error", message: string): never {
  redirect(`${accountPath}?${kind}=${encodeURIComponent(message)}`);
}

export async function createAccount(formData: FormData) {
  const actor = await requireModulePermission("accounts", "create");

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

  // The on_auth_user_created trigger has already inserted a role-less profile.
  // Update that row instead of inserting a duplicate profile for the same Auth user.
  const { data: profile, error: profileError } = await admin.from("profiles")
    .update({ full_name: fullName, role, is_active: true })
    .eq("id", created.user.id)
    .select("id")
    .maybeSingle();

  if (profileError || !profile) {
    await admin.auth.admin.deleteUser(created.user.id);
    finish("error", "Profil akun gagal diperbarui. Pembuatan akun dibatalkan.");
  }

  const { error: auditError } = await admin.from("activity_logs").insert({
    actor_id: actor.profile.id,
    action: "create",
    resource_type: "profile",
    resource_id: created.user.id,
    metadata: { changed_fields: ["full_name", "role", "is_active"] },
  });
  if (auditError) {
    await admin.from("profiles").delete().eq("id", created.user.id);
    await admin.auth.admin.deleteUser(created.user.id);
    finish("error", "Akun dibatalkan karena catatan audit tidak dapat disimpan.");
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
    .select("id,full_name,role,is_active")
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
  const { error: auditError } = await admin.from("activity_logs").insert({
    actor_id: actor.profile.id,
    action: "update",
    resource_type: "profile",
    resource_id: targetId,
    metadata: { changed_fields: ["full_name", "role", "is_active"] },
  });
  if (auditError) {
    await admin.from("profiles").update({ full_name: target.full_name, role: target.role, is_active: target.is_active }).eq("id", targetId);
    finish("error", "Perubahan dibatalkan karena catatan audit tidak dapat disimpan.");
  }
  revalidatePath(accountPath);
  finish("success", "Data dan hak akses akun berhasil diperbarui.");
}

export async function resetAccountPassword(formData: FormData) {
  const actor = await requireModulePermission("accounts", "manage");
  const targetId = String(formData.get("user_id") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!uuidPattern.test(targetId)) finish("error", "Akun tujuan tidak valid.");
  if (password.length < 5 || password.length > 128) finish("error", "Password baru harus berisi 5–128 karakter.");

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(targetId, { password });
  if (error) finish("error", "Password akun gagal diperbarui.");
  const sessionClient = await createClient();
  const { error: sessionError } = targetId === actor.profile.id
    ? await sessionClient.rpc("revoke_other_app_sessions")
    : await sessionClient.rpc("revoke_user_app_sessions", { p_user_id: targetId });
  if (sessionError) finish("error", "Password berubah, tetapi sesi perangkat lama belum berhasil dicabut. Periksa keamanan akun.");
  const { error: unlockError } = await admin.from("login_protection_attempts").delete().eq("user_id", targetId);
  if (unlockError) finish("error", "Password berubah, tetapi status penguncian belum dapat direset. Periksa migrasi perlindungan login.");
  const { error: auditError } = await admin.from("activity_logs").insert({
    actor_id: actor.profile.id,
    action: "password_reset",
    resource_type: "auth_user",
    resource_id: targetId,
    metadata: {},
  });
  if (auditError) finish("error", "Password berhasil diubah, tetapi catatan audit gagal disimpan. Periksa log aktivitas.");

  revalidatePath(accountPath);
  finish("success", "Password akun berhasil diperbarui dan status penguncian direset. Sampaikan password sementara melalui kanal aman.");
}

export async function unlockAccount(formData: FormData) {
  const actor = await requireModulePermission("accounts", "manage");
  const targetId = String(formData.get("user_id") ?? "");
  if (!uuidPattern.test(targetId)) finish("error", "Akun tujuan tidak valid.");

  const admin = createAdminClient();
  const { error } = await admin.from("login_protection_attempts").delete().eq("user_id", targetId);
  if (error) finish("error", "Status penguncian gagal direset. Pastikan migrasi perlindungan login sudah diterapkan.");
  const { error: auditError } = await admin.from("activity_logs").insert({
    actor_id: actor.profile.id,
    action: "login_protection_reset",
    resource_type: "auth_user",
    resource_id: targetId,
    metadata: {},
  });
  if (auditError) finish("error", "Status penguncian telah direset, tetapi catatan audit gagal disimpan.");

  revalidatePath(accountPath);
  finish("success", "Status penguncian login berhasil direset oleh Ketua Pemuda.");
}
