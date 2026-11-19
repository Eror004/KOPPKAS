import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [page, migration, config] = await Promise.all([
  read("../src/app/public/contact/page.tsx"),
  read("../supabase/migrations/20261118074617_public_contact_rate_limit.sql"),
  read("../supabase/config.toml"),
]);

test("Public Contact Center exposes WhatsApp as the only contact channel", () => {
  assert.match(page, /WhatsApp resmi organisasi/);
  assert.doesNotMatch(page, /<form|<textarea|<select|sender_name|sender_contact|email|Instagram|alamat sekretariat|jam layanan/i);
  assert.doesNotMatch(page, /functions\/v1\/public-contact-submit/);
});

test("WhatsApp contact remains inactive until an official organization number is configured", () => {
  assert.match(page, /Nomor WhatsApp resmi organisasi belum dikonfigurasi/);
  assert.doesNotMatch(page, /wa\.me\/\d+|api\.whatsapp\.com\/send\?phone=/);
});

test("legacy contact rate-limit storage remains private and never stores raw IP addresses", () => {
  assert.match(migration, /ip_hash text primary key/);
  assert.match(migration, /revoke all on public\.public_contact_rate_limits from public, anon, authenticated/);
  assert.doesNotMatch(migration, /client_ip inet/);
  assert.doesNotMatch(config, /\[functions\.public-contact-submit\]/);
});
