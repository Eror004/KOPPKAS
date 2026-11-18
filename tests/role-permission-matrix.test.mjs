import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const permissions = await readFile(new URL("../src/lib/auth/permissions.ts", import.meta.url), "utf8");

function roleBlock(role) {
  const start = permissions.indexOf(`  ${role}: {`);
  assert.notEqual(start, -1, `permission block exists for ${role}`);
  const end = permissions.indexOf("\n  },", start);
  assert.notEqual(end, -1, `permission block ends for ${role}`);
  return permissions.slice(start, end);
}

test("the permission matrix defines all six organization roles", () => {
  for (const role of ["ketua_pemuda", "wakil_ketua_pemuda", "sekretaris", "bendahara", "ketua_rw_01", "ketua_rt_01"]) {
    roleBlock(role);
  }
});

test("only Ketua Pemuda can manage accounts", () => {
  assert.ok(roleBlock("ketua_pemuda").includes('accounts: ["read", "create", "update", "delete", "manage"]'));
  for (const role of ["wakil_ketua_pemuda", "sekretaris", "bendahara", "ketua_rw_01", "ketua_rt_01"]) {
    assert.ok(!roleBlock(role).includes("accounts:"), role);
  }
});

test("only Sekretaris can mutate organizational structure", () => {
  assert.ok(roleBlock("sekretaris").includes('structure: ["read", "create", "update", "delete"]'));
  for (const role of ["ketua_pemuda", "wakil_ketua_pemuda", "ketua_rw_01", "ketua_rt_01"]) {
    assert.ok(roleBlock(role).includes('structure: ["read"]'), role);
  }
  assert.ok(!roleBlock("bendahara").includes("structure:"));
});

test("Sekretaris may record voluntary monthly dues but has no general finance access", () => {
  assert.ok(roleBlock("sekretaris").includes('monthly_dues: ["read", "create"]'));
  assert.ok(!roleBlock("sekretaris").includes("general_finance"));
  assert.ok(!roleBlock("sekretaris").includes("event_finance"));
});

test("RW and RT roles cannot access finance or approve events and letters", () => {
  for (const role of ["ketua_rw_01", "ketua_rt_01"]) {
    const block = roleBlock(role);
    for (const forbidden of ["general_finance", "monthly_dues", "event_finance"]) assert.ok(!block.includes(forbidden), role);
    assert.ok(block.includes('events: ["read", "create"]'), role);
    assert.ok(!block.includes("approve"), role);
  }
});

test("Bendahara can work on finance but cannot manage accounts or structure", () => {
  const block = roleBlock("bendahara");
  assert.ok(block.includes('general_finance: ["read", "create"]'));
  assert.ok(block.includes('monthly_dues: ["read", "create", "update"]'));
  assert.ok(block.includes('event_finance: ["read", "create", "approve"]'));
  assert.ok(!block.includes("accounts:"));
  assert.ok(!block.includes("structure:"));
});

test("INBOX is read-only for all six roles until mutation scope is approved", () => {
  for (const role of ["ketua_pemuda", "wakil_ketua_pemuda", "sekretaris", "bendahara", "ketua_rw_01", "ketua_rt_01"]) {
    assert.ok(roleBlock(role).includes('inbox: ["read"]'), role);
  }
});
