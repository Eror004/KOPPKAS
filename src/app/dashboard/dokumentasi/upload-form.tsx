"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createMediaAsset } from "./actions";

const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf", "video/mp4"];
const maxFileSize = 25 * 1024 * 1024;

export function MediaUploadForm({ userId }: { userId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const formData = new FormData(event.currentTarget);
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const file = formData.get("file");

    if (title.length < 3 || title.length > 160) {
      setError("Judul arsip harus berisi 3–160 karakter.");
      return;
    }
    if (description.length > 1000) {
      setError("Deskripsi maksimal 1.000 karakter.");
      return;
    }
    if (!(file instanceof File) || file.size === 0) {
      setError("Pilih file yang akan diunggah.");
      return;
    }
    if (!allowedTypes.includes(file.type)) {
      setError("Format file yang diizinkan: JPG, PNG, WebP, PDF, atau MP4.");
      return;
    }
    if (file.size > maxFileSize) {
      setError("Ukuran file maksimal 25 MB.");
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const safeName = file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-100) || "file";
      const storagePath = `${userId}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("koppkas-documents")
        .upload(storagePath, file, { contentType: file.type, upsert: false });

      if (uploadError) {
        setError("File gagal diunggah. Periksa koneksi dan kebijakan Storage.");
        return;
      }

      const metadata = new FormData();
      metadata.set("title", title);
      metadata.set("description", description);
      metadata.set("storage_path", storagePath);
      const result = await createMediaAsset(metadata);

      if (result.error) {
        await supabase.storage.from("koppkas-documents").remove([storagePath]);
        setError(result.error);
        return;
      }

      setSuccess(result.success ?? "File berhasil disimpan.");
      formRef.current?.reset();
      router.refresh();
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="module-form media-upload-form">
      <div className="module-form-heading"><div><p className="eyebrow">PRIVATE DOCUMENT STORAGE</p><h3>Unggah dokumentasi</h3></div><span className="event-form-icon"><Upload size={18} /></span></div>
      <label>Judul arsip<input name="title" minLength={3} maxLength={160} required placeholder="Contoh: Dokumentasi kerja bakti" /></label>
      <label>Deskripsi<input name="description" maxLength={1000} placeholder="Keterangan singkat (opsional)" /></label>
      <label>File<input name="file" type="file" accept={allowedTypes.join(",")} required /></label>
      <p className="module-footnote">Format JPG, PNG, WebP, PDF, MP4 · Maksimal 25 MB · Penyimpanan privat, hanya akun berwenang yang dapat membuka file.</p>
      {error && <p className="form-feedback error" role="alert">{error}</p>}
      {success && <p className="form-feedback success" role="status">{success}</p>}
      <button type="submit" disabled={pending}><Upload size={16} /> {pending ? "Mengunggah..." : "Unggah file"}</button>
    </form>
  );
}
