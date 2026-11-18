import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [permissions, actions, page] = await Promise.all([
  read("../src/lib/auth/permissions.ts"),
  read("../src/app/dashboard/struktur/actions.ts"),
  read("../src/app/dashboard/struktur/page.tsx"),
]);

test("Secretary is the only role with structure management permissions", () => {
  const secretary = permissions.match(/sekretaris:\s*\{([\s\S]*?)\n  \},/)?.[1] ?? "";
  assert.match(secretary, /structure:\s*\[[^\]]*"create"[^\]]*"update"[^\]]*"delete"/);
  const ketua = permissions.match(/ketua_pemuda:\s*\{([\s\S]*?)\n  \},/)?.[1] ?? "";
  assert.match(ketua, /structure:\s*\["read"\]/);
});

test("structure mutations are protected by server-side module permissions", () => {
  assert.match(actions, /requireModulePermission\("structure", "create"\)/);
  assert.match(actions, /requireModulePermission\("structure", "update"\)/);
  assert.match(page, /user\.role === "sekretaris"/);
  assert.match(page, /action=\{createPosition\}/);
  assert.match(page, /action=\{updatePosition\}/);
});
