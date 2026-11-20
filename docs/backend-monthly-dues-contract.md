# Backend contract — Uang Kas Bulanan

Branch: `chatgpt/backend-monthly-dues`

## Read models

### `monthly_dues_summary`
The view keeps its existing columns and changes `payment_status` to:
- `lunas` when the member's aggregate in that month is at least Rp10,000.
- `kurang` when the aggregate is positive and below Rp10,000.
- `belum_bayar` when no positive payment rows exist.
- The aggregate remains isolated to one `monthly_dues` row (one member, one month).

### `monthly_dues_payment_receipts`
Read-only, `security_invoker` view. One row per persisted payment:
- `payment_reference`: deterministic unique reference containing the complete immutable payment UUID.
- `payment_id`, `monthly_dues_id`, `member_id`, `member_name`.
- `amount`, `paid_at`, `dues_month`, `note`.
- `recorded_by`, optional `recorded_by_name`.
- `reference_amount`, `paid_amount_after_transaction`, `status_after_transaction`.

Cumulative post-transaction status is ordered by `paid_at, payment_id`, not derived from today's aggregate. View access uses underlying RLS on monthly dues, payments, members, and profiles.

## RPC contracts

### `ensure_monthly_dues_for_member(p_member_id uuid, p_dues_month date) returns uuid`
- Requires authenticated user with one of Ketua, Wakil Ketua, Bendahara, Sekretaris.
- Requires an active existing member and first-day-of-month date.
- Inserts one register row at Rp10,000, or returns the existing row ID.
- Does not create or match a member by name.

### `create_member_and_monthly_dues_safe(p_full_name text, p_dues_month date, p_confirm_same_name boolean default false) returns jsonb`
- Requires authenticated user with one of Ketua, Wakil Ketua, Bendahara, Sekretaris.
- Serializes same-normalized-name attempts with an advisory transaction lock.
- If active exact-name candidates exist and confirmation is false, returns:
  `{ "status": "duplicate_candidates", "matches": [{ "id": "...", "full_name": "..." }] }`
- With explicit confirmation, creates a distinct new member UUID and the month's register atomically.
- If no candidates exist, creates the member and register atomically.
- Names are only a duplicate-warning signal; all later selection and payment references use UUIDs.

## Server Action response

- `recordDuesPayment` returns `transactionId` from the existing idempotent RPC after successful persistence.
- `getDuesPaymentReceipt(transactionId)` reads the receipt projection by persisted payment UUID.
- `searchDuesMembers(query, duesMonth)` searches active members by name and returns `{ members, error? }` with stable member UUIDs, including members without a period register. A query failure is distinct from an empty result.
- `ensureDuesRegister(memberId, duesMonth)` safely creates or returns the period register ID for an existing member.
- `createDuesMember(fullName, duesMonth, confirmSameName)` returns either the created member/register UUIDs or exact-name candidates for user disambiguation.

## Business rules
- Rp10,000 reference is fixed by a database constraint.
- Payments remain voluntary/manual. No bills, penalties, debts, or carryover.
- A member's payment aggregate is isolated by month.
- Multiple positive payments in one month are supported.
- No bank integration, transfer rail, or external payment provider is introduced.

## Migration / verification gate
This branch contains a prepared migration only. It has not been applied to any Supabase project.
The live migration history currently has six versions not present in `main` and two local-only versions. Reconcile that history before applying or merging schema changes.


## Historical monthly cash book and expenses

### `monthly_dues_cash_opening_balances`
- October 2026 is seeded with an immutable historical opening balance of Rp205,000.
- This row is not a dues payment, not member income, and not a new general-ledger income entry.
- RLS exposes the cash balance only to Ketua Pemuda, Wakil Ketua Pemuda, and Bendahara.
- A database trigger rejects UPDATE and DELETE; authenticated users receive SELECT only.

### `monthly_dues_cash_expenses`
- Expenses are append-only records with period, amount, description, actual spending timestamp, recorder UUID, and idempotency key.
- The selected period must match the spending timestamp in Asia/Jakarta.
- Direct INSERT, UPDATE, and DELETE are not granted to authenticated clients.
- The only write path is `record_monthly_dues_cash_expense`, which validates authentication, active finance role, amount, description, period, and idempotency.
- UPDATE and DELETE are blocked by a database trigger. A correction must be represented by a separate compensating record; existing history is never overwritten.

### Read models and Server Actions
- `monthly_dues_cash_book_summary` returns opening balance, monthly dues inflows, expenses, and closing cash balance. The October 2026 opening balance is Rp205,000; subsequent periods carry forward the previous closing cash balance.
- `monthly_dues_cash_book_movements` unifies the immutable opening record, persisted member payments, and persisted expense entries.
- Both views use `security_invoker = true` and respect underlying RLS.
- `getMonthlyDuesCashBook(duesMonth)` reads the summary and movements for finance roles.
- `recordMonthlyDuesCashExpense(previous, formData)` writes only through the database RPC and returns the persisted transaction UUID.

### Example
For October 2026:
- Opening balance: Rp205,000.
- Expense: Rp50,000.
- Closing balance before other inflows: Rp155,000.
- The original opening-balance row remains Rp205,000 and cannot be edited or deleted.

### Separation of books
The historical cash opening record is scoped to UANG KAS BULANAN and is not inserted as an income entry in KEUANGAN. The two books remain separate. Member dues payments continue to be the source of monthly dues inflows; no amount is inferred or fabricated.
