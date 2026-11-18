import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [migration, page, form, action] = await Promise.all([
  read("../supabase/migrations/20261118170000_private_document_storage.sql"),
  read("../src/app/dashboard/dokumentasi/page.tsx"),
  read("../src/app/dashboard/dokumentasi/upload-form.tsx"),
  read("../src/app/dashboard/dokumentasi/actions.ts"),
]);

test("organization document bucket is private and enforces file type and size limits", () => {
  assert.match(migration, /koppkas-documents[\s\S]*?false[\s\S]*?26214400/);
  assert.match(migration, /application\/pdf/);
  assert.match(migration, /video\/mp4/);
  assert.match(form, /25 \* 1024 \* 1024/);
});

test("storage access is scoped to active media roles and uploader-owned paths", () => {
  assert.match(migration, /koppkas_docs_read_media_roles/);
  assert.match(migration, /koppkas_docs_insert_media_roles/);
  assert.match(migration, /storage\.foldername\(name\)/);
  assert.match(migration, /app_private\.current_app_role\(\) is not null/);
});

test("uploads register only internal metadata under the authenticated user path", () => {
  assert.match(action, /storagePath\.startsWith/);
  assert.match(action, /visibility: "internal"/);
  assert.match(action, /uploaded_by: user\.profile\.id/);
  assert.match(form, /koppkas-documents/);
});

test("private files are displayed through short-lived signed URLs", () => {
  assert.match(page, /createSignedUrl\(item\.storage_path, 600\)/);
  assert.match(page, /\.eq\("visibility", "internal"\)/);
});