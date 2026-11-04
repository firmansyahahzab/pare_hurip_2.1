# Halaman publik Luas Lahan Tanam

Halaman baru: http://localhost:3000/luas-lahan-tanam.
Menu **Luas Lahan Tanam** tersedia di navigasi desktop dan ponsel, termasuk dari beranda.

## Mengaktifkan pada proyek yang adminnya sudah berjalan

1. Gunakan source proyek ini dan konfigurasi `.env.local` proyek Anda yang sudah terhubung ke Supabase. Jangan membagikan file rahasia tersebut.
2. Di SQL Editor Supabase yang sama dengan halaman admin, jalankan **`supabase/migrations/002_luas_tanam_public.sql`**. Jalankan setelah migrasi `001_luas_tanam.sql`; tidak perlu mengulang schema awal pada database yang sudah berjalan. Migrasi baru tidak menghapus data dan dapat dijalankan ulang.
3. Pasang dependensi jika belum tersedia: `pnpm install --frozen-lockfile` (menggunakan versi pnpm pada `package.json`). Alternatif: `npm install`.
4. Jalankan `pnpm dev` atau `npm run dev`, lalu buka URL halaman di atas.
5. Tambahkan/edit/impor data di **Admin → Data Luas Lahan Tanam**. Kembali ke tab halaman publik atau klik **Perbarui data**. Pilih tahun/bulan/kecamatan yang sesuai dan klik **Terapkan Filter**.

Untuk database baru, ikuti panduan awal proyek terlebih dahulu, kemudian jalankan migrasi publik di langkah 2.

## Perilaku data

- Sumber yang sama dengan admin: tabel `kecamatan` dan `luas_lahan_tanam`. Tidak ada data contoh dalam halaman produksi.
- Tahun awal/reset mengikuti tahun terbaru yang memiliki data. Bila database kosong, menggunakan tahun berjalan di Asia/Jakarta.
- Filter diterapkan ke total hektare, jumlah kecamatan, periode data, kedua grafik, tabel, insight, dan unduhan CSV.
- Total hektare adalah penjumlahan luas tanam bulanan, bukan luas fisik lahan unik. Lahan yang ditanam kembali dapat tercatat pada bulan yang berbeda.
- Data kosong dibedakan dari nilai 0 ha. Persentase tidak tersedia bila total nol atau tidak ada data.
- Tabel menampilkan 5 kecamatan per halaman. Unduhan CSV mencakup seluruh kecamatan yang sesuai filter, termasuk yang belum memiliki data, dan dapat dibuka dengan Excel.
- Tanggal pembaruan adalah aktivitas terbaru modul luas tanam secara keseluruhan; waktu ditampilkan dalam WIB.
- Label instansi mengikuti desain: Dinas Pertanian Kota Tasikmalaya.
- Halaman memuat ulang data saat tab mendapat fokus dan menyediakan tombol pembaruan manual; bukan langganan Supabase Realtime.

## Akses

`GET /api/public/land?year=2024&month=1&district=kode-wilayah` dapat dibaca tanpa login.
Parameter bersifat opsional. Endpoint menggunakan RPC `ph_public_lahan_dashboard` dengan anon key yang sudah digunakan proyek.
RPC hanya mengembalikan agregat dan referensi wilayah. Identitas admin, email, catatan internal, dan rincian aktivitas tidak dikirim ke publik.
Hak baca tabel privat serta hak tambah/edit/hapus admin tetap seperti sebelumnya; tidak perlu memberikan service-role key ke browser.

## Pemeriksaan

- `npm run typecheck`
- `npm test` — termasuk uji database PostgreSQL lokal melalui PGlite untuk alur input/edit/impor/hapus admin → agregat publik, filter, pembatasan akses, nilai nol, dan CSV.
- `npm run build`

Pengujian visual tambahan: jalankan aplikasi, lalu `node tests/browser-public-land.mjs` (Edge di Windows). Gunakan environment `QA_ORIGIN` bila port aplikasi berbeda dan `BROWSER_PATH` untuk lokasi browser alternatif. Pengujian ini memakai profil browser terpisah dan mencegat API dengan database PGlite berisi data uji; tidak mengubah database Supabase. Tangkapan layar disimpan di `artifacts/`.

File utama yang ditambahkan: halaman di `app/(public)/luas-lahan-tanam`, komponen `components/land/PublicLandDashboard.tsx` beserta CSS module, API `app/api/public/land/route.ts`, helper `lib/land/public.ts`, dan migrasi `002_luas_tanam_public.sql`.
