import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);

  const destination = new URL("/login", request.url);
  destination.searchParams.set("reason", "session-ended");
  return NextResponse.redirect(destination);
}
