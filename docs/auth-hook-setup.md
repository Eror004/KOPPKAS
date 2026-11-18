# KOPPKAS progressive login protection

This protection uses the Supabase Auth **Password Verification Hook**. The hook is not active until the Postgres function migration is applied and the hook is enabled in the Supabase Dashboard.

## Required setup

1. Apply `20261118090000_progressive_login_protection.sql` to the KOPPKAS Supabase project in a reviewed staging-first workflow.
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

`SUPABASE_SECRET_KEY` is also required by the Ketua-only account manager and the public contact form's hashed-IP rate limiter. Keep it server-only in Vercel and local environment variables; never use a `NEXT_PUBLIC_` prefix and never paste the secret into chat or source control.

The public contact form allows five messages per client IP in a rolling ten-minute window. It stores only a HMAC-SHA256 fingerprint of the IP, keyed with the server secret and fails closed if the trusted client IP or server-side key is unavailable.
