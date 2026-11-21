# Backend contract — Uang Kas Bulanan

Branch: `chatgpt/backend-monthly-dues-hardening`

## Read models

### `monthly_dues_summary`
The view keeps its existing columns and sets `payment_status` to:
- `lunas` when the member's aggregate in that month is at least Rp10,000.
- `belum_bayar` whenever the aggregate is below Rp10,000, including partial voluntary payments.
- The aggregate remains isolated to one `monthly_dues` row (one member, one month). Partial amounts remain visible in `paid_amount`; they do not change the unpaid status.

### `monthly_dues_payment_receipts`
Read-only, `security_invoker` view. One row per persisted payment:
- `payment_reference`: deterministic unique reference containing the complete immutable payment UUID.
- `payment_id`, `monthly_dues_id`, `member_id`, `member_name`.
- `amount`, `paid_at`, `dues_month`, `note`.
- `recorded_by`, optional `recorded_by_name`.
- `reference_amount`, `paid_amount_after_transaction`, `status_after_transaction`.

Cumulative post-transaction status is ordered by `paid_at, payment_id`, not derived from today's aggregate. A cumulative amount below Rp10,000 remains `belum_bayar`, including partial payments. View access uses underlying RLS on monthly dues, payments, members, and profiles.

## RPC contracts

### `ensure_monthly_dues_for_member(p_member_id uuid, p_dues_month date) returns uuid`
- Requires authenticated user with one of Ketua Pemuda, Wakil Ketua Pemuda, or Bendahara.
- Requires an active existing member and first-day-of-month date.
- Inserts one register row at Rp10,000, or returns the existing row ID.
- Does not create or match a member by name.

### `create_member_and_monthly_dues_safe(p_full_name text, p_dues_month date, p_confirm_same_name boolean default false) returns jsonb`
- Requires authenticated user with one of Ketua Pemuda, Wakil Ketua Pemuda, or Bendahara. Sekretaris is read-only.
- Serializes same-normalized-name attempts with an advisory transaction lock.
- If active exact-name candidates exist and confirmation is false, returns:
  `{ "status": "duplicate_candidates", "matches": [{ "id": "...", "full_name": "..." }] }`
- With explicit confirmation, creates a distinct new member UUID and the month's register atomically.
- If no candidates exist, creates the member and register atomically.
- Names are only a duplicate-warning signal; all later selection and payment references use UUIDs.

## Server Action response

- `recordDuesPayment` returns `transactionId` from the existing idempotent RPC after successful persistence.
- `getDuesPaymentReceipt(transactionId)` reads the receipt projection by persisted payment UUID.
- `searchDuesMembers(query, duesMonth)` searches active members by name and returns `{ members, hasMore, error? }` with stable member UUIDs, including members without a period register. It fetches 16 rows to return at most 15 and sets `hasMore` when additional matches exist, so a capped result is never presented as complete. A query failure is distinct from an empty result.
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
The hosted database now has 40 applied migration versions, and all 40 have matching local SQL source files in this branch. The branch contains 47 migration files total. The two pre-existing migrations (`20261119080000_app_device_sessions` and `20261119090000_koppkas_account_limit`) were applied to production on 2026-11-21 after the full local migration replay and CI checks passed. Seven monthly-dues migrations remain pending: `20261120100000`, `20261120120000`, `20261120130000`, `20261120140000`, `20261121100000`, `20261121140000`, and `20261121150000`. All 40 production migration versions have exact matching repository files; no remote-only migration versions remain. The October 2026 opening balance of Rp205,000 has been explicitly confirmed and approved by the owner. Do not apply the seven monthly-dues migrations until frontend Server Actions are integrated and the release gates below pass.


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

### Cash availability guard
- A cash expense is rejected when its amount is greater than the latest official closing cash balance.
- The database serializes expense transactions with a transaction-scoped advisory lock before reading the authoritative cash-book summary. Concurrent expenses therefore cannot each spend the same available balance.
- The RPC rechecks an idempotency key after acquiring the lock, so a concurrent retry returns the original persisted transaction rather than being rejected as a second expense.
- An unavailable official balance fails closed; no expense is inserted.
- Insufficient balance is returned as a database constraint-style error (23514). The Server Action must present this as an insufficient-balance message without retrying under a new idempotency key.

### `monthly_dues_cash_expenses`
- Expenses are append-only records with period, amount, description, actual spending timestamp, recorder UUID, and idempotency key.
- The selected period must match the spending timestamp in Asia/Jakarta and must already be opened.
- Direct INSERT, UPDATE, and DELETE are not granted to authenticated clients.
- The only write path is `record_monthly_dues_cash_expense`, which validates authentication, active finance role, amount, description, period, and idempotency.
- A database trigger also rejects expense inserts into unopened periods. UPDATE and DELETE are blocked by a separate trigger. Corrections require a separate compensating record.

### Read models and Server Actions
- `monthly_dues_cash_book_summary` returns only explicitly opened periods, with opening balance, actual dues inflows, expenses, and closing cash balance.
- The opening balance for each later period is calculated from the preceding opened periods' actual net movements. Historical changes therefore recalculate subsequent opening balances without duplicating transactions. This means late/backdated transactions can change previously displayed closing and later opening balances; owner approval of this behavior is required before release.
- `monthly_dues_cash_book_movements` unifies the immutable October opening record, persisted member payments, and persisted expense entries for opened periods.
- Both views use `security_invoker = true` and retain SELECT for authenticated callers. Each view also applies an explicit active-role filter for Ketua, Wakil Ketua, and Bendahara, so Sekretaris cannot query a partial or misleading cash-book result directly through the Data API. The underlying opening-balance and expense tables have matching RLS restrictions.
- The cash-book Server Action separately requires `general_finance:read` before querying the two views. No additional public `SECURITY DEFINER` read RPC is introduced; this avoids widening the exposed privileged-function surface.
- Cash-book income is currently attributed to the `dues_month` of the member register, and only payment rows with `paid_at >= monthly_dues_periods.opened_at` are counted. Payments already present before the period's opening timestamp are excluded so historic collections already represented by the Rp205,000 October opening balance are not counted a second time. A payment entered later for an older dues month is therefore reflected in that older cash-book period; the owner must confirm this attribution before release.
- The movement view emits one informational opening-balance row for every opened period. October shows the immutable historical Rp205,000 opening; later periods show their derived carry-forward opening balance. These display rows are not additional income and do not create stored cash transactions.
- `generateMonthlyRegister(previous, formData)` now requires an explicit `dues_month` field and calls `open_monthly_dues_period`; it no longer silently creates the current calendar month.
- `getMonthlyDuesPeriods()` lists periods that have actually been opened.
- `getMonthlyDuesCashBook(duesMonth, page = 0, pageSize = 50)` reads the role-filtered summary and a deterministic movement page after its Server Action permission check. Page size is limited to 1–100; the result includes `movementCount`, `page`, `pageSize`, and `hasMore`. The summary totals are the authoritative full-period totals and must never be recomputed from one movement page.
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
The seven monthly-dues migrations are prepared on the isolated backend branch and have not been applied to production. The two earlier session/account migrations are now applied and reconciled. Authenticated role/RLS tests and a real browser integration remain required; the local CI replay and pgTAP checks have passed.


### Outstanding integration and owner gates
- The current integrated page uses read-only monthly-book and receipt projections. The legacy member-creation RPC remains revoked for authenticated callers; member/register/payment write UI stays disabled until action contracts, idempotency, six-role E2E, and the release gates are approved.
- Lifecycle activation now uses the dedicated explicit client-triggered sync command for Ketua/Wakil/Bendahara; period reads remain read-only and no manual next-month opening control should be exposed.
- The owner must still confirm whether a payment for an older dues month should be attributed to that dues month or to the actual month cash was received, and whether late historical entries may recalculate closed-period balances.
- The historical October 2026 opening amount of Rp205,000 has been confirmed by the owner and approved for production. It is an opening balance only, not an iuran payment or general-ledger income.
- A read-only hosted audit still finds both legacy member-creation RPCs executable by `authenticated`, plus direct `INSERT`/`UPDATE` table privileges on `monthly_dues` and `UPDATE` on `monthly_dues_payments`. The closing migration removes these paths, but it must be deployed together with the new period-gated RPCs after frontend compatibility is ready; do not apply the closing migration alone.
- Local pgTAP verifies authorization and integrity behavior, but a real concurrent period-opening / concurrent expense test and final frontend-to-backend E2E verification remain release gates.

## Lifecycle hardening update — 2026-11-21

This section supersedes the earlier manual-period-opening behavior above.

### Current-month lifecycle
- The authoritative month is calculated in Asia/Jakarta.
- sync_monthly_dues_period_lifecycle() is a mutating command, not a read operation. Only Ketua Pemuda, Wakil Ketua Pemuda, and Bendahara may execute it. Sekretaris is read-only: it may read available dues periods and totals but cannot create registers, create members through the dues workflow, record payments, or activate/synchronize a period. getMonthlyDuesPeriods and all book-read adapters are read-only. A dedicated server action invokes lifecycle sync after the monthly-dues client module actually mounts for the three authorized roles; it must not run during Server Component rendering or route prefetch. After a confirmed sync, the client refreshes the read-only period and totals queries. A sync failure or ambiguous response must remain unconfirmed, never be shown as success.
- Only the current Jakarta month may have status = active. Previous months become closed; no RPC can reopen them.
- If several months were missed, one period row is created for each month. Missed months are closed and marked data_status = historical_empty unless actual persisted payment/expense source rows exist.
- Historical-empty periods receive no generated member registers, payments, expenses, or opening/closing cash figures. The monthly dues summary suppresses default register rows for those months.
- opened_effective_at / closed_effective_at represent calendar boundaries. opened_processed_at / closed_processed_at represent when the application actually processed the lifecycle change. The effective close boundary is 00:00 WIB on the first day of the following month.
- Existing period RPC signatures remain compatible, but open_monthly_dues_period(p_dues_month) accepts only the current Jakarta month. It is no longer a way to open a future or historical month.

### Write boundary and concurrency
- Ordinary requests use a fast path when the current period already exists; lifecycle creation/rollover is serialized with a transaction advisory lock.
- Payment, expense, member-register, and member-creation write paths obtain a shared row lock (FOR SHARE) on the selected period.
- The authoritative validation timestamp is captured with clock_timestamp() only after acquiring that lock. The lock is held until transaction commit.
- Rollover updates the old period and therefore waits for in-flight writers. A writer that validated before the boundary may commit while holding its shared lock; a writer that validates after 00:00 WIB is rejected.
- The validation timestamp is persisted as the payment's paid_at. It is not confused with the later transaction commit timestamp.
- Idempotency is reconciled before the month gate and again after acquiring the period lock. A matching committed retry returns its original transaction ID even after the period closes; a different actor, register, amount, or note using the same key is rejected.

### Receipt snapshots
- New payments store member_name_snapshot and recorder_name_snapshot in the same insert as the payment.
- Receipt and cash-book payment labels use these snapshots rather than mutable current member/profile names.
- Legacy rows are not backfilled from current names. Their snapshot fields remain NULL because the historical names cannot be reconstructed reliably.

### Cash-book uncertainty
- monthly_dues_cash_book_summary retains its original five columns in the same order and appends data_status and cash_balance_status.
- A missed month marked historical_empty exposes NULL income/expense/balance values rather than fabricated Rp0 values.
- Every later opening/closing balance that crosses an unreconciled historical gap remains NULL. Expense recording fails closed while the official balance is unavailable.
- The monthly dues member-status summary and the separate cash-book balance remain distinct read models.

### Verification and release boundary
- Source-invariant tests cover Jakarta lifecycle timestamps, empty missed periods, post-lock retry reconciliation, snapshot-only receipts, NULL historical cash gaps, and view-column compatibility.
- GitHub CI run #468 passed: all 47 repository migrations replayed locally, pgTAP authorization/integrity tests passed, the Node test suite including the read-only period-action regression passed, the concurrency smoke test passed, and Edge Function typecheck, TypeScript, ESLint, and production build passed. The smoke test uses two independent sessions but is not exhaustive stress testing of the exact 00:00 WIB race. Browser end-to-end integration remains a release gate.
- This migration is isolated on chatgpt/backend-monthly-dues-hardening. It has not been applied to production; migration-history reconciliation remains a separate release gate.



## Monthly dues period totals contract

### `monthly_dues_period_totals`
A `security_invoker = true` read-only view for Ketua Pemuda, Wakil Ketua Pemuda, Bendahara, and Sekretaris. It is a dues register aggregate, not the general cash-book balance. The period row is the source of truth for selected-period state; aggregate metrics are computed across every authorized register for that month, never from a paginated member list.

Fields, in order:
- `dues_month`: first day of the selected month.
- `status`: `active` or `closed`.
- `data_status`: `available` or `historical_empty`.
- `member_count`, `paid_member_count`, `unpaid_member_count`: integer counts.
- `total_paid_amount`, `total_reference_amount`, `total_remaining_amount`: `numeric(15,2)`.

For `available` periods with no register rows, all six metrics are zero. For `historical_empty` periods, all six metrics are NULL because the historical data is unknown. Do not coalesce historical NULL values to zero in SQL, Server Actions, or UI. The view preserves underlying period/register/payment RLS and grants SELECT only to authenticated users; Ketua RW and Ketua RT receive no rows. Sekretaris can read dues totals but cannot read the separate cash-book balance.

### Lifecycle RPC result
`sync_monthly_dues_period_lifecycle()` returns `dues_month`, `status`, `data_status`, `processed_at`, `register_count`, and `validated_at`. The expected successful current-period contract is `status = active` and `data_status = available`. A client must not treat a timeout or transport failure as proof that the command did not commit; retry behavior must remain safe and must refresh the read model after a confirmed result.

### Verification boundary
The SQL migration and pgTAP role/aggregate tests are committed to the isolated backend branch and have passed the latest local Supabase CI replay. Repeated synchronization is idempotent by the unique period/member-month constraints and `ON CONFLICT DO NOTHING`; the committed concurrency smoke passed, but true concurrent calls and a rollover race at 00:00 WIB remain release gates. No monthly-dues migration has been applied to production.


## Cash-book pagination

`monthly_dues_cash_book_movements` exposes both `occurred_at` (the business event time) and `recorded_at` (the immutable database insertion/opening time: payment and expense `created_at`, or the opening balance record's `created_at` with the period's `opened_at` as fallback). The first page captures the maximum `recorded_at`; subsequent keyset cursors carry that high-water mark and filter every page to `recorded_at <= highWater`. This prevents newly inserted, backdated expenses from appearing in later pages of an already-open pagination snapshot. The official cash-book summary remains a separate authoritative read and is never calculated from loaded movement pages.
