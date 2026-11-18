import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "./env";

export async function createAuthClient() {
  const { url, key } = getSupabaseEnv();
  const cookieStore = await cookies();

  // User authentication must use the publishable key, just like the
  // browser/server session clients. A secret key is reserved for trusted
  // administrative operations and must not become the user's API identity.
  return createServerClient(url, key, {
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
