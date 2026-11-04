# Analisis dan perubahan Pare Hurip 3.0

## Proyek asal

Implementasi meneruskan source `pare-hurip-dev-v2-main(1).zip`, bukan aplikasi terpisah. Framework tetap Next.js 15 App Router, React 19, TypeScript, Tailwind CSS 4, Supabase Auth/PostgreSQL, Recharts, dan SheetJS (`xlsx`). Package manager tetap pnpm. Aset logo, halaman publik, peta, visualisasi KSA, modul harga beras, serta route proxy prediksi lama dipertahankan.

Autentikasi lama memakai Supabase Auth dengan profil `public.profiles` (`id`, `name`, `email`, `role`, `created_at`). Service-role client tetap hanya di server. Tidak ada tabel akun atau penyimpanan password baru. Database awal persis dari SQL yang diberikan terdapat dalam `supabase/000_schema_awal_database_kosong.sql`.

Arsip desain berisi gambar PNG. Gambar Copy yang sama diperlakukan sebagai referensi duplikat. Implementasi memakai warna hijau, sidebar/header, kartu ringkasan, filter, tabel, formulir, modal, dan alur tiga tahap sesuai struktur referensi. Modal edit luas tanam/pengguna mengikuti komponen bersama. Status pemeriksaan visual dijelaskan pada laporan pengujian.

## Keputusan dan asumsi

- Periode bulanan, satu baris per kecamatan/bulan, DATE pada hari pertama. Luas dalam hektare dengan NUMERIC(12,2); nol valid dan dibedakan dari data yang belum ada.
- Referensi `kecamatan` khusus modul baru, terpisah dari `districts` pada KSA. Perubahan kode melakukan cascade; penghapusan referensi terpakai ditolak.
- Admin mengelola luas tanam/referensi. Hanya superadmin mengelola akun. Form/API tidak memberikan perubahan role; akun baru selalu admin dan maksimal satu superadmin.
- Empat menu utama mengikuti permintaan. Pengaturan dihapus. Fitur KSA dibuka melalui tombol Modul KSA; dashboard dan referensi lamanya memiliki route tersendiri.
- Statistik dan aktivitas diambil dari database. `activity_log` bersama diperluas dengan `details` dan `request_key` untuk audit/idempotensi; kolom `module` memisahkan aktivitas. Tidak ada statistik dummy.
- Impor berhasil berarti satu proses dengan setidaknya satu baris tersimpan dan tanpa kegagalan teknis. Invalid/duplikat dapat dilewati. Proses seluruhnya dilewati atau mengalami kegagalan teknis sebagian tidak dihitung sebagai impor berhasil.
- Import dibatasi 10 MB/5.000 baris dan mendukung xlsx/xls. Ekspor mencakup seluruh hasil filter/pencarian; lebih dari 100.000 baris ditolak dengan pesan, bukan dipotong.
- File impor, sumber_input, dan nama_file tidak disimpan pada tabel luas tanam. Identitas permintaan dan ringkasan hasil tersimpan di log.
- Modul luas tanam tidak mengubah model ML. Backend ML yang disediakan tetap paket terpisah untuk fitur prediksi lama.

## Struktur implementasi

| Lokasi | Tanggung jawab |
|---|---|
| `components/land/` | Dashboard, daftar, form/modal, wilayah, pengguna, dan impor |
| `lib/land/domain.ts` | Tipe, validasi, normalisasi angka/periode, dan preview |
| `lib/land/server.ts` | Pemeriksaan sesi/role, origin mutasi, RPC, dan pesan error |
| `lib/land/excel.ts` | Parser, template, dan file ekspor pada server |
| `app/api/admin/land/` | API data, options, dashboard, import, template, export |
| `app/api/admin/kecamatan/` | API referensi modul baru |
| `app/api/admin/users/` | Admin Auth dengan sinkronisasi profil dan verifikasi hasil |
| `supabase/migrations/001_luas_tanam.sql` | Constraint, indeks, RLS/grant, trigger Auth, RPC, dan audit |
| `tests/` | Tes SQL, validasi, render komponen, dan interaksi form |

Operasi data dan pencatatan log dalam satu transaksi SQL. Hak tulis langsung tabel baru dicabut dari klien; RPC memeriksa identitas. Pemeriksaan API tidak menggantikan pemeriksaan database. Role berasal dari profil, bukan metadata pengguna. Trigger Auth membuat profil hanya bagi akun yang ditandai oleh backend berhak istimewa; signup publik tidak otomatis menjadi admin.

Impor melakukan validasi kembali dan mengunci ID proses pada transaksi, sehingga retry yang sama tidak menambah data/log. Constraint unik menangani benturan kecamatan–bulan. Hasil backend menjadi sumber hitungan halaman Selesai. Ekspor menggunakan fungsi STABLE agar pengambilan seluruh halaman berada pada snapshot yang sama.

Akun superadmin dilindungi oleh API serta trigger penghapusan Auth. Akun penginput data ditahan oleh foreign key. Menghapus akun yang tidak terkait data melakukan cascade ke profil, sedangkan log mempertahankan nama pelaku dan mengosongkan actor_id.

Migrasi tidak dijalankan otomatis. Pada konflik superadmin ganda atau identitas KSA duplikat, migrasi berhenti agar data lama ditinjau; tidak ada deduplikasi atau penghapusan akun otomatis.

## Rute yang berubah

| Tujuan | Route |
|---|---|
| Dashboard luas tanam | `/admin/dashboard` |
| Data luas tanam | `/admin/land-data` |
| Tambah manual | `/admin/land-data/new` |
| Impor luas tanam | `/admin/land-data/import` |
| Referensi kecamatan luas tanam | `/admin/region-reference` |
| Pengguna Admin | `/admin/admin-users` |
| Dashboard KSA lama | `/admin/ksa-dashboard` |
| Referensi districts lama | `/admin/ksa-region-reference` |
| Data/impor KSA lama | `/admin/ksa-data`, `/admin/ksa-import` |

## Daftar perubahan file

Perbandingan terhadap ZIP source lama. File dependency terpasang, rahasia environment, cache, dan hasil build dikecualikan. `next-env.d.ts` disertakan sebagai deklarasi awal agar pemeriksaan tipe tidak membutuhkan hasil build sebelumnya.

### Ditambah (37)

- `.env.example`
- `PANDUAN_MULAI.md`
- `app/admin/ksa-dashboard/page.tsx`
- `app/admin/ksa-region-reference/page.tsx`
- `app/admin/land-data/import/page.tsx`
- `app/admin/land-data/new/page.tsx`
- `app/admin/land-data/page.tsx`
- `app/api/admin/kecamatan/route.ts`
- `app/api/admin/land/dashboard/route.ts`
- `app/api/admin/land/export/route.ts`
- `app/api/admin/land/import/route.ts`
- `app/api/admin/land/options/route.ts`
- `app/api/admin/land/route.ts`
- `app/api/admin/land/template/route.ts`
- `components/land/AdminUsers.tsx`
- `components/land/Common.tsx`
- `components/land/Dashboard.tsx`
- `components/land/ImportLand.tsx`
- `components/land/LandData.tsx`
- `components/land/LandForm.tsx`
- `components/land/Regions.tsx`
- `docs/ANALISIS_DAN_PERUBAHAN.md`
- `docs/HASIL_PENGUJIAN.md`
- `lib/land/client.ts`
- `lib/land/domain.ts`
- `lib/land/excel.ts`
- `lib/land/server.ts`
- `next-env.d.ts`
- `supabase/000_schema_awal_database_kosong.sql`
- `supabase/002_bootstrap_superadmin.sql`
- `supabase/migrations/001_luas_tanam.sql`
- `tests/database.test.ts`
- `tests/domain.test.ts`
- `tests/interactions.test.tsx`
- `tests/register.mjs`
- `tests/tsconfig.json`
- `tests/ui.test.tsx`

### Diubah (16)

- `README.id.md`
- `README.md`
- `app/admin/admin-users/page.tsx`
- `app/admin/dashboard/page.tsx`
- `app/admin/region-reference/page.tsx`
- `app/api/admin/users/route.ts`
- `app/globals.css`
- `components/layout/AdminLayout.tsx`
- `components/pages/admin-page/AdminAuthContext.tsx`
- `components/pages/admin-page/Login.tsx`
- `eslint.config.mjs`
- `lib/supabase/client.ts`
- `middleware.ts`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`

### Dihapus (2)

- `app/admin/settings/page.tsx`
- `components/pages/admin-page/Settings.tsx`

## Menjalankan dan memverifikasi

Ikuti [PANDUAN_MULAI.md](../PANDUAN_MULAI.md), kemudian baca [HASIL_PENGUJIAN.md](HASIL_PENGUJIAN.md) untuk hasil aktual dan batas pengujian. ZIP tidak menyertakan node_modules, .env.local, kredensial, atau build .next; pasang dependency dengan lockfile sebelum menjalankan.
