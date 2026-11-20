"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireModulePermission } from "@/lib/auth/require-role";

export type DuesActionState = {
  success?: string;
  error?: string;
  transactionId?: string;
};

export type DuesMemberOption = {
  memberId: string;
  fullName: string;
  monthlyDuesId: string | null;
  paidAmount: string | number | null;
  paymentStatus: "lunas" | "kurang" | "belum_bayar" | null;
};

export type DuesMemberSearchResult = {
  members: DuesMemberOption[];
  error?: string;
};

export type DuesMemberCreationResult =
  | { status: "created"; member_id: string; monthly_dues_id: string; full_name: string }
  | { status: "duplicate_candidates"; matches: Array<{ id: string; full_name: string }> };

export type DuesPaymentReceipt = {
  payment_reference: string;
  payment_id: string;
  monthly_dues_id: string;
  member_id: string;
  member_name: string;
  amount: string | number;
  paid_at: string;
  dues_month: string;
  note: string | null;
  recorded_by: string;
  recorded_by_name: string | null;
  reference_amount: string | number;
  paid_amount_after_transaction: string | number;
  status_after_transaction: "lunas" | "kurang" | "belum_bayar";
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-01$/;

function isValidMonth(value: string): boolean {
  if (!MONTH_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

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

/** Search active membership by name, but always return the stable member UUID. */
export async function searchDuesMembers(query: string, duesMonth: string): Promise<DuesMemberSearchResult> {
  await requireModulePermission("monthly_dues", "read");
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 2 || normalizedQuery.length > 80 || !isValidMonth(duesMonth)) return { members: [] };

  // Escape ILIKE wildcards so user input is treated as a literal substring.
  const escapedQuery = normalizedQuery.replace(/[\\%_]/g, "\\$&");
  const supabase = await createClient();
  const { data: members, error } = await supabase
    .from("members")
    .select("id, full_name")
    .is("archived_at", null)
    .ilike("full_name", `%${escapedQuery}%`)
    .order("full_name", { ascending: true })
    .limit(15);

  if (error) return { members: [], error: "Pencarian anggota belum dapat dilakukan." };
  if (!members?.length) return { members: [] };
  const memberIds = members.map((member) => member.id);
  const { data: duesRows, error: duesError } = await supabase
    .from("monthly_dues_summary")
    .select("id, member_id, paid_amount, payment_status")
    .eq("dues_month", duesMonth)
    .in("member_id", memberIds);

  if (duesError) return { members: [], error: "Status daftar kas periode ini belum dapat dimuat." };

  const duesByMember = new Map((duesRows ?? []).map((row) => [row.member_id, row]));
  return { members: members.map((member) => {
    const dues = duesByMember.get(member.id);
    return {
      memberId: member.id,
      fullName: member.full_name,
      monthlyDuesId: dues?.id ?? null,
      paidAmount: dues?.paid_amount ?? null,
      paymentStatus: dues?.payment_status ?? null,
    };
  }) };
}

/** Ensure an existing active member has exactly one register row for the selected month. */
export async function ensureDuesRegister(memberId: string, duesMonth: string): Promise<{ monthlyDuesId?: string; error?: string }> {
  await requireModulePermission("monthly_dues", "create");
  if (!UUID_PATTERN.test(memberId) || !isValidMonth(duesMonth)) {
    return { error: "Anggota atau periode kas tidak valid." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ensure_monthly_dues_for_member", {
    p_member_id: memberId,
    p_dues_month: duesMonth,
  });
  if (error || typeof data !== "string" || !UUID_PATTERN.test(data)) {
    return { error: "Daftar kas anggota untuk periode ini gagal disiapkan." };
  }

  revalidatePath("/dashboard/uang-kas-bulanan");
  return { monthlyDuesId: data };
}

/** Create a new member atomically, or return exact-name candidates for UUID selection. */
export async function createDuesMember(
  fullName: string,
  duesMonth: string,
  confirmSameName = false,
): Promise<{ result?: DuesMemberCreationResult; error?: string }> {
  await requireModulePermission("monthly_dues", "create");
  const normalizedName = fullName.trim();
  if (normalizedName.length < 2 || normalizedName.length > 120 || !isValidMonth(duesMonth)) {
    return { error: "Nama harus 2–120 karakter dan periode harus valid." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_member_and_monthly_dues_safe", {
    p_full_name: normalizedName,
    p_dues_month: duesMonth,
    p_confirm_same_name: confirmSameName,
  });

  if (error || !data || typeof data !== "object") {
    return { error: "Anggota gagal ditambahkan. Silakan coba lagi atau hubungi pengelola." };
  }

  const result = data as DuesMemberCreationResult;
  if (result.status === "created") {
    if (!UUID_PATTERN.test(result.member_id) || !UUID_PATTERN.test(result.monthly_dues_id)) {
      return { error: "Respons pembuatan anggota tidak valid. Periksa data sebelum melanjutkan." };
    }
    revalidatePath("/dashboard/uang-kas-bulanan");
    revalidatePath("/dashboard/keanggotaan");
    return { result };
  }
  if (result.status === "duplicate_candidates" && Array.isArray(result.matches)
    && result.matches.every((match) => UUID_PATTERN.test(match.id) && typeof match.full_name === "string")) {
    return { result };
  }
  return { error: "Respons pembuatan anggota tidak dikenali. Silakan coba lagi." };
}

export async function recordDuesPayment(_previous: DuesActionState, formData: FormData): Promise<DuesActionState> {
  await requireModulePermission("monthly_dues", "create");
  const monthlyDuesId = String(formData.get("monthly_dues_id") ?? "");
  const amount = Number(formData.get("amount"));
  const idempotencyKey = String(formData.get("idempotency_key") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (!UUID_PATTERN.test(monthlyDuesId) || !UUID_PATTERN.test(idempotencyKey)) {
    return { error: "Data pembayaran tidak valid." };
  }
  if (!Number.isFinite(amount) || amount <= 0 || amount > 9999999999999.99) {
    return { error: "Nominal pembayaran harus lebih dari nol." };
  }
  if (note.length > 500) return { error: "Catatan terlalu panjang." };

  const supabase = await createClient();
  const { data: transactionId, error } = await supabase.rpc("record_monthly_dues_payment", {
    p_monthly_dues_id: monthlyDuesId,
    p_amount: amount,
    p_idempotency_key: idempotencyKey,
    p_note: note || null,
  });
  if (error || typeof transactionId !== "string" || !UUID_PATTERN.test(transactionId)) {
    return { error: "Pembayaran gagal dicatat. Periksa hak akses dan koneksi database." };
  }

  revalidatePath("/dashboard/uang-kas-bulanan");
  return {
    success: "Pembayaran berhasil dicatat.",
    transactionId,
  };
}

/** Read a receipt only from a persisted payment row visible through the receipt view's RLS. */
export async function getDuesPaymentReceipt(
  transactionId: string,
): Promise<{ receipt?: DuesPaymentReceipt; error?: string }> {
  await requireModulePermission("monthly_dues", "read");
  if (!UUID_PATTERN.test(transactionId)) return { error: "Referensi transaksi tidak valid." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("monthly_dues_payment_receipts")
    .select("payment_reference, payment_id, monthly_dues_id, member_id, member_name, amount, paid_at, dues_month, note, recorded_by, recorded_by_name, reference_amount, paid_amount_after_transaction, status_after_transaction")
    .eq("payment_id", transactionId)
    .maybeSingle();

  if (error || !data) {
    return { error: "Bukti transaksi tidak ditemukan atau akun tidak memiliki akses." };
  }
  return { receipt: data as DuesPaymentReceipt };
}
