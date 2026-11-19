import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDeviceLabel } from "./device-label";
import { createClient } from "@/lib/supabase/server";
import { isAppRole } from "./roles";

export async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) redirect("/login");

  // getUser asks Supabase Auth to verify that the session still exists;
  // getClaims alone only verifies the JWT signature and expiry.
  const { data: verifiedUser, error: userError } = await supabase.auth.getUser();
  if (userError || !verifiedUser.user || verifiedUser.user.id !== data.claims.sub) {
    redirect("/auth/session-expired");
  }

  const requestHeaders = await headers();
  const userAgent = (requestHeaders.get("user-agent") ?? "").slice(0, 512);
  const { data: sessionPolicy, error: sessionPolicyError } = await supabase.rpc(
    "register_current_app_session",
    {
      p_device_label: getDeviceLabel(userAgent),
      p_user_agent: userAgent,
    },
  );
  const policy = sessionPolicy as { allowed?: boolean } | null;

  if (sessionPolicyError || !policy?.allowed) {
    redirect("/auth/session-expired");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active")
    .eq("id", data.claims.sub)
    .maybeSingle();

  if (profileError || !profile?.is_active || !isAppRole(profile.role)) {
    redirect("/login?reason=access");
  }

  return { claims: data.claims, profile, role: profile.role };
}
