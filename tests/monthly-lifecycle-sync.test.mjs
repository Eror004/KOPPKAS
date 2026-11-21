import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createRequire } from "node:module";
import React, { act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import ts from "typescript";
const require = createRequire(import.meta.url);
function load(path, mocks, timers = { setTimeout, clearTimeout }) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  runInNewContext(js, { exports, require: name => mocks[name] ?? require(name), ...timers });
  return exports;
}
const { can } = load("../src/lib/auth/permissions.ts", {});
function actionFor(role, response = { data: { dues_month: "2026-11-01", status: "active", data_status: "available", processed_at: "2026-11-01T00:00:00Z", validated_at: "2026-11-01T00:00:00Z", register_count: 0 }, error: null }) {
  const calls = [];
  const { syncMonthlyDuesLifecycle } = load("../src/app/dashboard/uang-kas-bulanan/lifecycle-sync-action.ts", {
    "@/lib/auth/require-role": { requireModulePermission: async (module, permission) => {
      calls.push(["guard", module, permission]);
      if (!can(role, module, permission)) throw new Error("denied");
      return { role };
    } },
    "@/components/monthly-dues/period-totals-contract": { isValidTotalsMonth: value => /^\d{4}-(0[1-9]|1[0-2])-01$/.test(value) },
    "@/lib/supabase/server": { createClient: async () => ({ rpc: async name => { calls.push(["rpc", name]); return response; } }) },
  });
  return { action: syncMonthlyDuesLifecycle, calls };
}

test("sync action rechecks server permission and denies secretary, RT and RW before RPC", async () => {
  for (const role of ["ketua_pemuda", "wakil_ketua_pemuda", "bendahara"]) {
    const { action, calls } = actionFor(role);
    assert.equal((await action()).ok, true);
    assert.deepEqual(calls, [["guard", "monthly_dues", "update"], ["rpc", "sync_monthly_dues_period_lifecycle"]]);
  }
  for (const role of ["sekretaris", "ketua_rt_01", "ketua_rw_01"]) {
    const { action, calls } = actionFor(role);
    await assert.rejects(action(), /denied/);
    assert.equal(calls.some(call => call[0] === "rpc"), false);
  }
});

test("RPC error and malformed success are unconfirmed, not success", async () => {
  for (const response of [{ data: null, error: { message: "failed" } }, { data: { dues_month: "bad", status: "active", data_status: "available" }, error: null }]) {
    const result = await actionFor("bendahara", response).action();
    assert.equal(result.ok, false); assert.match(result.error, /belum terkonfirmasi/);
  }
});

test("SSR does not call sync; Strict Mode mount invokes once and successful sync refreshes read-only page", async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: "http://example.test" });
  const previous = { window: globalThis.window, document: globalThis.document, navigator: globalThis.navigator, flag: globalThis.IS_REACT_ACT_ENVIRONMENT };
  Object.defineProperty(globalThis, "window", { value: dom.window, configurable: true, writable: true });
  Object.defineProperty(globalThis, "document", { value: dom.window.document, configurable: true, writable: true });
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true, writable: true });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    const { createRoot } = await import("react-dom/client");
    let calls = 0, refreshes = 0, resolve;
    const pending = new Promise(r => { resolve = r; });
    const router = { refresh: () => { refreshes++; } };
    const { LifecycleSync } = load("../src/components/monthly-dues/lifecycle-sync.tsx", {
      "next/navigation": { useRouter: () => router },
      "@/app/dashboard/uang-kas-bulanan/lifecycle-sync-action": { syncMonthlyDuesLifecycle: () => { calls++; return pending; } },
    });
    const html = renderToStaticMarkup(React.createElement(LifecycleSync, { actorId: "actor-1" }));
    assert.match(html, /Menyinkronkan/); assert.equal(calls, 0);
    const root = createRoot(dom.window.document.getElementById("root"));
    await act(async () => { root.render(React.createElement(React.StrictMode, null, React.createElement(LifecycleSync, { actorId: "actor-1" }))); });
    assert.equal(calls, 1); assert.equal(refreshes, 0);
    await act(async () => { resolve({ ok: true }); await pending; });
    assert.equal(refreshes, 1); assert.equal(calls, 1);
    await act(async () => { root.unmount(); });
  } finally {
    for (const [key, value] of Object.entries({ window: previous.window, document: previous.document, navigator: previous.navigator, IS_REACT_ACT_ENVIRONMENT: previous.flag })) {
      if (value === undefined) delete globalThis[key]; else Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    }
    dom.window.close();
  }
});

test("explicit role check refuses a secretary even if the module guard is misconfigured", async () => {
  let rpc = 0;
  const { syncMonthlyDuesLifecycle } = load("../src/app/dashboard/uang-kas-bulanan/lifecycle-sync-action.ts", {
    "@/lib/auth/require-role": { requireModulePermission: async () => ({ role: "sekretaris" }) },
    "@/components/monthly-dues/period-totals-contract": { isValidTotalsMonth: () => true },
    "@/lib/supabase/server": { createClient: async () => ({ rpc: async () => { rpc++; } }) },
  });
  assert.equal((await syncMonthlyDuesLifecycle()).ok, false);
  assert.equal(rpc, 0);
});

test("unconfirmed sync displays error; lifecycle retry is blocked while pending and refreshes only after success", async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: "http://example.test" });
  const previous = { window: globalThis.window, document: globalThis.document, navigator: globalThis.navigator, flag: globalThis.IS_REACT_ACT_ENVIRONMENT };
  Object.defineProperty(globalThis, "window", { value: dom.window, configurable: true, writable: true });
  Object.defineProperty(globalThis, "document", { value: dom.window.document, configurable: true, writable: true });
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true, writable: true });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    const { createRoot } = await import("react-dom/client");
    let calls = 0, refreshes = 0, finish;
    const pending = new Promise(r => { finish = r; });
    const router = { refresh: () => { refreshes++; } };
    const { LifecycleSync } = load("../src/components/monthly-dues/lifecycle-sync.tsx", {
      "next/navigation": { useRouter: () => router },
      "@/app/dashboard/uang-kas-bulanan/lifecycle-sync-action": { syncMonthlyDuesLifecycle: async () => { calls++; return calls === 1 ? { ok: false } : pending; } },
    });
    const root = createRoot(dom.window.document.getElementById("root"));
    await act(async () => { root.render(React.createElement(LifecycleSync, { actorId: "actor-1" })); });
    assert.match(dom.window.document.querySelector('[role="alert"]').textContent, /belum terkonfirmasi/);
    assert.equal(refreshes, 0);
    const button = dom.window.document.querySelector("button");
    await act(async () => { button.click(); button.click(); });
    assert.equal(calls, 2);
    assert.ok(dom.window.document.querySelector('[role="status"]'));
    assert.equal(dom.window.document.querySelector("button"), null);
    await act(async () => { finish({ ok: true }); await pending; });
    assert.equal(refreshes, 1);
    await act(async () => { root.unmount(); });
  } finally {
    for (const [key, value] of Object.entries({ window: previous.window, document: previous.document, navigator: previous.navigator, IS_REACT_ACT_ENVIRONMENT: previous.flag })) {
      if (value === undefined) delete globalThis[key]; else Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    }
    dom.window.close();
  }
});

test("navigation remount shares in-flight sync, but a later visit may revalidate", async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: "http://example.test" });
  const previous = { window: globalThis.window, document: globalThis.document, navigator: globalThis.navigator, flag: globalThis.IS_REACT_ACT_ENVIRONMENT };
  Object.defineProperty(globalThis, "window", { value: dom.window, configurable: true, writable: true });
  Object.defineProperty(globalThis, "document", { value: dom.window.document, configurable: true, writable: true });
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true, writable: true });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    const { createRoot } = await import("react-dom/client");
    let calls = 0, refreshes = 0, finish;
    let now = Date.now();
    class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
    const pending = new Promise(r => { finish = r; });
    const router = { refresh: () => { refreshes++; } };
    const { LifecycleSync } = load("../src/components/monthly-dues/lifecycle-sync.tsx", {
      "next/navigation": { useRouter: () => router },
      "@/app/dashboard/uang-kas-bulanan/lifecycle-sync-action": { syncMonthlyDuesLifecycle: async () => { calls++; return calls === 1 ? pending : { ok: true }; } },
    }, { setTimeout, clearTimeout, Date: Clock });
    const root = createRoot(dom.window.document.getElementById("root"));
    await act(async () => { root.render(React.createElement(LifecycleSync, { actorId: "a", key: "first" })); });
    await act(async () => { root.render(React.createElement(LifecycleSync, { actorId: "a", key: "second" })); });
    assert.equal(calls, 1);
    await act(async () => { finish({ ok: true }); await pending; });
    assert.equal(refreshes, 1);
    await act(async () => { root.render(React.createElement(LifecycleSync, { actorId: "a", key: "third" })); });
    assert.equal(calls, 1); assert.equal(refreshes, 1);
    now += 5001;
    await act(async () => { root.render(React.createElement(LifecycleSync, { actorId: "a", key: "fourth" })); });
    assert.equal(calls, 2); assert.equal(refreshes, 2);
    await act(async () => { root.unmount(); });
  } finally {
    for (const [key, value] of Object.entries({ window: previous.window, document: previous.document, navigator: previous.navigator, IS_REACT_ACT_ENVIRONMENT: previous.flag })) {
      if (value === undefined) delete globalThis[key]; else Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    }
    dom.window.close();
  }
});

test("sync timeout remains unconfirmed and never refreshes as success", async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: "http://example.test" });
  const previous = { window: globalThis.window, document: globalThis.document, navigator: globalThis.navigator, flag: globalThis.IS_REACT_ACT_ENVIRONMENT };
  Object.defineProperty(globalThis, "window", { value: dom.window, configurable: true, writable: true });
  Object.defineProperty(globalThis, "document", { value: dom.window.document, configurable: true, writable: true });
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true, writable: true });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    const { createRoot } = await import("react-dom/client");
    let timer, refreshes = 0;
    const router = { refresh: () => { refreshes++; } };
    const { LifecycleSync } = load("../src/components/monthly-dues/lifecycle-sync.tsx", {
      "next/navigation": { useRouter: () => router },
      "@/app/dashboard/uang-kas-bulanan/lifecycle-sync-action": { syncMonthlyDuesLifecycle: () => new Promise(() => {}) },
    }, { setTimeout: (callback, delay) => { assert.equal(delay, 30000); timer = callback; return 1; }, clearTimeout: () => {} });
    const root = createRoot(dom.window.document.getElementById("root"));
    await act(async () => { root.render(React.createElement(LifecycleSync, { actorId: "actor" })); });
    await act(async () => { timer(); });
    assert.match(dom.window.document.querySelector('[role="alert"]').textContent, /belum terkonfirmasi/);
    assert.equal(refreshes, 0);
    await act(async () => { root.unmount(); });
  } finally {
    for (const [key, value] of Object.entries({ window: previous.window, document: previous.document, navigator: previous.navigator, IS_REACT_ACT_ENVIRONMENT: previous.flag })) {
      if (value === undefined) delete globalThis[key]; else Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    }
    dom.window.close();
  }
});

test("sync confirmation requires complete result and matches the WIB month of backend validation", async () => {
  const valid = { dues_month: "2026-11-01", status: "active", data_status: "available", processed_at: "2026-10-31T17:00:00Z", validated_at: "2026-10-31T17:00:00Z", register_count: 0 };
  assert.equal((await actionFor("bendahara", { data: valid, error: null }).action()).ok, true);
  for (const change of [{ validated_at: "2026-10-31T16:59:59Z" }, { processed_at: null }, { validated_at: "invalid" }, { register_count: -1 }, { register_count: null }, { data_status: "historical_empty" }]) {
    assert.equal((await actionFor("bendahara", { data: { ...valid, ...change }, error: null }).action()).ok, false);
  }
});

test("sync completing while unmounted still refreshes on a nearby remount", async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: "http://example.test" });
  const previous = { window: globalThis.window, document: globalThis.document, navigator: globalThis.navigator, flag: globalThis.IS_REACT_ACT_ENVIRONMENT };
  Object.defineProperty(globalThis, "window", { value: dom.window, configurable: true, writable: true });
  Object.defineProperty(globalThis, "document", { value: dom.window.document, configurable: true, writable: true });
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true, writable: true });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    const { createRoot } = await import("react-dom/client");
    let calls = 0, refreshes = 0, finish;
    const pending = new Promise(r => { finish = r; });
    const router = { refresh: () => { refreshes++; } };
    const { LifecycleSync } = load("../src/components/monthly-dues/lifecycle-sync.tsx", {
      "next/navigation": { useRouter: () => router },
      "@/app/dashboard/uang-kas-bulanan/lifecycle-sync-action": { syncMonthlyDuesLifecycle: () => { calls++; return pending; } },
    });
    const root = createRoot(dom.window.document.getElementById("root"));
    await act(async () => { root.render(React.createElement(LifecycleSync, { actorId: "a" })); });
    await act(async () => { root.render(null); });
    await act(async () => { finish({ ok: true }); await pending; });
    assert.equal(refreshes, 0);
    await act(async () => { root.render(React.createElement(LifecycleSync, { actorId: "a" })); });
    assert.equal(calls, 1); assert.equal(refreshes, 1);
    await act(async () => { root.unmount(); });
  } finally {
    for (const [key, value] of Object.entries({ window: previous.window, document: previous.document, navigator: previous.navigator, IS_REACT_ACT_ENVIRONMENT: previous.flag })) {
      if (value === undefined) delete globalThis[key]; else Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    }
    dom.window.close();
  }
});

test("database authorization rejection is distinct from ambiguous sync errors", async () => {
  for (const code of ["42501", "28000"]) {
    const result = await actionFor("bendahara", { data: null, error: { code } }).action();
    assert.equal(result.ok, false);
    assert.equal(result.reason, "denied");
  }
  for (const code of ["55000", "08006", undefined]) {
    const result = await actionFor("bendahara", { data: null, error: { code } }).action();
    assert.equal(result.ok, false);
    assert.equal(result.reason, "unconfirmed");
  }
});

test("authorization denial has no retry and does not automatically retry on remount", async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: "http://example.test" });
  const previous = { window: globalThis.window, document: globalThis.document, navigator: globalThis.navigator, flag: globalThis.IS_REACT_ACT_ENVIRONMENT };
  Object.defineProperty(globalThis, "window", { value: dom.window, configurable: true, writable: true });
  Object.defineProperty(globalThis, "document", { value: dom.window.document, configurable: true, writable: true });
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true, writable: true });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    const { createRoot } = await import("react-dom/client");
    let calls = 0, refreshes = 0;
    const router = { refresh: () => { refreshes++; } };
    const { LifecycleSync } = load("../src/components/monthly-dues/lifecycle-sync.tsx", {
      "next/navigation": { useRouter: () => router },
      "@/app/dashboard/uang-kas-bulanan/lifecycle-sync-action": { syncMonthlyDuesLifecycle: async () => { calls++; return { ok: false, reason: "denied", error: "denied" }; } },
    });
    const root = createRoot(dom.window.document.getElementById("root"));
    await act(async () => { root.render(React.createElement(LifecycleSync, { actorId: "actor", key: "first" })); });
    assert.match(dom.window.document.querySelector('[role="alert"]').textContent, /Akses sinkronisasi ditolak/);
    assert.equal(dom.window.document.querySelector("button"), null);
    await act(async () => { root.render(React.createElement(LifecycleSync, { actorId: "actor", key: "second" })); });
    assert.equal(calls, 1); assert.equal(refreshes, 0);
    assert.equal(dom.window.document.querySelector("button"), null);
    await act(async () => { root.unmount(); });
  } finally {
    for (const [key, value] of Object.entries({ window: previous.window, document: previous.document, navigator: previous.navigator, IS_REACT_ACT_ENVIRONMENT: previous.flag })) {
      if (value === undefined) delete globalThis[key]; else Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    }
    dom.window.close();
  }
});
