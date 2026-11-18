import { ShieldCheck, UserPlus, UsersRound } from "lucide-react";
import { ModuleShell } from "@/components/module-shell";
import { requireModulePermission } from "@/lib/auth/require-role";
import { ROLE_LABELS, APP_ROLES } from "@/lib/auth/roles";
import { createAdminClient, hasSupabaseAdminConfig } from "@/lib/supabase/admin";
import { createAccount, resetAccountPassword, unlockAccount, updateAccount } from "./actions";

export const dynamic = "force-dynamic";

type AccountPageProps = { searchParams: Promise<{ success?: string; error?: string }> };

export default async function AccountsPage({ searchParams }: AccountPageProps) {
  await requireModulePermission("accounts", "manage");
  const query = await searchParams;

  if (!hasSupabaseAdminConfig()) {
    return (
      <ModuleShell title="Manajemen Akun">
        <main className="module-page">
          <div className="module-page-head"><div><p className="eyebrow">ACCOUNT CONTROL</p><h1>Manajemen Akun</h1><p>Pembuatan akun, pengaturan jabatan, status aktif, dan reset password.</p></div></div>
          <div className="module-alert" role="alert">Fitur ini belum diaktifkan. Tambahkan SUPABASE_SERVICE_ROLE_KEY sebagai environment variable server-only pada deployment dan environment lokal. Jangan pernah memakai awalan NEXT_PUBLIC_ untuk secret ini.</div>
        </main>
      </ModuleShell>
    );
  }

  const admin = createAdminClient();
  const [{ data: profiles, error: profilesError }, { data: authUsers, error: authError }, { data: lockRows, error: lockError }] = await Promise.all([
    admin.from("profiles").select("id,full_name,role,is_active,created_at").order("created_at", { ascending: true }),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from("login_protection_attempts").select("user_id,failed_attempts,locked_until,requires_admin_unlock"),
  ]);

  const emails = new Map((authUsers?.users ?? []).map((user) => [user.id, user.email ?? "Email tidak tersedia"]));
  const protections = new Map((lockRows ?? []).map((row) => [row.user_id, row]));
  const accounts = (profiles ?? []).map((profile) => ({ ...profile, email: emails.get(profile.id) ?? "Email tidak tersedia", protection: protections.get(profile.id) ?? null }));

  return (
    <ModuleShell title="Manajemen Akun">
      <main className="module-page">
        <div className="module-page-head"><div><p className="eyebrow">ACCOUNT CONTROL · KETUA PEMUDA</p><h1>Manajemen Akun</h1><p>Kelola akun pengurus, jabatan, status aktif, dan password. Akun tidak dihapus agar riwayat aktivitas tetap utuh.</p></div><div className="module-total"><UsersRound size={19} /><strong>{accounts.length}</strong><span>AKUN TERDAFTAR</span></div></div>
        {query.error && <p className="form-feedback error" role="alert">{query.error}</p>}
        {query.success && <p className="form-feedback success" role="status">{query.success}</p>}
        {(profilesError || authError) && <div className="module-alert" role="alert">Daftar akun tidak dapat dimuat lengkap. Periksa konfigurasi Supabase Auth dan database.</div>}
        {lockError && <div className="module-alert" role="alert">Status perlindungan login belum tersedia. Pastikan migrasi progressive login protection sudah diterapkan.</div>}

        <form action={createAccount} className="module-form">
          <div className="module-form-heading"><div><p className="eyebrow">AKUN BARU</p><h3>Buat akun pengurus</h3></div><span className="add-member-icon"><UserPlus size={18} /></span></div>
          <label>Nama lengkap<input name="full_name" minLength={2} maxLength={120} required placeholder="Nama pengurus" /></label>
          <label>Email login<input name="email" type="email" maxLength={254} required placeholder="nama@email.com" /></label>
          <label>Password awal<input name="password" type="password" minLength={5} maxLength={128} required autoComplete="new-password" placeholder="Minimal 5 karakter" /></label>
          <label>Jabatan<select name="role" defaultValue="" required><option value="" disabled>Pilih jabatan</option>{APP_ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select></label>
          <button type="submit"><UserPlus size={16} /> Buat akun</button>
        </form>

        <section className="module-table-panel" style={{ marginTop: 22 }}>
          <div className="module-table-heading"><div><p className="eyebrow">ACCOUNT DIRECTORY</p><h2>Daftar akun pengurus</h2></div><span>{accounts.length} AKUN</span></div>
          {accounts.length ? <div className="account-list">{accounts.map((account) => (
            <article className="member-group" key={account.id} style={{ padding: 16, margin: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div><strong style={{ color: "#24445a", fontSize: 13 }}>{account.full_name}</strong><p style={{ color: "#7a8f9e", fontSize: 11, margin: "4px 0" }}>{account.email}</p></div>
                <span className={account.protection?.requires_admin_unlock ? "account-status inactive" : account.protection?.locked_until && new Date(account.protection.locked_until).getTime() > Date.now() ? "account-status inactive" : account.is_active ? "account-status active" : "account-status inactive"}>{account.protection?.requires_admin_unlock ? "VERIFIKASI KETUA" : account.protection?.locked_until && new Date(account.protection.locked_until).getTime() > Date.now() ? "TERKUNCI SEMENTARA" : account.is_active ? "AKTIF" : "NONAKTIF"}</span>
              </div>
              <form action={updateAccount} className="module-form" style={{ maxWidth: "none", marginTop: 12, padding: 0, border: 0 }}>
                <input type="hidden" name="user_id" value={account.id} />
                <label>Nama lengkap<input name="full_name" defaultValue={account.full_name} minLength={2} maxLength={120} required /></label>
                <label>Jabatan<select name="role" defaultValue={account.role ?? ""} required><option value="" disabled>Pilih jabatan</option>{APP_ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select></label>
                <label>Status akun<select name="is_active" defaultValue={account.is_active ? "on" : "off"}><option value="on">Aktif</option><option value="off">Nonaktif</option></select></label>
                <button type="submit"><ShieldCheck size={15} /> Simpan perubahan</button>
              </form>
              <form action={resetAccountPassword} className="module-form" style={{ maxWidth: "none", marginTop: 12, padding: 0, border: 0 }}>
                <input type="hidden" name="user_id" value={account.id} />
                <label>Reset password<input name="password" type="password" minLength={5} maxLength={128} required autoComplete="new-password" placeholder="Password baru, minimal 5 karakter" /></label>
                <button type="submit">Perbarui password</button>
              </form>
              {account.protection && <form action={unlockAccount} className="module-form" style={{ maxWidth: "none", marginTop: 10, padding: 0, border: 0 }}>
                <input type="hidden" name="user_id" value={account.id} />
                <button type="submit" className="secondary-button">Reset penguncian login</button>
              </form>}
            </article>
          ))}</div> : <div className="module-empty">Belum ada akun pengurus yang terdaftar.</div>}
        </section>
        <p className="verify-disclaimer" style={{ marginTop: 16 }}>Akun yang dinonaktifkan tidak dapat masuk ke dashboard. Jangan mengirim password melalui INBOX atau kanal publik.</p>
      </main>
    </ModuleShell>
  );
}
