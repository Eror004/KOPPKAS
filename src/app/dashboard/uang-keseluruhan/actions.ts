"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireModulePermission } from "@/lib/auth/require-role";

export type LedgerActionState = { success?: string; error?: string };

export async function recordManualLedgerEntry(
  _previous: LedgerActionState,
  formData: FormData,
): Promise<LedgerActionState> {
  const user = await requireModulePermission("general_finance", "create");
  const idempotencyKey = String(formData.get("idempotency_key") ?? "");
  const direction = String(formData.get("direction") ?? "");
  const amount = Number(formData.get("amount"));
  const description = String(formData.get("description") ?? "").trim();

  if (!/^[0-9a-f-]{36}$/i.test(idempotencyKey)) return { error: "Kunci transaksi tidak valid. Muat ulang formulir." };
  if (direction !== "masuk" && direction !== "keluar") return { error: "Arah transaksi tidak valid." };
  if (!Number.isFinite(amount) || amount <= 0 || amount > 9999999999999.99) return { error: "Nominal harus lebih dari nol." };
  if (description.length < 2 || description.length > 240) return { error: "Keterangan harus berisi 2–240 karakter." };

  const supabase = await createClient();
  const payload = {
    direction,
    amount,
    description,
    source_type: "manual",
    source_id: idempotencyKey,
    created_by: user.profile.id,
  };
  const { error } = await supabase.from("general_ledger_entries").insert(payload);

  if (error?.code === "23505") {
    const { data: existing } = await supabase.from("general_ledger_entries")
      .select("direction,amount,description,created_by")
      .eq("source_type", "manual")
      .eq("source_id", idempotencyKey)
      .maybeSingle();
    if (
      existing &&
      existing.direction === direction &&
      Number(existing.amount) === amount &&
      existing.description === description &&
      existing.created_by === user.profile.id
    ) {
      revalidatePath("/dashboard/uang-keseluruhan");
      return { success: "Transaksi ini sudah tercatat sebelumnya." };
    }
    return { error: "Kunci transaksi sudah digunakan untuk data yang berbeda." };
  }

  if (error) return { error: "Transaksi gagal dicatat. Periksa hak akses dan koneksi database." };
  revalidatePath("/dashboard/uang-keseluruhan");
  return { success: "Transaksi berhasil dicatat pada Uang Keseluruhan." };
}
