import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const [schema, grants, adminGrant] = await Promise.all([
  read("../supabase/migrations/20261118033833_core_schema.sql"),
  read("../supabase/migrations/20261118033846_api_grants_and_audit.sql"),
  read("../supabase/migrations/20261118074611_server_account_audit_grants.sql"),
]);

test("profiles has row-level security enabled", () => {
  assert.match(schema, /alter table public\.profiles enable row level security;/i);
});

test("only Ketua Pemuda receives profile-management policy access", () => {
  const policy = schema.match(
    /create policy "profiles_manage_ketua"[\s\S]*?;/i,
  )?.[0] ?? "";

  assert.ok(policy, "Ketua profile-management policy exists");
  assert.match(policy, /for all to authenticated/i);
  assert.match(policy, /using\s*\(app_private\.has_any_role\(array\['ketua_pemuda'\]/i);
  assert.match(policy, /with check\s*\(app_private\.has_any_role\(array\['ketua_pemuda'\]/i);
  assert.doesNotMatch(policy, /wakil_ketua_pemuda|sekretaris|bendahara|ketua_rw_01|ketua_rt_01/i);
});

test("self-service profile updates cannot change role or reactivate a disabled account", () => {
  const policy = schema.match(
    /create policy "profiles_update_self_non_privileged"[\s\S]*?;/i,
  )?.[0] ?? "";

  assert.ok(policy, "self-update policy exists");
  assert.match(policy, /using\s*\(id\s*=\s*\(select auth\.uid\(\)\)\)/i);
  assert.match(policy, /with check\s*\([\s\S]*?id\s*=\s*\(select auth\.uid\(\)\)/i);
  assert.match(policy, /role is not distinct from app_private\.current_app_role\(\)/i);
  assert.match(policy, /is_active = true/i);
});

test("authenticated users receive only profile read/update grants from the application grant migration", () => {
  assert.match(grants, /grant select, update on public\.profiles to authenticated;/i);
  assert.doesNotMatch(grants, /grant [^;]*(insert|delete|truncate)[^;]* on public\.profiles to authenticated;/i);
});

test("service-role profile administration remains server-side", () => {
  assert.match(adminGrant, /grant select, insert, update, delete on public\.profiles to service_role;/i);
});
test("profile management remains protected by explicit role checks and self-update restrictions", () => {
  const management = schema.match(/create policy "profiles_manage_ketua"[\s\S]*?;/i)?.[0] ?? "";
  const selfUpdate = schema.match(/create policy "profiles_update_self_non_privileged"[\s\S]*?;/i)?.[0] ?? "";
  assert.match(management, /app_private\.has_any_role/);
  assert.match(selfUpdate, /role is not distinct from app_private\.current_app_role\(\)/i);
  assert.match(selfUpdate, /is_active = true/i);
});
