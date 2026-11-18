import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [actions, page, controls, permissions, migration, privacy] = await Promise.all([
  read("../src/app/dashboard/surat-dokumen/actions.ts"),
  read("../src/app/dashboard/surat-dokumen/page.tsx"),
  read("../src/app/dashboard/surat-dokumen/workflow-controls.tsx"),
  read("../src/lib/auth/permissions.ts"),
  read("../supabase/migrations/20261118120000_letter_draft_owner_permissions.sql"),
  read("../supabase/migrations/20261118060000_public_letter_verification_privacy.sql"),
]);

test("letter owners can edit their own drafts while Secretary manages general letters", () => {
  assert.match(migration, /created_by = \(select auth\.uid\(\)\)/);
  assert.match(migration, /category = 'umum' and app_private\.current_app_role\(\) = 'sekretaris'/);
  assert.match(actions, /export async function updateLetterDraft/);
  assert.match(controls, /action=\{updateLetterDraft\}/);
});

test("Bendahara manages own financial letters and financial letters remain private to finance roles", () => {
  assert.match(permissions, /bendahara:[\s\S]*?letters: \["read", "create", "update"\]/);
  assert.match(migration, /letters_read_general_or_finance/);
  assert.match(migration, /ketua_pemuda','wakil_ketua_pemuda','bendahara'/);
  assert.match(privacy, /category = 'umum'/);
});

test("official letters require submit, leadership approval and reasoned cancellation", () => {
  assert.match(actions, /submitLetterForApproval/);
  assert.match(actions, /approveLetter/);
  assert.match(actions, /cancelLetter/);
  assert.match(actions, /cancellation_reason: reason/);
  assert.match(page, /LetterWorkflowControls/);
  assert.match(controls, /Setujui & terbitkan surat/);
});

test("submitted letter content and creator identity are immutable", () => {
  assert.match(migration, /Official letter creator is immutable/);
  assert.match(migration, /Only Bendahara may manage financial letters/);
  assert.match(migration, /guard_letter_owner_and_category/);
});
