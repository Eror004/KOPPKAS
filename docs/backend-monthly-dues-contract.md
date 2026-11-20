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


## Explicit monthly period opening and cumulative cash book

### `monthly_dues_periods`
- A month appears in UANG KAS BULANAN only after an authorized officer explicitly opens it.
- October 2026 is the first period and is seeded once with the historical opening cash of Rp205,000.
- A later period can only be opened if it is the immediately following month after the latest opened period. No calendar-based month generation exists.
- Opening a period is one atomic RPC operation: it records who opened it, creates the period, and prepares one Rp10,000 register row for every active member.
- Opening a later period derives its opening cash balance from the previous opened period's closing balance. It does not create a second opening-money transaction or duplicate the historical Rp205,000.
- Reopening an existing month is rejected. Gaps and out-of-order periods are rejected.
- Register creation, member creation from the dues workflow, payment recording, and expense recording are rejected for unopened periods.

### RPC: `open_monthly_dues_period(p_dues_month date) returns jsonb`
- Requires an authenticated Ketua Pemuda, Wakil Ketua Pemuda, or Bendahara.
- Accepts only the first day of the immediately following month.
- Uses a transaction advisory lock to serialize concurrent opening attempts.
- Returns the opened month, its derived opening balance, and the number of active-member register rows created.
- Creates the period and member registers in the same transaction; a failure rolls back the whole operation.

### `monthly_dues_cash_expenses`
- Expenses are append-only records with period, amount, description, actual spending timestamp, recorder UUID, and idempotency key.
- The selected period must match the spending timestamp in Asia/Jakarta and must already be opened.
- Direct INSERT, UPDATE, and DELETE are not granted to authenticated clients.
- The only write path is `record_monthly_dues_cash_expense`, which validates authentication, active finance role, amount, description, period, and idempotency.
- A database trigger also rejects expense inserts into unopened periods. UPDATE and DELETE are blocked by a separate trigger. Corrections require a separate compensating record.

### Read models and Server Actions
- `monthly_dues_cash_book_summary` returns only explicitly opened periods, with opening balance, actual dues inflows, expenses, and closing cash balance.
- The opening balance for each later period is calculated from the preceding opened periods' actual net movements. Historical changes therefore recalculate subsequent opening balances without duplicating transactions.
- `monthly_dues_cash_book_movements` unifies the immutable October opening record, persisted member payments, and persisted expense entries for opened periods.
- Both views use `security_invoker = true` and respect underlying RLS.
- `generateMonthlyRegister(previous, formData)` now requires an explicit `dues_month` field and calls `open_monthly_dues_period`; it no longer silently creates the current calendar month.
- `getMonthlyDuesPeriods()` lists periods that have actually been opened.
- `getMonthlyDuesCashBook(duesMonth)` reads the summary and movements for finance roles.
- `recordMonthlyDuesCashExpense(previous, formData)` writes only through the database RPC and returns the persisted transaction UUID.

### Example
- October 2026 opens with Rp205,000 historical opening cash.
- If October receives Rp100,000 and spends Rp50,000, October closes at Rp255,000.
- When an authorized officer explicitly opens November, November's opening cash is Rp255,000.
- If November then receives Rp80,000 and spends Rp20,000, November closes at Rp315,000.
- December does not appear until it is explicitly opened. Its opening cash is derived from November's closing balance.
- Member payment status remains isolated to its own month; voluntary payments are not carried as member debt.

### Separation of books
The historical cash opening record is scoped to UANG KAS BULANAN and is not inserted as an income entry in KEUANGAN. The two books remain separate. Member dues payments continue to be the source of actual monthly dues inflows; no amount is inferred or fabricated.

### Migration / verification gate
The period-opening migration is prepared on the isolated backend branch and has not been applied to Supabase. Live migration history still requires reconciliation before any hosted migration, merge, or deployment. Authenticated role/RLS tests and a real database test of concurrent period opening remain required.
