import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [page, client, home] = await Promise.all([
  read("../src/app/dashboard/page.tsx"),
  read("../src/components/dashboard-content-client.tsx"),
  read("../src/components/dashboard-home-client.tsx"),
]);

test("dashboard metrics come from role-scoped Supabase queries", () => {
  assert.match(page, /can\(user\.role, "members", "read"\)/);
  assert.match(page, /from\("members"\).*count: "exact"/s);
  assert.match(page, /can\(user\.role, "events", "read"\)/);
  assert.match(page, /from\("events"\).*count: "exact"/s);
  assert.doesNotMatch(page, /monthly_dues_summary|currentMonth|paid_amount/);
  assert.match(page, /monthlyCollected: \{ kind: "unavailable" as const \}/);
  assert.match(page, /from\("public_messages"\).*eq\("status", "baru"\)/s);
});

test("dashboard displays live metrics and Jakarta-local date instead of static placeholder values", () => {
  assert.match(client, /stats\.members/);
  assert.match(client, /stats\.events/);
  assert.match(client, /stats\.monthlyCollected/);
  assert.match(client, /stats\.newMessages/);
  assert.match(home, /timeZone: "Asia\/Jakarta"/);
  assert.doesNotMatch(client, /SELASA, 17 NOVEMBER 2026|BUILD IN PROGRESS|Menunggu koneksi data|Inbox belum terhubung/);
});

test("dashboard notification control navigates to the notifications module", () => {
  assert.match(client, /onClick=\{\(\) => chooseModule\("Notifikasi"\)\}/);
});
