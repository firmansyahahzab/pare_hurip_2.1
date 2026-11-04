BEGIN;

-- =====================================================
-- 1. TIPE PERAN PENGGUNA
-- Nilai enum untuk percobaan: admin dan superadmin.
-- =====================================================

CREATE TYPE public.user_role AS ENUM (
    'admin',
    'superadmin'
);


-- =====================================================
-- 2. PROFIL PENGGUNA — WEBSITE LAMA
-- Akun login tetap dikelola Supabase Auth.
-- =====================================================

CREATE TABLE public.profiles (
    id UUID NOT NULL,

    name TEXT NOT NULL,

    email TEXT NOT NULL,

    role public.user_role NOT NULL
        DEFAULT 'admin'::public.user_role,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT profiles_pkey
        PRIMARY KEY (id),

    CONSTRAINT profiles_id_fkey
        FOREIGN KEY (id)
        REFERENCES auth.users(id)
);


-- =====================================================
-- 3. KECAMATAN WEBSITE LAMA
-- Digunakan oleh data_ksa.
-- =====================================================

CREATE TABLE public.districts (
    id UUID NOT NULL DEFAULT gen_random_uuid(),

    district_code TEXT NOT NULL UNIQUE,

    name TEXT NOT NULL,

    created_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT districts_pkey
        PRIMARY KEY (id)
);


-- =====================================================
-- 4. LOG AKTIVITAS BERSAMA
-- Kolom module membedakan aktivitas setiap fitur.
-- =====================================================

CREATE TABLE public.activity_log (
    id UUID NOT NULL DEFAULT gen_random_uuid(),

    actor_id UUID,

    actor_name TEXT,

    action_type TEXT NOT NULL,

    description TEXT NOT NULL,

    created_at TIMESTAMPTZ DEFAULT now(),

    module TEXT,

    CONSTRAINT activity_log_pkey
        PRIMARY KEY (id),

    CONSTRAINT activity_log_actor_id_fkey
        FOREIGN KEY (actor_id)
        REFERENCES public.profiles(id)
);


-- =====================================================
-- 5. DATA KSA — WEBSITE LAMA
-- =====================================================

CREATE TABLE public.data_ksa (
    id UUID NOT NULL DEFAULT gen_random_uuid(),

    segment_id TEXT NOT NULL,

    subsegment TEXT NOT NULL,

    periode TEXT NOT NULL,

    phase TEXT NOT NULL,

    created_by UUID,

    created_at TIMESTAMPTZ DEFAULT now(),

    updated_at TIMESTAMPTZ DEFAULT now(),

    district_code TEXT,

    CONSTRAINT data_ksa_pkey
        PRIMARY KEY (id),

    CONSTRAINT data_ksa_district_code_fkey
        FOREIGN KEY (district_code)
        REFERENCES public.districts(district_code),

    CONSTRAINT data_ksa_created_by_fkey
        FOREIGN KEY (created_by)
        REFERENCES auth.users(id)
);


-- =====================================================
-- 6. PENGISIAN OTOMATIS district_code PADA DATA KSA
--
-- Menggantikan DEFAULT left(segment_id, 7),
-- karena DEFAULT tidak dapat merujuk kolom lain.
--
-- Saat INSERT, jika district_code NULL:
-- ambil tujuh karakter pertama segment_id.
-- Kode tersebut harus sudah terdaftar di districts.
-- =====================================================

CREATE FUNCTION public.isi_district_code_ksa()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF NEW.district_code IS NULL THEN
        NEW.district_code :=
            pg_catalog.left(NEW.segment_id, 7);
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_isi_district_code_ksa
BEFORE INSERT ON public.data_ksa
FOR EACH ROW
EXECUTE FUNCTION public.isi_district_code_ksa();


-- =====================================================
-- 7. JENIS BERAS — WEBSITE LAMA
-- =====================================================

CREATE TABLE public.rice_types (
    id SMALLINT NOT NULL,

    name TEXT NOT NULL UNIQUE,

    CONSTRAINT rice_types_pkey
        PRIMARY KEY (id)
);


-- =====================================================
-- 8. HARGA BERAS — WEBSITE LAMA
-- =====================================================

CREATE TABLE public.rice_prices (
    id BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,

    date DATE NOT NULL,

    rice_type_id SMALLINT,

    price NUMERIC NOT NULL,

    created_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT rice_prices_pkey
        PRIMARY KEY (id),

    CONSTRAINT rice_prices_rice_type_id_fkey
        FOREIGN KEY (rice_type_id)
        REFERENCES public.rice_types(id)
);


-- =====================================================
-- 9. KECAMATAN FITUR BARU
-- Terpisah dari tabel districts.
-- =====================================================

CREATE TABLE public.kecamatan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    nama_kecamatan VARCHAR(100) NOT NULL
        CHECK (length(trim(nama_kecamatan)) > 0),

    kode_wilayah VARCHAR(20) NOT NULL UNIQUE
        CHECK (length(trim(kode_wilayah)) > 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- =====================================================
-- 10. LUAS LAHAN TANAM — FITUR BARU
-- Input manual dan Excel menggunakan tabel yang sama.
-- Tanpa kolom sumber_input dan nama_file.
-- =====================================================

CREATE TABLE public.luas_lahan_tanam (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    kode_wilayah VARCHAR(20) NOT NULL,

    -- Contoh: Oktober 2026 disimpan sebagai 2026-10-01.
    periode DATE NOT NULL
        CHECK (
            isfinite(periode)
            AND EXTRACT(DAY FROM periode) = 1
        ),

    -- Luas dalam hektare.
    luas_ha NUMERIC(12,2) NOT NULL
        CHECK (
            luas_ha >= 0
            AND luas_ha <> 'NaN'::numeric
        ),

    keterangan VARCHAR(500),

    created_by UUID NOT NULL DEFAULT auth.uid(),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT luas_lahan_kecamatan_fkey
        FOREIGN KEY (kode_wilayah)
        REFERENCES public.kecamatan(kode_wilayah)
        ON DELETE RESTRICT,

    CONSTRAINT luas_lahan_penginput_fkey
        FOREIGN KEY (created_by)
        REFERENCES public.profiles(id)
        ON DELETE RESTRICT,

    -- Satu data per kecamatan per bulan.
    CONSTRAINT unik_kecamatan_periode
        UNIQUE (kode_wilayah, periode)
);

CREATE INDEX idx_luas_lahan_created_by
ON public.luas_lahan_tanam (created_by);


-- =====================================================
-- 11. AKTIFKAN ROW LEVEL SECURITY
-- Policy akses website belum disertakan.
-- Pengujian dapat dilakukan melalui SQL Editor.
-- =====================================================

ALTER TABLE public.profiles
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.districts
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.activity_log
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.data_ksa
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.rice_types
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.rice_prices
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.kecamatan
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.luas_lahan_tanam
    ENABLE ROW LEVEL SECURITY;

COMMIT;

