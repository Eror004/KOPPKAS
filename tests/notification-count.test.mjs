import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../src/app/dashboard/notifikasi/page.tsx", import.meta.url), "utf8");

test("notification unread total is exact and scoped to the current recipient", () => {
  assert.match(page, /count: "exact", head: true/);
  assert.match(page, /\.is\("read_at", null\)/);
  assert.match(page, /\.eq\("recipient_id", user\.profile\.id\)/);
  assert.doesNotMatch(page, /notifications\.filter\(\(item\) => !item\.read_at\)/);
});
