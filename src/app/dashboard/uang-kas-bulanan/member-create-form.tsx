"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, UserRoundCheck } from "lucide-react";
import { createDuesMember, ensureDuesRegister, type DuesMemberCreationResult } from "./actions";
import { periodLabel } from "@/components/monthly-dues/contracts";

type FormState = { message?: string; error?: string; matches?: Array<{ id: string; full_name: string }> };

export function DuesMemberCreateForm({ duesMonth }: { duesMonth: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [state, setState] = useState<FormState>({});
  const [pending, setPending] = useState(false);

  async function submit(confirmSameName = false) {
    setPending(true);
    setState({});
    try {
      const response = await createDuesMember(name, duesMonth, confirmSameName);
      if (response.error) {
        setState({ error: response.error });
      } else if (response.result?.status === "duplicate_candidates") {
        setState({ matches: response.result.matches });
      } else if (response.result?.status === "created") {
        setState({ message: `Anggota ${response.result.full_name} berhasil ditambahkan ke periode ${periodLabel(duesMonth)}.` });
        setName("");
        router.refresh();
      } else {
        setState({ error: "Respons penambahan anggota tidak dikenali." });
      }
    } catch {
      setState({ error: "Anggota belum dapat ditambahkan. Periksa koneksi lalu coba lagi." });
    } finally {
      setPending(false);
    }
  }

  async function useExisting(memberId: string) {
    setPending(true);
    setState({});
    try {
      const response = await ensureDuesRegister(memberId, duesMonth);
      if (response.error) setState({ error: response.error });
      else {
        setState({ message: "Anggota yang dipilih berhasil dimasukkan ke daftar periode ini." });
        setName("");
        router.refresh();
      }
    } catch {
      setState({ error: "Daftar kas anggota belum dapat disiapkan." });
    } finally {
      setPending(false);
    }
  }

  return <section id="tambah-anggota" className="bank-panel bank-add" aria-labelledby="add-member-title">
    <div className="bank-section-title"><div><p className="eyebrow">KEANGGOTAAN</p><h2 id="add-member-title">Tambah anggota ke periode</h2></div><UserPlus size={20} /></div>
    <p>Tambahkan anggota baru secara atomik atau pilih anggota yang sudah ada. Nama yang sama akan ditampilkan untuk pemeriksaan sebelum membuat data baru.</p>
    <form className="dues-member-create" onSubmit={event => { event.preventDefault(); void submit(false); }}>
      <label className="bank-field">Nama lengkap anggota
        <input value={name} onChange={event => setName(event.target.value)} minLength={2} maxLength={120} required placeholder="Masukkan nama lengkap" />
      </label>
      <button type="submit" disabled={pending || name.trim().length < 2}><UserPlus size={16} /> {pending ? "Memproses..." : "Periksa & tambahkan"}</button>
    </form>
    {state.error && <p className="form-feedback error" role="alert">{state.error}</p>}
    {state.message && <p className="form-feedback success" role="status">{state.message}</p>}
    {state.matches && <div className="dues-duplicate-review" role="group" aria-label="Kandidat anggota dengan nama sama">
      <p>Nama yang mirip sudah ditemukan. Pilih anggota yang dimaksud, atau konfirmasi jika ini memang orang baru.</p>
      <ul>{state.matches.map(match => <li key={match.id}><span><strong>{match.full_name}</strong><small>ID {match.id}</small></span><button type="button" disabled={pending} onClick={() => void useExisting(match.id)}><UserRoundCheck size={15} /> Gunakan anggota ini</button></li>)}</ul>
      <button type="button" className="dues-create-distinct" disabled={pending} onClick={() => void submit(true)}>Tetap buat anggota baru dengan nama ini</button>
    </div>}
  </section>;
}
