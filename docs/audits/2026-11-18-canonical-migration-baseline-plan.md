# KOPPKAS — Canonical Migration Baseline Plan

Date: 2026-11-18  
Branch reviewed: `codex/hardening-event-ledger-locks`  
Reviewed commit: `ab6aa96305b63540643557f75923066a7c1a5f9f`

## Executive decision

**Do not run `supabase db push`, `supabase migration repair`, or any production migration yet.**

The remote migration history and repository history are not a simple one-to-one chain. The repository's first 11 migration files currently use version IDs `20261117000100` through `20261117001100`, while the remote project records corresponding names under versions `20261118033833` through `20261118033906`. The remote project also has an additional applied migration `20261118033828_cleanup_empty_conflicting_tables` whose SQL file is not present in the current repository.

Git history shows that the current base migration filenames were normalized from earlier filenames such as `202611170001_core_schema.sql` to `20261117000100_core_schema.sql`. This confirms the local version identifiers changed during repository history. It does **not** prove that the current SQL bytes are identical to what was applied remotely.

## Facts established

### Current repository chain

There are 26 SQL migration files in `supabase/migrations`:

- 11 base migrations using the `20261117000...` version prefix.
- 1 index migration using `20261118033944`, which matches the remote version.
- 14 later feature/security migrations from `20261118050000` through `20261118190000` (with timestamp gaps).

### Current remote history

The active Supabase project records 13 applied versions:

1. `20261118033828_cleanup_empty_conflicting_tables`
2. `20261118033833_core_schema`
3. `20261118033842_letter_numbering_and_inbox`
4. `20261118033844_dues_and_event_workflows`
5. `20261118033846_api_grants_and_audit`
6. `20261118033848_approval_guards`
7. `20261118033850_secretary_monthly_dues_read`
8. `20261118033853_letter_categories_public_verification`
9. `20261118033855_inline_dues_member_and_letter_submit`
10. `20261118033858_opening_balance_and_balance_view`
11. `20261118033900_access_hardening`
12. `20261118033906_public_events`
13. `20261118033944_index_foreign_key_columns`

The first 11 repository base migrations have same-name remote counterparts but different version IDs. The index migration has the exact same version ID. The cleanup migration is remote-only. The 14 later feature migrations are not in remote history.

### Why a name-only match is insufficient

Supabase tracks migration versions. If the local migration version is different from the remote version, the CLI can treat the local file as pending even when its name looks familiar. Replaying schema creation, grants, triggers, or policy changes against a live project can fail or change access behavior.

The Git history also contains post-creation edits to at least some base migrations. Therefore, the current file is not automatically a byte-for-byte record of the SQL that ran remotely.

## Rejected shortcuts

Do not:

- Rename the current 11 base files to remote version IDs solely because names match.
- Create an empty placeholder for `cleanup_empty_conflicting_tables` and claim it reproduces the original migration.
- Run `supabase migration repair` before proving which SQL effects are already present and equivalent.
- Mark all local base versions as applied based only on matching names.
- Remove old remote migration records to make the history look tidy.
- Run `supabase db push` to "see what happens".
- Use a production schema diff as permission to apply changes automatically.

## Recommended strategy

### Phase A — preserve and document provenance

1. Keep the remote 13-entry history unchanged.
2. Keep existing migration files unchanged until a version-by-version comparison is complete.
3. Preserve the missing cleanup migration as an explicit provenance gap.
4. Use the remote live schema, grants, policies, triggers, functions, extensions, and storage configuration as evidence of current state—not as proof of original SQL.
5. Keep all production access read-only during this phase.

### Phase B — establish a reproducible clean-database path

1. Create a disposable PostgreSQL/Supabase-compatible test environment without connecting it to the production project.
2. Replay the repository's base chain from an empty database, checking every migration in timestamp order.
3. Verify that the base chain plus the later feature migrations builds the intended schema without errors.
4. Add SQL integration tests for:
   - all six application roles and RLS boundaries;
   - public verification of general letters without public exposure of financial letter bodies;
   - monthly dues append-only history and audited correction path;
   - event committee restrictions and finalized-event locks;
   - event ledger idempotency and surplus transfer exactly once;
   - account management restricted to Ketua Pemuda;
   - private document storage and object deletion permissions.
5. Do not create a paid Supabase branch. If a local Docker/Supabase stack is unavailable, use a free ephemeral PostgreSQL service in CI only where it can faithfully represent the required Supabase objects; clearly label any Supabase-specific behavior that remains untested.

### Phase C — reconcile production history without replaying old SQL

After Phase B and a complete live-schema comparison:

1. Prepare a version-by-version mapping table that includes local version, remote version, SQL provenance, verified schema effects, and any differences.
2. Decide whether the remote history can be preserved as-is while future changes are delivered only as new migrations, or whether a carefully reviewed metadata reconciliation is necessary.
3. If considering `supabase migration repair`, prepare the exact commands and expected before/after history first. Treat it as a production metadata change and require explicit approval.
4. Never mark a migration applied unless its complete intended effect is already present and verified.
5. Never mark a remote migration reverted merely to silence CLI drift without an approved audit-preserving migration plan.

### Phase D — deploy only after explicit approval

1. Review the exact SQL diff and rollback/recovery plan.
2. Confirm backup and recovery expectations.
3. Apply one reviewed production migration batch only after explicit user approval.
4. Verify post-migration schema, grants, RLS policies, triggers, function definitions, and application smoke tests.
5. Merge PR and deploy application separately, each with explicit approval.

## Current blockers

| Blocker | Why it matters | Resolution |
| --- | --- | --- |
| Missing `cleanup_empty_conflicting_tables` SQL | Cannot establish exact historical provenance | Recover from original deployment environment/backup or document the gap permanently |
| 11 base version mismatches | CLI may consider local base SQL pending | Compare exact historical SQL/effects before any repair |
| Current base files have later edits | Same name does not prove same deployed SQL | Inspect Git history and compare against live schema |
| No clean Supabase-compatible test run yet | SQL and RLS behavior not integration-tested | Build a disposable local/CI test path |
| 14 feature migrations are not remote-applied | They contain security and workflow changes | Validate chain and role tests before production |

## Current safety boundary

- No SQL was run against production during this planning step.
- No migration was applied or repaired.
- No production data was changed.
- No PR merge or deployment was performed.
- The branch-only public-letter grant fix and event trigger ordering fix remain un-applied to production.

## Next engineering action

Build the disposable clean-database validation path and test the migration chain there. Do not attempt to normalize production migration metadata until the chain and live-state mapping are proven.
