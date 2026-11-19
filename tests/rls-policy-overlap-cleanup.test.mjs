import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(
  new URL("../supabase/migrations/20261119150000_reduce_redundant_profile_position_policies.sql", import.meta.url),
  "utf8",
);

test("Secretary retains organization-position write permissions without duplicate SELECT policy", () => {
  assert.match(migration, /drop policy if exists "positions_manage_secretary"/);
  for (const command of ["insert", "update", "delete"]) {
    assert.match(migration, new RegExp('create policy "positions_' + command + '_secretary"[\\s\\S]*?for ' + command, "i"));
  }
  assert.doesNotMatch(migration, /create policy "positions_manage_secretary"/);
});

test("profile visibility remains covered by dedicated read policies", () => {
  assert.match(migration, /drop policy if exists "profiles_manage_ketua"/);
  assert.doesNotMatch(migration, /drop policy if exists "profiles_read_self_or_leadership"/);
  assert.doesNotMatch(migration, /drop policy if exists "profiles_read_active_org_accounts"/);
});

test("profile self-update restrictions and Ketua management remain equivalent", () => {
  assert.match(migration, /profiles_update_self_non_privileged/);
  assert.match(migration, /profiles_update_self_or_ketua/);
  assert.match(migration, /role is not distinct from app_private\.current_app_role\(\)/);
  assert.match(migration, /is_active = true/);
  assert.match(migration, /profiles_insert_ketua/);
  assert.match(migration, /profiles_delete_ketua/);
});

test("policy consolidation is transactional and does not change grants, data, or RLS state", () => {
  assert.match(migration, /\bbegin;/);
  assert.match(migration, /commit;\s*$/);
  assert.doesNotMatch(migration, /grant |revoke |disable row level security|drop table|truncate|delete from/i);
});
