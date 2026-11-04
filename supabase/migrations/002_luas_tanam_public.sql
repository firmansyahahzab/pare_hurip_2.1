-- Jalankan sesudah 001_luas_tanam.sql. Tidak mengubah hak tulis admin.
BEGIN;

-- Publik hanya menerima agregat, bukan identitas penginput, catatan, atau log.
CREATE OR REPLACE FUNCTION public.ph_public_lahan_dashboard(
 p_year int DEFAULT NULL, p_month int DEFAULT NULL, p_district text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE selected_year int; result jsonb;
BEGIN
 IF (p_year IS NOT NULL AND p_year NOT BETWEEN 1900 AND 9999)
 OR (p_month IS NOT NULL AND p_month NOT BETWEEN 1 AND 12)
 OR length(coalesce(p_district,'')) > 20 THEN
  RAISE EXCEPTION 'Filter tidak valid.' USING ERRCODE='22023';
 END IF;
 SELECT coalesce(p_year, max(extract(year FROM periode)::int),
  extract(year FROM current_timestamp AT TIME ZONE 'Asia/Jakarta')::int)
 INTO selected_year FROM public.luas_lahan_tanam;

 WITH selected AS (
  SELECT kode_wilayah, periode, luas_ha FROM public.luas_lahan_tanam
  WHERE periode >= make_date(selected_year,1,1)
   AND periode <= make_date(selected_year,12,31)
   AND (p_month IS NULL OR extract(month FROM periode)=p_month)
   AND (coalesce(p_district,'')='' OR kode_wilayah=p_district)
 ), trend AS (
  SELECT month, sum(l.luas_ha) total, count(l.periode) records
  FROM generate_series(1,12) month
  LEFT JOIN selected l ON extract(month FROM l.periode)=month
  WHERE p_month IS NULL OR month=p_month GROUP BY month
 ), comparison AS (
  SELECT k.kode_wilayah, k.nama_kecamatan, sum(l.luas_ha) total, count(l.periode) records
  FROM public.kecamatan k LEFT JOIN selected l USING(kode_wilayah)
  WHERE coalesce(p_district,'')='' OR k.kode_wilayah=p_district
  GROUP BY k.kode_wilayah,k.nama_kecamatan
 )
 SELECT jsonb_build_object(
  'filters', jsonb_build_object('year',selected_year::text,'month',coalesce(p_month::text,''),'district',coalesce(p_district,'')),
  'options', jsonb_build_object(
   'years', (SELECT jsonb_agg(y ORDER BY y DESC) FROM (
    SELECT DISTINCT extract(year FROM periode)::int y FROM public.luas_lahan_tanam
    UNION SELECT selected_year) years),
   'regions', coalesce((SELECT jsonb_agg(jsonb_build_object('kode_wilayah',kode_wilayah,'nama_kecamatan',nama_kecamatan)
    ORDER BY nama_kecamatan,kode_wilayah) FROM public.kecamatan),'[]'::jsonb)),
  'summary', jsonb_build_object(
   'total', (SELECT sum(luas_ha) FROM selected),
   'records', (SELECT count(*) FROM selected),
   'districts', (SELECT count(DISTINCT kode_wilayah) FROM selected),
   'months', (SELECT count(DISTINCT periode) FROM selected),
   'start', (SELECT min(periode) FROM selected),
   'end', (SELECT max(periode) FROM selected)),
  'trend', (SELECT jsonb_agg(t ORDER BY month) FROM trend t),
  'comparison', coalesce((SELECT jsonb_agg(c ORDER BY nama_kecamatan,kode_wilayah) FROM comparison c),'[]'::jsonb),
  'updatedAt', coalesce(
   (SELECT max(created_at) FROM public.activity_log WHERE module='luas_lahan_tanam'),
   (SELECT max(created_at) FROM public.luas_lahan_tanam))
 ) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.ph_public_lahan_dashboard(int,int,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ph_public_lahan_dashboard(int,int,text) TO anon,authenticated;
COMMENT ON FUNCTION public.ph_public_lahan_dashboard(int,int,text)
 IS 'Ringkasan publik luas tanam dari input admin; tanpa identitas, catatan, dan aktivitas admin.';
NOTIFY pgrst,'reload schema';
COMMIT;
