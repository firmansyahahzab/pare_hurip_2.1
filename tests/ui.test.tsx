import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EditLand } from "../components/land/LandForm";
import { Success } from "../components/land/Common";
const row = { id: "id", kode_wilayah: "001", nama_kecamatan: "Kawalu", periode: "2026-10-01", luas_ha: 25.5, keterangan: "Catatan lama", created_by: "user", created_at: "" };
test("Modal edit menampilkan nilai data terpilih; batal bukan submit", () => {
 const html = renderToStaticMarkup(<EditLand row={row} regions={[{ id: "region", kode_wilayah: "001", nama_kecamatan: "Kawalu", created_at: "" }]} onClose={() => {}} onSuccess={() => {}} />);
 assert.match(html, /Edit Data Luas Lahan Tanam/); assert.match(html, /value="2026-10"/); assert.match(html, /value="25.5"/); assert.match(html, /Catatan lama/); assert.match(html, /value="001" selected=""/); assert.match(html, /type="button"[^>]*>Batal/);
});
test("Modal sukses memiliki pesan, tombol Tutup, dan judul aksesibel", () => {
 const html = renderToStaticMarkup(<Success text="Data luas lahan tanam berhasil diperbarui." onClose={() => {}} />);
 assert.match(html, /aria-labelledby/); assert.match(html, /Data luas lahan tanam berhasil diperbarui/); assert.match(html, />Tutup<\/button>/);
});
