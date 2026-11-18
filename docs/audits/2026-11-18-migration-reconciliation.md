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
