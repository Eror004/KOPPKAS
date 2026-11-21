/** Preparation only: no RPC is invoked here and the payment UI remains disabled. */
export type PaymentIntent = Readonly<{
  actorId: string;
  bookMonth: string;
  registerId: string;
  key: string;
  amount: string;
  note: string | null;
}>;
export type PaymentInput = { actorId: string; bookMonth: string; registerId: string; amount: string; note: string };
export type PaymentOutcome =
  | { kind: "committed"; transactionId: string }
  | { kind: "unconfirmed"; message: string }
  | { kind: "validation" | "authorization" | "database"; message: string };
export type RpcResult = { data: unknown; error: { code?: string } | null };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONTH = /^[1-9]\d{3}-(0[1-9]|1[0-2])-01$/;

export function normalizePaymentAmount(input: string): string {
  const value = input.trim();
  if (!/^\d{1,13}(?:\.\d{1,2})?$/.test(value)) throw new Error("Nominal tidak valid.");
  const [whole, fraction = ""] = value.split(".");
  const result = `${whole.replace(/^0+(?=\d)/, "")}.${fraction.padEnd(2, "0")}`;
  if (result === "0.00") throw new Error("Nominal harus lebih dari nol.");
  return result;
}

/** Caller supplies a new secure UUID only for a new, fully resolved operation. */
export function createPaymentIntent(input: PaymentInput, key: string): PaymentIntent {
  if (!UUID.test(input.actorId) || !UUID.test(input.registerId) || !UUID.test(key) || !MONTH.test(input.bookMonth)) {
    throw new Error("Identitas pembayaran tidak valid.");
  }
  const note = input.note.trim();
  if (note.length > 500) throw new Error("Catatan terlalu panjang.");
  return Object.freeze({ actorId: input.actorId.toLowerCase(), bookMonth: input.bookMonth,
    registerId: input.registerId.toLowerCase(), key: key.toLowerCase(), amount: normalizePaymentAmount(input.amount), note: note || null });
}

/** A retry must use the original immutable intent, never a newly edited form. */
export function validatePaymentRetry(intent: PaymentIntent, input: PaymentInput): PaymentIntent {
  const candidate = createPaymentIntent(input, intent.key);
  if (candidate.actorId !== intent.actorId || candidate.bookMonth !== intent.bookMonth ||
      candidate.registerId !== intent.registerId || candidate.amount !== intent.amount || candidate.note !== intent.note) {
    throw new Error("Data transaksi berubah; selesaikan rekonsiliasi transaksi sebelumnya.");
  }
  return intent;
}

/** Map only an explicit SQLSTATE to a definite rejection; network/invalid results are ambiguous. */
export function classifyPaymentOutcome(result: RpcResult | null, previousUnknown = false): PaymentOutcome {
  if (result && !result.error && typeof result.data === "string" && UUID.test(result.data)) {
    return { kind: "committed", transactionId: result.data };
  }
  const code = result?.error?.code;
  // A later rejection does not prove the earlier ambiguous request didn't commit.
  if (previousUnknown || !code || !/^[0-9A-Z]{5}$/.test(code) || code.startsWith("PGRST") ||
      code.startsWith("08") || code === "40003" || code.startsWith("57P0")) {
    return { kind: "unconfirmed", message: "BELUM TERKONFIRMASI. Periksa ulang transaksi yang sama sebelum membuat transaksi baru." };
  }
  if (code === "42501" || code.startsWith("28")) return { kind: "authorization", message: "Akun tidak berwenang mencatat pembayaran." };
  if (code.startsWith("22")) return { kind: "validation", message: "Data pembayaran ditolak. Periksa kembali sebelum mencoba." };
  return { kind: "database", message: "Database menolak pembayaran. Periksa transaksi sebelum mencoba kembali." };
}
