# Sprint 1 frontend: contract and integration notes

These interfaces describe data already read by the existing pages; they are not new API contracts. Authorization remains on the server and in the existing database policies. The two modules do not share ledger write logic.

## Keanggotaan

`MemberRecord` in `src/components/members/contracts.ts` mirrors the existing active-members query: `id`, `full_name`, `gender`, `phone`, `created_at`. Only records whose `archived_at` is null are loaded. “Belum lengkap” means gender is missing; phone is optional. The existing Secretary-only `createMember` action is used unchanged, with its existing validation and result state.

**Backend coordination required:** Confirm a server-authorized edit operation, accepted fields, validation, concurrency and success/error contract. The edit form is disabled and does not persist. Archive/deletion and archived-member detail are outside the existing page query and are not represented as available.

## Uang Kas Bulanan

`DuesRecord` in `src/components/monthly-dues/contracts.ts` mirrors the existing `monthly_dues_summary` select. Amounts can arrive as numbers or numeric strings. `payment_status` and the period reference are supplied by the backend view; UI does not infer status from a different threshold. Existing actions for generating the current register, adding an inline member, and recording a payment remain unchanged. The current implementation reads at most the current month plus the previous eleven months.

The member count is the **number of entries in that period's register**, not the total active membership. Progress represents the percentage of registered entries marked `lunas`, not an amount billed. “Sudah mencatat pembayaran” means accumulated amount is positive; this includes partially paid entries. The reference is voluntary and each period stands alone: no debt, fine or arrears carryover is calculated by the UI. Recording remains limited in the UI to the current period; authorization and idempotency remain server-side.

**Backend coordination required:**

1. Confirm the Rp10,000 reference invariant for existing and future records and the meaning of the status fields if a record uses a different reference.
2. Provide an authorized, paginated or bounded transaction-history read contract for individual payments, including ordering, errors and permitted roles. The current summary has only an aggregate; the UI explicitly says individual history is unavailable. Multiple and partial payment recording uses the existing action, but the UI cannot list individual transactions yet.
3. Provide an authoritative active-member total and clarify the treatment of active members missing from a given monthly register, if the owner needs a comparison with the entire membership. Do not interpret missing rows as unpaid.
4. Confirm requirements and authorization before allowing recording on historical periods.

## Validation scope

UI tests use isolated, labelled fixtures and mock only the payment form during component rendering; they do not exercise backend persistence. JSDOM interaction tests cover client-side search, status filtering and period navigation, not browser layout or assistive technology. Authenticated end-to-end tests and responsive/screen-reader smoke tests remain required with an approved test environment.
