/// <reference lib="deno.ns" />
import { isIP } from "node:net";
import { withSupabase } from "npm:@supabase/server@1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, authorization, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function hmacSha256(secret: string, value: string) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  ).then(async (key) => {
    const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
    return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
  });
}

const handler = withSupabase({ auth: "none" }, async (request, context) => {
  if (request.method === "OPTIONS") return new Response("ok", { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return response({ error: "Method not allowed." }, 405);

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return response({ error: "Format pesan tidak valid." }, 400);
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return response({ error: "Format pesan tidak valid." }, 400);
  }

  const website = typeof body.website === "string" ? body.website.trim() : "";
  if (website) return response({ success: true });

  const senderName = typeof body.senderName === "string" ? body.senderName.trim() : "";
  const senderContact = typeof body.senderContact === "string" ? body.senderContact.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (senderName.length < 2 || senderName.length > 120) return response({ error: "Nama harus berisi 2–120 karakter." }, 400);
  if (senderContact.length < 5 || senderContact.length > 160) return response({ error: "Kontak harus berisi 5–160 karakter." }, 400);
  if (category.length < 2 || category.length > 80) return response({ error: "Pilih kategori pesan." }, 400);
  if (subject.length < 3 || subject.length > 160) return response({ error: "Subjek harus berisi 3–160 karakter." }, 400);
  if (message.length < 10 || message.length > 5000) return response({ error: "Pesan harus berisi 10–5.000 karakter." }, 400);

  // The Edge gateway supplies the caller IP. Do not accept an IP field from the form body.
  const candidateIp = request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!candidateIp || !isIP(candidateIp)) {
    return response({ error: "Layanan kontak sementara tidak tersedia. Silakan gunakan WhatsApp resmi organisasi." }, 503);
  }

  let secretKey = "";
  try {
    const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}") as Record<string, string>;
    secretKey = secretKeys.default ?? "";
  } catch {
    secretKey = "";
  }
  if (!secretKey) {
    return response({ error: "Layanan kontak sementara tidak tersedia. Silakan gunakan WhatsApp resmi organisasi." }, 503);
  }

  const ipHash = await hmacSha256(secretKey, candidateIp);
  const admin = context.supabaseAdmin;
  const { data: allowed, error: rateLimitError } = await admin.rpc("consume_public_contact_rate_limit", {
    p_ip_hash: ipHash,
  });
  if (rateLimitError) {
    return response({ error: "Layanan kontak sementara tidak tersedia. Silakan gunakan WhatsApp resmi organisasi." }, 503);
  }
  if (allowed !== true) {
    return response({ error: "Terlalu banyak pesan dari jaringan ini. Coba lagi sekitar 10 menit." }, 429);
  }

  const { error: insertError } = await admin.from("public_messages").insert({
    sender_name: senderName,
    sender_contact: senderContact,
    category,
    subject,
    message,
    status: "baru",
  });
  if (insertError) {
    return response({ error: "Pesan belum dapat dikirim. Silakan coba kembali nanti." }, 500);
  }

  return response({ success: true });
});

Deno.serve(handler);
