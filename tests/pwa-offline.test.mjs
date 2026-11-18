import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [worker, offline] = await Promise.all([
  read("../public/sw.js"),
  read("../public/offline.html"),
]);

test("service worker caches only static shell and immutable assets", () => {
  assert.match(worker, /STATIC_ASSETS = \["\/icon\.svg", "\/manifest\.webmanifest", "\/offline\.html"\]/);
  assert.match(worker, /url\.pathname\.startsWith\("\/_next\/static\/"\)/);
  assert.doesNotMatch(worker, /url\.pathname\.startsWith\("\/dashboard/);
  assert.doesNotMatch(worker, /url\.pathname\.startsWith\("\/api/);
});

test("navigation falls back to the offline shell without caching private pages", () => {
  assert.match(worker, /request\.mode === "navigate"/);
  assert.match(worker, /fetch\(request\)\.catch/);
  assert.match(worker, /caches\.match\("\/offline\.html"\)/);
  assert.match(offline, /data anggota, keuangan, dokumen pribadi/);
  assert.match(offline, /tidak disimpan untuk akses offline/);
});
