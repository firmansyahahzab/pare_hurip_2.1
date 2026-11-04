# Hasil pengujian Pare Hurip 3.0

Tanggal pemeriksaan: 25 Oktober 2026. Lingkungan: Node.js v24.22.1, Next.js 15.5.22. Dependency mengikuti `pnpm-lock.yaml`; package manager yang ditetapkan proyek adalah pnpm 11.25.0.

## Pemeriksaan yang dijalankan

| Pemeriksaan | Perintah skrip proyek | Hasil |
|---|---|---|
| TypeScript | `pnpm typecheck` | Lulus, tidak ada kesalahan tipe |
| ESLint | `pnpm lint` | Lulus, tidak ada kesalahan/warning lint |
| Tes otomatis | `pnpm test` | 19 tes lulus; 0 gagal, dilewati, atau dibatalkan |
| Build produksi | `pnpm build` | Lulus; kompilasi, validasi tipe/lint, pembuatan 34 halaman, dan build traces selesai |
| Pengaturan di modul | Pencarian source navigasi/admin dan daftar route build | Tidak ada tautan `/admin/settings`, menu Pengaturan, maupun route settings |

Pada lingkungan pengerjaan, executable lokal dipanggil langsung: `node_modules/.bin/tsc --noEmit`, `node_modules/.bin/eslint .`, `node --import ./tests/register.mjs --test tests/*.test.ts tests/*.test.tsx`, dan `node_modules/.bin/next build`. Perintah tersebut menjalankan isi skrip pada tabel di atas tanpa wrapper package manager.

Build menampilkan dua peringatan cache internal Webpack tentang serialisasi string besar. Build tetap selesai dengan exit code 0. Halaman peta KSA lama mempunyai bundle besar; optimasi fitur lama bukan bagian perubahan ini.

## Cakupan tes

### Database — `tests/database.test.ts`

PostgreSQL berjalan lokal melalui PGlite. Skema `auth.users`, fungsi `auth.uid()`, dan role dibuat khusus untuk pengujian; kemudian SQL awal dan migrasi yang disertakan dijalankan. Data uji terisolasi dan tidak menjadi seed aplikasi.

- Migrasi dapat dijalankan dua kali; akun signup publik tidak otomatis memperoleh profil admin; batas satu superadmin berlaku.
- Tambah/edit/hapus data dan constraint kecamatan–periode; angka nol sah.
- RLS dan hak tabel menolak penulisan langsung, kenaikan peran, serta pemalsuan log impor oleh klien.
- Kecamatan yang dipakai tidak dapat dihapus; perubahan kode mengikuti relasi dengan cascade.
- Impor menangani duplikat database/file, baris invalid, hitungan hasil aktual, validasi nilai NULL, dan permintaan ulang dengan ID yang sama.
- Dashboard membedakan nol dari tidak ada data, mempertahankan tren satu tahun, menghitung proses impor, dan tetap konsisten setelah kode kecamatan berubah.
- Ekspor diuji pada 1.102 baris, termasuk filter/pencarian dan hasil yang melebihi halaman tabel.
- Pengguna anonim/tanpa profil ditolak pada RPC baru; akses baca publik KSA tetap tersedia.
- Trigger Auth menyinkronkan profil secara atomik dan rollback ketika constraint profil gagal; superadmin dan akun penginput data terlindungi.
- Penghapusan admin tanpa data terkait menghapus profil serta mempertahankan log dengan actor_id kosong.

### Validasi — `tests/domain.test.ts`

- Format desimal Indonesia, nol, ribuan, angka negatif/NaN, batas nilai dan presisi.
- Periode bulanan dan panjang keterangan.
- Preview memisahkan valid/invalid/duplikat tanpa menulis data.
- Baris invalid pertama tidak menghalangi baris valid berikutnya.
- Judul kolom, normalisasi bulan, dan kode berawalan nol.

### Komponen — `tests/ui.test.tsx` dan `tests/interactions.test.tsx`

- Render modal edit menampilkan nilai data terpilih dan tombol Batal bukan submit.
- Modal berhasil mempunyai judul aksesibel, pesan, dan tombol Tutup.
- Interaksi form di JSDOM: Batal tidak mengirim permintaan; kegagalan mempertahankan input; klik cepat tidak menggandakan penyimpanan; dialog tidak dapat dibatalkan ketika sibuk; callback berhasil menunggu jawaban server.
- Unmount mengembalikan fokus ke pemicu dan memulihkan scroll halaman.

Jumlah 19 mencakup satu tes induk database beserta 10 subtesnya, 5 tes domain, 2 tes render, dan 1 tes interaksi. JSDOM memakai polyfill showModal/close; tes ini tidak menguji focus trap native atau tampilan browser sebenarnya.

## Batas verifikasi

- Tidak ada kredensial proyek Supabase nyata. Login, Supabase Auth Admin API, PostgREST, email, dan penerapan policy pada proyek Anda belum diuji end-to-end.
- PGlite memeriksa SQL dan trigger pada PostgreSQL lokal dengan Auth minimal, bukan seluruh layanan Supabase. Setelah menjalankan migrasi pada proyek percobaan, lakukan checklist berikut.
- Pemeriksaan visual desktop/tablet/ponsel dan navigasi keyboard pada browser asli belum selesai. Runner preview lingkungan tidak cocok dengan argumen CLI Next.js. CSS responsif, struktur dialog, tipe, dan interaksi komponen diperiksa melalui source/tes; tidak ada klaim kesesuaian pixel-perfect.
- Backend ML asli tetap terpisah dan tidak dijalankan; akurasi model, ketersediaan endpoint, dan integrasi prediksi langsung belum diverifikasi.
- Belum ada uji beban, lomba permintaan pada layanan Supabase nyata, atau benchmark batas maksimal 100.000 baris ekspor/5.000 baris impor. Tes ekspor menggunakan 1.102 baris.
- Tidak ada perubahan yang dijalankan pada database produksi atau akun nyata.

## Checklist setelah konfigurasi lokal

1. Jalankan migrasi pada database percobaan dan bootstrap superadmin sesuai `PANDUAN_MULAI.md`.
2. Login sebagai superadmin; buat admin, edit nama/email/password opsional, lalu login sebagai admin tersebut. Pastikan admin ditolak dari API/halaman Pengguna Admin.
3. Tambah kecamatan dan data bulan tertentu dengan luas 0 serta bilangan desimal. Edit, batalkan edit, lalu hapus dengan konfirmasi. Pastikan modal berhasil muncul hanya sesudah penyimpanan selesai.
4. Uji hapus kecamatan/akun yang masih terkait data dan pastikan ditolak. Pastikan superadmin tidak bisa dihapus.
5. Unduh template, isi baris valid/invalid/duplikat, lihat preview, lalu simpan. Cocokkan hitungan hasil, tabel, dan jumlah proses impor di dashboard.
6. Ubah filter/pencarian, ekspor, dan cocokkan seluruh hasil. Periksa bulan kosong dibandingkan luas 0 di grafik.
7. Uji desktop, tablet, ponsel; navigasi Tab/Shift+Tab/Escape pada dialog; perubahan tema.
8. Buka kembali halaman publik, modul KSA, serta prediksi dengan backend ML lama yang aktif.
