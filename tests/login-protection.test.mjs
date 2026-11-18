import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [migration, login, authClient, accountActions] = await Promise.all([
  read("../supabase/migrations/20261118090000_progressive_login_protection.sql"),
  read("../src/app/login/actions.ts"),
  read("../src/lib/supabase/auth.ts"),
  read("../src/app/dashboard/akun/actions.ts"),
]);

test("progressive login protection applies 15-minute and 1-hour lockouts", () => {
  assert.match(migration, /next_attempt_count >= 5 then now\(\) \+ interval '15 minutes'/);
  assert.match(migration, /next_attempt_count >= 10 then now\(\) \+ interval '1 hour'/);
  assert.match(migration, /requires_admin_unlock = false/);
  assert.match(migration, /attempt_row\.failed_attempts >= 10/);
  assert.match(migration, /attempt_row\.locked_until <= now\(\)/);
});

test("accounts at the 10-attempt threshold require Ketua admin unlock", () => {
  assert.match(migration, /requires_admin_unlock/);
  assert.match(migration, /Akun memerlukan verifikasi tambahan/);
  assert.match(accountActions, /export async function unlockAccount/);
  assert.match(accountActions, /from\("login_protection_attempts"\)\.delete\(\)/);
});

test("login protection state is inaccessible to public and ordinary authenticated users", () => {
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on public\.login_protection_attempts from public, anon, authenticated/);
  assert.match(migration, /to supabase_auth_admin/);
  assert.match(migration, /to service_role/);
});

test("password verification hook is a Supabase Auth hook and login uses it", () => {
  assert.match(migration, /public\.hook_password_verification_attempt\(event jsonb\)/);
  assert.match(migration, /grant execute on function public\.hook_password_verification_attempt\(jsonb\) to supabase_auth_admin/);
  assert.match(login, /createAuthClient/);
  assert.match(login, /password\.length < 5/);
});

test("server Auth client forwards trusted IP only when a secret key is configured", () => {
  assert.match(authClient, /process\.env\.SUPABASE_SECRET_KEY/);
  assert.match(authClient, /Sb-Forwarded-For/);
  assert.match(authClient, /x-real-ip/);
  assert.match(authClient, /x-forwarded-for/);
  assert.match(authClient, /isIP\(candidateIp\)/);
});

test("account manager reads lock status computed by Postgres rather than render-time clock calls", () => {
  assert.match(migration, /create or replace view public\.login_protection_status/);
  assert.match(migration, /security_invoker = true/);
  assert.match(migration, /locked_until > now\(\) as is_currently_locked/);
});
