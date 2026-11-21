import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireModulePermission } from "@/lib/auth/require-role";
import type { MonthlyDuesCashBookResult, MonthlyDuesCashMovement, MonthlyDuesCashBookSummary } from "./actions";

const MONTH = /^[1-9]\d{3}-(0[1-9]|1[0-2])-01$/;
const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
const KEY = /^(?:0:opening:[1-9]\d{3}-(?:0[1-9]|1[0-2])-01|[12]:(?:payment|expense):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
const PAGE_SIZE = 50;
type Cursor = { month: string; at: string; key: string };
function parseCursor(value: string, month: string): Cursor | null {
  if (value.length > 512 || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const cursor = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    return cursor && cursor.month === month && typeof cursor.at === "string" && TIME.test(cursor.at) && Number.isFinite(Date.parse(cursor.at)) && typeof cursor.key === "string" && KEY.test(cursor.key) ? cursor : null;
  } catch { return null; }
}
function encodeCursor(month: string, item: MonthlyDuesCashMovement): string {
  return Buffer.from(JSON.stringify({ month, at: item.occurred_at, key: item.movement_key })).toString("base64url");
}

/** Keyset order is (occurred_at, movement_key), never an offset or a balance calculation. */
export async function readCashBook(month: string, after?: string): Promise<MonthlyDuesCashBookResult & { nextCursor?: string }> {
  await requireModulePermission("general_finance", "read");
  if (!MONTH.test(month)) return { movements: [], error: "Periode kas tidak valid." };
  const cursor = after === undefined ? undefined : parseCursor(after, month);
  if (after !== undefined && !cursor) return { movements: [], error: "Kursor mutasi tidak valid." };
  try {
    const supabase = await createClient();
    const summaryQuery = supabase.from("monthly_dues_cash_book_summary").select("dues_month, opening_balance, income_amount, expense_amount, closing_balance, data_status, cash_balance_status").eq("dues_month", month).maybeSingle();
    let query = supabase.from("monthly_dues_cash_book_movements").select("movement_key, transaction_id, dues_month, occurred_at, movement_type, description, amount, recorded_by, note, immutable")
      .eq("dues_month", month).order("occurred_at", { ascending: true }).order("movement_key", { ascending: true }).limit(PAGE_SIZE + 1);
    if (cursor) query = query.or(`occurred_at.gt."${cursor.at}",and(occurred_at.eq."${cursor.at}",movement_key.gt."${cursor.key}")`);
    const [{ data: summary, error: summaryError }, { data, error }] = await Promise.all([summaryQuery, query]);
    if (summaryError || error || !summary || !Array.isArray(data)) return { movements: [], error: "Pembukuan kas belum dapat dimuat." };
    if (data.some(item => item.dues_month !== month || typeof item.movement_key !== "string" || !KEY.test(item.movement_key) || typeof item.occurred_at !== "string" || !TIME.test(item.occurred_at) || !Number.isFinite(Date.parse(item.occurred_at)) || typeof item.description !== "string" || (item.recorded_by !== null && typeof item.recorded_by !== "string"))) return { movements: [], error: "Data mutasi kas tidak valid." };
    const movements = data.slice(0, PAGE_SIZE) as MonthlyDuesCashMovement[];
    return { summary: summary as MonthlyDuesCashBookSummary, movements, hasMore: data.length > PAGE_SIZE, nextCursor: data.length > PAGE_SIZE ? encodeCursor(month, movements[movements.length - 1]) : undefined };
  } catch { return { movements: [], error: "Pembukuan kas belum dapat dimuat." }; }
}
