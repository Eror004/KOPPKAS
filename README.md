# KOPPKAS

Sistem operasional organisasi Pemuda Kampung Sawah Kaum — dibangun dari nol di repository Private ini. Website publik berada di `/`, sedangkan dashboard pengurus berada di `/dashboard`.

## Technology

- Next.js 16 App Router + React 19
- TypeScript strict mode
- Supabase Auth + Postgres + Realtime (dedicated KOPPKAS project aktif di Singapore / ap-southeast-1)
- SQL migrations with Row Level Security
- Lucide icons and responsive CSS design tokens

## Local setup

Requirements: Node.js 22 LTS recommended.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Isi `.env.local` dengan konfigurasi **dedicated KOPPKAS Supabase project**:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=

# Server-only; required for privileged account and rate-limit operations.
SUPABASE_SECRET_KEY=
# Legacy server-only fallback:
SUPABASE_SERVICE_ROLE_KEY=
```

Jangan pernah menaruh secret/service-role key di browser code atau variabel `NEXT_PUBLIC_*`.

## Checks

GitHub Actions menjalankan test, typecheck, lint, production build, dan rebuild seluruh rangkaian migrasi lokal pada push/PR ke `main`. Kuota Actions bergantung pada paket GitHub.

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Database

Migration files berada di `supabase/migrations/` dan harus diterapkan sesuai urutan timestamp pada dedicated KOPPKAS database. Jangan menerapkannya ke project lama `pemuda-kampung-sawah-kaum`; project tersebut milik sistem sebelumnya.

**Baseline 18 November 2026:** 32/32 versi migrasi saat itu sudah selaras dengan riwayat Supabase KOPPKAS dan seluruhnya telah diterapkan. Rangkaian baseline tersebut berhasil dibangun ulang dari database lokal kosong pada GitHub Actions. Migration bootstrap Ketua yang ditambahkan setelah baseline berada di branch fitur dan belum diterapkan ke project aktif.

Saldo pembukaan November 2026 sebesar Rp205.000 tetap tercatat sebagai snapshot per 1 November 2026, bukan pemasukan baru.

The migrations include:
- Six organization roles and profile bootstrap.
- Member directory, positions, events, finance ledgers, correspondence, announcements, media metadata, INBOX, notifications, and audit trail.
- RLS policies and explicit Data API grants.
- Idempotent monthly dues payments that post once into the overall ledger.
- Atomic inline member creation from monthly dues, with gender intentionally incomplete.
- Event surplus transfer guard and annual continuous official-letter numbering.
- Private document storage, role-scoped access, progressive login protection, and public-contact rate limiting.
- October 2026 closing balance Rp205,000 carried as a November opening snapshot, not as a new income transaction.

## Implemented application areas

- Public homepage, published event listing, public contact form, and published-letter verification.
- Role-filtered dashboard navigation and server-side module permission checks.
- Member directory split by gender, incomplete-member list, and separate direct/inline member creation paths.
- Monthly dues register, partial/multiple payment recording, idempotent posting to the overall ledger, and canonical balance view.
- Event workspace, independent event ledger, and surplus-transfer closeout function.
- Official-letter draft creation with annual sequence allocation and approval transition guards.
- Announcement drafts, INBOX read view, realtime notification fan-out, and notification read state.
- Audit log triggers and metadata-only changed-field capture.
- PWA manifest and service worker that caches static assets only.

## Current implementation boundaries

- Public contact submission and published-letter verification routes are implemented in source.
- A guarded one-time first Ketua bootstrap script and singleton database guard are available in source; they have not been applied or executed against the active project.
- INBOX read access is available to all six roles. Reply, assignment, status changes, and archive mutations remain disabled until the organization confirms their role permissions.
- Public Auth signup is disabled. Production currently has no Auth users or profiles; the first Ketua account still needs a one-time, controlled bootstrap before dashboard operations can begin.
- Privileged server actions require `SUPABASE_SECRET_KEY` (preferred) or `SUPABASE_SERVICE_ROLE_KEY`. The public Supabase URL and publishable key are configured in the Vercel project, but the server-only key has not yet been added.
- Progressive login protection is installed in the database; live login verification remains pending the first account and Auth hook setup. Max-three-device enforcement and session revocation still need a dedicated privileged workflow.
- Contact form has server validation, a honeypot, and persistent per-source rate-limit storage. CAPTCHA is not configured.
- The private `koppkas-documents` Storage bucket and role-scoped policies are configured; upload UX and runtime access still require smoke testing.
- Vercel project `koppkas` is linked to this repository. No deployment has been created yet; production deployment is waiting for the server-only key and first Ketua bootstrap.
- GitHub Actions run #224 passed schema tests, TypeScript, ESLint, production build, and a full local migration-chain reset.

Do not use the application for real finance or organization operations until the first Ketua account is provisioned, the server-only key is configured, and the deployed application passes runtime smoke tests.
