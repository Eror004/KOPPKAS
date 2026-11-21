import { formatContribution } from "./contracts";

/** A payment row from the authoritative book read model, not a member aggregate. */
export type MonthlyBookRow = {
  paymentId: string;
  memberNameSnapshot: string | null;
  amount: number | string;
};

/** Availability must come from the backend's provenance, never the row count. */
export type MonthlyBookData =
  | { kind: "available"; rows: readonly MonthlyBookRow[] }
  | { kind: "historical_unavailable" }
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "restricted" };

export function MonthlyBook({ data }: { data: MonthlyBookData }) {
  if (data.kind === "loading") return <p role="status">Memuat buku kas…</p>;
  if (data.kind === "error") return <p role="alert">Buku kas belum dapat dimuat. Silakan coba lagi.</p>;
  if (data.kind === "restricted") return <p role="status">Anda tidak memiliki akses ke buku kas ini.</p>;
  if (data.kind === "historical_unavailable") return <p role="status">Data historis tidak tersedia.</p>;
  if (!data.rows.length) return <p role="status">Belum ada transaksi tercatat.</p>;

  return <table className="monthly-book-table">
    <thead><tr><th scope="col">NAMA</th><th scope="col">NOMINAL</th></tr></thead>
    <tbody>{data.rows.map(row => <tr key={row.paymentId}>
      <td>{row.memberNameSnapshot?.trim() || "Nama historis tidak tersedia"}</td>
      <td>{(typeof row.amount === "number" || (typeof row.amount === "string" && row.amount.trim() !== "")) && Number.isFinite(Number(row.amount)) && Number(row.amount) > 0 ? formatContribution(row.amount) : "Nominal tidak tersedia"}</td>
    </tr>)}</tbody>
  </table>;
}
