import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [permissions, actions, admin, page, dashboard, edgeFunction, coreSchema, accountLimit, navigation, moduleShell] = await Promise.all([
  read("../src/lib/auth/permissions.ts"),
  read("../src/app/dashboard/akun/actions.ts"),
  read("../src/lib/supabase/admin.ts"),
  read("../src/app/dashboard/akun/page.tsx"),
  read("../src/components/dashboard-home-client.tsx"),
  read("../supabase/functions/account-admin/index.ts"),
  read("../supabase/migrations/20261118033833_core_schema.sql"),
  read("../supabase/migrations/20261119090000_koppkas_account_limit.sql"),
  read("../src/components/dashboard-navigation.ts"),
  read("../src/components/module-shell.tsx"),
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
  assert.match(navigation, /href: "\/dashboard\/akun", label: "Manajemen Akun"[^\n]*module: "accounts"/);
  assert.match(dashboard, /dashboardNavigation\.filter\(item => can\(role, item\.module\)\)/);
  assert.match(moduleShell, /dashboardNavigation\.filter\(\(item\) => can\(user\.role, item\.module\)\)/);
});

test("account security revokes existing sessions before role, status or password changes", () => {
  const updateStart = edgeFunction.indexOf('if (action === "update")');
  const updateEnd = edgeFunction.indexOf('if (action === "reset_password")');
  const updateBlock = edgeFunction.slice(updateStart, updateEnd);
  assert.ok(updateBlock.indexOf("revoke_user_app_sessions_admin") < updateBlock.indexOf('.update({ full_name: fullName, role, is_active: isActive'));
  const resetStart = edgeFunction.indexOf('if (action === "reset_password")');
  const resetEnd = edgeFunction.indexOf('if (action === "unlock")');
  const resetBlock = edgeFunction.slice(resetStart, resetEnd);
  assert.ok(resetBlock.indexOf("revoke_user_app_sessions_admin") < resetBlock.indexOf("updateUserById"));
  assert.ok(resetBlock.indexOf("revoke_other_app_sessions") < resetBlock.indexOf("updateUserById"));
});

test("organization account provisioning is capped at six, including inactive profiles", () => {
  assert.match(edgeFunction, /from\("profiles"\)\s*\.select\("id", \{ count: "exact", head: true \}\)/);
  assert.match(edgeFunction, /accountCount \?\? 0\) >= 6/);
  assert.match(accountLimit, /pg_advisory_xact_lock/);
  assert.match(accountLimit, /select count\(\*\)::integer/);
  assert.match(accountLimit, /v_account_count >= 6/);
  assert.match(accountLimit, /before insert on public\.profiles/);
});
