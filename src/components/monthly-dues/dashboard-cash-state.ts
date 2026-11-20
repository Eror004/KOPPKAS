/** Dashboard presentation only. No period or amount is inferred from absent data. */
export type DashboardCashState =
  | { kind: "unavailable" }
  | { kind: "restricted" }
  | { kind: "error" }
  | { kind: "unopened" }
  | { kind: "opened"; income: number };

export function dashboardCashDisplay(state: DashboardCashState): { value: string; label: string } {
  switch (state.kind) {
    case "restricted": return { value: "—", label: "Akses terbatas" };
    case "unavailable": return { value: "—", label: "Data kas belum terhubung" };
    case "error": return { value: "—", label: "Data kas gagal dimuat" };
    case "unopened": return { value: "—", label: "Periode belum dibuka" };
    case "opened":
      if (!Number.isFinite(state.income) || state.income < 0) return { value: "—", label: "Data kas gagal dimuat" };
      return { value: new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 2 }).format(state.income), label: "Pemasukan periode terbuka" };
  }
}
