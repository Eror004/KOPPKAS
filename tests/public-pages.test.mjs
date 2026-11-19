import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [home, about, structure, information, transparency] = await Promise.all([
  read("../src/components/public-home.tsx"),
  read("../src/app/public/tentang/page.tsx"),
  read("../src/app/public/struktur/page.tsx"),
  read("../src/app/public/informasi/page.tsx"),
  read("../src/app/public/transparansi/page.tsx"),
]);

test("public navigation exposes the seven blueprint destinations", () => {
  for (const route of ["tentang", "struktur", "kegiatan", "informasi", "transparansi", "contact"]) {
    assert.match(home, new RegExp("/public/" + route));
  }
});

test("public structure and transparency pages never expose internal records by default", () => {
  assert.match(structure, /tidak otomatis ditampilkan/);
  assert.match(transparency, /tidak otomatis ditampilkan/);
  assert.doesNotMatch(structure + transparency, /from\("(profiles|members|general_ledger_entries|monthly_dues_payments)"\)/);
});

test("public information only reads published announcements", () => {
  assert.match(information, /from\("announcements"\)/);
  assert.match(information, /eq\("is_published", true\)/);
});

test("about page uses the approved organizational vision", () => {
  assert.match(about, /Mewujudkan generasi muda yang bersatu, berdaya, kreatif, dan bertanggung jawab/);
});
