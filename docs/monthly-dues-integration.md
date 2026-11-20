# Monthly dues frontend integration

## Branch relationship

- Arena's original frontend work remains on `arena/7a7d374b-koppkas` / PR #21.
- Backend source of truth is `chatgpt/backend-monthly-dues` / PR #22.
- This integration is isolated on `integration/monthly-dues-arena` / PR #23, based on the latest backend head.
- PR #21 and PR #22 are not modified by this integration.

## Connected flows

- Monthly dues page reads the explicit period list from `getMonthlyDuesPeriods`.
- Register rows are read only for opened periods from `monthly_dues_summary`.
- Opening a period submits an explicit `dues_month`; the UI only exposes opening to Ketua Pemuda, Wakil Ketua Pemuda, and Bendahara.
- Payment submission uses the backend idempotency key and returns a persisted transaction ID.
- Receipt lookup uses `monthly_dues_payment_receipts` separately from payment submission. Receipt retry must never submit a payment again.
- Member creation uses `create_member_and_monthly_dues_safe`; duplicate candidates are presented for explicit selection or explicit confirmation to create a distinct member.
- Cash-book presentation is hidden unless the role has `general_finance:read`.

## Remaining integration work

1. Replace the current-period-only payment picker with `searchDuesMembers(query, duesMonth)`, including the `hasMore` refinement message and safe `ensureDuesRegister` flow for members without a register.
2. Connect `getMonthlyDuesCashBook` to the accounting panel. Use the full-period summary as authoritative; do not derive closing balance from a partial movement page.
3. Add paginated movement navigation and expense recording using the backend Server Actions.
4. Verify real authenticated sessions and all six roles against deployed RLS only after owner approval for the required environment and test data.
5. Run responsive browser, keyboard, focus, reduced-motion, and error-state QA.
6. Obtain owner decisions on historical opening-balance reconciliation and carry-forward semantics before release.

## Safety boundaries

- No production migration or database write has been performed.
- No merge or production deployment has been performed.
- Monthly contributions remain voluntary; Rp10,000 is a reference threshold, not a compulsory bill or debt.
- The monthly dues register remains separate from the organization's general finance ledger.
