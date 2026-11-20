/** Frontend boundary for the proposed PR #22 contract. No implementation is provided here. */
export type BackendDuesStatus = "lunas" | "kurang" | "belum_bayar";
export type DuesMemberOption = { memberId: string; fullName: string; monthlyDuesId: string | null; paidAmount: string | number | null; paymentStatus: BackendDuesStatus | null };
export type DuesMemberSearchResult = { members: DuesMemberOption[]; error?: string };
export type DuesMemberCreationResult =
  | { status: "created"; member_id: string; monthly_dues_id: string; full_name: string }
  | { status: "duplicate_candidates"; matches: Array<{ id: string; full_name: string }> };
export type DuesPaymentReceipt = {
  payment_reference: string; payment_id: string; monthly_dues_id: string; member_id: string; member_name: string;
  amount: string | number; paid_at: string; dues_month: string; note: string | null;
  recorded_by: string; recorded_by_name: string | null; reference_amount: string | number;
  paid_amount_after_transaction: string | number; status_after_transaction: BackendDuesStatus;
};
export type ReceiptResult = { receipt?: DuesPaymentReceipt; error?: string };
export type DuesActionState = { success?: string; error?: string; transactionId?: string };
export interface MonthlyDuesBackend {
  searchDuesMembers(query: string, duesMonth: string): Promise<DuesMemberSearchResult>;
  ensureDuesRegister(memberId: string, duesMonth: string): Promise<{ monthlyDuesId?: string; error?: string }>;
  createDuesMember(fullName: string, duesMonth: string, confirmSameName?: boolean): Promise<{ result?: DuesMemberCreationResult; error?: string }>;
  recordDuesPayment(previous: DuesActionState, formData: FormData): Promise<DuesActionState>;
  getDuesPaymentReceipt(transactionId: string): Promise<ReceiptResult>;
}
