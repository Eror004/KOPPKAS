# KOPPKAS — Migration Reconciliation (2026-11-18)

## Scope and safety

This is a read-only reconciliation of the GitHub working branch `codex/hardening-event-ledger-locks` against the active Supabase project's migration history. No SQL was executed against Supabase in this step. No migration was applied, no rows were changed, and no branch database was created.

Do not run `supabase db push`, `supabase migration repair`, or apply migrations to the active project based only on this inventory.

## Inventory result

- Repository branch contains **26 SQL migration files**.
- Supabase remote history contains **13 migration records**.
- **12 remote migration names** have same-name SQL files in the repository.
- **1 remote migration** (`cleanup_empty_conflicting_tables`) has no matching file in the repository.
- **14 repository migrations** are not represented in the remote migration history by name; these are pending branch work and have not been applied to production according to the current history.

Important: 11 same-name base migrations use local version IDs beginning `20261117000...`, while their remote history versions begin `202611180338...`. Supabase migration identity is version-based. Same-name files with different version IDs are not considered applied automatically and may be replayed by the CLI.

## Same-name mapping

| Repository migration file | Remote version | Remote name | Version match? |
| --- | --- | --- | --- |
| `20261117000100_core_schema.sql` | `20261118033833` | `core_schema` | No |
| `20261117000200_letter_numbering_and_inbox.sql` | `20261118033842` | `letter_numbering_and_inbox` | No |
| `20261117000300_dues_and_event_workflows.sql` | `20261118033844` | `dues_and_event_workflows` | No |
| `20261117000400_api_grants_and_audit.sql` | `20261118033846` | `api_grants_and_audit` | No |
| `20261117000500_approval_guards.sql` | `20261118033848` | `approval_guards` | No |
| `20261117000600_secretary_monthly_dues_read.sql` | `20261118033850` | `secretary_monthly_dues_read` | No |
| `20261117000700_letter_categories_public_verification.sql` | `20261118033853` | `letter_categories_public_verification` | No |
| `20261117000800_inline_dues_member_and_letter_submit.sql` | `20261118033855` | `inline_dues_member_and_letter_submit` | No |
| `20261117000900_opening_balance_and_balance_view.sql` | `20261118033858` | `opening_balance_and_balance_view` | No |
| `20261117001000_access_hardening.sql` | `20261118033900` | `access_hardening` | No |
| `20261117001100_public_events.sql` | `20261118033906` | `public_events` | No |
| `20261118033944_index_foreign_key_columns.sql` | `20261118033944` | `index_foreign_key_columns` | Yes |

The mapping above is based on migration names and repository inventory. It is **not** proof that the SQL bytes are identical to the SQL originally applied remotely. The remote migration history stores version/name metadata, not the original SQL text.

## Remote-only migration

| Remote version | Name | Repository file |
| --- | --- | --- |
| `20261118033828` | `cleanup_empty_conflicting_tables` | Missing |

The exact SQL for this already-applied migration cannot be recovered from the migration-history list. Do not invent a replacement migration or assume it was a no-op. Inspect the current schema and Git history for evidence of the cleanup's intent; preserve this as an unresolved provenance gap until the original SQL is recovered or the effect is independently established.

## Repository-only migrations

These 14 files are present in the working branch but do not appear in the current remote history:

1. `20261118050000_event_finance_finalization_guards.sql`
2. `20261118060000_public_letter_verification_privacy.sql`
3. `20261118070000_event_ledger_balance_summary.sql`
4. `20261118080000_committee_dues_letters_audit_hardening.sql`
5. `20261118090000_progressive_login_protection.sql`
6. `20261118100000_server_account_audit_grants.sql`
7. `20261118110000_event_dual_report_authorship.sql`
8. `20261118120000_letter_draft_owner_permissions.sql`
9. `20261118140000_public_contact_rate_limit.sql`
10. `20261118150000_monthly_dues_idempotency_payload_guard.sql`
11. `20261118160000_event_ledger_idempotency.sql`
12. `20261118170000_private_document_storage.sql`
13. `20261118180000_private_storage_delete_active_role_guard.sql`
14. `20261118190000_secretary_monthly_dues_read_access.sql`

These are un-applied branch changes according to remote migration history. This does not prove every file is safe to apply: each migration still requires dependency, ordering, idempotency, and role-policy review.

## Safe reconciliation plan

1. Preserve the live remote migration history as the source of truth for what Supabase records as applied.
2. Recover the exact SQL for `cleanup_empty_conflicting_tables` from the original authoring environment, backup, or deployment records. If unavailable, document its intended effect and verify the resulting schema without fabricating its source.
3. Compare the SQL in each same-name repository migration with the current live schema and any available deployment artifact. Migration names are a clue, not a checksum.
4. Establish a canonical baseline strategy before changing migration filenames:
   - Either reconstruct the exact historical migration files using the remote version IDs and verified SQL, or
   - create a documented baseline/reconciliation approach that explicitly accounts for the remote versions and does not replay existing DDL.
   Do not simply rename files or run migration repair without a reviewed version-by-version plan.
5. Review the 14 feature migrations individually, including their dependency order. Re-run the directory inventory before treating this list as exhaustive.
6. Because the user target is Rp0, do not create a Supabase development branch unless its actual cost is confirmed as zero and explicitly acceptable. Prefer a disposable local PostgreSQL/Supabase stack if available; otherwise perform static SQL review and clearly label staging tests as not run.
7. After a canonical chain is agreed, validate schema invariants, all six role policies, public letter privacy, monthly-dues append-only corrections, event closeout, and ledger idempotency in a non-production environment.
8. Obtain explicit approval before any production migration, merge, or deployment.

## Current conclusion

The live project has a migration-history provenance gap and a version-ID mismatch. The safe next action is not to push migrations. Recover the missing cleanup migration and establish a verified canonical baseline first.

No production database changes, migration repairs, Git merges, or deployments were performed for this reconciliation.

## Static SQL review — follow-up findings

### Public letter column privilege gap found and patched in the branch

The first review of `20261118060000_public_letter_verification_privacy.sql` found that it revoked table-level SELECT from `anon`, but did not explicitly revoke legacy column-level SELECT grants. PostgreSQL keeps column-level grants separate from table-level grants. The earlier live audit had found an anonymous grant on `official_letters.body`.

The branch migration now explicitly revokes table-level SELECT from `anon, public` and column-level SELECT on `(body, category, letter_number)` from `anon, public`, then re-grants only the intended verification metadata columns to `anon`. The schema-invariant test now asserts both revokes. This is a branch-only correction; it has not been applied to the live project.

### Event finalization migration ordering dependency

`20261118050000_event_finance_finalization_guards.sql` installs a trigger function that reads report-author columns added later by `20261118110000_event_dual_report_authorship.sql`. The later migration explicitly disables that trigger while adding/backfilling those columns, then re-enables it. The chain therefore has an intentional forward dependency and a deployment interval in which application updates to `events` could fail if they reach the trigger before the later migration completes. Keep application writes to events quiesced across this migration sequence, or refactor the trigger/migrations to eliminate the forward dependency before production use.

### Staging and verification boundary

- No Supabase development branch was created because the user target is Rp0 and branch compute may incur charges.
- No local PostgreSQL/Supabase runtime was available through the current connector-only workflow, so SQL integration tests and six-role impersonation were not run.
- GitHub CI was triggered for the privilege-revoke regression change; its result must be checked separately.
- Static SQL review is not equivalent to executing the migration chain against a clean database or testing RLS as each role.


## Follow-up review — event migration ordering corrected

A deeper review confirmed a real deployment-window defect: migration `20261118050000_event_finance_finalization_guards.sql` created a trigger function that referenced five columns introduced only by migration `20261118110000_event_dual_report_authorship.sql`. PostgreSQL trigger-record field references are evaluated when the trigger executes, so an application event update between those migrations could fail.

Branch-only correction:
- The earlier migration now guards only event columns that exist at that point in the chain.
- The dual-report migration replaces the trigger function with the extended version immediately after adding/backfilling the report-author columns.
- A schema regression test asserts the early migration has no forward references and the later migration extends the guard only after adding the columns.

This removes the identified forward-column dependency without changing the intended final lock behavior. It still needs clean-database SQL execution before any production use.

## Application-to-migration contract spot check

- Event finance entry action sends a UUID idempotency key and validates duplicate-key retries against event, direction, amount, description, and actor.
- Monthly dues payment action calls the database RPC with a UUID idempotency key and note; the hardened RPC compares the complete payment payload on retries.
- Both client forms retain the same generated key while an unsuccessful action is retried and clear it after success.
- Event narrative and financial report actions call the corresponding database RPCs, rather than directly writing protected report fields.

These are source inspections, not end-to-end runtime tests.

## CI update

- CI run #186 passed on commit `208d30af400438dd320f56d79ffb4321e0f159ce`.
- The event migration-order fix and regression test were committed after that run. Their CI result must be checked on the new branch head before considering the code checks green.

## Remaining review limits

- The SQL chain has not been executed against a clean local or staging database.
- The six role policies have not been exercised with real role-scoped test identities.
- The migration history mismatch and missing `cleanup_empty_conflicting_tables` source remain unresolved.
- No production SQL, migration repair, merge, or deployment has been performed.


### CI verification after the event ordering correction

- CI #188 initially failed because two pre-existing regression assertions still expected the new report-author columns to be checked by the earlier migration. The failure was in stale test expectations, not a TypeScript, lint, or build error.
- The assertions were updated to verify that the early migration has no forward references and that the later migration adds the extended guard.
- CI #192 passed on commit `08af7509e20e7a846eb78c93eecca3c3ac219b01`: npm install, schema invariant tests, TypeScript, ESLint, and production build all succeeded.

## Local migration-chain CI follow-up — 2026-11-18

### CI #195 failure and remediation

The new isolated Supabase migration job started a clean local Supabase stack and applied migrations through `20261118100000_server_account_audit_grants.sql`. It then stopped at `20261118110000_event_dual_report_authorship.sql` with PostgreSQL syntax error `42601` at the dollar-quote delimiter of `app_private.guard_event_finalized_updates()`: the function body used an unmatched `as $` / `end $;` instead of a valid dollar-quoted body.

Branch-only fix:
- Corrected the function body delimiters to `as $$` and `end $$;`.
- Added a schema invariant test for the function's dollar-quoted syntax.

CI #195 quality job passed (schema invariant tests, TypeScript, ESLint, production build); the local migration job failed at the SQL parse error described above. The failure is a real migration defect, not a production database failure. No Supabase production SQL was executed.

### Monthly-dues idempotency actor binding

Static review of `20261118150000_monthly_dues_idempotency_payload_guard.sql` found that retries compared dues record, amount, and note, but did not compare the original recorder. The RPC now also requires `existing_payment.recorded_by` to match `auth.uid()` in both the initial lookup and concurrent-conflict recovery path. A regression assertion covers both comparisons.

### Verification boundary after these fixes

- Fix commits: `a8f0eb1` (SQL delimiter), `d57e0d9` (delimiter regression test), `ba3f01a` (actor binding), `6e61aa6` (actor regression test).
- These latest commits have not yet received a confirmed CI run in the available workflow-run results.
- The clean local migration chain has therefore **not yet passed**.
- Migrations after `20261118110000` remain unverified by execution until the clean reset is rerun.
- Remote Supabase migration history remains 13 records; no migration repair, apply, or production DDL/DML was performed.
