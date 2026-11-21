import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
function load(createClient) {
  const source = readFileSync(new URL("../src/app/dashboard/uang-kas-bulanan/receipt-read.ts", import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  runInNewContext(js, { exports, require: name => {
    if (name === "server-only") return {};
    if (name === "@/lib/supabase/server") return { createClient };
    throw new Error(`Unexpected dependency ${name}`);
  } });
  return exports.readReceipt;
}
const id = "00000000-0000-4000-8000-000000000001";
const ref = "KAS-202610-00000000000040008000000000000001";
const receipt = { payment_id: id, payment_reference: ref, member_name: "Snapshot anggota", recorded_by_name: null,
  amount: 5000, paid_at: "2026-10-10T00:00:00Z", dues_month: "2026-10-01", status_after_transaction: "belum_bayar" };
function client(result) {
  const calls = [];
  return { calls, db: { from(table) { calls.push(["from", table]); return {
    select(fields) { calls.push(["select", fields]); return this; },
    eq(field, value) { calls.push(["eq", field, value]); return this; },
    async maybeSingle() { return result; },
  }; } } };
}
test("receipt reads persisted snapshots by transaction ID or reference", async () => {
  for (const [search, expectedField] of [[id, "payment_id"], [ref.toLowerCase(), "payment_reference"]]) {
    const { db, calls } = client({ data: receipt, error: null });
    const result = await load(async () => db)(search);
    assert.equal(result.receipt.member_name, "Snapshot anggota");
    assert.equal(result.receipt.recorded_by_name, null);
    assert.equal(calls[0][1], "monthly_dues_payment_receipts");
    assert.equal(calls[2][1], expectedField);
    assert.equal(calls[2][2], expectedField === "payment_reference" ? ref : id);
  }
});
test("invalid or unavailable receipt does not invent a success", async () => {
  let queries = 0;
  const read = load(async () => { queries++; return client({ data: null, error: null }).db; });
  assert.match((await read("nama anggota")).error, /valid/);
  assert.equal(queries, 0);
  assert.match((await read(id)).error, /tidak ditemukan/);
  const malformed = load(async () => client({ data: { ...receipt, member_name: undefined }, error: null }).db);
  assert.match((await malformed(id)).error, /tidak valid/);
});
