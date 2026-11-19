import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [functionSource, page, migration, config] = await Promise.all([
  read("../supabase/functions/public-contact-submit/index.ts"),
  read("../src/app/public/contact/page.tsx"),
  read("../supabase/migrations/20261118074617_public_contact_rate_limit.sql"),
  read("../supabase/config.toml"),
]);

test("public contact uses the Edge gateway IP and HMACs it before message insertion", () => {
  assert.match(functionSource, /cf-connecting-ip/);
  assert.match(functionSource, /x-forwarded-for/);
  assert.match(functionSource, /isIP\(candidateIp\)/);
  assert.match(functionSource, /SUPABASE_SECRET_KEYS/);
  assert.match(functionSource, /name: "HMAC", hash: "SHA-256"/);
  assert.ok(functionSource.indexOf("consume_public_contact_rate_limit") < functionSource.indexOf('from("public_messages").insert'));
  assert.doesNotMatch(functionSource, /body\.ip|body\.clientIp/);
});

test("public contact form sends only the form payload and public publishable key to the Edge Function", () => {
  assert.match(page, /functions\/v1\/public-contact-submit/);
  assert.match(page, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(page, /senderName:/);
  assert.match(page, /senderContact:/);
  assert.doesNotMatch(page, /SUPABASE_SECRET_KEY|createAdminClient/);
  assert.match(config, /\[functions\.public-contact-submit\]\s+verify_jwt = false/);
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
