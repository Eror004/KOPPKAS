import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [migration, deletePolicy, page, form, action] = await Promise.all([
  read("../supabase/migrations/20261118074627_private_document_storage.sql"),
  read("../supabase/migrations/20261118074629_private_storage_delete_active_role_guard.sql"),
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

test("private document deletion requires an active media role and preserves admin cleanup", () => {
  assert.match(deletePolicy, /drop policy if exists "koppkas_docs_delete_owner_or_admin"/);
  assert.match(deletePolicy, /for delete to authenticated/);
  assert.match(deletePolicy, /app_private\.has_any_role\(array\[[\s\S]*?ketua_rt_01/);
  assert.match(deletePolicy, /storage\.foldername\(name\)\)\[1\] = \(select auth\.uid\(\)\)::text/);
  assert.match(deletePolicy, /ketua_pemuda','wakil_ketua_pemuda','sekretaris'/);
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

const storageRoleAlignment = await read("../supabase/migrations/20261118074644_private_storage_role_alignment.sql");

test("private storage updates exclude Bendahara and deletion is Ketua-only", () => {
  assert.match(storageRoleAlignment, /koppkas_docs_update_owner_or_admin/);
  assert.match(storageRoleAlignment, /'ketua_pemuda','wakil_ketua_pemuda','sekretaris','ketua_rw_01','ketua_rt_01'/);
  assert.doesNotMatch(storageRoleAlignment, /'bendahara'/);
  assert.match(storageRoleAlignment, /create policy "koppkas_docs_delete_ketua"/);
  assert.match(storageRoleAlignment, /has_any_role\(array\['ketua_pemuda'\]/);
});
