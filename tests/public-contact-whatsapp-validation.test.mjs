import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const action = await readFile(
  new URL("../src/app/public/contact/actions.ts", import.meta.url),
  "utf8",
);

test("public contact validates WhatsApp numbers on the server", () => {
  assert.match(action, /function isValidWhatsAppNumber\(value: string\)/);
  assert.match(action, /digits\.length >= 8/);
  assert.match(action, /digits\.length <= 15/);
  assert.match(action, /\^\\\?\+\?\[0-9\]/);
  assert.match(action, /if \(!isValidWhatsAppNumber\(senderContact\)\)/);
});

test("WhatsApp-only contact rejects email as a contact channel", () => {
  assert.match(action, /Masukkan nomor WhatsApp aktif dengan 8–15 digit angka/);
  assert.doesNotMatch(action, /senderContact\.length < 5/);
});
