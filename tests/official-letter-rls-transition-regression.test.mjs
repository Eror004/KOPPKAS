import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [policyMigration, transitionMigration, contentGuardMigration, actions] = await Promise.all([
  read("../supabase/migrations/20261118074615_letter_draft_owner_permissions.sql"),
  read("../supabase/migrations/20261118033848_approval_guards.sql"),
  read("../supabase/migrations/20261118074603_committee_dues_letters_audit_hardening.sql"),
  read("../src/app/dashboard/surat-dokumen/actions.ts"),
]);

test("letter update RLS is paired with immutable creator and draft-only content rules", () => {
  assert.match(policyMigration, /created_by = \(select auth\.uid\(\)\)/);
  assert.match(policyMigration, /Official letter creator is immutable/);
  assert.match(contentGuardMigration, /old\.status <> 'draft'/);
  assert.match(contentGuardMigration, /new\.subject is distinct from old\.subject/);
  assert.match(contentGuardMigration, /new\.body is distinct from old\.body/);
  assert.match(contentGuardMigration, /new\.category is distinct from old\.category/);
});

test("database enforces leadership-only publication and cancellation metadata", () => {
  assert.match(transitionMigration, /create or replace function app_private\.guard_letter_transitions/);
  assert.match(transitionMigration, /Only Ketua or Wakil Ketua may cancel an official letter/);
  assert.match(transitionMigration, /Only Ketua or Wakil Ketua may publish an official letter/);
  assert.match(transitionMigration, /Official letter approval metadata is required/);
  assert.match(transitionMigration, /Letter cancellation metadata is required/);
  assert.match(transitionMigration, /Invalid official letter status transition/);
});

test("server actions validate draft fields and require module permissions", () => {
  assert.match(actions, /requireModulePermission\("letters", "update"\)/);
  assert.match(actions, /subject\.length < 3 \|\| subject\.length > 180/);
  assert.match(actions, /body\.length < 10 \|\| body\.length > 20000/);
  assert.match(actions, /letter\.status !== "draft"/);
});
