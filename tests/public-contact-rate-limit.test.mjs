import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [action, migration] = await Promise.all([
  read("../src/app/public/contact/actions.ts"),
  read("../supabase/migrations/20261118140000_public_contact_rate_limit.sql"),
]);

test("public contact validates and hashes the trusted client IP before message insertion", () => {
  assert.match(action, /headerStore\.get\("x-real-ip"\)/);
  assert.match(action, /isIP\(candidateIp\)/);
  assert.match(action, /createHash\("sha256"\)/);
  assert.ok(action.indexOf("consume_public_contact_rate_limit") < action.indexOf('from("public_messages").insert'));
});

test("public contact rate limit allows five submissions per ten-minute window", () => {
  assert.match(migration, /request_count \+ 1 >= 6/);
  assert.match(migration, /interval '10 minutes'/);
  assert.match(migration, /return current_count <= 5/);
});

test("rate-limit records contain only a hash and are inaccessible to anonymous clients", () => {
  assert.match(migration, /ip_hash text primary key/);
  assert.match(migration, /revoke all on public\.public_contact_rate_limits from public, anon, authenticated/);
  assert.doesNotMatch(migration, /client_ip inet/);
});
