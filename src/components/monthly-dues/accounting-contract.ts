/** Proposed frontend boundary only. No backend query or persistence exists on this branch. */
export const HISTORICAL_OCTOBER_PERIOD = "2026-10-01";
export const HISTORICAL_OCTOBER_AMOUNT = 205000;

export type AccountingMutation = Readonly<{
  id: string; period: string; occurredAt: string; direction: "in" | "out"; amount: number | string;
  description: string; recordedBy: string;
}>;
export type AccountingSnapshot = Readonly<{
  period: string; openingAmount: number | string; complete: boolean; mutations: readonly AccountingMutation[];
}>;
export type AccountingState =
  | { kind: "unavailable" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; snapshot: AccountingSnapshot };

/** Presentation boundary only, not a backend contract. Never infer status from missing rows. */
export type PeriodPresentation =
  | { period: string; status: "unopened" }
  | { period: string; status: "opened"; opening: number | string; income: number | string; expenses: number | string; closing: number | string };

/** Convert non-negative amounts to integer cents, without rounding away invalid precision. */
function cents(value: number | string): number | null {
  const raw = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) return null;
  const [whole, fractional = ""] = raw.split(".");
  const result = Number(whole) * 100 + Number(fractional.padEnd(2, "0"));
  return Number.isSafeInteger(result) ? result : null;
}

/** Only a complete, period-scoped backend snapshot can produce a running balance. */
export function runningBalance(period: string, snapshot: AccountingSnapshot): number | null {
  if (!snapshot.complete || snapshot.period !== period) return null;
  const opening = cents(snapshot.openingAmount);
  if (opening === null || (period === HISTORICAL_OCTOBER_PERIOD && opening !== HISTORICAL_OCTOBER_AMOUNT * 100)) return null;
  let total = opening;
  const ids = new Set<string>();
  for (const mutation of snapshot.mutations) {
    const amount = cents(mutation.amount);
    if (!mutation.id || ids.has(mutation.id) || mutation.period !== period || amount === null || amount <= 0 || !["in", "out"].includes(mutation.direction)) return null;
    ids.add(mutation.id);
    total += mutation.direction === "in" ? amount : -amount;
    if (!Number.isSafeInteger(total)) return null;
  }
  return total / 100;
}
