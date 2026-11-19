import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateBootstrapInput } from "../scripts/bootstrap-first-ketua.mjs";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("first Ketua bootstrap normalizes identity and requires explicit confirmation", () => {
  assert.deepEqual(validateBootstrapInput({
    fullName: "  Ketua Pertama  ",
    email: " KETUA@KOPPKAS.ID ",
    password: "a-strong-password",
    confirmation: "CREATE_FIRST_KETUA",
  }), {
    fullName: "Ketua Pertama",
    email: "ketua@koppkas.id",
    password: "a-strong-password",
  });
});

test("first Ketua bootstrap rejects weak credentials and missing confirmation", () => {
  const valid = {
    fullName: "Ketua KOPPKAS",
    email: "ketua@koppkas.id",
    password: "short",
    confirmation: "CREATE_FIRST_KETUA",
  };
  assert.throws(() => validateBootstrapInput(valid), /12–128 karakter/);
  assert.throws(() => validateBootstrapInput({ ...valid, password: "long-enough-password", email: "not-an-email" }), /Email tidak valid/);
  assert.throws(() => validateBootstrapInput({ ...valid, password: "long-enough-password", confirmation: "" }), /konfirmasi bootstrap/i);
});

test("bootstrap claims a singleton guard before checking and creating the first Auth user", async () => {
  const script = await read("../scripts/bootstrap-first-ketua.mjs");
  const claim = script.indexOf('.from("first_ketua_bootstrap_guard").insert({ id: true })');
  const authCheck = script.indexOf("admin.auth.admin.listUsers");
  const create = script.indexOf("admin.auth.admin.createUser");
  assert.ok(claim >= 0 && authCheck > claim && create > authCheck);
  assert.match(script, /from\("profiles"\)\.select\("id", \{ count: "exact", head: true \}\)/);
  assert.match(script, /role: "ketua_pemuda", is_active: true/);
  assert.match(script, /one_time_first_ketua_bootstrap/);
  assert.match(script, /completed_at: new Date\(\)\.toISOString\(\)/);
  assert.doesNotMatch(script, /console\.log\([^\n]*password/i);
});

test("bootstrap guard is a server-only singleton protected by RLS and explicit grants", async () => {
  const migration = await read("../supabase/migrations/20261119000000_first_ketua_bootstrap_guard.sql");
  assert.match(migration, /id boolean primary key default true check \(id = true\)/);
  assert.match(migration, /auth_user_id uuid references auth\.users\(id\) on delete restrict/);
  assert.match(migration, /alter table public\.first_ketua_bootstrap_guard enable row level security/);
  assert.match(migration, /revoke all on public\.first_ketua_bootstrap_guard from public, anon, authenticated/);
  assert.match(migration, /grant select, insert, update, delete on public\.first_ketua_bootstrap_guard to service_role/);
});

test("bootstrap command loads local environment and is not part of normal app startup", async () => {
  const packageJson = JSON.parse(await read("../package.json"));
  assert.equal(packageJson.scripts["bootstrap:first-ketua"], "node --env-file=.env.local scripts/bootstrap-first-ketua.mjs");
});
