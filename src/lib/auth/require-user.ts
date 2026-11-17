import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAppRole } from "./roles";

export async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) redirect("/login");

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