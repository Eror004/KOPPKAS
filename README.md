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

**Verified 19 November 2026:** 38 migration versions through `20261119044717` are present in the dedicated KOPPKAS Supabase migration history. The new device-session migration `20261119080000_app_device_sessions.sql` is currently branch-only and must pass CI/review before it is applied.

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

- Public homepage, published event listing, WhatsApp-only Public Contact Center, and published-letter verification.
- Role-filtered dashboard navigation and server-side module permission checks.
- Member directory split by gender, incomplete-member list, and separate direct/inline member creation paths.
- Monthly dues register, partial/multiple payment recording, idempotent posting to the overall ledger, and canonical balance view.
- Event workspace, independent event ledger, and surplus-transfer closeout function.
- Official-letter draft creation with annual sequence allocation and approval transition guards.
- Announcement drafts, INBOX read view, realtime notification fan-out, and notification read state.
- Audit log triggers and metadata-only changed-field capture.
- PWA manifest and service worker that caches static assets only.

## Current implementation boundaries

- WhatsApp-only Public Contact Center and published-letter verification routes are implemented in source.
- INBOX read access is available to all six roles. Reply, assignment, status changes, and archive mutations remain disabled until the organization confirms their role permissions.
- Public Auth signup is disabled. The dedicated KOPPKAS Supabase project already has an Auth user with an active `ketua_pemuda` profile. Do not run a first-account bootstrap.
- Ketua-only account administration is being moved to the authenticated Supabase Edge Function `account-admin`, which uses Supabase-managed server secrets and does not depend on a Vercel service-role key. The Vercel `SUPABASE_SECRET_KEY` variable entry is currently empty in Production, Preview, and Development. Account administration no longer depends on it; it is only needed for optional Auth IP forwarding. Supabase documents the Password Verification Attempt Hook as Teams/Enterprise-only, so the progressive 5/10-attempt lockout is not active on the current Free plan.
- Progressive login protection migration is applied; the Password Verification Hook's Dashboard activation still needs verification. The new three-device session enforcement and session-management UI are in `feat/session-security-controls-v2` and are not active until its migration is reviewed, applied, and deployed.
- Public Contact Center exposes WhatsApp as the only initial contact channel. The official WhatsApp number has not yet been configured, so the button remains disabled and no personal number or placeholder link is displayed.
- The private `koppkas-documents` Storage bucket and role-scoped policies are configured; upload UX and runtime access still require smoke testing.
- Vercel project `koppkas` is linked to this repository and has a READY Production deployment from `main` (commit `ce875fde`). PR #2's login-header fix has been merged to `main`; its production deployment must be checked before declaring the login fix live.
- GitHub Actions run #224 passed schema tests, TypeScript, ESLint, production build, and a full local migration-chain reset.

Do not treat this repository's source checks as proof of live operational readiness. Before real finance operations, verify the deployed login flow, configure the server-only key for Ketua account management, activate and test the Password Verification Hook, apply the reviewed session migration, and complete role-by-role runtime smoke tests.
