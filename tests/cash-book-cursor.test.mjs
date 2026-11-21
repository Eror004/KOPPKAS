import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
const src = readFileSync(new URL("../src/app/dashboard/uang-kas-bulanan/cash-book-read.ts", import.meta.url), "utf8");
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const month = "2026-11-01";
const items = Array.from({length: 51}, (_, i) => ({ dues_month: month, movement_key: `1:payment:00000000-0000-4000-8000-${String(i).padStart(12,"0")}`, occurred_at: "2026-11-10T10:00:00.123456+00:00", description: "Iuran", recorded_by: null, amount: 1000 }));
function load({ role = "allow", rows = items } = {}) {
  const calls = [];
  const builder = (table) => {
    const q = {};
    for (const method of ["select", "eq", "order", "limit", "or"]) q[method] = (...args) => { calls.push([table, method, ...args]); return q; };
    q.maybeSingle = async () => ({ data: { dues_month: month }, error: null });
    q.then = (resolve, reject) => Promise.resolve({ data: rows, error: null }).then(resolve, reject);
    return q;
  };
  const exports = {};
  runInNewContext(js, { exports, Buffer, Number, Date, JSON, Promise, Array, require: name => name === "server-only" ? {} : name === "@/lib/supabase/server" ? { createClient: async () => ({ from: table => { calls.push(["from", table]); return builder(table); } }) } : name === "@/lib/auth/require-role" ? { requireModulePermission: async (...args) => { calls.push(["permission", ...args]); if (role === "deny") throw Error("denied"); } } : {} });
  return { read: exports.readCashBook, calls };
}
test("cursor uses stable timestamp plus tie-breaker and preserves microseconds", async () => {
  const { read, calls } = load();
  const first = await read(month); assert.equal(first.movements.length, 50); assert.equal(first.hasMore, true); assert.ok(first.nextCursor);
  await read(month, first.nextCursor);
  const filter = calls.find(x => x[1] === "or")[2];
  assert.match(filter, /2026-11-10T10:00:00\.123456\+00:00/); assert.match(filter, /000000000049/);
  assert.match(filter, /occurred_at\.gt.*and\(occurred_at\.eq.*movement_key\.gt/);
  assert.equal(calls.filter(x => x[1] === "limit")[0][2], 51);
});
test("invalid or cross-month cursors fail before querying; authorization precedes all queries", async () => {
  const { read, calls } = load();
  const forged = Buffer.from(JSON.stringify({month, at: '2026-11-10T10:00:00Z",x', key: items[0].movement_key})).toString("base64url");
  for (const cursor of [forged, "%%%", Buffer.from(JSON.stringify({ month: "2026-10-01", at: items[0].occurred_at, key: items[0].movement_key })).toString("base64url")]) assert.match((await read(month, cursor)).error, /Kursor/);
  assert.equal(calls.filter(x => x[0] === "from").length, 0);
  const denied = load({ role: "deny" }); await assert.rejects(denied.read(month), /denied/); assert.equal(denied.calls.filter(x => x[0] === "from").length, 0);
});
test("summary is read separately and last page has no cursor", async () => {
  const { read, calls } = load({ rows: items.slice(0, 1) }); const result = await read(month);
  assert.equal(result.hasMore, false); assert.equal(result.nextCursor, undefined); assert.equal(result.summary.dues_month, month);
  assert.ok(calls.some(x => x[0] === "from" && x[1] === "monthly_dues_cash_book_summary"));
});
