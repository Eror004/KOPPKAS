"use server";

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