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

// Execute the real TypeScript navigation and permission functions without a backend.
test("all navigation hrefs resolve to route files with matching server guards", async () => {
  const { existsSync, readFileSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const { runInNewContext } = await import("node:vm");
  const ts = await import("typescript");
  const evaluate = (source) => {
    const exports = {};
    runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports });
    return exports;
  };
  const items = evaluate(nav).dashboardNavigation;
  const { can } = evaluate(readFileSync(resolve("src/lib/auth/permissions.ts"), "utf8"));
  assert.equal(new Set(items.map(item => item.href)).size, items.length);
  const actions = new Map();
  for (const item of items) {
    const file = resolve("src/app", `.${item.href}`, "page.tsx");
    assert.ok(existsSync(file), `${item.href} has a route page`);
    const page = readFileSync(file, "utf8");
    if (item.href === "/dashboard") assert.match(page, /requireUser\(\)/);
    else {
      const guard = page.match(/requireModulePermission\("([^"]+)",\s*"([^"]+)"\)/);
      assert.ok(guard, `${item.href} has a module guard`);
      assert.equal(guard[1], item.module, `${item.href} checks the navigation module`);
      actions.set(item.href, guard[2]);
    }
  }
  const common = ["dashboard", "members", "events", "letters", "notifications", "inbox", "security"];
  const expected = {
    ketua_pemuda: [...common, "structure", "general_finance", "monthly_dues", "event_finance", "announcements", "media", "reports", "activity", "accounts"],
    wakil_ketua_pemuda: [...common, "structure", "general_finance", "monthly_dues", "event_finance", "announcements", "media", "reports", "activity"],
    sekretaris: [...common, "structure", "monthly_dues", "announcements", "media", "reports"],
    bendahara: [...common, "general_finance", "monthly_dues", "event_finance", "reports"],
    ketua_rw_01: [...common, "structure", "announcements", "media"],
    ketua_rt_01: [...common, "structure", "announcements", "media"],
  };
  for (const [role, modules] of Object.entries(expected)) {
    for (const item of items) {
      assert.equal(can(role, item.module), modules.includes(item.module), `${role}: ${item.href}`);
      if (actions.has(item.href)) assert.equal(can(role, item.module), can(role, item.module, actions.get(item.href)), `${role}: navigation and route action agree for ${item.href}`);
    }
    for (const href of ["/dashboard", "/dashboard/keanggotaan", "/dashboard/kegiatan", "/dashboard/inbox"]) {
      assert.ok(items.some(item => item.href === href && can(role, item.module)), `${role}: primary ${href}`);
    }
  }
});
