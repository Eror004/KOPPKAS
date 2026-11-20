import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read = (p) => readFile(new URL(p, import.meta.url), "utf8");
const [nav, shell, moduleShell, home, css] = await Promise.all([
  read("../src/components/dashboard-navigation.ts"), read("../src/components/dashboard-shell.tsx"),
  read("../src/components/module-shell.tsx"), read("../src/components/dashboard-home-client.tsx"), read("../src/app/globals.css"),
]);
test("both server shells filter the same navigation using server permissions", () => {
  assert.match(moduleShell, /await requireUser\(\)/);
  assert.match(moduleShell, /dashboardNavigation\.filter\(\(item\) => can\(user\.role, item\.module\)\)/);
  assert.match(home, /dashboardNavigation\.filter\(item => can\(role, item\.module\)\)/);
  assert.doesNotMatch(shell, /from "@\/lib\/auth\/permissions"/);
  assert.match(nav, /module: "event_finance"/);
  assert.match(nav, /module: "accounts"/);
});
test("navigation provides desktop collapse, mobile dialog and keyboard support", () => {
  assert.match(shell, /aria-expanded=\{!collapsed\}/);
  assert.match(shell, /role="dialog" aria-modal="true"/);
  assert.match(shell, /event\.key === "Escape"/);
  assert.match(shell, /event\.key === "Tab"/);
  assert.match(shell, /aria-current=/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /safe-area-inset-bottom/);
});
