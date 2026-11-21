import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireModulePermission } from "@/lib/auth/require-role";
import type { MonthlyDuesCashBookResult, MonthlyDuesCashMovement, MonthlyDuesCashBookSummary } from "./actions";

const MONTH = /^[1-9]\d{3}-(0[1-9]|1[0-2])-01$/;
const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
const KEY = /^(?:0:opening:[1-9]\d{3}-(?:0[1-9]|1[0-2])-01|[12]:(?:payment|expense):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
const PAGE_SIZE = 50;
type Cursor = { month: string; at: string; key: string; highWater: string };

function parseCursor(value: string, month: string): Cursor | null {
  if (value.length > 768 || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const cursor = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    return cursor && cursor.month === month && typeof cursor.at === "string" && TIME.test(cursor.at) && Number.isFinite(Date.parse(cursor.at))
      && typeof cursor.key === "string" && KEY.test(cursor.key) && typeof cursor.highWater === "string"
      && TIME.test(cursor.highWater) && Number.isFinite(Date.parse(cursor.highWater)) ? cursor : null;
  } catch { return null; }
}

function encodeCursor(month: string, highWater: string, item: MonthlyDuesCashMovement): string {
  return Buffer.from(JSON.stringify({ month, at: item.occurred_at, key: item.movement_key, highWater })).toString("base64url");
}

/**
 * Keyset pagination is pinned to an immutable database-recorded_at high-water mark.
 * This excludes rows inserted after page one even when their occurred_at is backdated.
 * The official summary is always read separately and is never calculated from this page.
 */
export async function readCashBook(month: string, after?: string): Promise<MonthlyDuesCashBookResult & { nextCursor?: string }> {
  await requireModulePermission("general_finance", "read");
  if (!MONTH.test(month)) return { movements: [], error: "Periode kas tidak valid." };
  const cursor = after === undefined ? undefined : parseCursor(after, month);
  if (after !== undefined && !cursor) return { movements: [], error: "Kursor mutasi tidak valid." };
  try {
    const supabase = await createClient();
    const summaryQuery = supabase.from("monthly_dues_cash_book_summary")
      .select("dues_month, opening_balance, income_amount, expense_amount, closing_balance, data_status, cash_balance_status")
      .eq("dues_month", month).maybeSingle();
    const highWaterQuery = cursor
      ? Promise.resolve({ data: { recorded_at: cursor.highWater }, error: null })
      : supabase.from("monthly_dues_cash_book_movements").select("recorded_at")
          .eq("dues_month", month).order("recorded_at", { ascending: false }).limit(1).maybeSingle();
    const [{ data: summary, error: summaryError }, { data: highWaterRow, error: highWaterError }] = await Promise.all([summaryQuery, highWaterQuery]);
    if (summaryError || highWaterError || !summary || summary.dues_month !== month) {
      return { movements: [], error: "Pembukuan kas belum dapat dimuat." };
    }
    if (!highWaterRow) return { summary: summary as MonthlyDuesCashBookSummary, movements: [], hasMore: false };
    const highWater = highWaterRow.recorded_at;
    if (typeof highWater !== "string" || !TIME.test(highWater) || !Number.isFinite(Date.parse(highWater))) {
      return { movements: [], error: "Batas snapshot mutasi tidak valid." };
    }
    let query = supabase.from("monthly_dues_cash_book_movements")
      .select("movement_key, transaction_id, dues_month, occurred_at, recorded_at, movement_type, description, amount, recorded_by, note, immutable")
      .eq("dues_month", month).lte("recorded_at", highWater)
      .order("occurred_at", { ascending: true }).order("movement_key", { ascending: true }).limit(PAGE_SIZE + 1);
    if (cursor) query = query.or('occurred_at.gt."'+cursor.at+'",and(occurred_at.eq."'+cursor.at+'",movement_key.gt."'+cursor.key+'")');
    const { data, error } = await query;
    if (error || !Array.isArray(data)) return { movements: [], error: "Pembukuan kas belum dapat dimuat." };
    if (data.some(item => item.dues_month !== month || typeof item.movement_key !== "string" || !KEY.test(item.movement_key)
      || typeof item.occurred_at !== "string" || !TIME.test(item.occurred_at) || !Number.isFinite(Date.parse(item.occurred_at))
      || typeof item.recorded_at !== "string" || !TIME.test(item.recorded_at) || !Number.isFinite(Date.parse(item.recorded_at))
      || Date.parse(item.recorded_at) > Date.parse(highWater) || typeof item.description !== "string"
      || (item.recorded_by !== null && typeof item.recorded_by !== "string"))) {
      return { movements: [], error: "Data mutasi kas tidak valid." };
    }
    const movements = data.slice(0, PAGE_SIZE) as MonthlyDuesCashMovement[];
    const hasMore = data.length > PAGE_SIZE;
    return { summary: summary as MonthlyDuesCashBookSummary, movements, hasMore,
      nextCursor: hasMore ? encodeCursor(month, highWater, movements[movements.length - 1]) : undefined };
  } catch { return { movements: [], error: "Pembukuan kas belum dapat dimuat." }; }
}
