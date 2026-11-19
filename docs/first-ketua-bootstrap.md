# Bootstrap akun Ketua Pemuda pertama

Prosedur ini hanya untuk dedicated Supabase project KOPPKAS yang benar-benar belum memiliki Auth user maupun baris profil.

## Prasyarat

1. Pastikan target `NEXT_PUBLIC_SUPABASE_URL` adalah project KOPPKAS, bukan project sistem lama.
2. Terapkan migration `20261119000000_first_ketua_bootstrap_guard.sql` melalui alur migration yang telah direview. Jangan jalankan script sebelum tabel guard tersedia.
3. Siapkan `.env.local` dari `.env.example`.
4. Isi `SUPABASE_SECRET_KEY` (disarankan) atau `SUPABASE_SERVICE_ROLE_KEY` di `.env.local`. Kunci ini hanya untuk server/terminal lokal; jangan pernah memakai prefix `NEXT_PUBLIC_`, memasukkannya ke Git, atau mengirimkannya lewat chat.
5. Tentukan nama lengkap, email organisasi, dan password awal minimal 12 karakter.

## Jalankan satu kali

Tambahkan nilai berikut ke environment lokal untuk proses ini:

- `KOPPKAS_BOOTSTRAP_FULL_NAME`
- `KOPPKAS_BOOTSTRAP_EMAIL`
- `KOPPKAS_BOOTSTRAP_PASSWORD`
- `KOPPKAS_BOOTSTRAP_CONFIRM=CREATE_FIRST_KETUA`

Lalu jalankan:

```bash
npm run bootstrap:first-ketua
```

Script akan:
- Mengunci proses melalui satu baris singleton di `first_ketua_bootstrap_guard`, sehingga dua proses bootstrap tidak bisa berjalan bersamaan.
- Memastikan tabel `profiles` dan Supabase Auth belum memiliki akun.
- Membuat Auth user pertama dengan email terkonfirmasi.
- Mengisi profil hasil trigger Auth menjadi role `ketua_pemuda` dan aktif.
- Menulis audit log tanpa menyimpan password.
- Menandai guard selesai dan mempertahankannya sebagai bukti bahwa bootstrap telah dipakai.

## Batas keselamatan

- Script menolak berjalan jika sudah ada Auth user/profil atau guard telah diklaim.
- Jika proses berhenti setelah claim dibuat atau setelah Auth user dibuat tetapi sebelum selesai, guard sengaja tetap terkunci. Jangan hapus guard atau mengulang script secara membabi buta; periksa Auth user, profil, audit log, dan guard terlebih dahulu.
- Script tidak membuat akun lain dan tidak mengubah data organisasi.
- Setelah berhasil, hapus variabel `KOPPKAS_BOOTSTRAP_*` dari environment lokal. Simpan password awal melalui kanal aman dan minta Ketua menggantinya setelah login pertama.
- Prosedur ini belum mengaktifkan Password Verification Hook, batas tiga perangkat, atau pengaturan produksi lain. Ikuti `docs/auth-hook-setup.md` untuk konfigurasi hook login.
- Migration dan script di repository tidak berarti migration sudah diterapkan ke Supabase aktif. Penerapan database tetap harus melalui review dan verifikasi terpisah.
