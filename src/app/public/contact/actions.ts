"use server";

import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ContactState = { success?: boolean; error?: string };

export async function submitContact(_previous: ContactState, formData: FormData): Promise<ContactState> {
  const senderName = String(formData.get("sender_name") ?? "").trim();
  const senderContact = String(formData.get("sender_contact") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const website = String(formData.get("website") ?? "").trim();

  if (website) return { success: true };
  if (senderName.length < 2 || senderName.length > 120) return { error: "Nama harus berisi 2–120 karakter." };
  if (senderContact.length < 5 || senderContact.length > 160) return { error: "Kontak harus berisi 5–160 karakter." };
  if (category.length < 2 || category.length > 80) return { error: "Pilih kategori pesan." };
  if (subject.length < 3 || subject.length > 160) return { error: "Subjek harus berisi 3–160 karakter." };
  if (message.length < 10 || message.length > 5000) return { error: "Pesan harus berisi 10–5.000 karakter." };

  try {
    const headerStore = await headers();
    const candidateIp = headerStore.get("x-real-ip") ??
      (process.env.NODE_ENV !== "production" ? headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() : undefined);
    if (!candidateIp || !isIP(candidateIp)) return { error: "Layanan kontak sementara tidak tersedia. Silakan gunakan WhatsApp resmi organisasi." };

    const ipHash = createHash("sha256").update(candidateIp).digest("hex");
    const admin = createAdminClient();
    const { data: allowed, error: rateLimitError } = await admin.rpc("consume_public_contact_rate_limit", {
      p_ip_hash: ipHash,
    });
    if (rateLimitError) return { error: "Layanan kontak sementara tidak tersedia. Silakan gunakan WhatsApp resmi organisasi." };
    if (allowed !== true) return { error: "Terlalu banyak pesan dari jaringan ini. Coba lagi sekitar 10 menit." };

    const supabase = await createClient();
    const { error } = await supabase.from("public_messages").insert({
      sender_name: senderName,
      sender_contact: senderContact,
      category,
      subject,
      message,
      status: "baru",
    });
    if (error) throw error;
    return { success: true };
  } catch {
    return { error: "Pesan belum dapat dikirim. Silakan coba kembali nanti." };
  }
}