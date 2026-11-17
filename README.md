# KOPPKAS

Sistem operasional organisasi Pemuda Kampung Sawah Kaum — dibangun dari nol di repository Private ini. Website publik berada di `/`, sedangkan dashboard pengurus berada di `/dashboard`.

## Technology

- Next.js 16 App Router + React 19
- TypeScript strict mode
- Supabase Auth + Postgres + Realtime (project connection pending)
- SQL migrations with Row Level Security
- Lucide icons and responsive CSS design tokens

## Local setup

Requirements: Node.js 22 LTS recommended.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Fill `.env.local` with a **dedicated KOPPKAS Supabase project**:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Never put a Supabase secret/service-role key in browser code or a `NEXT_PUBLIC_*` variable.

## Checks

GitHub Actions menjalankan test, typecheck, lint, dan production build pada push/PR ke `main` (menggunakan kuota gratis Actions yang tersedia pada akun GitHub; kuota bergantung paket).

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Database

Migration files are in `supabase/migrations/` and must be applied in timestamp order to a dedicated KOPPKAS database. Do not apply them to the existing `pemuda-kampung-sawah-kaum` project: that project belongs to the earlier system and was not modified as part of this repository.

The migrations include:
- Six organization roles and profile bootstrap.
- Member directory, positions, events, finance ledgers, correspondence, announcements, media metadata, INBOX, notifications, and audit trail.
- RLS policies and explicit Data API grants.
- Idempotent monthly dues payments that post once into the overall ledger.
- Atomic inline member creation from monthly dues, with gender intentionally incomplete.
- Event surplus transfer guard and annual continuous official-letter numbering.
- October 2026 closing balance Rp205,000 carried as a November opening snapshot, not as a new income transaction.

## Current implementation boundaries

- Public contact submission and published-letter verification routes are implemented in source.
- INBOX read access is available to all six roles. Reply, assignment, status changes, and archive mutations are intentionally not enabled until the organization confirms their role permissions.
- Auth signup is disabled. Admin account provisioning, progressive failed-login lockout, max-three-device enforcement, and session revocation still need a dedicated privileged server workflow.
- Contact form currently has server validation and a honeypot. CAPTCHA and persistent per-source rate limiting are not configured yet.
- Media metadata UI exists; Storage buckets and file upload policies are not configured yet.
- Supabase migrations are source files only. No database project was created or modified in this implementation.
- No deployment has been performed.
- CI workflow is committed, but a successful Actions run has not yet been observed.

Do not use the application for real finance or organization operations until a dedicated Supabase project is connected, migrations are reviewed/applied, admin accounts are provisioned, and runtime tests pass.
