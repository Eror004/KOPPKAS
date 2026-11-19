"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireModulePermission } from "@/lib/auth/require-role";
import { isAppRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

const accountPath = "/dashboard/akun";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidPattern = /^[0-9a-f-]{36}$/i;

function finish(kind: "success" | "error", message: string): never {
  redirect(`${accountPath}?${kind}=${encodeURIComponent(message)}`);
}

async function callAccountAdmin(body: Record<string, unknown>) {
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke("account-admin", { body });
  if (error) {
    const context = (error as { context?: Response }).context;
    if (context) {
      try {
        const payload = await context.clone().json() as { error?: string };
        if (payload.error) return { error: payload.error };
      } catch {
        // Return a safe generic message if the function response is not JSON.
      }
    }
    return { error: "Layanan manajemen akun belum tersedia. Pastikan Edge Function account-admin sudah di-deploy." };
  }
  if (!data || data.ok !== true) {
    return { error: typeof data?.error === "string" ? data.error : "Permintaan manajemen akun gagal diproses." };
  }
  return { message: typeof data.message === "string" ? data.message : "Perubahan berhasil disimpan." };
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

  const result = await callAccountAdmin({ action: "create", fullName, email, password, role });
  if (result.error) finish("error", result.error);

  revalidatePath(accountPath);
  finish("success", result.message ?? "Akun baru berhasil dibuat.");
}

export async function updateAccount(formData: FormData) {
  await requireModulePermission("accounts", "manage");
  const targetId = String(formData.get("user_id") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const role = String(formData.get("role") ?? "");
  const isActive = ["on", "true"].includes(String(formData.get("is_active") ?? ""));

  if (!uuidPattern.test(targetId)) finish("error", "Akun tujuan tidak valid.");
  if (fullName.length < 2 || fullName.length > 120) finish("error", "Nama harus berisi 2–120 karakter.");
  if (!isAppRole(role)) finish("error", "Jabatan akun tidak valid.");

  const result = await callAccountAdmin({
    action: "update",
    userId: targetId,
    fullName,
    role,
    isActive,
  });
  if (result.error) finish("error", result.error);

  revalidatePath(accountPath);
  finish("success", result.message ?? "Data dan hak akses akun berhasil diperbarui.");
}

export async function resetAccountPassword(formData: FormData) {
  await requireModulePermission("accounts", "manage");
  const targetId = String(formData.get("user_id") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!uuidPattern.test(targetId)) finish("error", "Akun tujuan tidak valid.");
  if (password.length < 5 || password.length > 128) finish("error", "Password baru harus berisi 5–128 karakter.");

  const result = await callAccountAdmin({ action: "reset_password", userId: targetId, password });
  if (result.error) finish("error", result.error);

  revalidatePath(accountPath);
  finish("success", result.message ?? "Password akun berhasil diperbarui.");
}

export async function unlockAccount(formData: FormData) {
  await requireModulePermission("accounts", "manage");
  const targetId = String(formData.get("user_id") ?? "");
  if (!uuidPattern.test(targetId)) finish("error", "Akun tujuan tidak valid.");

  const result = await callAccountAdmin({ action: "unlock", userId: targetId });
  if (result.error) finish("error", result.error);

  revalidatePath(accountPath);
  finish("success", result.message ?? "Status penguncian login berhasil direset.");
}
