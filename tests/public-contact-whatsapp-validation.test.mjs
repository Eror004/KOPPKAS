import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const action = await readFile(
  new URL("../src/app/public/contact/actions.ts", import.meta.url),
  "utf8",
);

test("public contact validates WhatsApp numbers on the server", () => {
  assert.ok(action.includes("function isValidWhatsAppNumber(value: string)"));
  assert.ok(action.includes("digits.length >= 8"));
  assert.ok(action.includes("digits.length <= 15"));
  assert.ok(action.includes("isValidWhatsAppNumber(senderContact)"));
});

test("WhatsApp-only contact rejects email as a contact channel", () => {
  assert.ok(action.includes("Masukkan nomor WhatsApp aktif dengan 8–15 digit angka"));
  assert.ok(!action.includes("senderContact.length < 5"));
});
