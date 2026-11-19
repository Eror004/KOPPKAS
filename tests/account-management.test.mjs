import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [permissions, actions, admin, page, dashboard, edgeFunction, coreSchema] = await Promise.all([
  read("../src/lib/auth/permissions.ts"),
  read("../src/app/dashboard/akun/actions.ts"),
  read("../src/lib/supabase/admin.ts"),
  read("../src/app/dashboard/akun/page.tsx"),
  read("../src/components/dashboard-home-client.tsx"),
  read("../supabase/functions/account-admin/index.ts"),
  read("../supabase/migrations/20261118033833_core_schema.sql"),
]);

test("account management is granted only to Ketua Pemuda", () => {
  const ketua = permissions.match(/ketua_pemuda:\s*\{([\s\S]*?)\n  \},/)?.[1] ?? "";
  assert.match(ketua, /accounts:\s*\[[^\]]*"manage"/);
  for (const role of ["wakil_ketua_pemuda", "sekretaris", "bendahara", "ketua_rw_01", "ketua_rt_01"]) {
    const block = permissions.match(new RegExp(role + ":\\s*\\{([\\s\\S]*?)\\n  \\},"));
    assert.ok(block, `role block exists: ${role}`);
    assert.doesNotMatch(block[1], /accounts:/);
  }
});

test("admin client remains server-only and never exposes service credentials publicly", () => {
  assert.match(admin, /import "server-only"/);
  assert.match(admin, /process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(admin, /NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/);
});

test("account server actions require Ketua permissions and invoke the protected Edge Function", () => {
  assert.match(actions, /requireModulePermission\("accounts", "create"\)/);
  assert.match(actions, /requireModulePermission\("accounts", "manage"\)/);
  assert.match(actions, /functions\.invoke\("account-admin"/);
  assert.match(actions, /action: "create"/);
  assert.match(actions, /action: "update"/);
  assert.match(actions, /action: "reset_password"/);
  assert.match(actions, /action: "unlock"/);
  assert.doesNotMatch(actions, /createAdminClient|SUPABASE_SERVICE_ROLE_KEY/);
});

test("account page is protected and provides create, role/status and password controls", () => {
  assert.match(page, /requireModulePermission\("accounts", "manage"\)/);
  assert.match(page, /functions\.invoke\("account-admin"/);
  assert.match(page, /action=\{createAccount\}/);
  assert.match(page, /action=\{updateAccount\}/);
  assert.match(page, /action=\{resetAccountPassword\}/);
  assert.doesNotMatch(page, /SUPABASE_SERVICE_ROLE_KEY|createAdminClient/);
});

test("Edge Function independently verifies active Ketua role and protects the last active Ketua", () => {
  assert.match(edgeFunction, /withSupabase\(\{ auth: "user" \}/);
  assert.match(edgeFunction, /context\.supabase\.auth\.getUser\(accessToken\)/);
  assert.match(edgeFunction, /actor\?\.role !== "ketua_pemuda"/);
  assert.match(edgeFunction, /actor\.is_active !== true/);
  assert.match(edgeFunction, /Minimal harus ada satu akun Ketua Pemuda yang aktif/);
  assert.match(edgeFunction, /admin\.auth\.admin\.createUser/);
  assert.match(edgeFunction, /admin\.auth\.admin\.updateUserById/);
  assert.match(edgeFunction, /admin\.auth\.admin\.deleteUser/);
  assert.match(edgeFunction, /revoke_user_app_sessions_admin/);
});

test("new Auth users update the profile row created by the database trigger", () => {
  assert.match(coreSchema, /on_auth_user_created/);
  assert.match(edgeFunction, /from\("profiles"\)\s*\.update\(\{ full_name: fullName, role, is_active: true \}\)/);
  assert.match(edgeFunction, /\.eq\("id", created\.user\.id\)\s*\.select\("id"\)\s*\.maybeSingle\(\)/);
  assert.doesNotMatch(edgeFunction, /from\("profiles"\)\.insert\(\{\s*id: created\.user\.id/);
});

test("account management navigation remains role-filtered", () => {
  assert.match(dashboard, /"Manajemen Akun": "accounts"/);
  assert.match(dashboard, /"Manajemen Akun": "\/dashboard\/akun"/);
});
