import test from "node:test";
import assert from "node:assert/strict";
import { normalizeArea, normalizeRow, previewRows, rowsFromMatrix, validateLand, periodLabel, type Region } from "../lib/land/domain";
const regions: Region[] = [{ id: "r1", kode_wilayah: "001", nama_kecamatan: "Kawalu", created_at: "" }];
const valid = { row_number: 2, kode_wilayah: "001", nama_kecamatan: "Kawalu", periode: "2026-01-01", luas_ha: "25.5", keterangan: "" };
test("Desimal Indonesia, nol, ribuan dan presisi", () => {
 assert.equal(normalizeArea("25,5"), "25.5"); assert.equal(normalizeArea("1.234,56"), "1234.56"); assert.equal(normalizeArea(0), "0");
 for (const luas_ha of ["", "-1", "NaN", "Infinity", "1.234", "10000000000", "2.999"]) assert.ok(validateLand({ ...valid, luas_ha }).luas_ha, luas_ha);
 assert.deepEqual(validateLand({ ...valid, luas_ha: "0" }), {});
});
test("Periode bulanan dan batas keterangan", () => {
 for (const periode of ["2026-01-02", "2026-13-01", "2026-00-01", "1800-01-01", ""]) assert.ok(validateLand({ ...valid, periode }).periode);
 assert.ok(validateLand({ ...valid, keterangan: "x".repeat(501) }).keterangan); assert.equal(periodLabel("2026-10-01"), "Oktober 2026");
});
test("Preview memisahkan valid, invalid, dan duplikat tanpa menulis data", () => {
 const rows = [valid, { ...valid, row_number: 3 }, { ...valid, row_number: 4, periode: "2026-02-01" }, { ...valid, row_number: 5, nama_kecamatan: "Tawang" }, { ...valid, row_number: 6, luas_ha: "-1" }];
 const copy = structuredClone(rows); const result = previewRows(rows, regions, [{ kode_wilayah: "001", periode: "2026-02-01" }]);
 assert.deepEqual(result.map(r => r.status), ["valid", "duplicate", "duplicate", "invalid", "invalid"]); assert.deepEqual(rows, copy);
});
test("Baris invalid pertama tidak memblokir baris valid berikutnya", () => {
 const result = previewRows([{ ...valid, luas_ha: "" }, { ...valid, row_number: 3 }], regions, []);
 assert.deepEqual(result.map(r => r.status), ["invalid", "valid"]);
});
test("Template/parser konsisten dan kode bernol di depan tetap teks", () => {
 const result = rowsFromMatrix([["Kode Kecamatan", "Kecamatan", "Tahun", "Bulan", "Luas Tanam (ha)", "Keterangan"], ["001", "Kawalu", 2026, "Oktober", "25,5", "uji"], ["", "", "", "", "", ""]]);
 assert.equal(result[0].kode_wilayah, "001"); assert.equal(result[0].periode, "2026-10-01"); assert.equal(result[0].luas_ha, "25.5"); assert.equal(result.length, 1);
 assert.throws(() => rowsFromMatrix([["Kecamatan"], ["Kawalu"]]), /Kolom wajib/);
 assert.throws(() => rowsFromMatrix([["Kode Kecamatan", "Kecamatan", "Tahun", "Bulan", "Luas Tanam (ha)"]]), /belum berisi/);
 assert.equal(normalizeRow(null, 1).kode_wilayah, "");
});
