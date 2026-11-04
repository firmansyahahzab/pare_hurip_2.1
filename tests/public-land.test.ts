import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { areaPercentage, landInsight, publicLandCsv, type PublicLandData } from "../lib/land/public";

const ADMIN = "22222222-2222-4222-8222-222222222222";
test("Publik: data admin, agregat dan filter akurat tanpa membuka akses admin", async t => {
 const db = new PGlite();
 try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
   CREATE TABLE auth.users(id uuid PRIMARY KEY,email text NOT NULL,raw_user_meta_data jsonb DEFAULT '{}',raw_app_meta_data jsonb DEFAULT '{}');
   CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
   GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;`);
  for (const file of ["supabase/000_schema_awal_database_kosong.sql", "supabase/migrations/001_luas_tanam.sql", "supabase/migrations/002_luas_tanam_public.sql", "supabase/migrations/002_luas_tanam_public.sql"]) {
   await db.exec(await readFile(file, "utf8"));
  }
  const login = async (admin: boolean) => {
   await db.exec("RESET ROLE");
   await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [admin ? ADMIN : ""]);
   await db.exec(admin ? "SET ROLE authenticated" : "SET ROLE anon");
  };
  const rpc = async (name: string, args: unknown[] = []) => {
   const result = await db.query<{ data: unknown }>(`SELECT public.${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) AS data`, args);
   return result.rows[0].data;
  };
  const dashboard = async (year: number | null = null, month: number | null = null, district: string | null = null) =>
   await rpc("ph_public_lahan_dashboard", [year, month, district]) as PublicLandData;
  const save = async (code: string, period: string, area: string, id: string | null = null) =>
   await rpc("ph_lahan_save", [id, JSON.stringify({ kode_wilayah: code, periode: period, luas_ha: area, keterangan: "Catatan internal rahasia" })]) as string;

  await t.test("Tanpa data tetap menyediakan filter dan null, bukan angka palsu", async () => {
   await login(false);
   const result = await dashboard();
   assert.equal(result.summary.total, null);
   assert.equal(result.summary.records, 0);
   assert.equal(result.trend.length, 12);
   assert.ok(result.trend.every(row => row.total === null));
   assert.deepEqual(result.comparison, []);
   assert.equal(result.options.years.length, 1);
  });
  await db.exec("RESET ROLE");
  await db.query("INSERT INTO auth.users(id,email,raw_app_meta_data) VALUES($1,'admin@test.invalid','{\"parehurip_admin\":true}')", [ADMIN]);
  await login(true);
  for (const [code, name] of [["001", "Kawalu"], ["002", "Tawang"], ["003", "Cihideung"]]) await rpc("ph_kecamatan_save", [null, code, name]);
  const firstId = await save("001", "2024-01-01", "10.25");
  await save("001", "2024-02-01", "0");
  await save("002", "2024-01-01", "20.5");
  await save("002", "2023-01-01", "100");
  await login(false);

  await t.test("Default tahun terbaru; jumlah ha, kecamatan, periode dan tren berasal dari input", async () => {
   const result = await dashboard();
   assert.equal(result.filters.year, "2024");
   assert.deepEqual(result.options.years, [2024, 2023]);
   assert.equal(result.summary.total, 30.75);
   assert.equal(result.summary.districts, 2);
   assert.equal(result.summary.months, 2);
   assert.equal(result.summary.start, "2024-01-01");
   assert.equal(result.summary.end, "2024-02-01");
   assert.equal(result.trend[0].total, 30.75);
   assert.equal(result.trend[1].total, 0);
   assert.equal(result.trend[2].total, null);
   assert.equal(result.comparison.find(row => row.kode_wilayah === "003")?.total, null);
   assert.ok(result.updatedAt);
   assert.doesNotMatch(JSON.stringify(result), /created_by|actor_name|keterangan|Catatan internal|admin@test/);
  });
  await t.test("Filter bulan dan kecamatan berlaku pada semua ringkasan dan grafik", async () => {
   const result = await dashboard(2024, 2, "001");
   assert.equal(result.summary.total, 0);
   assert.equal(result.summary.records, 1);
   assert.equal(result.comparison.length, 1);
   assert.deepEqual(result.trend, [{ month: 2, records: 1, total: 0 }]);
   assert.equal((await dashboard(2023)).summary.total, 100);
   assert.equal((await dashboard(2025)).summary.total, null);
   assert.equal((await dashboard(2024, 2, "002")).summary.total, null);
   assert.deepEqual((await dashboard(2024, null, "tidakada")).comparison, []);
   await assert.rejects(dashboard(1800), /Filter/);
   await assert.rejects(dashboard(2024, 13), /Filter/);
   await assert.rejects(dashboard(2024, null, "X".repeat(21)), /Filter/);
  });
  await t.test("Anon hanya mendapat agregat dan tidak dapat membaca/menulis tabel atau memakai RPC admin", async () => {
   await assert.rejects(db.exec("SELECT * FROM public.luas_lahan_tanam"), /permission/i);
   await assert.rejects(db.exec("SELECT * FROM public.profiles"), /permission/i);
   await assert.rejects(db.exec("SELECT * FROM public.activity_log"), /permission/i);
   await assert.rejects(rpc("ph_lahan_options"), /permission/i);
   await assert.rejects(save("001", "2024-03-01", "1"), /permission/i);
   await assert.rejects(rpc("ph_lahan_delete", [firstId]), /permission/i);
  });
  await t.test("Edit, impor, dan hapus admin langsung tercermin pada hasil publik", async () => {
   await login(true);
   await save("001", "2024-01-01", "15.25", firstId);
   await login(false);
   assert.equal((await dashboard(2024)).summary.total, 35.75);
   await login(true);
   await rpc("ph_lahan_import", ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", JSON.stringify([
    { row_number: 2, kode_wilayah: "003", nama_kecamatan: "Cihideung", periode: "2024-03-01", luas_ha: "5", keterangan: "" },
   ])]);
   await login(false);
   assert.equal((await dashboard(2024)).summary.total, 40.75);
   assert.equal((await dashboard(2024)).summary.districts, 3);
   await login(true);
   await rpc("ph_lahan_delete", [firstId]);
   await login(false);
   assert.equal((await dashboard(2024)).summary.total, 25.5);
  });
 } finally { await db.close(); }
});

const fixture: PublicLandData = {
 filters: { year: "2024", month: "", district: "" },
 options: { years: [2024], regions: [] },
 summary: { total: 30, records: 3, districts: 3, months: 1, start: "2024-01-01", end: "2024-01-01" },
 trend: [], updatedAt: null,
 comparison: [
  { kode_wilayah: "001", nama_kecamatan: "Kawalu", total: 15, records: 1 },
  { kode_wilayah: "002", nama_kecamatan: "Tawang", total: 15, records: 1 },
  { kode_wilayah: "003", nama_kecamatan: "Cihideung", total: 0, records: 1 },
  { kode_wilayah: "004", nama_kecamatan: "Belum tercatat", total: null, records: 0 },
 ],
};
test("Persentase dan insight menangani nol, tanpa data dan nilai tertinggi yang sama", () => {
 assert.equal(areaPercentage(15, 30), 50);
 assert.equal(areaPercentage(0, 30), 0);
 assert.equal(areaPercentage(0, 0), null);
 assert.equal(areaPercentage(null, 30), null);
 assert.match(landInsight(fixture), /Kawalu, Tawang sebesar 15 ha/);
 assert.match(landInsight(fixture), /Cihideung sebesar 0 ha/);
 assert.doesNotMatch(landInsight(fixture), /Belum tercatat/);
 assert.match(landInsight({ ...fixture, comparison: [] }), /Belum ada data/);
});
test("CSV mencakup seluruh baris, filter, desimal Indonesia dan perlindungan formula", () => {
 const data = { ...fixture, comparison: [...fixture.comparison, { kode_wilayah: "005", nama_kecamatan: '=HYPERLINK("bad")', total: 2.5, records: 1 }] };
 const csv = publicLandCsv(data);
 assert.ok(csv.startsWith("\uFEFF"));
 assert.equal(csv.split("\r\n").length, 6);
 assert.ok(csv.includes('"2024";"Semua bulan"'));
 assert.ok(csv.includes('"2,5"'));
 assert.ok(csv.includes("\"'=HYPERLINK(\"\"bad\"\")\""));
 assert.match(csv, /Belum ada data/);
 assert.doesNotMatch(csv, /NaN|Infinity/);
});
