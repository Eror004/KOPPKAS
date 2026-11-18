"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireModulePermission } from "@/lib/auth/require-role";

export type EventActionState = { success?: string; error?: string };

export async function createEvent(_previous: EventActionState, formData: FormData): Promise<EventActionState> {
  const user = await requireModulePermission("events", "create");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const startsAt = String(formData.get("starts_at") ?? "").trim();

  if (title.length < 3 || title.length > 160) return { error: "Nama kegiatan harus berisi 3–160 karakter." };
  if (description.length > 5000 || location.length > 180) return { error: "Deskripsi atau lokasi terlalu panjang." };
  const date = startsAt ? new Date(`${startsAt}:00+07:00`) : null;
  if (date && Number.isNaN(date.getTime())) return { error: "Tanggal kegiatan tidak valid." };

  const supabase = await createClient();
  const { error } = await supabase.from("events").insert({
    title, description: description || null, location: location || null,
    starts_at: date?.toISOString() ?? null, status: "draft", created_by: user.profile.id,
  });
  if (error) return { error: "Kegiatan gagal disimpan. Periksa koneksi dan hak akses." };
  revalidatePath("/dashboard/kegiatan");
  return { success: "Draft kegiatan berhasil dibuat. Publikasi tetap memerlukan persetujuan Ketua atau Wakil Ketua." };
}

const eventPath = "/dashboard/kegiatan";
const uuidPattern = /^[0-9a-f-]{36}$/i;

function finishEventAction(kind: "success" | "error", message: string): never {
  redirect(`${eventPath}?${kind}=${encodeURIComponent(message)}`);
}

async function loadEventForAction(id: string) {
  if (!uuidPattern.test(id)) finishEventAction("error", "Data kegiatan tidak valid.");
  const supabase = await createClient();
  const { data, error } = await supabase.from("events")
    .select("id,created_by,status,financial_report_by,final_report_submitted_at,description,location,starts_at,ends_at")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) finishEventAction("error", "Kegiatan tidak ditemukan atau tidak dapat diakses.");
  return { supabase, event: data };
}

export async function submitEventForApproval(formData: FormData) {
  const actor = await requireModulePermission("events", "create");
  const { supabase, event } = await loadEventForAction(String(formData.get("event_id") ?? ""));
  if (event.status !== "draft") finishEventAction("error", "Hanya draft yang dapat diajukan.");
  if (event.created_by !== actor.profile.id && actor.role !== "sekretaris") {
    finishEventAction("error", "Hanya pembuat kegiatan atau Sekretaris yang dapat mengajukan draft.");
  }
  const { error } = await supabase.from("events").update({
    status: "menunggu_persetujuan",
    updated_at: new Date().toISOString(),
  }).eq("id", event.id);
  if (error) finishEventAction("error", "Pengajuan kegiatan gagal disimpan.");
  revalidatePath(eventPath);
  finishEventAction("success", "Kegiatan diajukan untuk persetujuan Ketua atau Wakil Ketua.");
}

export async function approveEvent(formData: FormData) {
  const actor = await requireModulePermission("events", "approve");
  const { supabase, event } = await loadEventForAction(String(formData.get("event_id") ?? ""));
  if (event.status !== "menunggu_persetujuan") finishEventAction("error", "Kegiatan tidak sedang menunggu persetujuan.");
  const { error } = await supabase.from("events").update({
    status: "terbit",
    approved_by: actor.profile.id,
    approved_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", event.id);
  if (error) finishEventAction("error", "Persetujuan atau publikasi kegiatan gagal.");
  revalidatePath(eventPath);
  finishEventAction("success", "Kegiatan berhasil disetujui dan diterbitkan.");
}

export async function startEvent(formData: FormData) {
  const actor = await requireModulePermission("events", "create");
  const { supabase, event } = await loadEventForAction(String(formData.get("event_id") ?? ""));
  if (event.status !== "terbit") finishEventAction("error", "Hanya kegiatan terbit yang dapat dimulai.");
  if (event.created_by !== actor.profile.id && !["ketua_pemuda", "wakil_ketua_pemuda", "sekretaris"].includes(actor.role)) {
    finishEventAction("error", "Hanya pembuat kegiatan, Sekretaris, Ketua atau Wakil yang dapat memulai kegiatan.");
  }
  const { error } = await supabase.from("events").update({
    status: "berlangsung",
    updated_at: new Date().toISOString(),
  }).eq("id", event.id);
  if (error) finishEventAction("error", "Status kegiatan gagal diperbarui.");
  revalidatePath(eventPath);
  finishEventAction("success", "Kegiatan ditandai sedang berlangsung.");
}

export async function submitEventFinancialReport(formData: FormData) {
  const actor = await requireModulePermission("event_finance", "create");
  if (actor.role !== "bendahara") finishEventAction("error", "Laporan keuangan kegiatan hanya dapat diserahkan Bendahara.");
  const eventId = String(formData.get("event_id") ?? "");
  const report = String(formData.get("financial_report") ?? "").trim();
  if (!uuidPattern.test(eventId)) finishEventAction("error", "Data kegiatan tidak valid.");
  if (report.length < 10 || report.length > 10000) finishEventAction("error", "Laporan keuangan harus berisi 10–10.000 karakter.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_event_financial_report", {
    p_event_id: eventId,
    p_report: report,
  });
  if (error) finishEventAction("error", "Laporan keuangan gagal diserahkan. Pastikan kegiatan sedang berlangsung.");
  revalidatePath(eventPath);
  finishEventAction("success", "Laporan keuangan Bendahara berhasil diserahkan.");
}

export async function submitEventFinalReport(formData: FormData) {
  const actor = await requireModulePermission("events", "create");
  const { supabase, event } = await loadEventForAction(String(formData.get("event_id") ?? ""));
  const report = String(formData.get("final_report") ?? "").trim();
  if (event.status !== "berlangsung") finishEventAction("error", "Laporan naratif hanya dapat diserahkan saat kegiatan berlangsung.");
  if (event.created_by !== actor.profile.id) finishEventAction("error", "Laporan naratif diserahkan oleh pembuat kegiatan yang bertindak sebagai Ketua Panitia.");
  if (!event.financial_report_by) finishEventAction("error", "Laporan Bendahara harus diserahkan terlebih dahulu.");
  if (event.financial_report_by === actor.profile.id) finishEventAction("error", "Laporan Ketua Panitia dan Bendahara harus berasal dari dua akun berbeda.");
  if (report.length < 10 || report.length > 10000) finishEventAction("error", "Laporan kegiatan harus berisi 10–10.000 karakter.");

  const { error } = await supabase.from("events").update({
    final_report: report,
    final_report_by: actor.profile.id,
    final_report_submitted_at: new Date().toISOString(),
    status: "menunggu_laporan",
    updated_at: new Date().toISOString(),
  }).eq("id", event.id);
  if (error) finishEventAction("error", "Laporan akhir gagal diserahkan. Pastikan laporan Bendahara sudah lengkap.");
  revalidatePath(eventPath);
  finishEventAction("success", "Kedua laporan sudah lengkap dan menunggu persetujuan akhir.");
}

export async function approveEventFinalReport(formData: FormData) {
  await requireModulePermission("event_finance", "approve");
  const eventId = String(formData.get("event_id") ?? "");
  if (!uuidPattern.test(eventId)) finishEventAction("error", "Data kegiatan tidak valid.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_event_final_report", { p_event_id: eventId });
  if (error) finishEventAction("error", "Laporan akhir belum dapat disetujui. Periksa kelengkapan dua laporan dan buku kas kegiatan.");
  revalidatePath(eventPath);
  revalidatePath("/dashboard/keuangan");
  revalidatePath("/dashboard/keuangan-kegiatan");
  finishEventAction("success", "Laporan disetujui. Kegiatan selesai dan surplus dipindahkan satu kali ke Uang Keseluruhan.");
}

export async function cancelEvent(formData: FormData) {
  const actor = await requireModulePermission("events", "approve");
  const { supabase, event } = await loadEventForAction(String(formData.get("event_id") ?? ""));
  const reason = String(formData.get("reason") ?? "").trim();
  if (event.status === "selesai" || event.status === "dibatalkan") finishEventAction("error", "Kegiatan selesai atau dibatalkan tidak dapat dibatalkan ulang.");
  if (reason.length < 3 || reason.length > 500) finishEventAction("error", "Alasan pembatalan harus berisi 3–500 karakter.");
  const { error } = await supabase.from("events").update({
    status: "dibatalkan",
    cancellation_reason: reason,
    cancelled_by: actor.profile.id,
    cancelled_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", event.id);
  if (error) finishEventAction("error", "Pembatalan kegiatan gagal disimpan.");
  revalidatePath(eventPath);
  finishEventAction("success", "Kegiatan berhasil dibatalkan dengan alasan tercatat.");
}


export async function updateEventDetails(formData: FormData) {
  const actor = await requireModulePermission("events", "create");
  const { supabase, event } = await loadEventForAction(String(formData.get("event_id") ?? ""));
  if (!["draft", "terbit", "berlangsung"].includes(event.status)) {
    finishEventAction("error", "Detail hanya dapat diubah pada draft, kegiatan terbit atau kegiatan berlangsung.");
  }
  if (event.created_by !== actor.profile.id && actor.role !== "sekretaris") {
    finishEventAction("error", "Hanya pembuat kegiatan atau Sekretaris yang dapat mengubah detail.");
  }

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const startsAtRaw = String(formData.get("starts_at") ?? "").trim();
  const endsAtRaw = String(formData.get("ends_at") ?? "").trim();
  if (title.length < 3 || title.length > 160) finishEventAction("error", "Nama kegiatan harus berisi 3–160 karakter.");
  if (description.length > 5000 || location.length > 180) finishEventAction("error", "Deskripsi atau lokasi terlalu panjang.");

  const startsAt = startsAtRaw ? new Date(`${startsAtRaw}:00+07:00`) : null;
  const endsAt = endsAtRaw ? new Date(`${endsAtRaw}:00+07:00`) : null;
  if ((startsAt && Number.isNaN(startsAt.getTime())) || (endsAt && Number.isNaN(endsAt.getTime()))) {
    finishEventAction("error", "Tanggal kegiatan tidak valid.");
  }
  if (startsAt && endsAt && endsAt < startsAt) finishEventAction("error", "Waktu selesai tidak boleh sebelum waktu mulai.");

  const { error } = await supabase.from("events").update({
    title,
    description: description || null,
    location: location || null,
    starts_at: startsAt?.toISOString() ?? null,
    ends_at: endsAt?.toISOString() ?? null,
    updated_at: new Date().toISOString(),
  }).eq("id", event.id);
  if (error) finishEventAction("error", "Perubahan detail kegiatan gagal disimpan.");
  revalidatePath(eventPath);
  finishEventAction("success", "Detail kegiatan berhasil diperbarui.");
}

export async function addEventCommitteeMember(formData: FormData) {
  const actor = await requireModulePermission("events", "create");
  const { supabase, event } = await loadEventForAction(String(formData.get("event_id") ?? ""));
  if (!["draft", "menunggu_persetujuan", "terbit", "berlangsung"].includes(event.status)) {
    finishEventAction("error", "Panitia tidak dapat diubah setelah laporan akhir diserahkan.");
  }
  if (event.created_by !== actor.profile.id && !["ketua_pemuda", "wakil_ketua_pemuda", "sekretaris"].includes(actor.role)) {
    finishEventAction("error", "Hanya pembuat kegiatan, Sekretaris, Ketua atau Wakil yang dapat mengelola panitia.");
  }
  const memberId = String(formData.get("member_id") ?? "");
  const committeeRole = String(formData.get("committee_role") ?? "").trim();
  if (!uuidPattern.test(memberId)) finishEventAction("error", "Pilih anggota yang valid.");
  if (committeeRole.length < 2 || committeeRole.length > 80) finishEventAction("error", "Nama posisi panitia harus berisi 2–80 karakter.");
  const { data: member } = await supabase.from("members").select("id").eq("id", memberId).is("archived_at", null).maybeSingle();
  if (!member) finishEventAction("error", "Anggota tidak ditemukan atau sudah diarsipkan.");

  const { error } = await supabase.from("event_committee").insert({
    event_id: event.id,
    member_id: memberId,
    committee_role: committeeRole,
  });
  if (error) finishEventAction("error", "Anggota gagal ditambahkan. Periksa apakah anggota sudah terdaftar di kegiatan.");
  revalidatePath(eventPath);
  finishEventAction("success", "Anggota panitia berhasil ditambahkan.");
}

export async function removeEventCommitteeMember(formData: FormData) {
  const actor = await requireModulePermission("events", "create");
  const { supabase, event } = await loadEventForAction(String(formData.get("event_id") ?? ""));
  if (!["draft", "menunggu_persetujuan", "terbit", "berlangsung"].includes(event.status)) {
    finishEventAction("error", "Panitia tidak dapat diubah setelah laporan akhir diserahkan.");
  }
  if (event.created_by !== actor.profile.id && !["ketua_pemuda", "wakil_ketua_pemuda", "sekretaris"].includes(actor.role)) {
    finishEventAction("error", "Hanya pembuat kegiatan, Sekretaris, Ketua atau Wakil yang dapat mengelola panitia.");
  }
  const memberId = String(formData.get("member_id") ?? "");
  if (!uuidPattern.test(memberId)) finishEventAction("error", "Data anggota panitia tidak valid.");
  const { error } = await supabase.from("event_committee")
    .delete().eq("event_id", event.id).eq("member_id", memberId);
  if (error) finishEventAction("error", "Anggota panitia gagal dihapus.");
  revalidatePath(eventPath);
  finishEventAction("success", "Anggota panitia berhasil dihapus.");
}
