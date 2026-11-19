# KOPPKAS progressive login protection

This protection uses the Supabase Auth **Password Verification Hook**. The hook is not active until the Postgres function migration is applied and the hook is enabled in the Supabase Dashboard.

## Required setup

1. Apply `20261118074605_progressive_login_protection.sql` to the KOPPKAS Supabase project in a reviewed staging-first workflow.
2. In Supabase Dashboard, open **Authentication → Hooks**.
3. Enable **Password Verification Hook** and select the Postgres function `public.hook_password_verification_attempt`.
4. Open **Authentication → Rate Limits** and enable **IP Address Forwarding**.
5. Set `SUPABASE_SECRET_KEY` as a server-only environment variable in the deployment and local environment. Use the Supabase secret API key (the `sb_secret_` key), never a `NEXT_PUBLIC_` variable.
6. Keep Supabase Auth's per-IP sign-in rate limit enabled. The application forwards the Vercel request IP through `Sb-Forwarded-For` when the server secret key is configured.

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
- The hook is a Supabase Auth feature that must be explicitly enabled. A migration alone does not activate it.
- Verify the hook in a staging project before applying it to production. Do not test lockout behavior against real member accounts.


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
