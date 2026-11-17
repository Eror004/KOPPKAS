"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireModulePermission } from "@/lib/auth/require-role";

export type DuesActionState = { success?: string; error?: string };

export async function generateMonthlyRegister(previous: DuesActionState, formData: FormData): Promise<DuesActionState> {
  void previous;
  void formData;
  const user = await requireModulePermission("monthly_dues", "create");
  if (!["ketua_pemuda", "wakil_ketua_pemuda", "bendahara"].includes(user.role)) {
    return { error: "Hanya Ketua, Wakil Ketua, atau Bendahara yang dapat membuat daftar kas bulanan." };
  }

  const supabase = await createClient();
  const month = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }).slice(0, 7) + "-01";
  const { data: members, error: membersError } = await supabase
    .from("members").select("id").is("archived_at", null);

  if (membersError) return { error: "Daftar anggota belum dapat dibaca." };
  if (!members?.length) return { error: "Belum ada anggota aktif untuk dibuatkan daftar kas." };

  const rows = members.map((member) => ({
    member_id: member.id,
    dues_month: month,
    reference_amount: 10000,
  }));

  const { error } = await supabase.from("monthly_dues")
    .upsert(rows, { onConflict: "member_id,dues_month", ignoreDuplicates: true });

  if (error) return { error: "Daftar kas bulanan gagal dibuat." };
  revalidatePath("/dashboard/uang-kas-bulanan");
  return { success: "Daftar kas bulan berjalan berhasil disiapkan." };
}

export async function recordDuesPayment(_previous: DuesActionState, formData: FormData): Promise<DuesActionState> {
  await requireModulePermission("monthly_dues", "create");
  const monthlyDuesId = String(formData.get("monthly_dues_id") ?? "");
  const amount = Number(formData.get("amount"));
  const idempotencyKey = String(formData.get("idempotency_key") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (!/^[0-9a-f-]{36}$/i.test(monthlyDuesId) || !/^[0-9a-f-]{36}$/i.test(idempotencyKey)) {
    return { error: "Data pembayaran tidak valid." };
  }
  if (!Number.isFinite(amount) || amount <= 0 || amount > 9999999999999.99) {
    return { error: "Nominal pembayaran harus lebih dari nol." };
  }
  if (note.length > 500) return { error: "Catatan terlalu panjang." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_monthly_dues_payment", {
    p_monthly_dues_id: monthlyDuesId,
    p_amount: amount,
    p_idempotency_key: idempotencyKey,
    p_note: note || null,
  });
  if (error) return { error: "Pembayaran gagal dicatat. Periksa hak akses dan koneksi database." };
  revalidatePath("/dashboard/uang-kas-bulanan");
  return { success: "Pembayaran berhasil dicatat." };
}