import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [permissions, workflow, actions, backend] = await Promise.all([
  read("../src/lib/auth/permissions.ts"),
  read("../src/app/dashboard/uang-kas-bulanan/page.tsx"),
  read("../src/app/dashboard/uang-kas-bulanan/actions.ts"),
  read("../supabase/migrations/20261121100000_monthly_dues_lifecycle_and_receipt_snapshots.sql"),
]);

test("Sekretaris is read-only in monthly dues at the UI and server permission boundary", () => {
  assert.match(permissions, /sekretaris:\s*\{[\s\S]*?monthly_dues:\s*\["read"\]/);
  assert.doesNotMatch(permissions, /sekretaris:\s*\{[\s\S]*?monthly_dues:\s*\["read",\s*"create"\]/);
  assert.match(actions, /integrationWritesEnabled\s*=\s*\(\): boolean => false/);
  assert.match(workflow, /user\.role === "ketua_pemuda" \|\| user\.role === "wakil_ketua_pemuda" \|\| user\.role === "bendahara"/);
});

test("Secretary is excluded from all monthly-dues mutation RPC allowlists", () => {
  for (const fn of ["ensure_monthly_dues_for_member", "create_member_and_monthly_dues_safe", "record_monthly_dues_payment"]) {
    const start = backend.indexOf(`create or replace function public.${fn}`);
    assert.notEqual(start, -1, `${fn} definition exists`);
    const end = backend.indexOf("$function$;", start);
    assert.notEqual(end, -1, `${fn} body closes`);
    assert.doesNotMatch(backend.slice(start, end), /'sekretaris'/, `${fn} excludes Secretary`);
  }
});
