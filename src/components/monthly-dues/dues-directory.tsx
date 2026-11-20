"use client";

import { useId, useState } from "react";
import { ArrowDownLeft, ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Clock3, FileText, Plus, ReceiptText, Search, UsersRound, WalletCards } from "lucide-react";
import { AccountingPanel } from "./accounting-panel";
import { PaymentForm } from "@/app/dashboard/uang-kas-bulanan/payment-form";
import { DuesMemberCreateForm } from "@/app/dashboard/uang-kas-bulanan/member-create-form";
import { duesStatus, formatContribution, MONTHLY_REFERENCE, periodLabel, summarizeDues, type DuesRecord } from "./contracts";

type Props = { rows: DuesRecord[]; currentMonth: string; canRecord: boolean; canViewCashBook?: boolean; openedPeriods?: readonly string[] };
const labels = { lunas: "LUNAS", kurang: "KURANG", belum_bayar: "BELUM BAYAR", unavailable: "PERLU DIPERIKSA" } as const;

export function DuesDirectory({ rows, currentMonth, canRecord, canViewCashBook = false, openedPeriods }: Props) {
  const periods = Array.from(new Set(openedPeriods ?? [])).sort().reverse();
  const [selectedPeriod, setPeriod] = useState<string | null>(null);
  const period = selectedPeriod && periods.includes(selectedPeriod) ? selectedPeriod : periods[0] ?? "";
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [memberQuery, setMemberQuery] = useState("");
  const [memberId, setMemberId] = useState("");
  const selectId = useId();
  const index = periods.indexOf(period);
  const periodRows = rows.filter(row => row.dues_month === period);
  const summary = summarizeDues(periodRows);
  const visible = periodRows.filter(row => row.full_name.toLocaleLowerCase("id-ID").includes(query.trim().toLocaleLowerCase("id-ID")) && (filter === "all" || duesStatus(row) === filter));
  const currentRows = rows.filter(row => row.dues_month === currentMonth);
  const matches = currentRows.filter(row => row.full_name.toLocaleLowerCase("id-ID").includes(memberQuery.trim().toLocaleLowerCase("id-ID")));
  const selected = currentRows.find(row => row.member_id === memberId);
  const mismatch = periodRows.some(row => Number(row.reference_amount) !== MONTHLY_REFERENCE);
  const percent = summary.members ? Math.round(summary.paid / summary.members * 100) : 0;

  if (!openedPeriods) return <div className="sprint-module dues-bank"><section className="bank-panel" role="status"><p className="eyebrow">UANG KAS BULANAN</p><h1>Periode kas belum dapat dimuat</h1><p>Daftar periode yang dibuka belum terhubung. Pencatatan dan pembukaan periode sementara tidak tersedia agar tidak menampilkan periode yang belum terverifikasi.</p></section></div>;
  if (!periods.length) return <div className="sprint-module dues-bank"><section className="bank-panel" role="status"><p className="eyebrow">UANG KAS BULANAN</p><h1>Belum ada periode dibuka</h1><p>Pembukaan periode menunggu integrasi backend.</p><button type="button" disabled>Buka periode</button></section></div>;

  return <div className="sprint-module dues-bank">
    <div className="bank-heading"><div><p className="eyebrow">KOPPKAS / KONTRIBUSI SUKARELA</p><h1>Uang Kas Bulanan</h1><p>Catatan kontribusi anggota, dalam satu tempat.</p></div><span className="bank-heading-badge"><span /> PENCATATAN MANUAL</span></div>

    <div className="bank-overview">
      <section className="bank-balance" aria-labelledby="balance-title"><div className="bank-balance-top"><span><WalletCards size={17} aria-hidden="true" /> RINGKASAN KAS</span><span>PERIODE TERPILIH</span></div><div className="bank-period"><button type="button" disabled={index === periods.length - 1} onClick={() => setPeriod(periods[index + 1])} aria-label="Periode sebelumnya"><ChevronLeft size={18} /></button><span><CalendarDays size={15} aria-hidden="true" /> {periodLabel(period)}</span><button type="button" disabled={index === 0} onClick={() => setPeriod(periods[index - 1])} aria-label="Periode berikutnya"><ChevronRight size={18} /></button></div><p id="balance-title">Total tercatat periode ini</p><strong className="bank-total">{summary.members ? formatContribution(summary.collected) : "—"}</strong><div className="bank-balance-foot"><span>ACUAN SUKARELA</span><strong>Rp10.000 <small>/ anggota</small></strong><p>Tidak ada kewajiban pembayaran atau denda; status iuran terpisah per bulan. Saldo kas terakumulasi antarperiode.</p></div></section>
      <section className="bank-status" aria-label="Status anggota periode terpilih"><div className="bank-section-title"><div><p className="eyebrow">ANGGOTA PER PERIODE</p><h2>Status kontribusi</h2></div><span>{summary.members} terdaftar</span></div><p>Hanya anggota dalam daftar periode ini; bukan seluruh anggota aktif.</p><div className="bank-status-grid"><div><span className="bank-status-dot is-paid" /> <strong>{summary.paid}</strong><small>LUNAS</small></div><div><span className="bank-status-dot is-partial" /> <strong>{summary.short}</strong><small>KURANG</small></div><div><span className="bank-status-dot is-unpaid" /> <strong>{summary.unpaid}</strong><small>BELUM BAYAR</small></div></div><div className="bank-progress-label"><span>Mencapai acuan</span><strong>{summary.members ? `${percent}%` : "—"}</strong></div><progress aria-label="Persentase anggota terdaftar yang mencapai acuan" max={100} value={percent} />{summary.unavailable > 0 && <p role="alert">{summary.unavailable} data pembayaran perlu diperiksa dan belum dapat diklasifikasikan.</p>}</section>
    </div>
    {mismatch && <div className="bank-notice" role="alert">Ada acuan periode yang berbeda dari Rp10.000 di data sumber. Status di layar mengikuti Rp10.000; mohon verifikasi konsistensi dengan pengelola backend.</div>}

    <nav className="bank-quick-actions" aria-label="Aksi cepat kas bulanan">
      {canRecord && periods.includes(currentMonth) && <a href="#catat-pembayaran"><span><Plus size={20} /></span>Catat Pembayaran</a>}
      {canRecord && <a href="#tambah-anggota"><span><UsersRound size={20} /></span>Tambah Anggota</a>}
      <a href="#mutasi-kas"><span><ArrowDownLeft size={20} /></span>Mutasi Kas</a>
      <a href="#rekap-bulanan"><span><FileText size={20} /></span>Rekap Bulanan</a>
    </nav>

    {canViewCashBook && <AccountingPanel period={period} />}

    <div className="bank-main-grid">
      <section id="mutasi-kas" className="bank-panel bank-transactions" aria-labelledby="transactions-title"><div className="bank-section-title"><div><p className="eyebrow">AKTIVITAS TERBARU</p><h2 id="transactions-title">Mutasi kas</h2></div><span>{periodLabel(period)}</span></div><div className="bank-unavailable"><span className="bank-empty-icon"><Clock3 size={22} aria-hidden="true" /></span><h3>Riwayat transaksi belum tersedia</h3><p>Data yang tersedia saat ini hanya total per anggota, bukan transaksi individual. Mutasi, pencarian transaksi, dan detail akan tersedia setelah kontrak backend disepakati.</p><button type="button" disabled>Cari transaksi</button></div></section>
      <section className="bank-panel bank-receipt" aria-labelledby="receipt-title"><div className="bank-section-title"><div><p className="eyebrow">BUKTI TRANSAKSI</p><h2 id="receipt-title">Struk digital</h2></div><ReceiptText size={20} aria-hidden="true" /></div><div className="bank-unavailable"><span className="bank-empty-icon"><ReceiptText size={22} aria-hidden="true" /></span><h3>Struk belum tersedia</h3><p>Struk hanya dapat ditampilkan dari transaksi yang benar-benar tersimpan. Referensi dan status setelah transaksi belum tersedia dari kontrak saat ini.</p></div></section>
    </div>

    {canRecord && periods.includes(currentMonth) && <section id="catat-pembayaran" className="bank-panel bank-payment" aria-labelledby="payment-title"><div className="bank-section-title"><div><p className="eyebrow">TRANSAKSI BARU</p><h2 id="payment-title">Catat pembayaran</h2><p>Untuk bulan berjalan: {periodLabel(currentMonth)}. Pembayaran dapat dilakukan sebagian atau beberapa kali.</p></div><span className="bank-icon"><ArrowDownLeft size={20} /></span></div>
      <div className="bank-payment-body"><label className="bank-field" htmlFor={`${selectId}-search`}>Cari anggota terdaftar<input id={`${selectId}-search`} type="search" value={memberQuery} onChange={event => { setMemberQuery(event.target.value); setMemberId(""); }} placeholder="Ketik nama anggota" autoComplete="off" /></label><label className="bank-field" htmlFor={`${selectId}-member`}>Pilih anggota<select id={`${selectId}-member`} value={memberId} onChange={event => setMemberId(event.target.value)}><option value="">Pilih dari daftar bulan berjalan</option>{matches.map(row => <option key={row.id} value={row.member_id}>{row.full_name} · ID {row.member_id}</option>)}</select></label><p className="bank-helper">Pencarian hanya mencakup anggota yang sudah masuk daftar bulan berjalan. Identitas anggota dibedakan menggunakan ID, bukan nama.</p>
      {selected ? <div className="bank-selected"><div><span>ANGGOTA TERPILIH</span><strong>{selected.full_name}</strong><small>ID {selected.member_id}</small></div><div><span>TERCATAT BULAN INI</span><strong>{formatContribution(selected.paid_amount)}</strong></div></div> : <p className="bank-helper" role="status">{matches.length ? "Pilih anggota untuk membuka formulir pembayaran." : "Tidak ada anggota terdaftar yang cocok. Periksa daftar bulan berjalan."}</p>}
      {selected && <div className="dues-record"><PaymentForm key={selected.id} monthlyDuesId={selected.id} /></div>}
</div></section>}

    {canRecord && periods.includes(currentMonth) && <DuesMemberCreateForm duesMonth={currentMonth} />}

    <section className="bank-panel bank-members" aria-labelledby="dues-title"><div className="bank-section-title"><div><p className="eyebrow">DAFTAR PERIODE</p><h2 id="dues-title">Anggota · {periodLabel(period)}</h2><p>Status berdasarkan total kontribusi pada periode ini.</p></div><span>{visible.length} ditampilkan</span></div><div className="sprint-filters"><label className="sprint-search"><Search size={17} aria-hidden="true" /><span className="sr-only">Cari anggota dalam daftar kas</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Cari nama anggota" /></label><label className="sprint-select"><span>Filter status</span><select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">Semua status</option><option value="lunas">Lunas</option><option value="kurang">Kurang</option><option value="belum_bayar">Belum bayar</option><option value="unavailable">Perlu diperiksa</option></select></label></div>
      {visible.length ? <ul className="sprint-list">{visible.map(row => { const status = duesStatus(row); return <li key={row.id}><details className="sprint-detail"><summary><span className="sprint-avatar">{row.full_name.slice(0, 1).toUpperCase()}</span><span className="sprint-person"><strong>{row.full_name}</strong><small>{formatContribution(row.paid_amount)} tercatat · ID {row.member_id.slice(-8)}</small></span><span className={`bank-badge ${status}`}>{labels[status]}</span><span className="sprint-detail-hint">Detail <span aria-hidden="true">⌄</span></span></summary><div className="sprint-detail-body"><dl><div><dt>Acuan sukarela</dt><dd>Rp10.000</dd></div><div><dt>Total tercatat</dt><dd>{formatContribution(row.paid_amount)}</dd></div><div><dt>Periode</dt><dd>{periodLabel(row.dues_month)}</dd></div></dl><p>Riwayat transaksi individual belum tersedia. Total di atas merupakan akumulasi pembayaran yang tercatat.</p>{canRecord && row.dues_month === currentMonth && <a href="#catat-pembayaran" onClick={() => { setMemberQuery(""); setMemberId(row.member_id); }}>Catat pembayaran <ArrowRight size={14} aria-hidden="true" /></a>}</div></details></li>; })}</ul> : <div className="sprint-empty">{periodRows.length ? "Tidak ada anggota yang cocok dengan pencarian atau filter." : "Belum ada daftar kas untuk periode ini."}</div>}
    </section>
    <section id="rekap-bulanan" className="bank-panel dues-recap"><div className="bank-section-title"><div><p className="eyebrow">RINGKASAN PERIODE</p><h2>Rekap bulanan</h2><p>Pilih periode yang sudah dibuka untuk melihat daftar.</p></div></div><div className="dues-recap-list">{periods.map(month => { const item = summarizeDues(rows.filter(row => row.dues_month === month)); return <button type="button" key={month} className={month === period ? "is-selected" : ""} onClick={() => setPeriod(month)} aria-pressed={month === period}><span>{periodLabel(month)}</span><span>{item.members ? `${item.paid}/${item.members} mencapai acuan` : "Belum ada daftar"}</span><strong>{item.members ? formatContribution(item.collected) : "—"}</strong></button>; })}</div><p className="sprint-note">Setiap bulan berdiri sendiri. Kontribusi bersifat sukarela, bukan tagihan atau utang.</p></section>
  </div>;
}
