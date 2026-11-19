/// <reference lib="deno.ns" />
import { withSupabase } from "npm:@supabase/server@1";

const allowedRoles = new Set([
  "ketua_pemuda",
  "wakil_ketua_pemuda",
  "sekretaris",
  "bendahara",
  "ketua_rw_01",
  "ketua_rt_01",
]);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidPattern = /^[0-9a-f-]{36}$/i;

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function validText(value: unknown, min: number, max: number) {
  return typeof value === "string" && value.trim().length >= min && value.trim().length <= max;
}

const handler = withSupabase({ auth: "user" }, async (request, context) => {
  if (request.method !== "POST") return response({ error: "Method not allowed." }, 405);

  const authorization = request.headers.get("Authorization") ?? "";
  const accessToken = authorization.replace(/^Bearer\s+/i, "");
  if (!accessToken) return response({ error: "Authentication required." }, 401);

  const { data: authData, error: authError } = await context.supabase.auth.getUser(accessToken);
  if (authError || !authData.user) return response({ error: "Authentication required." }, 401);

  const actorId = authData.user.id;
  const admin = context.supabaseAdmin;
  const { data: actor, error: actorError } = await admin
    .from("profiles")
    .select("id,role,is_active")
    .eq("id", actorId)
    .maybeSingle();

  if (actorError) return response({ error: "Account authorization could not be verified." }, 500);
  if (actor?.role !== "ketua_pemuda" || actor.is_active !== true) {
    return response({ error: "Only an active Ketua Pemuda can manage accounts." }, 403);
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return response({ error: "Invalid request body." }, 400);
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return response({ error: "Invalid request body." }, 400);
  }

  const action = body.action;

  if (action === "list") {
    const [
      { data: profiles, error: profilesError },
      { data: authUsers, error: usersError },
      { data: lockRows, error: lockError },
    ] = await Promise.all([
      admin.from("profiles").select("id,full_name,role,is_active,created_at").order("created_at", { ascending: true }),
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      admin.from("login_protection_status").select("user_id,failed_attempts,locked_until,requires_admin_unlock,is_currently_locked"),
    ]);

    if (profilesError || usersError || lockError) {
      return response({ error: "Account directory could not be loaded completely." }, 500);
    }

    const emails = new Map((authUsers?.users ?? []).map((user) => [user.id, user.email ?? "Email tidak tersedia"]));
    const protections = new Map((lockRows ?? []).map((row) => [row.user_id, row]));
    const accounts = (profiles ?? []).map((profile) => ({
      ...profile,
      email: emails.get(profile.id) ?? "Email tidak tersedia",
      protection: protections.get(profile.id) ?? null,
    }));
    return response({ accounts });
  }

  if (action === "create") {
    const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const role = typeof body.role === "string" ? body.role : "";

    if (!validText(fullName, 2, 120)) return response({ error: "Nama harus berisi 2–120 karakter." }, 400);
    if (!emailPattern.test(email) || email.length > 254) return response({ error: "Alamat email tidak valid." }, 400);
    if (password.length < 5 || password.length > 128) return response({ error: "Password harus berisi 5–128 karakter." }, 400);
    if (!allowedRoles.has(role)) return response({ error: "Jabatan akun tidak valid." }, 400);

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError || !created.user) return response({ error: "Akun gagal dibuat. Periksa email dan konfigurasi Auth." }, 400);

    const { data: profile, error: profileError } = await admin.from("profiles")
      .update({ full_name: fullName, role, is_active: true })
      .eq("id", created.user.id)
      .select("id")
      .maybeSingle();

    if (profileError || !profile) {
      await admin.auth.admin.deleteUser(created.user.id);
      return response({ error: "Profil akun gagal diperbarui. Pembuatan akun dibatalkan." }, 500);
    }

    const { error: auditError } = await admin.from("activity_logs").insert({
      actor_id: actorId,
      action: "create",
      resource_type: "profile",
      resource_id: created.user.id,
      metadata: { changed_fields: ["full_name", "role", "is_active"] },
    });
    if (auditError) {
      await admin.auth.admin.deleteUser(created.user.id);
      return response({ error: "Akun dibatalkan karena catatan audit tidak dapat disimpan." }, 500);
    }

    return response({ ok: true, message: "Akun baru berhasil dibuat." });
  }

  if (action === "update") {
    const targetId = typeof body.userId === "string" ? body.userId : "";
    const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
    const role = typeof body.role === "string" ? body.role : "";
    const isActive = body.isActive === true;

    if (!uuidPattern.test(targetId)) return response({ error: "Akun tujuan tidak valid." }, 400);
    if (!validText(fullName, 2, 120)) return response({ error: "Nama harus berisi 2–120 karakter." }, 400);
    if (!allowedRoles.has(role)) return response({ error: "Jabatan akun tidak valid." }, 400);
    if (targetId === actorId && (role !== "ketua_pemuda" || !isActive)) {
      return response({ error: "Ketua tidak dapat menurunkan jabatan atau menonaktifkan akunnya sendiri." }, 400);
    }

    const { data: target, error: targetError } = await admin.from("profiles")
      .select("id,full_name,role,is_active")
      .eq("id", targetId)
      .maybeSingle();
    if (targetError || !target) return response({ error: "Akun tidak ditemukan." }, 404);

    if (target.role === "ketua_pemuda" && (role !== "ketua_pemuda" || !isActive)) {
      const { count, error } = await admin.from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "ketua_pemuda")
        .eq("is_active", true);
      if (error || (count ?? 0) <= 1) {
        return response({ error: "Minimal harus ada satu akun Ketua Pemuda yang aktif." }, 409);
      }
    }

    const { error: updateError } = await admin.from("profiles")
      .update({ full_name: fullName, role, is_active: isActive, updated_at: new Date().toISOString() })
      .eq("id", targetId);
    if (updateError) return response({ error: "Perubahan akun gagal disimpan." }, 500);

    if (!isActive || role !== target.role) {
      const { error: sessionError } = await admin.rpc("revoke_user_app_sessions_admin", {
        p_actor_id: actorId,
        p_user_id: targetId,
      });
      if (sessionError) {
        await admin.from("profiles").update({
          full_name: target.full_name,
          role: target.role,
          is_active: target.is_active,
        }).eq("id", targetId);
        return response({ error: "Perubahan dibatalkan karena sesi lama akun belum berhasil dicabut." }, 500);
      }
    }

    const { error: auditError } = await admin.from("activity_logs").insert({
      actor_id: actorId,
      action: "update",
      resource_type: "profile",
      resource_id: targetId,
      metadata: { changed_fields: ["full_name", "role", "is_active"] },
    });
    if (auditError) return response({ error: "Akun berubah, tetapi catatan audit gagal disimpan. Periksa log aktivitas." }, 500);

    return response({ ok: true, message: "Data dan hak akses akun berhasil diperbarui." });
  }

  if (action === "reset_password") {
    const targetId = typeof body.userId === "string" ? body.userId : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!uuidPattern.test(targetId)) return response({ error: "Akun tujuan tidak valid." }, 400);
    if (password.length < 5 || password.length > 128) return response({ error: "Password baru harus berisi 5–128 karakter." }, 400);

    const { error: passwordError } = await admin.auth.admin.updateUserById(targetId, { password });
    if (passwordError) return response({ error: "Password akun gagal diperbarui." }, 400);

    const { error: sessionError } = targetId === actorId
      ? await context.supabase.rpc("revoke_other_app_sessions")
      : await admin.rpc("revoke_user_app_sessions_admin", { p_actor_id: actorId, p_user_id: targetId });
    if (sessionError) return response({ error: "Password berubah, tetapi sesi perangkat lama belum berhasil dicabut." }, 500);

    const { error: unlockError } = await admin.from("login_protection_attempts").delete().eq("user_id", targetId);
    if (unlockError) return response({ error: "Password berubah, tetapi status penguncian belum dapat direset." }, 500);

    const { error: auditError } = await admin.from("activity_logs").insert({
      actor_id: actorId,
      action: "password_reset",
      resource_type: "auth_user",
      resource_id: targetId,
      metadata: {},
    });
    if (auditError) return response({ error: "Password berubah, tetapi catatan audit gagal disimpan." }, 500);

    return response({ ok: true, message: "Password berhasil diperbarui dan sesi lama dicabut." });
  }

  if (action === "unlock") {
    const targetId = typeof body.userId === "string" ? body.userId : "";
    if (!uuidPattern.test(targetId)) return response({ error: "Akun tujuan tidak valid." }, 400);

    const { error: unlockError } = await admin.from("login_protection_attempts").delete().eq("user_id", targetId);
    if (unlockError) return response({ error: "Status penguncian gagal direset." }, 500);

    const { error: auditError } = await admin.from("activity_logs").insert({
      actor_id: actorId,
      action: "login_protection_reset",
      resource_type: "auth_user",
      resource_id: targetId,
      metadata: {},
    });
    if (auditError) return response({ error: "Status penguncian direset, tetapi catatan audit gagal disimpan." }, 500);

    return response({ ok: true, message: "Status penguncian login berhasil direset." });
  }

  return response({ error: "Action tidak dikenali." }, 400);
});

Deno.serve(handler);
