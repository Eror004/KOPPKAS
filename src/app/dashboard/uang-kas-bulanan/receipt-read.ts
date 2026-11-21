import "server-only";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REFERENCE = /^KAS-[0-9]{4}(0[1-9]|1[0-2])-[0-9a-f]{32}$/i;
const MONTH = /^[1-9]\d{3}-(0[1-9]|1[0-2])-01$/;
export type Receipt = { payment_id: string; payment_reference: string; member_name: string | null;
  recorded_by_name: string | null; amount: string | number; paid_at: string; dues_month: string;
  status_after_transaction: "lunas" | "belum_bayar" };

/** Uses PR #25 snapshot-only receipt projection. Call after monthly_dues read authorization. */
export async function readReceipt(search: string): Promise<{ receipt?: Receipt; error?: string }> {
  const value = search.trim();
  if (!UUID.test(value) && !REFERENCE.test(value)) return { error: "Masukkan ID atau referensi transaksi lengkap yang valid." };
  try {
    const supabase = await createClient();
    const field = UUID.test(value) ? "payment_id" : "payment_reference";
    const normalized = field === "payment_reference" ? value.toUpperCase() : value;
    const { data, error } = await supabase.from("monthly_dues_payment_receipts")
      .select("payment_id, payment_reference, member_name, recorded_by_name, amount, paid_at, dues_month, status_after_transaction")
      .eq(field, normalized).maybeSingle();
    if (error || !data) return { error: "Bukti tidak ditemukan atau tidak dapat diakses." };
    if (typeof data.payment_id !== "string" || !UUID.test(data.payment_id) || typeof data.payment_reference !== "string" || !REFERENCE.test(data.payment_reference)
        || (data.member_name !== null && typeof data.member_name !== "string")
        || (data.recorded_by_name !== null && typeof data.recorded_by_name !== "string")
        || (typeof data.amount !== "string" && typeof data.amount !== "number") || !String(data.amount).trim()
        || !Number.isFinite(Number(data.amount)) || Number(data.amount) <= 0
        || typeof data.paid_at !== "string" || !Number.isFinite(Date.parse(data.paid_at))
        || typeof data.dues_month !== "string" || !MONTH.test(data.dues_month)
        || (data.status_after_transaction !== "lunas" && data.status_after_transaction !== "belum_bayar")) {
      return { error: "Bukti tersimpan belum dapat ditampilkan karena data tidak valid." };
    }
    return { receipt: data as Receipt };
  } catch {
    return { error: "Bukti transaksi belum dapat dimuat. Silakan coba lagi." };
  }
}
