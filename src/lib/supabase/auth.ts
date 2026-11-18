import "server-only";

import { isIP } from "node:net";
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { getSupabaseEnv } from "./env";

export async function createAuthClient() {
  const { url, key } = getSupabaseEnv();
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const cookieStore = await cookies();
  const headerStore = await headers();
  const candidateIp = headerStore.get("x-real-ip") ??
    (process.env.NODE_ENV !== "production" ? headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() : undefined);
  const forwardedIp = candidateIp && isIP(candidateIp) ? candidateIp : undefined;

  return createServerClient(url, secretKey ?? key, {
    global: {
      headers: secretKey && forwardedIp
        ? { "Sb-Forwarded-For": forwardedIp }
        : {},
    },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot write cookies. Proxy refreshes sessions.
        }
      },
    },
  });
}
