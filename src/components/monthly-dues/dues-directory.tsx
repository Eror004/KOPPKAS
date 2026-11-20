"use client";

import { useEffect, useId, useState } from "react";
import { ArrowDownLeft, CalendarDays, ChevronLeft, ChevronRight, FileText, Plus, Search, UsersRound, WalletCards } from "lucide-react";
import { AccountingPanel } from "./accounting-panel";
import { PaymentForm } from "@/app/dashboard/uang-kas-bulanan/payment-form";
import type { DuesMemberCreationResult, DuesMemberSearchResult, ReceiptResult, MonthlyDuesCashBookResult } from "./backend-contract";
import { duesStatus, formatContribution, MONTHLY_REFERENCE, periodLabel, summarizeDues, type DuesRecord } from "./contracts";
import type { DuesActionState } from "./backend-contract";

type Props = {
  rows: DuesRecord[];
  currentMonth: string;
  canRecord: boolean;
  canViewFinance: boolean;
  openedPeriods: readonly string[];
  searchMembers: (query: string, duesMonth: string) => Promise<DuesMemberSearchResult>;
  ensureRegister: (memberId: string, duesMonth: string) => Promise<{ monthlyDuesId?: string; error?: string }>;
  createMember: (fullName: string, duesMonth: string, confirmSameName?: boolean) => Promise<{ result?: DuesMemberCreationResult; error?: string }>;
  getReceipt: (transactionId: string) => Promise<ReceiptResult>;
  getCashBook: (duesMonth: string, page?: number, pageSize?: number) => Promise<MonthlyDuesCashBookResult>;
  recordExpense: (previous: DuesActionState, formData: FormData) => Promise<DuesActionState>;
};
const labels = { lunas: "LUNAS", kurang: "KURANG", belum_bayar: "BELUM BAYAR", unavailable: "PERLU DIPERIKSA" } as const;

export function DuesDirectory(props: Props) {
  const { rows, currentMonth, canRecord, canViewFinance, openedPeriods, searchMembers, ensureRegister, createMember, getReceipt, getCashBook, recordExpense } = props;
  const periods = Array.from(new Set(openedPeriods)).sort().reverse();
  const [selectedPeriod, setPeriod] = useState<string | null>(null);
  const period = selectedPeriod && periods.includes(selectedPeriod) ? selectedPeriod : periods[0] ?? "";
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [memberQuery, setMemberQuery] = useState("");
  const [memberResults, setMemberResults] = useState<DuesMemberSearchResult>({ members: [] });
  const [memberLoading, setMemberLoading] = useState(false);
  const [memberError, setMemberError] = useState("");
  const [memberId, setMemberId] = useState("");
  const [selectedMember, setSelectedMember] = useState<{ memberId: string; fullName: string; monthlyDuesId: string; paidAmount: string | number | null } | null>(null);
  const [registerError, setRegisterError] = useState("");
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [duplicates, setDuplicates] = useState<Array<{ id: string; full_name: string }>>([]);
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);
  const selectId = useId();
  const index = periods.indexOf(period);
  const periodRows = rows.filter(row => row.dues_month === period);
  const summary = summarizeDues(periodRows);
  const visible = periodRows.filter(row => row.full_name.toLocaleLowerCase("id-ID").includes(query.trim().toLocaleLowerCase("id-ID")) && (filter === "all" || duesStatus(row) === filter));
  const percent = summary.members ? Math.round(summary.paid / summary.members * 100) : 0;

  useEffect(() => {
    let active = true;
    if (!canRecord || !currentMonth || memberQuery.trim().length < 2) return;
    const timer = setTimeout(() => {
      setMemberLoading(true);
      setMemberError("");
      searchMembers(memberQuery, currentMonth).then(result => {
        if (!active) return;
        setMemberResults(result);
        setMemberError(result.error ?? "");
      }).catch(() => { if (active) setMemberError("Pencarian anggota belum dapat dilakukan."); })
        .finally(() => { if (active) setMemberLoading(false); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [memberQuery, currentMonth, canRecord, searchMembers]);

  async function selectMember(nextId: string) {
    setMemberId(nextId); setSelectedMember(null); setRegisterError("");
    const member = memberResults.members.find(item => item.memberId === nextId);
    if (!member) return;
    if (member.monthlyDuesId) {
      setSelectedMember({ memberId: member.memberId, fullName: member.fullName, monthlyDuesId: member.monthlyDuesId, paidAmount: member.paidAmount });
      return;
    }
    setRegisterError("Menyiapkan daftar kas anggota…");
    const result = await ensureRegister(member.memberId, currentMonth);
    const monthlyDuesId = result.monthlyDuesId;
    if (result.error || !monthlyDuesId) {
      setRegisterError(result.error ?? "Daftar kas anggota belum dapat disiapkan.");
      return;
    }
    setSelectedMember({ memberId: member.memberId, fullName: member.fullName, monthlyDuesId, paidAmount: 0 });
    setMemberResults(current => ({ ...current, members: current.members.map(item => item.memberId === nextId ? { ...item, monthlyDuesId, paidAmount: 0 } : item) }));
    setRegisterError("");
  }

  async function submitNewMember(confirmSameName = false) {
    setCreateError(""); setCreateSuccess("");
    const result = await createMember(newName, currentMonth, confirmSameName);
    if (result.error) { setCreateError(result.error); return; }
    if (result.result?.status === "duplicate_candidates") {
      setDuplicates(result.result.matches); setConfirmDuplicate(true);
      return;
    }
    if (result.result?.status === "created") {
      setCreateSuccess(`Anggota ${result.result.full_name} berhasil ditambahkan ke periode ${periodLabel(currentMonth)}.`);
      setNewName(""); setDuplicates([]); setConfirmDuplicate(false);
      setMemberQuery(result.result.full_name);
      setMemberId(result.result.member_id);
      setSelectedMember({ memberId: result.result.member_id, fullName: result.result.full_name, monthlyDuesId: result.result.monthly_dues_id, paidAmount: 0 });
    }
  }

  if (!periods.length) return <div className="sprint-module dues-bank"><section className="bank-panel" role="status"><p className="eyebrow">UANG KAS BULANAN</p><h1>Belum ada periode dibuka</h1><p>Belum ada periode resmi yang dapat ditampilkan. Tidak ada periode yang dibuat otomatis.</p></section></div>;

  return <div className="sprint-module dues-bank">
    <div className="bank-heading"><div><p className="eyebrow">KOPPKAS / KONTRIBUSI SUKARELA</p><h1>Uang Kas Bulanan</h1><p>Catatan kontribusi anggota, dalam satu tempat.</p></div><span className="bank-heading-badge"><span /> PENCATATAN MANUAL</span></div>
    <div className="bank-overview">
      <section className="bank-balance" aria-labelledby="balance-title">
        <div className="bank-balance-top"><span><WalletCards size={17} aria-hidden="true" /> RINGKASAN KAS</span><span>PERIODE TERPILIH</span></div>
        <div className="bank-period"><button type="button" disabled={index === periods.length - 1} onClick={() => setPeriod(periods[index + 1])} aria-label="Periode sebelumnya"><ChevronLeft size={18} /></button><span><CalendarDays size={15} aria-hidden="true" /> {periodLabel(period)}</span><button type="button" disabled={index === 0} onClick={() => setPeriod(periods[index - 1])} aria-label="Periode berikutnya"><ChevronRight size={18} /></button></div>
        <p id="balance-title">Total pembayaran periode ini</p><strong className="bank-total">{summary.members ? formatContribution(summary.collected) : "—"}</strong>
        <div className="bank-balance-foot"><span>ACUAN SUKARELA</span><strong>{formatContribution(MONTHLY_REFERENCE)} <small>/ anggota</small></strong><p>Tidak ada kewajiban pembayaran atau denda. Status anggota berdiri sendiri setiap bulan.</p></div>
      </section>
      <section className="bank-status" aria-label="Status anggota periode terpilih">
        <div className="bank-section-title"><div><p className="eyebrow">ANGGOTA PER PERIODE</p><h2>Status kontribusi</h2></div><span>{summary.members} terdaftar</span></div>
        <p>Hanya anggota dalam daftar periode ini; bukan seluruh anggota aktif.</p>
        <div className="bank-status-grid"><div><span className="bank-status-dot is-paid" /><strong>{summary.paid}</strong><small>LUNAS</small></div><div><span className="bank-status-dot is-partial" /><strong>{summary.short}</strong><small>KURANG</small></div><div><span className="bank-status-dot is-unpaid" /><strong>{summary.unpaid}</strong><small>BELUM BAYAR</small></div></div>
        <div className="bank-progress-label"><span>Mencapai acuan</span><strong>{summary.members ? `${percent}%` : "—"}</strong></div><progress aria-label="Persentase anggota terdaftar yang mencapai acuan" max={100} value={percent} />
        {summary.unavailable > 0 && <p role="alert">{summary.unavailable} data pembayaran perlu diperiksa dan belum dapat diklasifikasikan.</p>}
      </section>
    </div>
    <nav className="bank-quick-actions" aria-label="Aksi cepat kas bulanan"><a href="#catat-pembayaran"><span><Plus size={20} /></span>Catat Pembayaran</a><a href="#tambah-anggota"><span><UsersRound size={20} /></span>Tambah Anggota</a><a href="#mutasi-kas"><span><ArrowDownLeft size={20} /></span>Mutasi Kas</a><a href="#rekap-bulanan"><span><FileText size={20} /></span>Rekap Bulanan</a></nav>

    <AccountingPanel period={period} canViewFinance={canViewFinance} getCashBook={getCashBook} recordExpense={recordExpense} />

    {canRecord && <section id="catat-pembayaran" className="bank-panel bank-payment" aria-labelledby="payment-title">
      <div className="bank-section-title"><div><p className="eyebrow">TRANSAKSI BARU</p><h2 id="payment-title">Catat pembayaran</h2><p>Periode berjalan yang telah dibuka: {periodLabel(currentMonth)}. Pembayaran dapat dilakukan sebagian atau beberapa kali.</p></div><span className="bank-icon"><ArrowDownLeft size={20} /></span></div>
      <div className="bank-payment-body">
        <label className="bank-field" htmlFor={`${selectId}-search`}>Cari anggota aktif<input id={`${selectId}-search`} type="search" value={memberQuery} onChange={event => { setMemberQuery(event.target.value); setMemberResults({ members: [] }); setMemberError(""); setMemberLoading(false); setMemberId(""); setSelectedMember(null); }} placeholder="Ketik minimal 2 karakter" autoComplete="off" /></label>
        {memberLoading && <p role="status">Mencari anggota…</p>}
        {memberError && <p role="alert">{memberError}</p>}
        {memberResults.hasMore && <p role="status">Hasil dibatasi 15 anggota. Perjelas kata pencarian untuk menemukan anggota lainnya.</p>}
        <label className="bank-field" htmlFor={`${selectId}-member`}>Pilih anggota<select id={`${selectId}-member`} value={memberId} onChange={event => void selectMember(event.target.value)}><option value="">Pilih anggota dari hasil pencarian</option>{memberResults.members.map(item => <option key={item.memberId} value={item.memberId}>{item.fullName} · {item.monthlyDuesId ? "sudah terdaftar" : "belum masuk daftar periode"}</option>)}</select></label>
        {registerError && <p role="status">{registerError}</p>}
        {selectedMember && <div className="bank-selected"><div><span>ANGGOTA TERPILIH</span><strong>{selectedMember.fullName}</strong><small>ID {selectedMember.memberId.slice(-8)}</small></div><div><span>TERCATAT BULAN INI</span><strong>{formatContribution(selectedMember.paidAmount ?? 0)}</strong></div></div>}
        {selectedMember && <div className="dues-record"><PaymentForm key={selectedMember.monthlyDuesId} monthlyDuesId={selectedMember.monthlyDuesId} getReceipt={getReceipt} /></div>}
      </div>
    </section>}

    {canRecord && <section id="tambah-anggota" className="bank-panel bank-add" aria-labelledby="add-member-title">
      <div className="bank-section-title"><div><p className="eyebrow">KEANGGOTAAN</p><h2 id="add-member-title">Tambah anggota</h2></div><UsersRound size={20} /></div>
      <form onSubmit={event => { event.preventDefault(); void submitNewMember(false); }} className="inline-member-form">
        <label>Nama lengkap anggota<input value={newName} onChange={event => setNewName(event.target.value)} minLength={2} maxLength={120} required placeholder="Nama lengkap" /></label>
        <button type="submit">Tambah anggota dan daftar periode</button>
      </form>
      {createError && <p role="alert">{createError}</p>}{createSuccess && <p role="status">{createSuccess}</p>}
      {confirmDuplicate && <div role="alert" className="bank-notice"><p>Nama berikut sudah terdaftar. Pastikan ini orang yang berbeda sebelum membuat identitas baru:</p><ul>{duplicates.map(item => <li key={item.id}>{item.full_name} · ID {item.id.slice(-8)}</li>)}</ul><button type="button" onClick={() => void submitNewMember(true)}>Ini anggota berbeda, lanjutkan</button><button type="button" onClick={() => { setConfirmDuplicate(false); setDuplicates([]); }}>Batalkan</button></div>}
    </section>}

    <section id="mutasi-kas" className="bank-panel bank-transactions"><div className="bank-section-title"><div><p className="eyebrow">STATUS ANGGOTA</p><h2>Daftar pembayaran · {periodLabel(period)}</h2><p>Akumulasi pembayaran sesuai periode, bukan riwayat transaksi individual.</p></div><span>{visible.length} ditampilkan</span></div>
      <div className="sprint-filters"><label className="sprint-search"><Search size={17} aria-hidden="true" /><span className="sr-only">Cari nama anggota</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Cari nama anggota" /></label><label className="sprint-select"><span>Filter status</span><select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">Semua status</option><option value="lunas">Lunas</option><option value="kurang">Kurang</option><option value="belum_bayar">Belum bayar</option><option value="unavailable">Perlu diperiksa</option></select></label></div>
      {visible.length ? <ul className="sprint-list">{visible.map(row => { const status = duesStatus(row); return <li key={row.id}><details className="sprint-detail"><summary><span className="sprint-avatar">{row.full_name.slice(0,1).toUpperCase()}</span><span className="sprint-person"><strong>{row.full_name}</strong><small>{formatContribution(row.paid_amount)} tercatat · ID {row.member_id.slice(-8)}</small></span><span className={`bank-badge ${status}`}>{labels[status]}</span><span className="sprint-detail-hint">Detail <span aria-hidden="true">⌄</span></span></summary><div className="sprint-detail-body"><dl><div><dt>Acuan sukarela</dt><dd>{formatContribution(row.reference_amount)}</dd></div><div><dt>Total tercatat</dt><dd>{formatContribution(row.paid_amount)}</dd></div><div><dt>Periode</dt><dd>{periodLabel(row.dues_month)}</dd></div></dl><p>Status di atas dihitung dari akumulasi pembayaran dibanding acuan Rp10.000. Kekurangan bukan tagihan atau utang wajib.</p></div></details></li>; })}</ul> : <div className="sprint-empty">{periodRows.length ? "Tidak ada anggota yang cocok dengan pencarian atau filter." : "Belum ada daftar kas untuk periode ini."}</div>}
    </section>
    <section id="rekap-bulanan" className="bank-panel dues-recap"><div className="bank-section-title"><div><p className="eyebrow">RINGKASAN PERIODE</p><h2>Rekap bulanan</h2><p>Pilih periode yang sudah dibuka.</p></div></div><div className="dues-recap-list">{periods.map(month => { const item = summarizeDues(rows.filter(row => row.dues_month === month)); return <button type="button" key={month} className={month === period ? "is-selected" : ""} onClick={() => setPeriod(month)} aria-pressed={month === period}><span>{periodLabel(month)}</span><span>{item.paid}/{item.members} mencapai acuan</span><strong>{item.members ? formatContribution(item.collected) : "—"}</strong></button>; })}</div><p className="sprint-note">Setiap bulan berdiri sendiri. Pembayaran sukarela dan tidak menimbulkan denda.</p></section>
  </div>;
}
