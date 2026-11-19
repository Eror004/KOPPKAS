"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireModulePermission } from "@/lib/auth/require-role";

export type EventFinanceState = { success?: string; error?: string };

export async function createEventFinanceEntry(_previous: EventFinanceState, formData: FormData): Promise<EventFinanceState> {
  await requireModulePermission("event_finance", "create");
  const eventId = String(formData.get("event_id") ?? "");
  const direction = String(formData.get("direction") ?? "");
  const amount = Number(formData.get("amount"));
  const description = String(formData.get("description") ?? "").trim();
  const idempotencyKey = String(formData.get("idempotency_key") ?? "");

  if (!/^[0-9a-f-]{36}$/i.test(eventId)) return { error: "Pilih kegiatan yang valid." };
  if (!/^[0-9a-f-]{36}$/i.test(idempotencyKey)) return { error: "Kunci transaksi tidak valid." };
  if (direction !== "masuk" && direction !== "keluar") return { error: "Arah transaksi tidak valid." };
  if (!Number.isFinite(amount) || amount <= 0 || amount > 9999999999999.99) return { error: "Nominal harus lebih dari nol." };
  if (description.length < 2 || description.length > 240) return { error: "Keterangan harus berisi 2–240 karakter." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_event_finance_entry", {
    p_event_id: eventId,
    p_direction: direction,
    p_amount: amount,
    p_description: description,
    p_idempotency_key: idempotencyKey,
  });

  if (error?.code === "23505") {
    return { error: "Kunci transaksi sudah digunakan untuk data yang berbeda." };
  }
  if (error) {
    if (error.code === "22023") return { error: "Kegiatan sudah ditutup atau data transaksi tidak valid." };
    return { error: "Transaksi kegiatan gagal disimpan. Periksa status kegiatan dan hak akses." };
  }

  revalidatePath("/dashboard/keuangan-kegiatan");
  revalidatePath("/dashboard/uang-keseluruhan");
  return { success: "Transaksi berhasil dicatat pada buku kegiatan." };
}
