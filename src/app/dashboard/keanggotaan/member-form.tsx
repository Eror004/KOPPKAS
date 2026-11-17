"use client";

import { useActionState } from "react";
import { UserPlus } from "lucide-react";
import { createMember, type MemberActionState } from "./actions";

const initialState: MemberActionState = {};

export function MemberForm() {
  const [state, action, pending] = useActionState(createMember, initialState);
  return (
    <form action={action} className="module-form">
      <div className="module-form-heading"><div><p className="eyebrow">DATA ANGGOTA</p><h3>Tambah anggota</h3></div><span className="add-member-icon"><UserPlus size={18} /></span></div>
      <label>Nama lengkap<input name="full_name" minLength={2} maxLength={120} required placeholder="Masukkan nama anggota" /></label>
      <label>Jenis kelamin<select name="gender" required defaultValue=""><option value="" disabled>Pilih jenis kelamin</option><option value="laki_laki">Laki-laki</option><option value="perempuan">Perempuan</option></select></label>
      <label>Nomor kontak <span className="optional-label">OPSIONAL</span><input name="phone" maxLength={40} placeholder="08xxxxxxxxxx" /></label>
      {state.error && <p className="form-feedback error" role="alert">{state.error}</p>}
      {state.success && <p className="form-feedback success" role="status">{state.success}</p>}
      <button type="submit" disabled={pending}><UserPlus size={16} /> {pending ? "Menyimpan..." : "Simpan anggota"}</button>
    </form>
  );
}