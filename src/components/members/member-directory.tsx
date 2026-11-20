"use client";

import { useState, type ReactNode } from "react";
import { Search, UsersRound } from "lucide-react";
import { memberCompleteness, type MemberRecord } from "./contracts";

type Props = { members: MemberRecord[]; canCreate: boolean; canEdit: boolean; createForm?: ReactNode };
const genderLabel = (gender: MemberRecord["gender"]) => gender === "laki_laki" ? "Laki-laki" : gender === "perempuan" ? "Perempuan" : "Belum dilengkapi";

export function MemberDirectory({ members, canCreate, canEdit, createForm }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const visible = members.filter(member => member.full_name.toLocaleLowerCase("id-ID").includes(query.trim().toLocaleLowerCase("id-ID")) && (filter === "all" || (filter === "incomplete" ? memberCompleteness(member) === "incomplete" : member.gender === filter)));
  const incomplete = members.filter(member => memberCompleteness(member) === "incomplete").length;
  return <div className="sprint-module">
    <div className="sprint-heading"><div><p className="eyebrow">DIREKTORI ORGANISASI</p><h1>Keanggotaan</h1><p>Kelola dan temukan data anggota dalam satu tempat.</p></div>{canCreate && <a className="sprint-primary" href="#tambah-anggota">Tambah anggota</a>}</div>
    <div className="sprint-stats" aria-label="Ringkasan anggota">
      <div><span>ANGGOTA AKTIF</span><strong>{members.length}</strong><small>Dalam direktori</small></div>
      <div><span>LAKI-LAKI</span><strong>{members.filter(member => member.gender === "laki_laki").length}</strong><small>Data tercatat</small></div>
      <div><span>PEREMPUAN</span><strong>{members.filter(member => member.gender === "perempuan").length}</strong><small>Data tercatat</small></div>
      <div><span>DATA BELUM LENGKAP</span><strong>{incomplete}</strong><small>Jenis kelamin belum diisi</small></div>
    </div>
    <section className="sprint-panel" aria-labelledby="members-title">
      <div className="sprint-panel-heading"><div><p className="eyebrow">DIREKTORI</p><h2 id="members-title">Daftar anggota</h2><p>Pilih anggota untuk melihat detail yang tersedia.</p></div><span className="sprint-count">{visible.length} anggota</span></div>
      <div className="sprint-filters"><label className="sprint-search"><Search size={17} aria-hidden="true" /><span className="sr-only">Cari nama anggota</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Cari nama anggota" /></label><label className="sprint-select"><span>Filter data</span><select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">Semua anggota</option><option value="laki_laki">Laki-laki</option><option value="perempuan">Perempuan</option><option value="incomplete">Belum lengkap</option></select></label></div>
      {visible.length ? <ul className="sprint-list">{visible.map(member => <li key={member.id}><details className="sprint-detail"><summary><span className="sprint-avatar"><UsersRound size={17} aria-hidden="true" /></span><span className="sprint-person"><strong>{member.full_name}</strong><small>{member.phone || "Kontak belum ditambahkan"}</small></span><span className={`sprint-badge ${memberCompleteness(member)}`}>{memberCompleteness(member) === "complete" ? "Data lengkap" : "Belum lengkap"}</span><span className="sprint-detail-hint">Detail <span aria-hidden="true">⌄</span></span></summary><div className="sprint-detail-body"><dl><div><dt>Jenis kelamin</dt><dd>{genderLabel(member.gender)}</dd></div><div><dt>Kontak</dt><dd>{member.phone || "Belum ditambahkan"}</dd></div><div><dt>Status anggota</dt><dd>Aktif</dd></div></dl>{canEdit && <details className="sprint-edit-preview"><summary>Formulir edit · belum tersedia</summary><p>Pengeditan menunggu kontrak backend; perubahan tidak dapat disimpan.</p><fieldset disabled><label>Nama lengkap<input value={member.full_name} readOnly /></label><label>Jenis kelamin<select defaultValue={member.gender ?? ""}><option value="">Belum dilengkapi</option><option value="laki_laki">Laki-laki</option><option value="perempuan">Perempuan</option></select></label><label>Nomor kontak<input value={member.phone ?? ""} readOnly /></label><button type="button">Simpan perubahan</button></fieldset></details>}</div></details></li>)}</ul> : <div className="sprint-empty">{members.length ? "Tidak ada anggota yang cocok dengan pencarian atau filter." : "Belum ada anggota aktif di direktori."}</div>}
    </section>
    {canCreate && <section id="tambah-anggota" className="sprint-form-area" aria-label="Tambah anggota">{createForm}</section>}
  </div>;
}
