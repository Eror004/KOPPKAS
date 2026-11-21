import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
const src = readFileSync(new URL("../src/app/dashboard/uang-kas-bulanan/cash-book-read.ts", import.meta.url), "utf8");
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const month = "2026-11-01";
const highWater = "2026-11-20T10:00:00.123456+00:00";
const items = Array.from({length: 51}, (_, i) => ({ dues_month: month, movement_key: "1:payment:00000000-0000-4000-8000-"+String(i).padStart(12,"0"), occurred_at: "2026-11-10T10:00:00.123456+00:00", recorded_at: highWater, description: "Iuran", recorded_by: null, amount: 1000 }));
function load({ role = "allow", rows = items, highWaterRow = { recorded_at: highWater } } = {}) {
  const calls = [];
  const builder = (table) => {
    const q = {};
    for (const method of ["select", "eq", "order", "limit", "or", "lte"]) q[method] = (...args) => { calls.push([table, method, ...args]); return q; };
    q.maybeSingle = async () => ({ data: table === "monthly_dues_cash_book_summary" ? { dues_month: month } : highWaterRow, error: null });
    q.then = (resolve, reject) => Promise.resolve({ data: rows, error: null }).then(resolve, reject);
    return q;
  };
  const exports = {};
  runInNewContext(js, { exports, Buffer, Number, Date, JSON, Promise, Array, require: name => name === "server-only" ? {} : name === "@/lib/supabase/server" ? { createClient: async () => ({ from: table => { calls.push(["from", table]); return builder(table); } }) } : name === "@/lib/auth/require-role" ? { requireModulePermission: async (...args) => { calls.push(["permission", ...args]); if (role === "deny") throw Error("denied"); } } : {} });
  return { read: exports.readCashBook, calls };
}
test("cursor pins a recorded_at high-water mark and keeps the stable event-time tie-breaker", async () => {
  const { read, calls } = load();
  const first = await read(month); assert.equal(first.movements.length, 50); assert.equal(first.hasMore, true); assert.ok(first.nextCursor);
  const decoded = JSON.parse(Buffer.from(first.nextCursor, "base64url").toString("utf8")); assert.equal(decoded.highWater, highWater);
  await read(month, first.nextCursor);
  const filters = calls.filter(x => x[1] === "lte"); assert.equal(filters.length, 2); assert.deepEqual(filters.map(x => x[2]), [highWater, highWater]);
  const eventFilter = calls.find(x => x[1] === "or")[2];
  assert.match(eventFilter, /2026-11-10T10:00:00\.123456\+00:00/); assert.match(eventFilter, /000000000049/);
  assert.match(eventFilter, /occurred_at\.gt.*and\(occurred_at\.eq.*movement_key\.gt/);
  assert.ok(calls.some(x => x[1] === "order" && x[2] === "recorded_at" && x[3].ascending === false));
});
test("invalid or cross-month cursors fail before querying; authorization precedes all queries", async () => {
  const { read, calls } = load();
  const forged = Buffer.from(JSON.stringify({ month, at: "2026-11-10T10:00:00Z", key: items[0].movement_key })).toString("base64url");
  for (const cursor of [forged, "%%%", Buffer.from(JSON.stringify({ month: "2026-10-01", at: items[0].occurred_at, key: items[0].movement_key, highWater })).toString("base64url")]) assert.match((await read(month, cursor)).error, /Kursor/);
  assert.equal(calls.filter(x => x[0] === "from").length, 0);
  const denied = load({ role: "deny" }); await assert.rejects(denied.read(month), /denied/); assert.equal(denied.calls.filter(x => x[0] === "from").length, 0);
});
test("a newly inserted backdated row beyond the first-page high-water mark is rejected", async () => {
  const late = { ...items[0], recorded_at: "2026-11-20T10:00:01.000000+00:00" };
  const { read } = load({ rows: [late] });
  assert.match((await read(month)).error, /Data mutasi kas tidak valid/);
});
test("no movement snapshot returns the official summary without inventing a zero balance", async () => {
  const { read, calls } = load({ highWaterRow: null, rows: [] });
  const result = await read(month);
  assert.equal(result.summary.dues_month, month); assert.equal(result.movements.length, 0); assert.equal(result.hasMore, false);
  assert.equal(calls.filter(x => x[1] === "lte").length, 0);
});
test("invalid months fail before database access", async () => {
  const { read, calls } = load();
  assert.match((await read("2026-13-01")).error, /Periode/);
  assert.equal(calls.filter(x => x[0] === "from").length, 0);
});
