import { createClient } from "@supabase/supabase-js";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Environment variable ${name} belum diisi.`);
  return value;
}

export function validateBootstrapInput(input) {
  const fullName = String(input.fullName ?? "").trim();
  const email = String(input.email ?? "").trim().toLowerCase();
  const password = String(input.password ?? "");
  if (fullName.length < 2 || fullName.length > 120) throw new Error("Nama harus berisi 2–120 karakter.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error("Email tidak valid.");
  if (password.length < 12 || password.length > 128) throw new Error("Password awal harus berisi 12–128 karakter.");
  if (input.confirmation !== "CREATE_FIRST_KETUA") throw new Error("Konfirmasi bootstrap satu kali tidak cocok.");
  return { fullName, email, password };
}

export async function bootstrapFirstKetua(admin, input) {
  const valid = validateBootstrapInput(input);
  const { error: claimError } = await admin.from("first_ketua_bootstrap_guard").insert({ id: true });
  if (claimError) throw new Error("Bootstrap sudah diklaim atau migrasi guard belum diterapkan.");

  const [{ count, error: profileError }, { data: authData, error: authError }] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.auth.admin.listUsers({ page: 1, perPage: 1 }),
  ]);
  if (profileError || authError) throw new Error("Preflight Supabase gagal; claim tetap dikunci untuk pemeriksaan manual.");
  if ((count ?? 0) > 0 || (authData?.users?.length ?? 0) > 0) {
    await admin.from("first_ketua_bootstrap_guard").delete().eq("id", true);
    throw new Error("Bootstrap ditolak karena project sudah memiliki Auth user atau profil.");
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: valid.email,
    password: valid.password,
    email_confirm: true,
    user_metadata: { full_name: valid.fullName },
  });
  if (error || !data.user) throw new Error("Auth user gagal dibuat; claim tetap dikunci untuk pemeriksaan manual.");

  const { data: profile, error: updateError } = await admin.from("profiles")
    .update({ full_name: valid.fullName, role: "ketua_pemuda", is_active: true })
    .eq("id", data.user.id).select("id").maybeSingle();
  if (updateError || !profile) throw new Error("Auth user sudah dibuat tetapi profil belum lengkap. Jangan jalankan ulang; periksa manual.");

  const { error: auditError } = await admin.from("activity_logs").insert({
    actor_id: null,
    action: "bootstrap",
    resource_type: "profile",
    resource_id: data.user.id,
    metadata: { source: "one_time_first_ketua_bootstrap", changed_fields: ["full_name", "role", "is_active"] },
  });
  if (auditError) throw new Error("Akun sudah dibuat tetapi audit gagal. Jangan jalankan ulang; periksa manual.");

  const { error: completeError } = await admin.from("first_ketua_bootstrap_guard")
    .update({ auth_user_id: data.user.id, completed_at: new Date().toISOString() }).eq("id", true);
  if (completeError) throw new Error("Akun sudah dibuat tetapi guard belum selesai. Jangan jalankan ulang; periksa manual.");
  return { userId: data.user.id, email: valid.email };
}

async function main() {
  const url = required("NEXT_PUBLIC_SUPABASE_URL");
  const secret = process.env.SUPABASE_SECRET_KEY?.trim() || required("SUPABASE_SERVICE_ROLE_KEY");
  const input = {
    fullName: required("KOPPKAS_BOOTSTRAP_FULL_NAME"),
    email: required("KOPPKAS_BOOTSTRAP_EMAIL"),
    password: required("KOPPKAS_BOOTSTRAP_PASSWORD"),
    confirmation: required("KOPPKAS_BOOTSTRAP_CONFIRM"),
  };
  const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
  const result = await bootstrapFirstKetua(admin, input);
  console.log(`Ketua Pemuda pertama dibuat: ${result.email}`);
}

if (process.argv[1]?.endsWith("bootstrap-first-ketua.mjs")) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
