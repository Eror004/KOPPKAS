# KOPPKAS — Live Supabase Drift Audit (2026-11-18)

## Scope and safety

This audit queried the active Supabase project using read-only catalog, migration-history, and advisor queries. No SQL DDL/DML was executed. No migration was applied, no rows were inserted or changed, and no user was created.

The GitHub working branch remains `codex/hardening-event-ledger-locks`. This report does not authorize merging, deploying, or changing the live database.

## Live database state

The remote Supabase migration history currently contains these 13 entries:

| Version | Migration |
| --- | --- |
| 20261118033828 | cleanup_empty_conflicting_tables |
| 20261118033833 | core_schema |
| 20261118033842 | letter_numbering_and_inbox |
| 20261118033844 | dues_and_event_workflows |
| 20261118033846 | api_grants_and_audit |
| 20261118033848 | approval_guards |
| 20261118033850 | secretary_monthly_dues_read |
| 20261118033853 | letter_categories_public_verification |
| 20261118033855 | inline_dues_member_and_letter_submit |
| 20261118033858 | opening_balance_and_balance_view |
| 20261118033900 | access_hardening |
| 20261118033906 | public_events |
| 20261118033944 | index_foreign_key_columns |

These remote version/name pairs have not yet been reconciled one-to-one with the migration files in the GitHub branch. Do not use `supabase db push` or apply branch migrations until that mapping is complete.

Observed application row counts were zero for profiles, events, official letters, monthly dues, monthly dues payments, and event ledger entries. `auth.users` also contained zero rows at audit time. The findings below are therefore latent configuration risks; the queried tables contained no current application records.

## Confirmed live policy / privilege drift

### 1. Public official-letter access — high priority

Live database facts:
- `anon` has table-level `SELECT` on `public.official_letters`.
- `anon` has column-level SELECT on `body`, `category`, and `letter_number`.
- The live anonymous SELECT policy is `letters_public_verify_published`, whose predicate is only `status = 'terbit'`.
- Therefore, if a published financial letter is created, its body and category can be read anonymously through the Data API.

Required target state:
- Public verification must expose only published letters in category `umum`.
- Revoke anonymous table-wide SELECT and grant only the minimal metadata columns, or expose a tightly scoped metadata-only view.
- Financial letters and letter bodies must not be public.

### 2. Event committee permissions — high priority

Live database facts:
- `event_committee_manage_authenticated` is an ALL policy for every authenticated user with any active app role.
- Authenticated users have DELETE privilege on the table.
- This is broader than the intended event creator / core leadership rules and does not exclude closeout states.

Required target state:
- Separate INSERT, UPDATE, and DELETE policies limited to the event creator and authorized core leadership.
- Block mutations after report closeout, completion, or cancellation.

### 3. Event ledger closeout guard — high priority

Live database facts:
- Authenticated finance roles have an INSERT policy on `event_ledger_entries`.
- Authenticated users have INSERT privilege.
- No live trigger was found that blocks event-ledger inserts outside the active event period.
- The live table does not yet expose the idempotency-key guard structure used by the hardening branch.

Required target state:
- Enforce active-event-period inserts at the database layer.
- Require a validated idempotency key for event-ledger writes.
- Permit surplus-transfer outflow only when it matches the approved transfer and general-ledger records.
- Preserve append-only behavior for ordinary authenticated users.

### 4. Monthly dues history protection — high priority

Live database facts:
- `monthly_dues_manage_finance_roles` remains an ALL policy for Ketua, Wakil, and Bendahara.
- Authenticated users have DELETE privilege on `monthly_dues`.
- The separate read policy for Sekretaris exists, as does the payment recorder policy, but the broad ALL policy remains.

Required target state:
- Remove the broad ALL policy.
- Keep narrowly scoped read / create / update policies for authorized roles.
- Revoke DELETE from authenticated users; corrections must use an auditable correction/reversal workflow.
- Preserve Secretary's ability to read the dues register and payment history and record voluntary payments.

## Security advisor interpretation

The security advisor reported four SECURITY DEFINER RPCs callable by `authenticated`:
- `approve_event_final_report`
- `create_member_and_monthly_dues`
- `create_member_for_dues`
- `record_monthly_dues_payment`

Catalog checks confirmed:
- `anon` cannot execute these functions.
- `authenticated` can execute them.
- Each function checks `auth.uid()` and validates allowed app roles before doing privileged work.
- Each function uses an empty `search_path`.

These advisor warnings are not automatically vulnerabilities: these RPCs intentionally perform restricted privileged operations. Keep the explicit identity/role checks and continue reviewing their transaction invariants.

The advisor also reported two RLS-enabled tables with no policies: `activity_audit_logs` and `letter_year_sequences`. Their grants should be checked as part of the migration reconciliation; no policy should be added unless an intended access path is identified.

## Advisor performance notes

- Multiple permissive policies were reported on nine tables. Review policy consolidation after security behavior is correct.
- Thirty indexes were reported unused. Do not drop them based only on this result; the database currently has no application users or data, so usage statistics are not representative.
- Health advisor returned no findings.

## Required reconciliation sequence

1. Inventory every migration file in the repository and map it to the 13 remote migration records.
2. Identify SQL changes that were applied remotely but are missing from Git, and Git migrations missing remotely.
3. Build a staging database from the canonical migration chain.
4. Validate the high-priority fixes above with role-specific SQL tests and transaction/idempotency tests.
5. Review Supabase security/performance advisors and inspect the resulting schema.
6. Obtain explicit approval before applying any reconciled migration to the active Supabase project.

## Verification boundary

This report is based on live catalog queries, migration history, row counts, and Supabase advisors. It is not a penetration test, browser test, or role-authenticated end-to-end simulation. No claim is made that staging validation has occurred.
