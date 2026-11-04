-- Jalankan sesudah schema awal. Transaksi ini tidak menghapus data.
BEGIN;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.profiles WHERE role::text = 'superadmin') > 1 THEN
    RAISE EXCEPTION 'Ada lebih dari satu superadmin. Tinjau akun secara manual sebelum migrasi.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.data_ksa GROUP BY segment_id, subsegment, periode HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Ada duplikat segment_id, subsegment, periode pada data KSA. Tinjau sebelum migrasi; tidak ada data dihapus.';
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS ph_single_superadmin ON public.profiles (role) WHERE role = 'superadmin';
CREATE UNIQUE INDEX IF NOT EXISTS ph_ksa_identity ON public.data_ksa(segment_id, subsegment, periode);

CREATE TABLE IF NOT EXISTS public.kecamatan (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 nama_kecamatan varchar(100) NOT NULL CHECK(length(trim(nama_kecamatan)) > 0),
 kode_wilayah varchar(20) NOT NULL UNIQUE CHECK(length(trim(kode_wilayah)) > 0),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.luas_lahan_tanam (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kode_wilayah varchar(20) NOT NULL,
 periode date NOT NULL CHECK(isfinite(periode) AND extract(day from periode)=1),
 luas_ha numeric(12,2) NOT NULL CHECK(luas_ha >= 0 AND luas_ha <> 'NaN'::numeric),
 keterangan varchar(500), created_by uuid NOT NULL DEFAULT auth.uid(),
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT luas_lahan_kecamatan_fkey FOREIGN KEY(kode_wilayah) REFERENCES public.kecamatan(kode_wilayah) ON DELETE RESTRICT,
 CONSTRAINT luas_lahan_penginput_fkey FOREIGN KEY(created_by) REFERENCES public.profiles(id) ON DELETE RESTRICT,
 CONSTRAINT unik_kecamatan_periode UNIQUE(kode_wilayah, periode)
);
ALTER TABLE public.luas_lahan_tanam DROP CONSTRAINT IF EXISTS luas_lahan_kecamatan_fkey;
ALTER TABLE public.luas_lahan_tanam ADD CONSTRAINT luas_lahan_kecamatan_fkey FOREIGN KEY(kode_wilayah)
 REFERENCES public.kecamatan(kode_wilayah) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY(id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.activity_log DROP CONSTRAINT IF EXISTS activity_log_actor_id_fkey;
ALTER TABLE public.activity_log ADD CONSTRAINT activity_log_actor_id_fkey FOREIGN KEY(actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.activity_log ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.activity_log ADD COLUMN IF NOT EXISTS request_key uuid;
CREATE UNIQUE INDEX IF NOT EXISTS ph_activity_request ON public.activity_log(request_key) WHERE request_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_luas_lahan_created_by ON public.luas_lahan_tanam(created_by);
CREATE INDEX IF NOT EXISTS ph_lahan_period ON public.luas_lahan_tanam(periode, kode_wilayah);
CREATE INDEX IF NOT EXISTS ph_activity_module ON public.activity_log(module, created_at DESC);

CREATE OR REPLACE FUNCTION public.ph_role() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT role::text FROM public.profiles WHERE id = (SELECT auth.uid());
$$;
CREATE OR REPLACE FUNCTION public.ph_assert_admin() RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF coalesce(public.ph_role(),'') NOT IN ('admin','superadmin') THEN
  RAISE EXCEPTION 'Akses admin diperlukan.' USING ERRCODE = '42501';
 END IF;
 RETURN auth.uid();
END $$;
CREATE OR REPLACE FUNCTION public.ph_log(p_action text, p_description text, p_details jsonb DEFAULT '{}'::jsonb, p_request uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor uuid := public.ph_assert_admin();
BEGIN
 INSERT INTO public.activity_log(actor_id,actor_name,action_type,description,module,details,request_key)
 SELECT v_actor, name, p_action, p_description, 'luas_lahan_tanam', p_details, p_request FROM public.profiles WHERE id=v_actor;
END $$;

-- Auth adalah sumber identitas. App metadata hanya bisa ditulis administrator Auth.
-- Signup publik tidak otomatis mendapatkan profil admin.
CREATE OR REPLACE FUNCTION public.ph_sync_auth_profile() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF TG_OP = 'INSERT' THEN
  IF NEW.raw_app_meta_data->>'parehurip_admin' = 'true' THEN
   INSERT INTO public.profiles(id,name,email,role) VALUES(NEW.id,coalesce(nullif(trim(NEW.raw_user_meta_data->>'name'),''),NEW.email),NEW.email,'admin');
  END IF;
 ELSE
  UPDATE public.profiles SET email=NEW.email,
   name=coalesce(nullif(trim(NEW.raw_user_meta_data->>'name'),''),name) WHERE id=NEW.id;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS ph_sync_auth_profile ON auth.users;
CREATE TRIGGER ph_sync_auth_profile AFTER INSERT OR UPDATE OF email, raw_user_meta_data ON auth.users
 FOR EACH ROW EXECUTE FUNCTION public.ph_sync_auth_profile();
CREATE OR REPLACE FUNCTION public.ph_protect_superadmin() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.profiles WHERE id=OLD.id AND role='superadmin') THEN
  RAISE EXCEPTION 'Akun superadmin tidak boleh dihapus.' USING ERRCODE='42501';
 END IF;
 RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS ph_protect_superadmin ON auth.users;
CREATE TRIGGER ph_protect_superadmin BEFORE DELETE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.ph_protect_superadmin();

-- Batasi hak tabel, termasuk bila ada policy permisif yang ditambahkan sebelumnya.
REVOKE ALL ON public.profiles,public.kecamatan,public.luas_lahan_tanam FROM anon,authenticated;
GRANT SELECT ON public.profiles,public.kecamatan,public.luas_lahan_tanam TO authenticated;
GRANT SELECT ON public.districts,public.data_ksa,public.rice_types,public.rice_prices TO anon,authenticated;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON public.districts,public.data_ksa,public.rice_types,public.rice_prices FROM anon,authenticated;
REVOKE ALL ON public.activity_log FROM anon,authenticated;
GRANT SELECT,INSERT ON public.activity_log TO authenticated;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['profiles','districts','data_ksa','rice_types','rice_prices','activity_log','kecamatan','luas_lahan_tanam'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 END LOOP;
END $$;
DROP POLICY IF EXISTS ph_profile_read ON public.profiles;
CREATE POLICY ph_profile_read ON public.profiles FOR SELECT TO authenticated USING(id=(SELECT auth.uid()) OR (SELECT public.ph_role())='superadmin');
DROP POLICY IF EXISTS ph_profile_boundary ON public.profiles;
CREATE POLICY ph_profile_boundary ON public.profiles AS RESTRICTIVE FOR SELECT TO authenticated USING(id=(SELECT auth.uid()) OR (SELECT public.ph_role())='superadmin');
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['districts','data_ksa','rice_types','rice_prices'] LOOP
  EXECUTE format('DROP POLICY IF EXISTS ph_public_read ON public.%I',t);
  EXECUTE format('CREATE POLICY ph_public_read ON public.%I FOR SELECT TO anon,authenticated USING(true)',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['kecamatan','luas_lahan_tanam','activity_log'] LOOP
  EXECUTE format('DROP POLICY IF EXISTS ph_admin_read ON public.%I',t);
  EXECUTE format('CREATE POLICY ph_admin_read ON public.%I FOR SELECT TO authenticated USING((SELECT public.ph_role()) IN (''admin'',''superadmin''))',t);
  EXECUTE format('DROP POLICY IF EXISTS ph_admin_boundary ON public.%I',t);
  EXECUTE format('CREATE POLICY ph_admin_boundary ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING((SELECT public.ph_role()) IN (''admin'',''superadmin''))',t);
 END LOOP;
END $$;
-- Kompatibilitas pencatatan KSA lama. Klien tidak boleh memalsukan event luas tanam.
DROP POLICY IF EXISTS ph_legacy_log ON public.activity_log;
CREATE POLICY ph_legacy_log ON public.activity_log FOR INSERT TO authenticated WITH CHECK(
 actor_id=(SELECT auth.uid()) AND (SELECT public.ph_role()) IN ('admin','superadmin')
 AND module IN ('import_data','kelola_data','referensi_wilayah','model_prediksi','pengguna_admin') AND request_key IS NULL AND details='{}'::jsonb);
DROP POLICY IF EXISTS ph_legacy_log_boundary ON public.activity_log;
CREATE POLICY ph_legacy_log_boundary ON public.activity_log AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(
 actor_id=(SELECT auth.uid()) AND (SELECT public.ph_role()) IN ('admin','superadmin')
 AND module IN ('import_data','kelola_data','referensi_wilayah','model_prediksi','pengguna_admin') AND request_key IS NULL AND details='{}'::jsonb);

CREATE OR REPLACE FUNCTION public.ph_lahan_options() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 PERFORM public.ph_assert_admin();
 RETURN jsonb_build_object('regions',coalesce((SELECT jsonb_agg(k ORDER BY nama_kecamatan) FROM public.kecamatan k),'[]'::jsonb),
 'years', (SELECT jsonb_agg(y ORDER BY y DESC) FROM (SELECT DISTINCT extract(year FROM periode)::int y FROM public.luas_lahan_tanam UNION SELECT extract(year FROM current_date)::int) x));
END $$;
CREATE OR REPLACE FUNCTION public.ph_lahan_list(p_filter jsonb DEFAULT '{}'::jsonb,p_page int DEFAULT 1,p_size int DEFAULT 10)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE result jsonb; y int := nullif(p_filter->>'year','')::int; m int := nullif(p_filter->>'month','')::int;
BEGIN
 PERFORM public.ph_assert_admin();
 IF p_page IS NULL OR p_size IS NULL OR p_page<1 OR p_size<1 OR p_size>1000 OR (y IS NOT NULL AND y NOT BETWEEN 1900 AND 9999) OR (m IS NOT NULL AND m NOT BETWEEN 1 AND 12) THEN RAISE EXCEPTION 'Filter tidak valid.' USING ERRCODE='22023'; END IF;
 WITH filtered AS (
  SELECT l.*,k.nama_kecamatan FROM public.luas_lahan_tanam l JOIN public.kecamatan k USING(kode_wilayah)
  WHERE (y IS NULL OR extract(year FROM l.periode)=y) AND (m IS NULL OR extract(month FROM l.periode)=m)
  AND (coalesce(p_filter->>'district','')='' OR l.kode_wilayah=p_filter->>'district')
  AND (coalesce(p_filter->>'search','')='' OR position(lower(p_filter->>'search') IN lower(k.nama_kecamatan))>0)
 ), paged AS (SELECT * FROM filtered ORDER BY periode DESC,nama_kecamatan,id LIMIT p_size OFFSET (p_page-1)*p_size)
 SELECT jsonb_build_object('count',(SELECT count(*) FROM filtered),'rows',coalesce((SELECT jsonb_agg(p) FROM paged p),'[]'::jsonb)) INTO result;
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.ph_lahan_save(p_id uuid,p_data jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a uuid:=public.ph_assert_admin(); v_id uuid; v_date date; v_area numeric; v_code text:=trim(p_data->>'kode_wilayah');
BEGIN
 IF coalesce(p_data->>'periode','') !~ '^[0-9]{4}-(0[1-9]|1[0-2])-01$' OR substring(p_data->>'periode',1,4)::int NOT BETWEEN 1900 AND 9999 THEN RAISE EXCEPTION 'Periode harus bulan dan tahun yang valid.' USING ERRCODE='22023'; END IF;
 IF coalesce(p_data->>'luas_ha','') !~ '^[0-9]+(\.[0-9]{1,2})?$' THEN RAISE EXCEPTION 'Luas harus angka nonnegatif, maksimum dua desimal.' USING ERRCODE='22023'; END IF;
 v_date := (p_data->>'periode')::date; v_area := (p_data->>'luas_ha')::numeric;
 IF v_area > 9999999999.99 OR length(coalesce(p_data->>'keterangan',''))>500 THEN RAISE EXCEPTION 'Luas atau keterangan melebihi batas.' USING ERRCODE='22023'; END IF;
 IF p_id IS NULL THEN
  INSERT INTO public.luas_lahan_tanam(kode_wilayah,periode,luas_ha,keterangan,created_by)
   VALUES(v_code,v_date,v_area,nullif(trim(p_data->>'keterangan'),''),a) RETURNING id INTO v_id;
 ELSE
  UPDATE public.luas_lahan_tanam SET kode_wilayah=v_code,periode=v_date,luas_ha=v_area,keterangan=nullif(trim(p_data->>'keterangan'),'') WHERE id=p_id RETURNING id INTO v_id;
  IF v_id IS NULL THEN RAISE EXCEPTION 'Data tidak ditemukan.' USING ERRCODE='P0002'; END IF;
 END IF;
 PERFORM public.ph_log(CASE WHEN p_id IS NULL THEN 'add_land' ELSE 'edit_land' END,
  CASE WHEN p_id IS NULL THEN 'Menambahkan' ELSE 'Mengubah' END || ' data luas tanam '||v_code||' periode '||v_date, jsonb_build_object('id',v_id,'kode_wilayah',v_code,'periode',v_date));
 RETURN v_id;
END $$;
CREATE OR REPLACE FUNCTION public.ph_lahan_delete(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.luas_lahan_tanam;
BEGIN
 PERFORM public.ph_assert_admin();
 DELETE FROM public.luas_lahan_tanam WHERE id=p_id RETURNING * INTO v;
 IF NOT FOUND THEN RAISE EXCEPTION 'Data tidak ditemukan.' USING ERRCODE='P0002'; END IF;
 PERFORM public.ph_log('delete_land','Menghapus data luas tanam '||v.kode_wilayah||' periode '||v.periode,to_jsonb(v));
END $$;
CREATE OR REPLACE FUNCTION public.ph_kecamatan_save(p_id uuid,p_code text,p_name text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
 PERFORM public.ph_assert_admin();
 IF length(trim(coalesce(p_code,''))) NOT BETWEEN 1 AND 20 OR length(trim(coalesce(p_name,''))) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Kode (maks. 20) dan nama kecamatan (maks. 100) wajib diisi.' USING ERRCODE='22023'; END IF;
 IF p_id IS NULL THEN INSERT INTO public.kecamatan(kode_wilayah,nama_kecamatan) VALUES(trim(p_code),trim(p_name)) RETURNING id INTO v_id;
 ELSE UPDATE public.kecamatan SET kode_wilayah=trim(p_code),nama_kecamatan=trim(p_name) WHERE id=p_id RETURNING id INTO v_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Kecamatan tidak ditemukan.' USING ERRCODE='P0002'; END IF;
 END IF;
 PERFORM public.ph_log(CASE WHEN p_id IS NULL THEN 'add_region' ELSE 'edit_region' END,'Menyimpan kecamatan '||trim(p_name)||' ('||trim(p_code)||')');
 RETURN v_id;
END $$;
CREATE OR REPLACE FUNCTION public.ph_kecamatan_delete(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.kecamatan;
BEGIN
 PERFORM public.ph_assert_admin();
 DELETE FROM public.kecamatan WHERE id=p_id RETURNING * INTO v;
 IF NOT FOUND THEN RAISE EXCEPTION 'Kecamatan tidak ditemukan.' USING ERRCODE='P0002'; END IF;
 PERFORM public.ph_log('delete_region','Menghapus kecamatan '||v.nama_kecamatan||' ('||v.kode_wilayah||')');
END $$;
CREATE OR REPLACE FUNCTION public.ph_lahan_existing(p_rows jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 PERFORM public.ph_assert_admin();
 IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(p_rows)>5000 THEN RAISE EXCEPTION 'Maksimum 5.000 baris per impor.' USING ERRCODE='22023'; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('kode_wilayah',l.kode_wilayah,'periode',l.periode)) FROM public.luas_lahan_tanam l WHERE EXISTS(
  SELECT 1 FROM jsonb_array_elements(p_rows) r WHERE r->>'kode_wilayah'=l.kode_wilayah AND r->>'periode'=l.periode::text)),'[]'::jsonb);
END $$;
CREATE OR REPLACE FUNCTION public.ph_lahan_import(p_request uuid,p_rows jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a uuid:=public.ph_assert_admin(); oldlog public.activity_log; r jsonb; v_date date; v_area numeric; v_id uuid;
 v_name text; v_region_id uuid; v_status text; v_reason text; n int:=0; skipped int:=0; failed int:=0; results jsonb:='[]'; saved_records jsonb:='[]'; result jsonb; fingerprint text;
BEGIN
 IF p_request IS NULL OR jsonb_typeof(p_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(p_rows) NOT BETWEEN 1 AND 5000 THEN RAISE EXCEPTION 'Permintaan impor tidak valid (1–5.000 baris).' USING ERRCODE='22023'; END IF;
 fingerprint:=md5(p_rows::text);
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 SELECT * INTO oldlog FROM public.activity_log WHERE request_key=p_request;
 IF FOUND THEN
  IF oldlog.actor_id IS DISTINCT FROM a OR (oldlog.details->>'fingerprint') IS DISTINCT FROM fingerprint THEN RAISE EXCEPTION 'ID proses impor sudah digunakan untuk permintaan berbeda.' USING ERRCODE='22023'; END IF;
  RETURN oldlog.details->'result';
 END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
  v_status:='saved'; v_reason:=NULL; v_id:=NULL;
  BEGIN
   SELECT nama_kecamatan,id INTO v_name,v_region_id FROM public.kecamatan WHERE kode_wilayah=r->>'kode_wilayah' FOR KEY SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Kode kecamatan belum terdaftar.' USING ERRCODE='22023'; END IF;
   IF lower(trim(coalesce(r->>'nama_kecamatan','')))<>lower(trim(v_name)) THEN RAISE EXCEPTION 'Kode dan nama kecamatan tidak cocok.' USING ERRCODE='22023'; END IF;
   IF coalesce(r->>'periode','') !~ '^[0-9]{4}-(0[1-9]|1[0-2])-01$' OR substring(r->>'periode',1,4)::int NOT BETWEEN 1900 AND 9999 THEN RAISE EXCEPTION 'Periode tidak valid.' USING ERRCODE='22023'; END IF;
   IF coalesce(r->>'luas_ha','') !~ '^[0-9]+(\.[0-9]{1,2})?$' THEN RAISE EXCEPTION 'Luas harus nonnegatif dan maksimum dua desimal.' USING ERRCODE='22023'; END IF;
   v_date:=(r->>'periode')::date; v_area:=(r->>'luas_ha')::numeric;
   IF v_area>9999999999.99 OR length(coalesce(r->>'keterangan',''))>500 THEN RAISE EXCEPTION 'Luas/keterangan melebihi batas.' USING ERRCODE='22023'; END IF;
   INSERT INTO public.luas_lahan_tanam(kode_wilayah,periode,luas_ha,keterangan,created_by)
    VALUES(r->>'kode_wilayah',v_date,v_area,nullif(trim(r->>'keterangan'),''),a)
    ON CONFLICT(kode_wilayah,periode) DO NOTHING RETURNING id INTO v_id;
   IF v_id IS NULL THEN v_status:='skipped';v_reason:='Duplikat kecamatan dan periode.'; skipped:=skipped+1;
   ELSE n:=n+1;saved_records:=saved_records||jsonb_build_array(jsonb_build_object('kode_wilayah',r->>'kode_wilayah','kecamatan_id',v_region_id,'periode',v_date)); END IF;
  EXCEPTION
   WHEN invalid_parameter_value OR invalid_text_representation OR datetime_field_overflow OR invalid_datetime_format OR numeric_value_out_of_range OR check_violation OR foreign_key_violation THEN
    v_status:='skipped';v_reason:=SQLERRM;skipped:=skipped+1;
   WHEN OTHERS THEN v_status:='failed';v_reason:='Gagal menyimpan baris; hubungi pengelola.';failed:=failed+1;
  END;
  results:=results||jsonb_build_array(jsonb_build_object('row_number',r->'row_number','status',v_status,'reason',v_reason));
 END LOOP;
 result:=jsonb_build_object('saved',n,'skipped',skipped,'failed',failed,'total',jsonb_array_length(p_rows),'rows',results);
 PERFORM public.ph_log(CASE WHEN failed>0 THEN 'import_partial' WHEN n>0 THEN 'import_success' ELSE 'import_empty' END,
  'Impor: '||n||' tersimpan, '||skipped||' dilewati, '||failed||' gagal.',
  jsonb_build_object('fingerprint',fingerprint,'result',result,'records',saved_records),p_request);
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.ph_lahan_dashboard(p_year int,p_month int DEFAULT NULL,p_district text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
 PERFORM public.ph_assert_admin();
 IF p_year NOT BETWEEN 1900 AND 9999 OR p_year IS NULL OR (p_month IS NOT NULL AND p_month NOT BETWEEN 1 AND 12) THEN RAISE EXCEPTION 'Tahun/bulan tidak valid.' USING ERRCODE='22023'; END IF;
 WITH annual AS (
 SELECT * FROM public.luas_lahan_tanam WHERE extract(year FROM periode)=p_year AND (coalesce(p_district,'')='' OR kode_wilayah=p_district)
 ), selected AS (SELECT * FROM annual WHERE p_month IS NULL OR extract(month FROM periode)=p_month),
 trend AS (SELECT month, sum(l.luas_ha) total, count(l.id) records FROM generate_series(1,12) month LEFT JOIN annual l ON extract(month FROM l.periode)=month GROUP BY month ORDER BY month),
 comparison AS (SELECT k.nama_kecamatan,k.kode_wilayah,sum(l.luas_ha) total,count(l.id) records FROM public.kecamatan k LEFT JOIN selected l USING(kode_wilayah)
 WHERE coalesce(p_district,'')='' OR k.kode_wilayah=p_district GROUP BY k.id,k.kode_wilayah,k.nama_kecamatan ORDER BY k.nama_kecamatan)
 SELECT jsonb_build_object('total',(SELECT count(*) FROM selected),'districts',(SELECT count(DISTINCT kode_wilayah) FROM selected),
 'start',(SELECT min(periode) FROM selected),'end',(SELECT max(periode) FROM selected),
 'trend',(SELECT jsonb_agg(t) FROM trend t),'comparison',coalesce((SELECT jsonb_agg(c) FROM comparison c),'[]'::jsonb),
 'imports',(SELECT count(*) FROM public.activity_log a WHERE a.module='luas_lahan_tanam' AND a.action_type='import_success' AND EXISTS(
 SELECT 1 FROM jsonb_array_elements(a.details->'records') r WHERE substring(r->>'periode',1,4)::int=p_year AND (p_month IS NULL OR substring(r->>'periode',6,2)::int=p_month) AND (coalesce(p_district,'')='' OR r->>'kecamatan_id'=(SELECT id::text FROM public.kecamatan WHERE kode_wilayah=p_district)))),
 'activities',coalesce((SELECT jsonb_agg(z) FROM (SELECT id,actor_name,action_type,description,created_at FROM public.activity_log WHERE module='luas_lahan_tanam' ORDER BY created_at DESC,id DESC LIMIT 10) z),'[]'::jsonb)) INTO result;
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.ph_lahan_export(p_filter jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE batch jsonb; result jsonb:='[]'; page int:=1;
BEGIN
 PERFORM public.ph_assert_admin();
 LOOP
  batch:=public.ph_lahan_list(p_filter,page,1000);
  IF (batch->>'count')::int>100000 THEN RAISE EXCEPTION 'Hasil melebihi 100.000 baris. Persempit filter.' USING ERRCODE='22023'; END IF;
  result:=result||(batch->'rows');
  EXIT WHEN jsonb_array_length(result)>=(batch->>'count')::int;
  page:=page+1;
 END LOOP;
 RETURN result;
END $$;

-- Semua RPC baru tertutup untuk publik anonim, termasuk function helper.
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure signature,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND left(p.proname,3)='ph_' LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
  IF f.proname NOT IN ('ph_log','ph_sync_auth_profile','ph_protect_superadmin') THEN
   EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.signature);
  END IF;
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
