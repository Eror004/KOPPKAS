import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(
  new URL("../supabase/migrations/20261119130000_official_letter_secretary_update_boundary.sql", import.meta.url),
  "utf8",
);

test("Secretary can update general letters only while they are drafts", () => {
  assert.match(migration, /drop policy if exists "letters_update_owner_or_leadership"/);
  assert.match(migration, /category = 'umum'[\s\S]*?current_app_role\(\) = 'sekretaris'[\s\S]*?status = 'draft'/);
  assert.match(migration, /status in \('draft', 'menunggu_persetujuan'\)/);
  assert.doesNotMatch(migration, /created_by = \(select auth\.uid\(\)\)/);
});

test("Leadership retains update access across the official-letter workflow", () => {
  assert.match(migration, /has_any_role\(array\['ketua_pemuda','wakil_ketua_pemuda'\]::public\.app_role\[\]\)/);
  assert.match(migration, /for update to authenticated/);
  assert.match(migration, /with check/);
});

test("policy replacement is transactional and does not touch unrelated tables", () => {
  assert.match(migration, /begin;/i);
  assert.match(migration, /commit;/i);
  assert.doesNotMatch(migration, /drop table|truncate|delete from/i);
});
