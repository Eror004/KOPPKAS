import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../src/app/dashboard/inbox/page.tsx", import.meta.url), "utf8");

test("inbox message list remains capped while unread count is exact across all rows", () => {
  assert.match(page, /\.limit\(100\)/);
  assert.match(page, /count: "exact", head: true/);
  assert.match(page, /\.eq\("status", "baru"\)/);
  assert.doesNotMatch(page, /messages\.filter\(\(message\) => message\.status === "baru"\)/);
});
