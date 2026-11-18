import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [permissions, actions, admin, page, dashboard] = await Promise.all([
  read("../src/lib/auth/permissions.ts"),
  read("../src/app/dashboard/akun/actions.ts"),
  read("../src/lib/supabase/admin.ts"),
  read("../src/app/dashboard/akun/page.tsx"),
  read("../src/components/dashboard-home-client.tsx"),
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

test("admin client is server-only and reads only the server secret", () => {
  assert.match(admin, /import "server-only"/);
  assert.match(admin, /process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(admin, /NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/);
});

test("account actions require Ketua permission and protect the last active Ketua", () => {
  assert.match(actions, /requireModulePermission\("accounts", "create"\)/);
  assert.match(actions, /requireModulePermission\("accounts", "manage"\)/);
  assert.match(actions, /Minimal harus ada satu akun Ketua Pemuda yang aktif/);
  assert.match(actions, /admin\.auth\.admin\.createUser/);
  assert.match(actions, /admin\.auth\.admin\.updateUserById/);
  assert.match(actions, /admin\.auth\.admin\.deleteUser/);
  assert.match(actions, /from\("activity_logs"\)\.insert/);
  assert.match(actions, /actor_id: actor\.profile\.id/);
});

test("account page is protected and provides create, role/status and password controls", () => {
  assert.match(page, /requireModulePermission\("accounts", "manage"\)/);
  assert.match(page, /action=\{createAccount\}/);
  assert.match(page, /action=\{updateAccount\}/);
  assert.match(page, /action=\{resetAccountPassword\}/);
  assert.match(page, /SUPABASE_SERVICE_ROLE_KEY/);
});

test("account management navigation is role-filtered", () => {
  assert.match(dashboard, /"Manajemen Akun": "accounts"/);
  assert.match(dashboard, /"Manajemen Akun": "\/dashboard\/akun"/);
});


test("new Auth users update the profile row created by the database trigger", () => {
  assert.match(actions, /on_auth_user_created/);
  assert.match(actions, /from\("profiles"\)\s*\.update\(\{ full_name: fullName, role, is_active: true \}\)/);
  assert.match(actions, /\.eq\("id", created\.user\.id\)\s*\.select\("id"\)\s*\.maybeSingle\(\)/);
  assert.doesNotMatch(actions, /from\("profiles"\)\.insert\(\{\s*id: created\.user\.id/);
});
