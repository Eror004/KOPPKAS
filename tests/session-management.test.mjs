import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [migration, login, requireUser, permissions, securityPage, securityActions, accountActions, proxy, adminFunction, accountPage] = await Promise.all([
  read("../supabase/migrations/20261119080000_app_device_sessions.sql"),
  read("../src/app/login/actions.ts"),
  read("../src/lib/auth/require-user.ts"),
  read("../src/lib/auth/permissions.ts"),
  read("../src/app/dashboard/keamanan-akun/page.tsx"),
  read("../src/app/dashboard/keamanan-akun/actions.ts"),
  read("../src/app/dashboard/akun/actions.ts"),
  read("../proxy.ts"),
  read("../supabase/functions/account-admin/index.ts"),
  read("../src/app/dashboard/akun/page.tsx"),
]);

test("device sessions are private and callable only through authenticated security-definer functions", () => {
  assert.match(migration, /create table public\.app_device_sessions/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on public\.app_device_sessions from public, anon, authenticated/);
  assert.match(migration, /security definer\s+set search_path = ''/);
  assert.match(migration, /grant execute on function public\.get_my_app_sessions\(\) to authenticated/);
  assert.match(migration, /grant execute on function public\.revoke_my_app_session\(uuid\) to authenticated/);
  assert.match(migration, /grant execute on function public\.revoke_other_app_sessions\(\) to authenticated/);
});

test("session lifetime is fixed at 24 hours and cannot be extended by refresh", () => {
  assert.match(migration, /created_at \+ interval '24 hours'/);
  assert.match(migration, /set not_after = least\(/);
  assert.match(migration, /v_created_at \+ interval '24 hours'/);
  assert.match(requireUser, /register_current_app_session/);
});

test("fourth login is rejected without deleting the three existing sessions", () => {
  const register = migration.split("create or replace function public.register_current_app_session")[1]
    .split("create or replace function public.get_my_app_sessions")[0];
  assert.match(register, /v_other_active >= 3/);
  assert.match(register, /delete from auth\.sessions where id = v_session_id and user_id = v_user_id/);
  assert.match(register, /'reason', 'device_limit'/);
  assert.match(register, /'max_devices', 3/);
  assert.match(register, /and s\.id <> v_session_id/);
});

test("login admission fails closed when session policy is unavailable or denies the device", () => {
  assert.match(login, /register_current_app_session/);
  assert.match(login, /sessionPolicyError \|\| !policy\?\.allowed/);
  assert.match(login, /signOut\(\{ scope: "local" \}\)/);
  assert.match(login, /Maksimal 3 perangkat aktif/);
});

test("protected dashboard requests verify the Auth user and current registered session", () => {
  assert.match(requireUser, /supabase\.auth\.getUser\(\)/);
  assert.match(requireUser, /register_current_app_session/);
  assert.match(requireUser, /redirect\("\/auth\/session-expired"\)/);
});

test("each of the six roles can manage only its own session list", () => {
  assert.match(permissions, /security:\s*\["read", "update"\]/);
  for (const role of ["ketua_pemuda", "wakil_ketua_pemuda", "sekretaris", "bendahara", "ketua_rw_01", "ketua_rt_01"]) {
    const block = permissions.match(new RegExp(role + ":\\s*\\{([\\s\\S]*?)\\n  \\},"));
    assert.ok(block, `role block exists: ${role}`);
    assert.match(block[1], /security:\s*\["read", "update"\]/);
  }
});

test("session revocation is scoped to the authenticated user and protects the current device", () => {
  assert.match(migration, /v_user_id uuid := auth\.uid\(\)/);
  assert.match(migration, /p_session_id = v_current_session_id/);
  assert.match(migration, /where id = p_session_id\s+and user_id = v_user_id/);
  assert.match(migration, /delete from auth\.sessions\s+where user_id = v_user_id\s+and id <> v_current_session_id/);
  assert.match(securityActions, /revoke_my_app_session/);
  assert.match(securityActions, /revoke_other_app_sessions/);
});

test("only an active Ketua Pemuda can revoke another account's sessions", () => {
  const adminRevoke = migration.split("create or replace function public.revoke_user_app_sessions")[1];
  assert.match(adminRevoke, /v_actor_role is distinct from 'ketua_pemuda'/);
  assert.match(adminRevoke, /v_actor_active is distinct from true/);
  assert.match(accountActions, /revoke_user_app_sessions/);
});

test("security UI shows current devices, individual revocation and logout-all-other-devices", () => {
  assert.match(securityPage, /get_my_app_sessions/);
  assert.match(securityPage, /PERANGKAT AKTIF/);
  assert.match(securityPage, /revokeDeviceSession/);
  assert.match(securityPage, /revokeOtherDeviceSessions/);
  assert.match(securityPage, /24 jam/);
  assert.match(securityPage, /Alamat IP dan lokasi tidak disimpan/);
});

test("public routes remain outside the authenticated dashboard session guard", () => {
  assert.match(proxy, /request\.nextUrl\.pathname === "\/"/);
  assert.match(proxy, /startsWith\("\/public"\)/);
  assert.match(proxy, /startsWith\("\/login"\)/);
  assert.doesNotMatch(proxy, /keamanan-akun/);
});


test("account administration runs in an authenticated Edge Function with server-managed secrets", () => {
  assert.match(adminFunction, /withSupabase\(\{ auth: "user" \}/);
  assert.match(adminFunction, /context\.supabaseAdmin/);
  assert.match(adminFunction, /context\.supabase\.auth\.getUser\(accessToken\)/);
  assert.match(adminFunction, /actor\?\.role !== "ketua_pemuda"/);
  assert.match(adminFunction, /actor\.is_active !== true/);
  for (const action of ["list", "create", "update", "reset_password", "unlock"]) {
    assert.match(adminFunction, new RegExp(`action === "${action}"`));
  }
  assert.match(adminFunction, /revoke_user_app_sessions_admin/);
});

test("account manager no longer depends on an empty Vercel service-role environment variable", () => {
  assert.match(accountPage, /functions\.invoke\("account-admin"/);
  assert.doesNotMatch(accountPage, /hasSupabaseAdminConfig|createAdminClient/);
  assert.match(accountActions, /functions\.invoke\("account-admin"/);
  assert.doesNotMatch(accountActions, /createAdminClient/);
  assert.match(migration, /grant execute on function public\.revoke_user_app_sessions_admin\(uuid, uuid\) to service_role/);
});
