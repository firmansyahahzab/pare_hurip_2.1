import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const SUPER = "11111111-1111-4111-8111-111111111111";
const ADMIN = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";
const JOB = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
test("Database: migration, CRUD, RLS, Auth, import, export dan dashboard", async t => {
 const db = new PGlite();
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
 CREATE TABLE auth.users(id uuid PRIMARY KEY, email text NOT NULL, raw_user_meta_data jsonb DEFAULT '{}',raw_app_meta_data jsonb DEFAULT '{}');
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA public,auth TO anon,authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;`);
 await db.exec(await readFile("supabase/000_schema_awal_database_kosong.sql", "utf8"));
 const migration = await readFile("supabase/migrations/001_luas_tanam.sql", "utf8");
 await db.exec(migration); await db.exec(migration);
 await db.query("INSERT INTO auth.users(id,email,raw_app_meta_data,raw_user_meta_data) VALUES($1,'super@test.invalid','{\"parehurip_admin\":true}','{\"name\":\"Super\"}'),($2,'admin@test.invalid','{\"parehurip_admin\":true}','{\"name\":\"Admin\"}'),($3,'public@test.invalid','{}','{\"role\":\"superadmin\"}')", [SUPER, ADMIN, OTHER]);
 await db.query("UPDATE public.profiles SET role='superadmin' WHERE id=$1", [SUPER]);
 const login = async (id: string, role = "authenticated") => { await db.exec("RESET ROLE"); await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id]); await db.exec(`SET ROLE ${role}`); };
 const owner = () => db.exec("RESET ROLE");
 const rpc = async (name: string, args: unknown[] = []) => { const r = await db.query<{ data: unknown }>(`SELECT public.${name}(${args.map((_,i) => `$${i+1}`).join(",")}) AS data`, args); return r.rows[0].data; };
 let region = ""; let land = "";
 const row = { row_number: 2, kode_wilayah: "001", nama_kecamatan: "Kawalu", periode: "2026-01-01", luas_ha: "0", keterangan: "uji" };
 await t.test("Migrasi dapat diulang; signup publik tidak mendapat profil admin", async () => {
  const r = await db.query("SELECT * FROM public.profiles WHERE id=$1", [OTHER]); assert.equal(r.rows.length, 0);
  await assert.rejects(db.query("UPDATE public.profiles SET role='superadmin' WHERE id=$1", [ADMIN]), /unique|duplicate/i);
 });
 await t.test("Admin CRUD data, nol valid, edit dan constraint duplikasi", async () => {
  await login(ADMIN); region = await rpc("ph_kecamatan_save", [null, "001", "Kawalu"]) as string;
  land = await rpc("ph_lahan_save", [null, JSON.stringify(row)]) as string;
  await assert.rejects(rpc("ph_lahan_save", [null, JSON.stringify(row)]), /unique|duplicate/i);
  await rpc("ph_lahan_save", [land, JSON.stringify({ ...row, luas_ha: "25.5" })]);
  const r = await rpc("ph_lahan_list", [JSON.stringify({ year: "2026" }), 1, 10]) as { count: number; rows: { luas_ha: number }[] };
  assert.equal(r.count, 1); assert.equal(r.rows[0].luas_ha, 25.5);
  await assert.rejects(rpc("ph_lahan_save", [null, JSON.stringify({ ...row, periode: "2026-02-01", luas_ha: "-1" })]));
 });
 await t.test("RLS melarang role escalation, direct write dan log impor palsu", async () => {
  assert.equal((await db.query("SELECT id FROM public.profiles")).rows.length, 1);
  await assert.rejects(db.query("UPDATE public.profiles SET role='superadmin' WHERE id=$1", [ADMIN]), /permission/i);
  await assert.rejects(db.exec("INSERT INTO public.kecamatan(kode_wilayah,nama_kecamatan) VALUES('X','X')"), /permission/i);
  await assert.rejects(db.query("INSERT INTO public.activity_log(actor_id,action_type,description,module) VALUES($1,'import_success','palsu','luas_lahan_tanam')", [ADMIN]), /policy|security/i);
 });
 await t.test("Referensi terpakai tidak boleh dihapus; kode dapat diubah secara cascade", async () => {
  await assert.rejects(rpc("ph_kecamatan_delete", [region]), /foreign key/i);
  await rpc("ph_kecamatan_save", [region, "002", "Kawalu"]);
  const r = await rpc("ph_lahan_list", ["{}", 1, 10]) as { rows: { kode_wilayah: string }[] }; assert.equal(r.rows[0].kode_wilayah, "002");
  await rpc("ph_kecamatan_save", [region, "001", "Kawalu"]);
 });
 await t.test("Impor: konflik DB, duplikat file, invalid, hasil aktual dan replay idempotent", async () => {
  const rows = [row, { ...row, row_number: 3, periode: "2026-02-01" }, { ...row, row_number: 4, periode: "2026-02-01" }, { ...row, row_number: 5, periode: "2026-03-01", luas_ha: "-1" }, { ...row, row_number: 6, periode: "2026-03-01", nama_kecamatan: "Salah" }];
  const first = await rpc("ph_lahan_import", [JOB, JSON.stringify(rows)]) as { saved: number; skipped: number; failed: number };
  assert.equal(first.saved, 1); assert.equal(first.skipped, 4); assert.equal(first.failed, 0);
  assert.deepEqual(await rpc("ph_lahan_import", [JOB, JSON.stringify(rows)]), first);
  await assert.rejects(rpc("ph_lahan_import", [JOB, JSON.stringify([row])]), /berbeda/);
  await assert.rejects(rpc("ph_lahan_import", ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", null]));
  await assert.rejects(rpc("ph_lahan_list", ["{}", 1, null]));
 });
 await t.test("Dashboard membedakan nol/tanpa data, tren tahunan, proses impor, dan edit kode", async () => {
  await rpc("ph_kecamatan_save", [region, "099", "Kawalu"]);
  const d = await rpc("ph_lahan_dashboard", [2026, 2, "099"]) as { total: number; imports: number; trend: { total: number | null; records: number }[]; comparison: { total: number }[] };
  assert.equal(d.total, 1); assert.equal(d.imports, 1); assert.equal(d.trend[0].total, 25.5); assert.equal(d.trend[1].total, 0); assert.equal(d.trend[2].total, null); assert.equal(d.comparison[0].total, 0);
  const no = await rpc("ph_lahan_dashboard", [2027, null, null]) as { total: number; imports: number }; assert.equal(no.total, 0); assert.equal(no.imports, 0);
 });
 await t.test("Ekspor mengikuti pencarian/filter dan melebihi halaman tabel", async () => {
  await owner();
  await db.query("INSERT INTO public.luas_lahan_tanam(kode_wilayah,periode,luas_ha,created_by) SELECT '099',('1900-01-01'::date+make_interval(months => n))::date,1,$1 FROM generate_series(0,1099) n", [ADMIN]);
  await login(ADMIN);
  const acrossPages = await rpc("ph_lahan_export", [JSON.stringify({ search: "kaw" })]) as unknown[]; assert.equal(acrossPages.length, 1102);
  const paged = await rpc("ph_lahan_list", ["{}", 1, 10]) as { count: number; rows: unknown[] }; assert.equal(paged.count, 1102); assert.equal(paged.rows.length, 10);
  const all = await rpc("ph_lahan_export", [JSON.stringify({ year: "2026", search: "kaw" })]) as unknown[]; assert.equal(all.length, 2);
  const one = await rpc("ph_lahan_export", [JSON.stringify({ year: "2026", month: "2" })]) as unknown[]; assert.equal(one.length, 1);
  const none = await rpc("ph_lahan_export", [JSON.stringify({ search: "tidakada" })]) as unknown[]; assert.equal(none.length, 0);
 });
 await t.test("Anon dan pengguna tanpa profil ditolak RPC; publik tetap dapat membaca KSA", async () => {
  await login("", "anon"); await assert.rejects(rpc("ph_lahan_options"), /permission/i); await db.exec("SELECT * FROM public.data_ksa");
  await login(OTHER); await assert.rejects(rpc("ph_lahan_options"), /Akses admin/); assert.equal((await db.query("SELECT * FROM public.luas_lahan_tanam")).rows.length, 0);
 });
 await t.test("Auth sync atomik, superadmin terlindung, FK akun terpakai ditolak", async () => {
  await owner();
  await db.exec("ALTER TABLE public.profiles ADD CONSTRAINT test_name_length CHECK(length(name)<=30)");
  await assert.rejects(db.query("UPDATE auth.users SET email='rollback@test.invalid',raw_user_meta_data=$2::jsonb WHERE id=$1", [ADMIN, JSON.stringify({ name: "X".repeat(50) })]), /check constraint/);
  assert.equal((await db.query<{ email: string }>("SELECT email FROM auth.users WHERE id=$1", [ADMIN])).rows[0].email, "admin@test.invalid");
  await db.exec("ALTER TABLE public.profiles DROP CONSTRAINT test_name_length");
  await owner(); await db.query("UPDATE auth.users SET email='updated@test.invalid',raw_user_meta_data='{\"name\":\"Nama Baru\"}' WHERE id=$1", [ADMIN]);
  const p = await db.query<{ name: string; email: string; role: string }>("SELECT name,email,role FROM public.profiles WHERE id=$1", [ADMIN]); assert.equal(p.rows[0].name, "Nama Baru"); assert.equal(p.rows[0].email, "updated@test.invalid"); assert.equal(p.rows[0].role, "admin");
  await assert.rejects(db.query("DELETE FROM auth.users WHERE id=$1", [SUPER]), /superadmin/);
  await assert.rejects(db.query("DELETE FROM auth.users WHERE id=$1", [ADMIN]), /foreign key/);
  await login(SUPER); await rpc("ph_lahan_delete", [land]);
  await assert.rejects(rpc("ph_lahan_delete", [land]), /tidak ditemukan/);
 });
 await t.test("Admin tanpa data bisa dihapus; profil hilang dan log tetap ada", async () => {
  await owner();
  await db.query("INSERT INTO auth.users(id,email,raw_app_meta_data) VALUES($1,$2,$3::jsonb)", ["44444444-4444-4444-8444-444444444444", "unused@test.invalid", JSON.stringify({ parehurip_admin: true })]);
  await login("44444444-4444-4444-8444-444444444444");
  await rpc("ph_kecamatan_save", [null, "NEW", "Kecamatan Uji"]);
  await owner(); await db.exec("DELETE FROM auth.users WHERE id='44444444-4444-4444-8444-444444444444'");
  assert.equal((await db.query("SELECT id FROM public.profiles WHERE id='44444444-4444-4444-8444-444444444444'")).rows.length, 0);
  assert.equal((await db.query("SELECT id FROM public.activity_log WHERE description LIKE '%Kecamatan Uji%' AND actor_id IS NULL")).rows.length, 1);
 });
 await db.close();
});
