import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(
  new URL("../supabase/migrations/20261118180000_remove_legacy_announcement_media_policies.sql", import.meta.url),
  "utf8",
);

test("removes legacy permissive policies that widened announcement access", () => {
  for (const policy of [
    "announcements_insert_active_roles",
    "announcements_update_owner_or_admin",
    "announcements_delete_admin",
  ]) {
    assert.match(migration, new RegExp(`drop policy if exists "${policy}" on public\\.announcements;`));
  }
});

test("removes legacy permissive policies that widened media access", () => {
  for (const policy of [
    "media_insert_active_roles",
    "media_update_owner_or_admin",
    "media_delete_admin",
  ]) {
    assert.match(migration, new RegExp(`drop policy if exists "${policy}" on public\\.media_assets;`));
  }
});

test("policy cleanup is transactional and does not disable RLS", () => {
  assert.match(migration, /^begin;/);
  assert.match(migration, /commit;\s*$/);
  assert.doesNotMatch(migration, /disable row level security/i);
  assert.doesNotMatch(migration, /drop table|truncate|delete from/i);
});
test("cleanup targets only the six superseded policies and preserves the tables", () => {
  assert.equal((migration.match(/drop policy if exists/gi) ?? []).length, 6);
  assert.doesNotMatch(migration, /drop table|alter table|truncate|delete from/i);
});
