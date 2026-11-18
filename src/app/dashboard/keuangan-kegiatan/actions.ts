"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireModulePermission } from "@/lib/auth/require-role";

export type EventFinanceState = { success?: string; error?: string };

export async function createEventFinanceEntry(_previous: EventFinanceState, formData: FormData): Promise<EventFinanceState> {
  const user = await requireModulePermission("event_finance", "create");
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
  const { error } = await supabase.from("event_ledger_entries").insert({
    event_id: eventId, direction, amount, description, created_by: user.profile.id,
    idempotency_key: idempotencyKey,
  });

  if (error?.code === "23505") {
    const { data: existing } = await supabase.from("event_ledger_entries")
      .select("event_id,direction,amount,description,created_by")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (
      existing &&
      existing.event_id === eventId &&
      existing.direction === direction &&
      Number(existing.amount) === amount &&
      existing.description === description &&
      existing.created_by === user.profile.id
    ) {
      revalidatePath("/dashboard/keuangan-kegiatan");
      return { success: "Transaksi ini sudah tercatat sebelumnya." };
    }
    return { error: "Kunci transaksi sudah digunakan untuk data yang berbeda." };
  }

  if (error) return { error: "Transaksi kegiatan gagal disimpan." };
  revalidatePath("/dashboard/keuangan-kegiatan");
  return { success: "Transaksi berhasil dicatat pada buku kegiatan." };
}