-- Jalankan sekali setelah membuat user melalui Supabase Authentication > Users.
-- Ubah dua nilai di bawah. Tidak menyimpan password dalam tabel aplikasi.
DO $$
DECLARE
 v_email text := 'firmansyahahzab@gmail.com';
 v_name text := 'afiee';
 v_id uuid;
BEGIN
 IF v_email = 'GANTI_EMAIL_SUPERADMIN' OR v_name = 'GANTI_NAMA_SUPERADMIN' THEN
  RAISE EXCEPTION 'Ganti email dan nama pada skrip bootstrap terlebih dahulu.';
 END IF;
 SELECT id INTO v_id FROM auth.users WHERE lower(email)=lower(trim(v_email));
 IF v_id IS NULL THEN RAISE EXCEPTION 'User belum ada di Supabase Auth. Buat user terlebih dahulu.'; END IF;
 IF EXISTS(SELECT 1 FROM public.profiles WHERE role='superadmin' AND id<>v_id) THEN
  RAISE EXCEPTION 'Superadmin lain sudah ada. Tidak ada akun yang diubah.';
 END IF;
 INSERT INTO public.profiles(id,name,email,role) VALUES(v_id,trim(v_name),lower(trim(v_email)),'superadmin')
 ON CONFLICT(id) DO UPDATE SET name=excluded.name,email=excluded.email,role='superadmin';
END $$;
