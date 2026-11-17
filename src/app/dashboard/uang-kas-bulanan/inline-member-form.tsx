"use client";

import { useActionState } from "react";
import { UserPlus } from "lucide-react";
import { createInlineDuesMember } from "./inline-member-action";
import type { DuesActionState } from "./actions";

const initialState: DuesActionState = {};

export function InlineMemberForm() {
  const [state, action, pending] = useActionState(createInlineDuesMember, initialState);
  return (
    <form action={action} className="inline-member-form">
      <div><span className="add-member-icon"><UserPlus size={17} /></span><div><strong>Anggota belum ada di daftar?</strong><small>Tambahkan nama sekarang, jenis kelamin bisa dilengkapi nanti.</small></div></div>
      <input name="full_name" minLength={2} maxLength={120} required placeholder="Nama lengkap anggota baru" aria-label="Nama anggota baru" />
      <button type="submit" disabled={pending}>{pending ? "Menambahkan..." : "Tambah anggota"}</button>
      {state.error && <p className="form-feedback error" role="alert">{state.error}</p>}
      {state.success && <p className="form-feedback success" role="status">{state.success}</p>}
    </form>
  );
}