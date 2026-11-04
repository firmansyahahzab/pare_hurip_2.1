# Pare Hurip 3.0 — Panduan mulai

Paket ini mengembangkan proyek Next.js Pare Hurip lama. Fitur publik, KSA, dan endpoint prediksi ML tetap tersedia. Modul baru mengelola luas lahan tanam, menggunakan tabel `kecamatan` yang terpisah dari `districts` milik KSA.

## 1. Persiapan

1. Ekstrak ZIP hasil ke folder, misalnya `D:\proyek\pare-hurip-3.0`.
2. Pasang Node.js 24 LTS dan editor VS Code. Buka terminal pada folder yang berisi `package.json`.
3. Pasang package manager sesuai proyek:

   ```sh
   npm install -g pnpm@11.25.0
   pnpm install --frozen-lockfile
   ```

4. Salin `.env.example` menjadi `.env.local`. Pada PowerShell:

   ```powershell
   Copy-Item .env.example .env.local
   ```

   Pada macOS/Linux: `cp .env.example .env.local`.

5. Isi tiga nilai Supabase dari proyek percobaan Anda:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://ID-PROYEK.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=ISI_ANON_KEY_PROYEK
   SUPABASE_SERVICE_ROLE_KEY=ISI_SERVICE_ROLE_KEY_PROYEK
   ML_API_URL=http://localhost:8000
   ```

   URL dan kunci proyek tersedia melalui menu Connect/Project Settings/API Keys di dashboard Supabase. Gunakan kunci `anon` pada variabel public dan `service_role` hanya pada variabel server. Jangan mengunggah `.env.local` ke Git atau membagikannya.

## 2. Siapkan database percobaan

Buka proyek percobaan di [Supabase Dashboard](https://supabase.com/dashboard), lalu SQL Editor. Skrip **tidak dijalankan otomatis oleh aplikasi**.

| Kondisi | Urutan yang dijalankan |
|---|---|
| Database kosong | `supabase/000_schema_awal_database_kosong.sql`, lalu `supabase/migrations/001_luas_tanam.sql` |
| SQL delapan tabel yang Anda kirim sudah dijalankan | Hanya `supabase/migrations/001_luas_tanam.sql` |
| Database lama berisi data | Cadangkan lebih dahulu, periksa kesesuaian nama tabel/kolom, lalu jalankan `001_luas_tanam.sql` pada salinan percobaan |

Skrip `000` adalah salinan SQL Anda dan **hanya untuk database kosong**. Jangan menjalankannya ulang untuk mengatasi error fungsi/tabel sudah ada. Skrip `001` dapat dijalankan ulang, tidak menghapus baris, dan menambahkan tabel baru jika belum ada. Jika ada lebih dari satu superadmin atau duplikat identitas KSA (`segment_id`, `subsegment`, `periode`), migrasi berhenti. Tinjau data konflik secara manual; paket tidak menghapus/deduplikasi data lama.

Migrasi mengaktifkan akses baca yang diperlukan, membatasi penulisan data baru melalui fungsi yang memeriksa akun, mencatat aktivitas dalam transaksi, menjaga satu superadmin, serta menyinkronkan profil dengan Auth. Fitur publik lama tetap dapat membaca tabel KSA dan harga beras. Migrasi ini ditujukan untuk skema yang Anda berikan; periksa trigger/policy tambahan bila database Anda telah dimodifikasi di luar skema tersebut.

## 3. Buat superadmin pertama

1. Buka Supabase **Authentication → Users**. Buat user dengan email Anda dan password kuat. Konfirmasikan email melalui fasilitas dashboard.
2. Buka `supabase/002_bootstrap_superadmin.sql`.
3. Ganti `GANTI_EMAIL_SUPERADMIN` dan `GANTI_NAMA_SUPERADMIN`, lalu jalankan di SQL Editor.
4. Akun admin berikutnya dibuat dari menu **Pengguna Admin** setelah login sebagai superadmin. Akun yang dibuat melalui menu ini selalu berperan admin.

User Auth yang dibuat langsung dari dashboard tidak otomatis menjadi admin. Profil admin dibuat oleh alur backend aplikasi, atau melalui langkah bootstrap yang dijalankan pemilik proyek. Peran tidak berasal dari metadata yang dapat diedit pengguna sendiri.

## 4. Jalankan web

```sh
pnpm dev
```

Buka [http://localhost:3000/admin/login](http://localhost:3000/admin/login), lalu login menggunakan akun superadmin. Halaman publik tetap di [http://localhost:3000](http://localhost:3000).

Mulai dari **Referensi Wilayah → Tambah Kecamatan**, lalu isi **Data Luas Lahan Tanam**. Tidak ada kecamatan atau angka contoh yang dimasukkan otomatis. Dropdown yang kosong berarti referensi belum diisi atau akses database belum benar.

Setelah mengubah `.env.local`, hentikan server dengan `Ctrl+C`, lalu jalankan `pnpm dev` kembali.

Untuk memeriksa proyek dan menjalankan hasil produksi secara lokal:

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm start
```

## 5. Modul dan aturan akses

| Bagian | Admin | Superadmin |
|---|---|---|
| Dashboard, luas tanam, impor/ekspor | Bisa | Bisa |
| Referensi kecamatan luas tanam | Bisa | Bisa |
| Pengguna Admin | Ditolak pada UI dan API | Bisa |
| Mengubah peran melalui form/API pengguna | Tidak tersedia | Tidak tersedia |
| Menghapus superadmin | Ditolak | Ditolak |

Empat menu utama modul baru: Dashboard, Data Luas Lahan Tanam, Referensi Wilayah, Pengguna Admin (superadmin). Menu dan route Pengaturan dihapus. Tautan **Modul KSA** di header atau menu profil membuka fitur lama, dengan navigasinya sendiri. Tema gelap/terang dan logout tetap tersedia.

Route lama KSA data/impor tetap `/admin/ksa-data` dan `/admin/ksa-import`. Dashboard KSA dipindahkan ke `/admin/ksa-dashboard`; referensi `districts` ke `/admin/ksa-region-reference`. Route `/admin/dashboard` dan `/admin/region-reference` sekarang menampilkan modul luas tanam.

## 6. Pengisian dan Excel

- Satu data untuk satu kecamatan pada satu bulan. Periode disimpan sebagai tanggal pertama bulan, misalnya `2026-10-01`, dan ditampilkan sebagai Oktober 2026.
- Luas dalam hektare, 0–9.999.999.999,99, maksimum dua desimal. Nol adalah data valid; tidak ada data ditampilkan terpisah.
- Keterangan opsional, maksimum 500 karakter.
- Edit menggunakan ID baris. Duplikasi kecamatan/bulan ditolak database, termasuk saat dua pengguna menyimpan bersamaan.
- Edit kode kecamatan memperbarui relasi data melalui cascade. Hapus kecamatan yang masih digunakan akan ditolak.
- Admin yang masih menjadi penginput data KSA/luas tanam tidak dapat dihapus. Riwayat aktivitas tetap disimpan saat akun tanpa keterkaitan data dihapus.

Unduh template dari halaman Data Luas Lahan Tanam. Isi sheet **Data Luas Tanam**, gunakan sheet **Referensi Kecamatan** dan **Petunjuk** sebagai bantuan.

| Kolom Excel | Aturan |
|---|---|
| Kode Kecamatan | Teks, sama persis dengan referensi. Pertahankan nol di depan. |
| Kecamatan | Nama sesuai kode; perbedaan kapital dan spasi tepi diabaikan. |
| Tahun | 1900–9999 |
| Bulan | 1–12 atau nama lengkap bulan Indonesia |
| Luas Tanam (ha) | Contoh: `25,5`, `25.5`, atau `1.234,56`. `1.234` tidak dianggap 1234. |
| Keterangan | Opsional, maksimum 500 karakter |

Dukungan: `.xlsx` dan `.xls`, maksimum **10 MB / 5.000 baris per file**. Pecah file yang melebihi batas.

Alur: pilih file → preview → Lanjut ke Simpan → Selesai. Preview tidak menyimpan data. Saat penyimpanan, semua baris divalidasi kembali. Baris invalid/duplikat dilewati; hasil akhir menunjukkan jumlah benar-benar tersimpan, dilewati, dan gagal. Permintaan ulang dengan ID proses yang sama tidak menggandakan data maupun jumlah proses impor. ID ini dipertahankan selama halaman impor masih terbuka; setelah memuat ulang, constraint unik tetap melindungi data, tetapi proses menjadi permintaan baru.

File Excel dan template tidak disimpan di database. Tabel luas tanam tidak memiliki `sumber_input` atau `nama_file`. Log menyimpan ringkasan hasil impor dan referensi baris untuk audit, tanpa menyimpan file Excel.

Export Data mengikuti filter **yang sudah diterapkan** dan pencarian aktif, mencakup semua hasil, bukan hanya halaman tabel. Batas 100.000 baris per ekspor; jika lebih, aplikasi meminta filter dipersempit, bukan memotong hasil diam-diam. Ekspor memakai snapshot database yang sama sepanjang pengambilan data.

## 7. Membaca dashboard

- Tahun memengaruhi grafik tren dan perbandingan.
- Bulan memengaruhi perbandingan dan ringkasan; tren tetap satu tahun penuh.
- Kecamatan membatasi data yang ditampilkan.
- Total Data = jumlah baris sesuai filter; Kecamatan dengan data = jumlah kecamatan unik dalam hasil.
- Periode Aktif = rentang periode yang memiliki data pada hasil filter.
- Import Berhasil = jumlah proses dengan setidaknya satu baris tersimpan dan tanpa kegagalan teknis. Baris invalid/duplikat yang dilewati tidak menggagalkan proses. Satu proses dihitung sekali bila memiliki data tersimpan yang sesuai filter.
- Impor yang seluruh barisnya dilewati tidak menambah jumlah impor berhasil. Impor dengan kegagalan teknis sebagian dicatat terpisah.
- Aktivitas Terbaru selalu memuat 10 aktivitas terakhir modul luas tanam dari semua periode; tidak ikut filter grafik.
- Ekspor dan unduh template menghasilkan file, tanpa pop-up berhasil tambahan. Impor memakai halaman Selesai. Tambah/edit/hapus memakai modal berhasil setelah konfirmasi backend.

## 8. Backend machine learning lama

Modul luas tanam tidak memerlukan perubahan model ML. Paket `ml-pare-hurip-main(2).zip` yang Anda berikan tetap digunakan terpisah untuk endpoint prediksi lama. Jalankan backend sesuai README paket tersebut dan sesuaikan `ML_API_URL` dengan URL backend, misalnya `http://localhost:8000`. Halaman prediksi membutuhkan data/model dan layanan ML yang tersedia; modul administrasi luas tanam hanya membutuhkan Next.js dan Supabase.

## 9. Jika muncul masalah

| Gejala | Pemeriksaan |
|---|---|
| Koneksi Supabase belum diatur | Isi `.env.local`, lalu restart Next.js. |
| Login berhasil di Auth tetapi akses admin tidak muncul | Pastikan ada baris `profiles` dengan ID Auth yang sama dan role admin/superadmin; jalankan migrasi RLS. |
| Struktur database belum siap | Jalankan `001_luas_tanam.sql`, lalu muat ulang halaman. |
| Gagal menambah akun / sinkronisasi profil | Periksa service-role key pada server dan trigger `ph_sync_auth_profile` pada `auth.users`. Jangan hapus trigger untuk memaksa operasi berhasil. |
| Duplikat kecamatan dan periode | Edit data yang sudah ada atau pilih periode/kecamatan lain. |
| Tidak dapat menghapus kecamatan/akun | Masih ada data terkait. Pesan aplikasi menjelaskan hubungan yang menghalangi. |
| API prediksi tidak merespons | Jalankan backend ML lama dan periksa `ML_API_URL`. |
| `CREATE ... already exists` saat menjalankan SQL awal | Skrip `000` hanya untuk database kosong. Pada skema yang sudah ada, jalankan migrasi `001`. |

## 10. Status pemeriksaan

Lihat `docs/HASIL_PENGUJIAN.md` untuk perintah, hasil, dan batas verifikasi. Pengujian database menggunakan PostgreSQL lokal melalui PGlite dengan skema Auth minimal khusus tes. Ini bukan koneksi ke akun Supabase Anda. Tidak ada migrasi yang dijalankan pada database produksi, tidak ada akun nyata yang dibuat, dan tidak ada perubahan pada backend ML.

Referensi teknis: [Supabase user management](https://supabase.com/docs/guides/auth/managing-user-data), [Admin updateUserById](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid).
