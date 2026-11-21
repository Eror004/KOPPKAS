import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function loadAdapter(createClient) {
  const source = readFileSync(new URL("../src/app/dashboard/uang-kas-bulanan/book-read.ts", import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  runInNewContext(js, { exports, require: name => {
    if (name === "server-only") return {};
    if (name === "@/lib/supabase/server") return { createClient };
    throw new Error(`Unexpected dependency ${name}`);
  }, Number });
  return exports.readMonthlyBook;
}

function clientFor(results, activeRow = active) {
  const calls = [];
  return { calls, client: { rpc: async name => { calls.push(["rpc", name]); throw new Error("unexpected mutation"); }, from(table) {
    calls.push(["from", table]);
    let activeQuery = false;
    const chain = {};
    for (const method of ["select", "order", "limit", "lt", "eq", "gt"]) chain[method] = (...args) => { calls.push([method, ...args]); if (method === "eq" && args[0] === "status" && args[1] === "active") activeQuery = true; return chain; };
    const next = () => { if (activeQuery) return { data: activeRow, error: null }; const result = results.shift(); assert.ok(result, `unexpected query ${table}`); return result; };
    chain.maybeSingle = async () => next();
    chain.then = (resolve, reject) => Promise.resolve(next()).then(resolve, reject);
    return chain;
  } } };
}
const period = "2026-10-01";
const id = "00000000-0000-4000-8000-000000000001";
const active = { dues_month: period, status: "active", data_status: "available", closed_effective_at: null, closed_processed_at: null };

test("reads PR25 snapshots without lifecycle mutation and never fetches finance", async () => {
  const { client, calls } = clientFor([
    { data: [active], error: null },
    { data: active, error: null },
    { data: [{ payment_id: id, member_name: "Nama snapshot", amount: "5000.00" }], error: null },
  ]);
  const result = await loadAdapter(async () => client)({ month: period });
  assert.equal(result.selected.dues_month, period);
  assert.equal(calls.some(call => call[0] === "rpc"), false);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].memberNameSnapshot, "Nama snapshot");
  assert.equal(result.rows[0].amount, "5000.00");
  assert.deepEqual(calls.filter(call => call[0] === "from").map(call => call[1]), ["monthly_dues_periods", "monthly_dues_periods", "monthly_dues_periods", "monthly_dues_payment_receipts"]);
  assert.ok(calls.some(call => call[0] === "select" && call[1] === "payment_id, member_name, amount"));
  assert.equal(calls.some(call => call.some(arg => typeof arg === "string" && /finance|cash_book/.test(arg))), false);
});

test("no current month is guessed and nonexistent or invalid periods are refused", async () => {
  const { client, calls } = clientFor([{ data: [active], error: null }]);
  const read = loadAdapter(async () => client);
  const result = await read({});
  assert.equal(result.activeMonth, period);
  assert.equal(result.selected, undefined);
  assert.equal(calls.filter(call => call[0] === "from").length, 2);
  const invalid = await read({ month: "2026-99-01" });
  assert.match(invalid.error, /tidak valid/);
  assert.equal(calls.filter(call => call[0] === "from").length, 2);
  const unavailable = clientFor([{ data: [active], error: null }, { data: null, error: null }]);
  const missing = await loadAdapter(async () => unavailable.client)({ month: "2026-09-01" });
  assert.match(missing.error, /tidak ditemukan/);
  assert.equal(unavailable.calls.filter(call => call[0] === "from").length, 3);
});

test("keyset pages payments without aggregating a partial page", async () => {
  const ids = Array.from({ length: 25 }, (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`);
  const { client, calls } = clientFor([
    { data: [active], error: null }, { data: active, error: null },
    { data: ids.map(payment_id => ({ payment_id, member_name: null, amount: 1000 })), error: null },
  ]);
  const result = await loadAdapter(async () => client)({ month: period, after: id });
  assert.equal(result.rows.length, 24);
  assert.equal(result.nextPaymentCursor, ids[23]);
  assert.equal(result.total, undefined);
  assert.ok(calls.some(call => call[0] === "gt" && call[1] === "payment_id" && call[2] === id));
});

test("unavailable or malformed data fails closed rather than displaying zero or success", async () => {
  const read = loadAdapter(async () => { throw new Error("configuration unavailable"); });
  const unavailable = await read({});
  assert.match(unavailable.error, /belum dapat diakses/);
  const { client } = clientFor([
    { data: [active], error: null }, { data: active, error: null },
    { data: [{ payment_id: id, member_name: null, amount: "" }], error: null },
  ]);
  const invalid = await loadAdapter(async () => client)({ month: period });
  assert.match(invalid.error, /tidak valid/);
  assert.equal(invalid.rows, undefined);
});

test("historical empty archive never fetches payments or invents member rows", async () => {
  const empty = { dues_month: "2026-09-01", status: "closed", data_status: "historical_empty", closed_effective_at: "2026-09-30T17:00:00Z", closed_processed_at: "2026-10-02T12:00:00Z" };
  const { client, calls } = clientFor([
    { data: [active, empty], error: null }, { data: empty, error: null },
  ]);
  const result = await loadAdapter(async () => client)({ month: empty.dues_month });
  assert.equal(result.selected.data_status, "historical_empty");
  assert.equal(result.rows, undefined);
  assert.equal(calls.some(call => call.includes("monthly_dues_payment_receipts")), false);
});

test("inconsistent active state fails closed without calling lifecycle", async () => {
  const wrong = { ...active, dues_month: "2026-09-01" };
  const mismatch = clientFor([{ data: [wrong], error: null }]);
  const result = await loadAdapter(async () => mismatch.client)({ month: period });
  assert.match(result.error, /diverifikasi/);
  assert.equal(mismatch.calls.some(call => call[0] === "rpc"), false);
  assert.equal(mismatch.calls.some(call => call.includes("monthly_dues_payment_receipts")), false);
});

test("book data never queries or derives aggregate counts", async () => {
  const { client, calls } = clientFor([
    { data: [active], error: null }, { data: active, error: null },
    { data: [{ payment_id: id, member_name: null, amount: 5000 }], error: null },
  ]);
  const result = await loadAdapter(async () => client)({ month: period });
  assert.equal(result.rows.length, 1);
  assert.equal(result.memberCounts, undefined);
  assert.equal(calls.some(call => call.includes("monthly_dues_summary")), false);
});

test("repeated reads and missing active period never trigger mutation", async () => {
  const { client, calls } = clientFor([{ data: [], error: null }, { data: [], error: null }], null);
  const read = loadAdapter(async () => client);
  const result = await read({});
  assert.equal(result.activeMonth, undefined);
  await read({});
  assert.equal(calls.some(call => call[0] === "rpc"), false);
});
