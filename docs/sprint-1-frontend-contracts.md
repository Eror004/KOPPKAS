# Sprint 1 frontend: contracts and integration notes

These interfaces describe existing queries, not new API contracts. Server authorization and database policies remain authoritative. Uang Kas Bulanan remains separate from the general finance interface.

## Keanggotaan

`MemberRecord` in `src/components/members/contracts.ts` mirrors the active-members query: `id`, `full_name`, `gender`, `phone`, `created_at`. Only records whose `archived_at` is null are loaded. “Belum lengkap” means gender is missing; phone is optional. The existing Secretary-only `createMember` action is unchanged.

**Coordination required:** agree on the authorized edit operation, validation and response. The edit form is disabled and does not persist. Archive/deletion and archived-member detail are not available from the existing query.

## Uang Kas Bulanan

`DuesRecord` in `src/components/monthly-dues/contracts.ts` mirrors the existing `monthly_dues_summary` view. The page now additionally selects its existing `member_id`; the payment selector identifies registered members by this stable ID, then submits the corresponding `monthly_dues.id` to the unchanged payment action. Search currently covers **only members with a register row for the current month**, not the entire membership directory. No missing member is assumed to be unpaid. Different members with the same name remain selectable separately. The existing register action and manual partial/multiple payment action are unchanged.

The UI classifies cumulative `paid_amount` for each period against the owner's Rp10,000 rule: exactly zero is **BELUM BAYAR**, positive and below Rp10,000 is **KURANG**, and Rp10,000 or more is **LUNAS**. This zero-payment interpretation relies on the existing database constraint that each transaction amount is positive and the view summing all payments visible under RLS. Invalid amounts are marked for review, not treated as zero. The backend view currently supplies a two-state status based on each row's `reference_amount`; if the source reference differs from Rp10,000, the UI warns because its displayed classification and backend status may differ. Backend must confirm and enforce the official invariant. The amount shown is a period aggregate, not an individual transaction or cash balance.

The member count is the number of entries in that period's register, **not** all active members. Progress is the percentage of registered rows reaching the reference. Each month stands alone; no arrears, fines or compulsory billing are calculated. UI recording remains limited to current-month entries; authorization and idempotency remain server-side.

### Explicitly unavailable until backend coordination

- **Transaction history/search/filter/detail and receipts:** the current page reads only aggregates. `recordDuesPayment` returns success/error text, not a persisted transaction ID, reference, timestamp, recorder, or post-transaction status. The UI deliberately shows unavailable states, not fabricated receipts or transactions. Agree on an authorized transaction read and receipt contract: persisted unique reference, stable member ID and name, amount, timestamp and timezone, accounting period, optional note, optional recorder display, and authoritative status immediately after that transaction. Confirm ordering, paging, filters, error states, privacy and permitted roles. Never derive a historical post-transaction status from the latest aggregate.
- **Complete member autocomplete / missing register entry:** agree on an authorized search of active membership and a safe way to select an existing member who lacks a current-period row. The existing summary only covers already-registered members; it must not silently create another member with the same name.
- **Inline creation:** the existing `create_member_and_monthly_dues` action unconditionally inserts a new member and does not supply an atomic duplicate-prevention or identity-resolution contract. The frontend keeps the action code unchanged but disables the entry point in this module until backend and owner settle how to detect/resolve duplicates, including concurrency and legitimate identical names. The current action does revalidate Keanggotaan, but successful cross-module behavior has not been verified in a real session. Client-side name matching alone cannot ensure uniqueness.
- **Actual total active membership:** agree on an authoritative count and how to handle members missing from each period's register.
- **Historical recording:** confirm requirements and authorization before enabling payment entry for earlier periods.

## Validation scope

UI tests use isolated, labelled fixtures and mock the payment form during component rendering; they do not exercise backend persistence. JSDOM interaction tests cover search, filtering, period navigation and selection by stable member ID, not real browser layout or assistive technology. Authenticated end-to-end, role-based RLS, responsive browser and screen-reader smoke tests are still required in an approved test environment.
