import { Clock3, Laptop, LogOut, ShieldCheck, Smartphone, Tablet } from "lucide-react";
import { ModuleShell } from "@/components/module-shell";
import { requireModulePermission } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { revokeDeviceSession, revokeOtherDeviceSessions } from "./actions";

export const dynamic = "force-dynamic";

type DeviceSession = {
  session_id: string;
  device_label: string;
  created_at: string;
  last_seen_at: string;
  is_current: boolean;
};

type SecurityPageProps = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

function DeviceIcon({ label }: { label: string }) {
  if (/phone|android|iphone/i.test(label)) return <Smartphone size={20} />;
  if (/tablet|ipad/i.test(label)) return <Tablet size={20} />;
  return <Laptop size={20} />;
}

function formatDate(value: string | null) {
  if (!value) return "Belum tersedia";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

export default async function AccountSecurityPage({ searchParams }: SecurityPageProps) {
  await requireModulePermission("security", "read");
  const query = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_app_sessions");
  const sessions = (data ?? []) as DeviceSession[];

  return (
    <ModuleShell title="Keamanan Akun">
      <main className="module-page">
        <div className="module-page-head">
          <div>
            <p className="eyebrow">ACCOUNT SECURITY</p>
            <h1>Keamanan Akun</h1>
            <p>Pantau perangkat yang sedang menggunakan akun ini dan keluarkan sesi yang tidak dikenal.</p>
          </div>
          <div className="module-total"><ShieldCheck size={19} /><strong>{sessions.length}/3</strong><span>PERANGKAT AKTIF</span></div>
        </div>

        {query.error && <p className="form-feedback error" role="alert">{query.error}</p>}
        {query.success && <p className="form-feedback success" role="status">{query.success}</p>}
        {error && <div className="module-alert" role="alert">Daftar sesi belum dapat dimuat. Pastikan migration keamanan perangkat sudah diterapkan.</div>}

        <section className="session-policy-panel">
          <div className="session-policy-icon"><Clock3 size={20} /></div>
          <div>
            <strong>Batas keamanan aktif</strong>
            <p>Maksimal 3 perangkat secara bersamaan. Setiap sesi berakhir setelah 24 jam sejak login. Jika sudah ada 3 perangkat aktif, login dari perangkat keempat ditolak dan sesi yang lama tetap dipertahankan.</p>
          </div>
        </section>

        <section className="module-table-panel session-panel">
          <div className="module-table-heading">
            <div><p className="eyebrow">ACTIVE SESSIONS</p><h2>Perangkat yang terhubung</h2></div>
            <span>{sessions.length} / 3</span>
          </div>

          {!error && sessions.length === 0 && (
            <div className="module-empty">Belum ada sesi perangkat yang tercatat. Muat ulang halaman setelah login.</div>
          )}

          <div className="session-list">
            {sessions.map((session) => (
              <article className="session-item" key={session.session_id}>
                <div className="session-device-icon"><DeviceIcon label={session.device_label} /></div>
                <div className="session-device-copy">
                  <div className="session-device-title">
                    <strong>{session.device_label}</strong>
                    {session.is_current && <span className="session-current-badge">PERANGKAT INI</span>}
                  </div>
                  <p>Login: {formatDate(session.created_at)}</p>
                  <p>Aktif terakhir: {formatDate(session.last_seen_at)}</p>
                </div>
                {!session.is_current && (
                  <form action={revokeDeviceSession}>
                    <input type="hidden" name="session_id" value={session.session_id} />
                    <button type="submit" className="session-revoke-button"><LogOut size={15} /> Keluarkan</button>
                  </form>
                )}
              </article>
            ))}
          </div>

          {sessions.some((session) => !session.is_current) && (
            <form action={revokeOtherDeviceSessions} className="session-revoke-all">
              <button type="submit" className="secondary-button"><LogOut size={15} /> Keluar dari semua perangkat lain</button>
            </form>
          )}
        </section>

        <p className="module-footnote">Informasi yang disimpan hanya jenis perangkat, browser, dan waktu sesi. Alamat IP dan lokasi tidak disimpan pada daftar ini. Website publik tetap dapat diakses tanpa login.</p>
      </main>
    </ModuleShell>
  );
}
