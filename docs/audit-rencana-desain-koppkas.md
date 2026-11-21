# Audit awal dan rencana standar desain KOPPKAS

Tanggal audit: 20 November 2026. Branch frontend PR #21 pada `2f79fb091dab8a0b189e9b111ae8b74052b31add`. PR #22 pada `3bd714a25e9d091e531cc6ff70c358a02097dde8`, masih draft. Dokumen ini merupakan audit awal berbasis pembacaan kode dan eksplorasi referensi, **bukan** sertifikasi visual, aksesibilitas, integrasi atau audit lengkap tiap state di setiap halaman. Tidak ada redesign massal yang dilakukan.

## Prinsip dan batas

- Pertahankan identitas Sky Blue & White, arsitektur navigasi yang disetujui, kebijakan organisasi dan aturan bisnis. Penyempurnaan besar memerlukan proposal dan persetujuan.
- Bahasa visual: profesional, hangat dan terarah; sentuhan ekspresif secukupnya tanpa mengurangi keterbacaan atau nuansa terpercaya untuk data keuangan. Bukan replika produk lain.
- Frontend saja. Tidak mengubah migrasi, skema, RLS, RPC, Server Actions, autentikasi backend, konfigurasi produksi, atau branch backend. Tidak merge/deploy.
- Angka, status, receipt dan periode bersumber dari kontrak/izin yang sah; kosong, belum tersedia, terlarang dan error harus dibedakan. Jangan menghitung saldo dari daftar mutasi parsial.

## Referensi dan terjemahan ke KOPPKAS

- [Apple Human Interface Guidelines — Foundations](https://developer.apple.com/design/human-interface-guidelines/foundations): adaptasi layout, hierarki tipografi dan motion yang menjelaskan keadaan. Terapkan pada sistem web KOPPKAS, bukan menyalin estetika platformnya.
- [Carbon Design System — Empty states](https://carbondesignsystem.com/patterns/empty-states-pattern/): bedakan data kosong, pencarian tanpa hasil dan kegagalan; sertakan langkah lanjut yang relevan. Ini khususnya penting untuk kas dan dashboard.
- [GOV.UK Design System — focus states](https://designnotes.blog.gov.uk/2019/07/29/weve-made-the-gov-uk-design-system-more-accessible/): fokus yang mudah dikenali dan kontras memadai adalah bagian inti interaksi keyboard.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/): target AA untuk evaluasi, termasuk kontras teks normal minimal 4,5:1 dan target pointer minimal 24×24 CSS px dengan pengecualian yang ditetapkan standar. Sasaran desain operasional 44×44 CSS px jika praktis, bukan klaim bahwa itu syarat AA universal.

Referensi ini adalah eksplorasi prinsip dasar, belum berupa benchmark visual kompetitor atau riset pengguna lapangan. Tahap konsep perlu moodboard dan review bersama pemilik sebelum implementasi redesign besar.

## Inventaris dan temuan awal

| Area | Yang sudah ada dan layak dipertahankan | Hal yang perlu ditindaklanjuti | Bukti utama |
| --- | --- | --- | --- |
| Website publik: beranda, tentang, struktur, kegiatan, informasi, transparansi, kontak | Hero editorial, navigasi publik, batas publikasi informasi, layout dan breakpoint khusus. Transparansi menjelaskan bahwa data internal tidak otomatis dipublikasikan. | `PublicHome` dan kegiatan publik memperlakukan sebagian kegagalan pembacaan sebagai data kosong; pesan “belum ada” dapat menyesatkan. Navigasi publik mobile memakai horizontal overflow dan teks kecil: perlu uji discoverability, keyboard, panjang label dan kontras. | `src/components/public-home.tsx`, `src/app/public/kegiatan/page.tsx`, `src/app/globals.css` |
| Login/autentikasi | Layout dua area, form berlabel, autocomplete, error `role=alert`, feedback pending. | Uji keterbacaan dan alur pada layar sempit, password manager, validasi/error, keyboard, zoom dan koneksi lambat. Tidak menyimpulkan keamanan autentikasi dari audit visual. | `src/app/login/page.tsx`, `.login-*` di `globals.css` |
| Dashboard & navigasi | Navigasi modul bersumber bersama dan difilter izin; shell menyediakan drawer mobile dengan Escape, focus trap/pemulihan fokus, label navigasi dan `aria-current`. Ada token, focus-visible, dan reduced-motion dasar. | `dashboard/page.tsx` masih merangkum iuran dari bulan kalender dan `reduce` menjadi nol jika hasil kosong; belum membuktikan periode dibuka, kelengkapan/RLS atau ketiadaan transaksi. Perlu validasi sumber/status resmi agar tidak menyajikan angka menyesatkan. Audit browser untuk navigasi desktop/mobile, role dan focus belum dilakukan. | `src/components/dashboard-shell.tsx`, `dashboard-navigation.ts`, `src/app/dashboard/page.tsx` |
| Uang Kas Bulanan | Halaman utama fail-closed dengan guard baca; komponen siap pakai memiliki desain m-banking, status, formulir disabled, riwayat dan struk yang belum tersedia secara jujur. Pembukaan eksplisit dan Rp205.000 historis terdokumentasi. | Komponen kaya tersebut **tidak terhubung** di halaman aktual. `backend-contract.ts` mencerminkan head PR #22 yang lebih lama; cocokkan lagi sebelum integrasi. PR #22 saat ini draft, migrasi belum diterapkan. Jangan menampilkan periode berdasarkan tanggal/fixture. | `src/app/dashboard/uang-kas-bulanan/page.tsx`, `src/components/monthly-dues/*`, `docs/audit-frontend-pr21-monthly-dues.md` |
| Keanggotaan | Pencarian/filter, detail per anggota, state error terpisah, komponen dirancang responsif dan menggunakan identitas yang sudah ada. | Validasi kepadatan, daftar panjang, layar sempit, pembaca layar dan edit yang belum tersedia; jangan mengesankan bahwa fitur disabled sudah berfungsi. | `src/app/dashboard/keanggotaan/page.tsx`, `src/components/members/member-directory.tsx` |
| Modul internal lain: keuangan, kegiatan, surat, laporan, inbox, notifikasi, struktur, akun, keamanan, dokumentasi dan lainnya | `ModuleShell` dan filter navigasi bersama memberi dasar konsisten; beberapa halaman mempunyai guard dan error. | Belum dievaluasi masing-masing secara visual. Contoh konkret: laporan memakai `data?.length ?? 0` dan menampilkan empty state meski query error; notifikasi memakai `unread ?? 0` dan empty state walau error. Bedakan error dari nol/kosong. Prioritaskan formulir, tabel dan workflow yang digunakan nyata. | `src/app/dashboard/laporan/page.tsx`, `src/app/dashboard/notifikasi/page.tsx`, `src/components/module-shell.tsx` |
| Design system & implementasi | `globals.css` memiliki token semantik, `:focus-visible`, reduced motion dan breakpoint; `ui/button.tsx` dan `ui/status.tsx` menyediakan primitive awal. | Ada campuran token baru, nilai hard-coded, CSS legacy dan komponen berbeda untuk pola serupa. Banyak label sekunder 8–11px dan beberapa kontrol ikon sekitar 26–34px: risiko keterbacaan/target, bukan kesimpulan otomatis gagal WCAG. Google Fonts diimpor dari jaringan; fallback ada, tetapi perubahan layout/kinerja saat font tidak tersedia perlu diuji. | `src/app/globals.css`, `src/components/ui/*` |

## Usulan arah visual (memerlukan persetujuan untuk redesign besar)

**Konsep: “Ruang Bersama, Tercatat Jelas”.** Identitas Sky Blue & White dipertahankan. Permukaan putih hangat dan biru berlapis membedakan area kerja, sementara tipografi Manrope/DM Sans dan penggunaan angka tabular yang terbaca memberi rasa editorial sekaligus ketelitian keuangan. Aksen segar dipakai hemat untuk state, bukan dekorasi dominan. Konten nyata dan ilustrasi/photography milik organisasi yang disetujui lebih penting daripada grafik acak.

- **Publik:** narasi organisasi, kegiatan aktual, akses informasi jelas, fotografi/aset yang disetujui, tipografi editorial dan ruang yang lebih lapang.
- **Dashboard:** ringkasan berdasarkan izin, informasi paling relevan dulu, hierarki angka jelas dan state ketidaktersediaan yang akurat; grafik hanya jika sumber dan maknanya terbukti.
- **Login:** fokus pada akses aman, kontras form dan feedback; tetap serumpun dengan publik dan dashboard.
- **Modul:** pola operasional kompak, filter dan detail mudah dipindai, satu aksi utama yang jelas; permukaan dan tipografi konsisten tanpa menyamakan kebutuhan seluruh modul.
- **Kas bulanan:** struktur m-banking + dashboard organisasi: periode resmi → ringkasan otoritatif → iuran anggota → mutasi/aksi, dengan saldo awal, pemasukan, pengeluaran dan saldo akhir jelas. Historis Oktober bukan pemasukan. Pembukaan eksplisit dan otorisasi backend tetap mengendalikan aksi.

## Rencana penerapan bertahap

1. **Baseline dan bukti (sebelum redesign):** inventaris semua route dan role, kumpulkan screenshot aktual di 320/390/768/1024/1440 px dan zoom 200%; catat state loading/empty/error/success/disabled dan jenis perangkat. Audit dengan keyboard, reduced motion, contrast checker dan screen reader pada skenario utama. Gunakan data uji terisolasi dan berlabel; jangan gunakan data fiktif sebagai data nyata. Hasil diprioritaskan menurut dampak tugas dan risiko.
2. **Sprint aktif — integrasi kas:** koordinasikan finalisasi dan ketersediaan kontrak PR #22 di branch frontend dan lingkungan uji yang disetujui. Bandingkan signature/types latest termasuk pagination; uji peran, RLS, data historis dan concurrency. Pertahankan fail-closed sampai sumber periode resmi tersedia. Bangun states dan detail UI hanya berdasarkan respons resmi; uji period selector, pencarian UUID, pembayaran, struk/retry, summary, mutasi berhalaman, pengeluaran dan pembukaan. Tinjau UX mobile/desktop dan akurasi data. Tidak mengubah backend untuk mempercepat integrasi.
3. **Pondasi design system:** setelah persetujuan, audit pemakaian warna/tipografi/spacing/radius/ikon/motion; tetapkan token semantik dan dokumentasi primitive tombol, form, alert, table/list, dialog dan navigasi dengan state interaktif serta contoh loading/error. Migrasikan secara inkremental, hindari perubahan global yang merusak halaman lain.
4. **Pilot usulan:** pilih bersama pemilik satu permukaan publik dan satu modul operasional untuk high-fidelity desktop/mobile dan review; jelaskan dampak, aksesibilitas, data dan rollback sebelum implementasi. Jangan mengubah arsitektur navigasi yang telah disetujui tanpa izin.
5. **Rollout bertahap:** terapkan ke login, dashboard dan semua modul berdasarkan prioritas tugas, mempertahankan perbedaan fungsi. Sertakan visual regression pada states nyata, data-error dan role; review di setiap milestone.
6. **Quality gate:** definisikan daftar semua route dan state, screenshot lintas breakpoint, keyboard/focus/zoom/reduced-motion, pengujian screen reader, akurasi loading/error dan konsistensi bahasa; tes unit/integrasi/build serta audit nyata sebelum menyatakan selesai. Jangan menyebut platform sudah aksesibel atau responsif menyeluruh sebelum ada bukti.

## Status pengujian dan keputusan

Audit ini hanya membaca kode, dokumentasi dan referensi. Tidak ada pengujian browser, screen reader, contrast measurement, authenticated end-to-end, modifikasi frontend atau verifikasi responsivitas seluruh halaman pada giliran audit ini. QA fixture lama tidak mewakili halaman produksi yang sekarang fail-closed. PR #22 melaporkan CI lulus untuk head terbaru, tetapi migrasi hosted, RLS autentikasi dan concurrency masih menjadi blocker menurut PR.

**Persetujuan yang dibutuhkan:** arah visual di atas dan prioritas pilot setelah integrasi kas; detail desain, aset dan halaman terdampak harus ditinjau sebelum redesign signifikan. Pertanyaan kas yang memerlukan backend/pemilik tetap dicatat di audit integrasi, termasuk pagination, akses Sekretaris, periode resmi dan ketersediaan migrasi.

## Lampiran A — inventaris seluruh halaman (pemeriksaan kode awal)

Inventaris ini mencakup semua `page.tsx` yang ada pada commit audit, bukan penilaian visual menyeluruh. “Uji” berarti pekerjaan yang **belum** dijalankan, bukan hasil lulus.

| Route | Kondisi yang teramati dari kode | Fokus uji / evaluasi berikutnya |
| --- | --- | --- |
| `/` | Beranda publik memakai `PublicHome`: hero, navigasi, pengumuman dan footer. Error query pengumuman tidak dibedakan dari kosong. | Komposisi, navigasi, state error/empty dan aksesibilitas lintas viewport. |
| `/public` | Redirect ke `/`. | Pastikan navigasi dan deep link tidak membingungkan. |
| `/public/tentang` | Konten organisasi statis dengan `PublicInfoShell`. | Keterbacaan, ritme editorial dan konten pada mobile. |
| `/public/struktur` | Menyatakan struktur belum diterbitkan. | Bedakan konten publik yang memang belum diterbitkan dari error; review copy. |
| `/public/kegiatan` | List kegiatan publik; kegagalan query/exception dapat tampil sebagai kosong. | Error vs kosong, overflow judul dan tanggal panjang. |
| `/public/informasi` | List pengumuman terbit; ada tampilan error eksplisit. | Empty/error dan akses keyboard list. |
| `/public/transparansi` | Penjelasan publikasi dan state laporan belum diterbitkan. | Hierarki dan persetujuan konten publik. |
| `/public/contact` | Halaman kanal kontak, terpisah dari dashboard. | Uji fungsi tautan, label, target sentuh dan viewport sempit. |
| `/login` | Form email/password, pending dan error. | Keyboard, password manager, zoom dan kontras; autentikasi backend di luar cakupan redesign. |
| `/verifikasi-surat/[id]` | Halaman publik memeriksa ID dan membaca data verifikasi surat. | State ID tidak valid, tidak ditemukan, error dan konten panjang; perlindungan data dan kontras. |
| `/dashboard` | Ringkasan berdasarkan izin. Query iuran masih memakai bulan kalender, dengan risiko nol dari hasil kosong. | Akurasi status periode, error, role, label dan responsive grid. |
| `/dashboard/keanggotaan` | Directory dan form berizin; error terpisah dan edit belum tersedia. | Pencarian, nama sama/UUID, state dan daftar panjang. |
| `/dashboard/uang-kas-bulanan` | Guard baca dan fail-closed; daftar/action periode resmi belum tersedia pada branch. | Integrasi kontrak serta state dan visual semua role tanpa data simulasi. |
| `/dashboard/keuangan` | Hub dengan tiga tautan buku keuangan. | Hierarki dan konsistensi izin navigasi tiap role. |
| `/dashboard/uang-keseluruhan` | Saldo dan tabel transaksi, alert pada error. | Periksa fallback saldo/nol saat query gagal, tabel sempit dan akses keyboard. |
| `/dashboard/keuangan-kegiatan` | Ringkasan dan transaksi, alert bila sumber tidak lengkap. | Verifikasi angka dan empty state saat error, tabel dan formulir mobile. |
| `/dashboard/kegiatan` | Daftar kegiatan, workflow/form, multiple queries dan alert. | Data parsial/error vs angka nol, kompleksitas workflow dan mobile. |
| `/dashboard/surat-dokumen` | Daftar surat, form dan feedback, hingga 100 baris. | Tabel mobile, status persetujuan, pesan error dan konten panjang. |
| `/dashboard/laporan` | Ringkasan status dan daftar; kode menampilkan nol/empty walau error. | Koreksi semantik error vs nol setelah prioritas disepakati; visual ringkasan. |
| `/dashboard/pengumuman` | Daftar draft/terbit, form dan alert. | Periksa error vs kosong, perbedaan status dan alur publikasi. |
| `/dashboard/inbox` | Daftar pesan dalam `details`, count dan alert; count dapat fallback nol. | Privasi, error vs kosong, pembacaan keyboard dan konten panjang. |
| `/dashboard/notifikasi` | Daftar dan unread count, realtime; fallback nol/empty walau error. | Sinkronisasi state, pengumuman aksesibel dan error vs kosong. |
| `/dashboard/struktur` | Daftar dan editor role-scoped dengan alert. | Error vs kosong, state form/otorisasi, struktur pada layar kecil. |
| `/dashboard/akun` | Manajemen akun dan direktori dengan guard/feedback/alert. | Error direktori vs jumlah nol, form sensitif dan role terbatas. |
| `/dashboard/keamanan-akun` | Sesi perangkat dan feedback/alert. | Error vs kosong, konfirmasi aksi dan akses keyboard. |
| `/dashboard/dokumentasi` | Arsip dan tautan file bertanda tangan, alert, state file tidak dapat dibuka. | Error vs empty, label tautan baru, privasi dan daftar media. |
| `/dashboard/riwayat-aktivitas` | Daftar hingga 100 aktivitas, alert dan empty state. | Error vs nol/empty, keterbacaan metadata dan tanggal. |

Dua halaman pendukung non-`page.tsx` yang juga perlu QA: `src/app/public/*` shell bersama dan `public/offline.html` (pengalaman offline/PWA). Callback autentikasi adalah handler, bukan target redesign halaman; state `/auth/session-expired` perlu diverifikasi routing dan rendering pada browser sesuai implementasi proyek.

## Lampiran B — design system: proposal untuk review

Ini adalah spesifikasi arah awal, bukan izin mengganti komponen global atau mengubah palet yang telah disetujui.

| Elemen | Proposal / kriteria |
| --- | --- |
| Warna | Jadikan token semantik `primary`, `surface`, `text`, `muted`, `border`, `focus`, `success`, `warning`, `error`; pertahankan Sky Blue & White. Audit kontras seluruh pasangan teks/latar; warna status selalu disertai teks/ikon. |
| Tipografi | Pertahankan Manrope/DM Sans sebagai baseline usulan; definisikan skala heading/body/label dan fallback system, hindari teks kecil pada informasi penting. Tampilkan nominal dengan angka tabular dan overflow yang aman. |
| Spasi & layout | Gunakan skala konsisten untuk jarak antar-komponen dan kontainer; tetapkan lebar baca maksimum dan grid adaptif untuk konteks publik, dashboard, formulir dan detail. Ukuran final ditentukan melalui prototipe dan uji. |
| Radius & elevation | Batasi sejumlah tingkat radius/elevation berdasarkan fungsi (input, card, overlay), bukan tambahan bayangan tanpa fungsi. Pertahankan keterbacaan border dan fokus. |
| Komponen | Inventaris dan dokumentasikan Button, Link, Input/Select, Status, Alert, Card, Table/List, Dialog/Drawer, Pagination dan Receipt dengan variasi states serta label aksesibel. Pakai elemen semantik native bila memungkinkan. |
| Interaksi | Pola hover, pressed, focus-visible, disabled dan pending yang konsisten; feedback keberhasilan/kegagalan bukan hanya warna. Animasi singkat sesuai fungsi dan menghormati reduced motion. |
| Data | Angka resmi, sumber/periode, izin dan kelengkapan dijelaskan; representasikan loading, kosong, error dan data parsial secara berbeda. Jangan menambahkan grafik atau angka dekoratif untuk mengisi ruang. |

## Lampiran C — prioritas dampak UX dan gerbang QA

| Prioritas | Masalah / hasil yang dituju | Cakupan dan prasyarat |
| --- | --- | --- |
| P0 — kepercayaan data & keselamatan transaksi | Mencegah periode/nominal palsu, penulisan duplikat, akses yang salah dan error yang tampil sebagai nol. Audit dashboard iuran, kas dan buku keuangan; pertahankan fail-closed. | Sprint kas; kontrak backend final, role/RLS serta lingkungan uji yang disetujui. |
| P1 — penyelesaian tugas & akses | Pengguna dapat menavigasi, memahami state dan menyelesaikan alur tanpa mouse di seluruh viewport; perbaiki error-vs-empty pada halaman berdampak tinggi. | Baseline per role, keyboard, focus, label, pembaca layar, responsive dan feedback. |
| P2 — konsistensi visual | Sistem token, komponen dan tipografi menyatu dengan palet serta navigasi yang telah disetujui. | Proposal terinci dan review sebelum perubahan global; pilot publik dan satu modul. |
| P3 — ekspresi merek & polish | Narasi publik, aset resmi, data visualization yang bermakna dan micro-interactions yang tidak mengganggu. | Konten/aset berizin, kebutuhan tervalidasi, persetujuan desain. |

QA per tahap: (1) daftar route/role/state dan screenshot baseline, (2) unit dan integration tests pada state sukses/error dan data batas, (3) browser 320/390/768/1024/1440 px, orientasi dan zoom 200%, (4) keyboard/focus, kontras terukur, reduced motion dan screen reader, (5) role/RLS, transaksi dan concurrent retry di lingkungan uji yang diizinkan, (6) review visual dan regresi sebelum meminta persetujuan berikutnya. Hasil aktual, peralatan dan kekurangan dicatat per halaman; tidak menganggap fixture sebagai bukti produksi.
