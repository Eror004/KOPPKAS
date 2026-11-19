# KOPPKAS progressive login protection

This protection is designed around the Supabase Auth **Password Verification Hook**. As verified against Supabase documentation on 19 November 2026, Password Verification Attempt Hooks are available only on Teams and Enterprise plans, not the current Free plan. The SQL function exists in KOPPKAS, but the progressive 5/10-attempt lockout is NOT active on the current Free project and cannot be enabled there without a plan change. Do not claim this protection is live.

## Required setup

1. Keep migration `20261118074605_progressive_login_protection.sql` versioned and tested in the repository.
2. Do not attempt to enable the Password Verification Attempt Hook on the current Free project; Supabase documents this hook as Teams/Enterprise only.
3. Keep Supabase Auth's built-in per-IP sign-in rate limit enabled.
4. The optional `SUPABASE_SECRET_KEY` server-only variable allows the Next.js Auth client to forward the Vercel request IP using `Sb-Forwarded-For`. It is currently empty in Vercel and must not be fabricated or exposed publicly.
5. If the organization later explicitly authorizes a paid Supabase plan, re-check current plan eligibility and activate/test the hook in a staging project before production.

## Lockout behavior

- Failed attempts 1–4: Supabase Auth handles the invalid credentials response.
- Failed attempt 5: 15-minute lockout.
- Further failed attempts after each 15-minute lockout continue the counter.
- Failed attempt 10: 1-hour lockout.
- After the hour expires, the next sign-in attempt requires additional verification; a Ketua Pemuda must reset the login-protection state from **Dashboard → Manajemen Akun**.
- A successful password verification clears the counter if the account is not currently locked and has not reached the admin-unlock state.
- Resetting the account password through Manajemen Akun also clears the lockout state.

## Important

- The hook receives an unauthenticated event, so test it carefully before enabling it for real accounts.
- The login-protection table has RLS enabled and is inaccessible to `anon` and `authenticated`; only Supabase Auth Admin and the server-side service role can manage it.
- The hook is a Supabase Auth feature that must be explicitly enabled; a migration alone does not activate it.
- The current Free plan cannot enable this hook. Progressive lockout remains a documented release gap while the Rp0 constraint is in force.
- Do not test lockout behavior against real member accounts.


## Server-side admin key

The Ketua-only account manager uses the authenticated Supabase Edge Function `account-admin` and Supabase-managed Edge Function secrets; it does not need a Vercel service-role key. Public Contact Center uses WhatsApp only and has no web message form. The Vercel `SUPABASE_SECRET_KEY` entry is empty in all targets, so the Next.js Auth client cannot attach `Sb-Forwarded-For` for end-user IP forwarding. Supabase Auth's default per-IP rate limits remain active. If IP forwarding is enabled in Supabase Auth settings, add the real `sb_secret_...` key to Vercel server-only environment variables; never use a `NEXT_PUBLIC_` prefix or paste the secret into chat/source control.

The WhatsApp channel remains inactive until the official organization number is configured. Do not display personal officers' numbers or invent a `wa.me` destination.


## Session and device protection

The approved application policy is a maximum of **three concurrent device sessions per account**. Session expiry remains governed by Supabase Auth; no fixed 24-hour lifetime has been approved. The website's public routes remain accessible without login. OTP/MFA is not enabled.

The implementation in `20261119080000_app_device_sessions.sql` is branch-only until reviewed and applied:

- The fourth/new login is rejected. The three existing sessions are preserved; the user must first revoke one from **Dashboard → Keamanan Akun**.
- Each role can list and revoke only its own sessions. The current device is identified in the list; other devices can be revoked individually.
- An active Ketua Pemuda can revoke all sessions belonging to another account when changing its role/status or resetting its password.
- The session registry stores device/browser labels and timestamps only. It does not store raw IP addresses or geolocation.
- Revocation deletes the corresponding `auth.sessions` row, matching the session invalidation primitive used by Supabase Auth's logout flow.

Apply the migration only after CI rebuilds the complete migration chain from an empty local database. Do not manually modify `auth.sessions` in the live project as a substitute for the reviewed migration.
