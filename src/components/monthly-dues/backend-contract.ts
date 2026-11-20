export type BackendDuesStatus = "lunas" | "belum_bayar";
export type DuesMemberOption = {
  memberId: string;
  fullName: string;
  monthlyDuesId: string | null;
  paidAmount: string | number | null;
  paymentStatus: BackendDuesStatus | null;
};
export type DuesMemberSearchResult = { members: DuesMemberOption[]; hasMore?: boolean; error?: string };
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
  status_after_transaction: BackendDuesStatus;
};
export type ReceiptResult = { receipt?: DuesPaymentReceipt; error?: string };
export type MonthlyDuesPeriodOption = { dues_month: string; opened_at: string };
export type MonthlyDuesCashBookSummary = {
  dues_month: string;
  opening_balance: string | number;
  income_amount: string | number;
  expense_amount: string | number;
  closing_balance: string | number;
};
export type MonthlyDuesCashMovement = {
  movement_key: string;
  transaction_id: string | null;
  dues_month: string;
  occurred_at: string;
  movement_type: "saldo_awal" | "pemasukan_iuran" | "pengeluaran";
  description: string;
  amount: string | number;
  recorded_by: string | null;
  note: string | null;
  immutable: boolean;
};
export type MonthlyDuesCashBookResult = {
  summary?: MonthlyDuesCashBookSummary;
  movements: MonthlyDuesCashMovement[];
  movementCount?: number;
  page?: number;
  pageSize?: number;
  hasMore?: boolean;
  error?: string;
};

export type DuesActionState = { success?: string; error?: string; transactionId?: string };
