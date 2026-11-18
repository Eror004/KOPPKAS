import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const permissions = await readFile(new URL("../src/lib/auth/permissions.ts", import.meta.url), "utf8");

function roleBlock(role) {
  const match = permissions.match(new RegExp(role + ":\\s*\\{([\\s\\S]*?)\\n  \\},"));
  assert.ok(match, `permission block exists for ${role}`);
  return match[1];
}

test("the permission matrix defines all six organization roles", () => {
  for (const role of [
    "ketua_pemuda",
    "wakil_ketua_pemuda",
    "sekretaris",
    "bendahara",
    "ketua_rw_01",
    "ketua_rt_01",
  ]) roleBlock(role);
});

test("only Ketua Pemuda can manage accounts", () => {
  assert.match(roleBlock("ketua_pemuda"), /accounts:\\s*\\[[^\\]]*"manage"/);
  for (const role of ["wakil_ketua_pemuda", "sekretaris", "bendahara", "ketua_rw_01", "ketua_rt_01"]) {
    assert.doesNotMatch(roleBlock(role), /accounts:/);
  }
});

test("only Sekretaris can mutate organizational structure", () => {
  assert.match(roleBlock("sekretaris"), /structure:\\s*\\[[^\\]]*"create"[^\\]]*"update"[^\\]]*"delete"/);
  for (const role of ["ketua_pemuda", "wakil_ketua_pemuda", "bendahara", "ketua_rw_01", "ketua_rt_01"]) {
    const block = roleBlock(role);
    if (role === "ketua_pemuda" || role === "wakil_ketua_pemuda" || role === "ketua_rw_01" || role === "ketua_rt_01") {
      assert.match(block, /structure:\\s*\\["read"\\]/);
    } else {
      assert.doesNotMatch(block, /structure:/);
    }
  }
});

test("Sekretaris may record voluntary monthly dues but has no general finance access", () => {
  assert.match(roleBlock("sekretaris"), /monthly_dues:\\s*\\["read", "create"\\]/);
  assert.doesNotMatch(roleBlock("sekretaris"), /general_finance|event_finance/);
});

test("RW and RT roles cannot access finance or approve events and letters", () => {
  for (const role of ["ketua_rw_01", "ketua_rt_01"]) {
    const block = roleBlock(role);
    assert.doesNotMatch(block, /general_finance|monthly_dues|event_finance/);
    assert.match(block, /events:\\s*\\["read", "create"\\]/);
    assert.doesNotMatch(block, /approve/);
  }
});

test("Bendahara can work on finance but cannot manage accounts or structure", () => {
  const block = roleBlock("bendahara");
  assert.match(block, /general_finance:\\s*\\["read", "create"\\]/);
  assert.match(block, /monthly_dues:\\s*\\["read", "create", "update"\\]/);
  assert.match(block, /event_finance:\\s*\\["read", "create", "approve"\\]/);
  assert.doesNotMatch(block, /accounts:|structure:/);
});

test("INBOX is read-only for all six roles until mutation scope is approved", () => {
  for (const role of [
    "ketua_pemuda",
    "wakil_ketua_pemuda",
    "sekretaris",
    "bendahara",
    "ketua_rw_01",
    "ketua_rt_01",
  ]) {
    assert.match(roleBlock(role), /inbox:\\s*\\["read"\\]/);
  }
});
