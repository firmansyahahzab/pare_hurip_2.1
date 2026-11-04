import "server-only";
import * as XLSX from "xlsx";
import { rowsFromMatrix, type Land, type Region } from "./domain";
import { RequestError } from "./server";
export async function parseExcel(file: File) {
 if (!/\.(xlsx|xls)$/i.test(file.name)) throw new RequestError("Pilih file .xlsx atau .xls.");
 if (!file.size || file.size > 10 * 1024 * 1024) throw new RequestError("Ukuran file harus lebih dari 0 dan maksimum 10 MB.");
 try {
  const book = XLSX.read(await file.arrayBuffer(), { type: "array", sheetRows: 5002, cellFormula: false });
  const sheet = book.Sheets[book.SheetNames.includes("Data Luas Tanam") ? "Data Luas Tanam" : book.SheetNames[0]];
  if (!sheet) throw new Error("Lembar data tidak ditemukan.");
  const range = sheet["!fullref"] ?? sheet["!ref"] ?? "A1";
  if (XLSX.utils.decode_range(range).e.r > 5000) throw new Error("Maksimum 5.000 baris data per impor.");
  return rowsFromMatrix(XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" }));
 } catch (e) { throw new RequestError(e instanceof Error ? e.message : "File Excel tidak dapat dibaca."); }
}
const headers = ["Kode Kecamatan", "Kecamatan", "Tahun", "Bulan", "Luas Tanam (ha)", "Keterangan"];
export function excelResponse(rows: Land[] | null, regions: Region[] = []) {
 const book = XLSX.utils.book_new();
 const matrix: (string | number)[][] = [headers];
 rows?.forEach(r => matrix.push([r.kode_wilayah, r.nama_kecamatan, Number(r.periode.slice(0, 4)), Number(r.periode.slice(5, 7)), Number(r.luas_ha), r.keterangan ?? ""]));
 const sheet = XLSX.utils.aoa_to_sheet(matrix);
 sheet["!cols"] = [{ wch: 22 }, { wch: 25 }, { wch: 10 }, { wch: 15 }, { wch: 22 }, { wch: 50 }];
 XLSX.utils.book_append_sheet(book, sheet, "Data Luas Tanam");
 if (!rows) {
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["Kode Kecamatan", "Kecamatan"], ...regions.map(r => [r.kode_wilayah, r.nama_kecamatan])]), "Referensi Kecamatan");
  const help = ["Isi sheet Data Luas Tanam. Jangan mengubah judul kolom.", "Kode Kecamatan bertipe teks; salin kode dan nama dari Referensi Kecamatan.", "Tahun: 1900–9999. Bulan: angka 1–12 atau nama bulan Indonesia.", "Luas dalam hektare: 0 atau lebih, maksimal dua desimal. Contoh 25,5 atau 25.5.", "Format angka Indonesia dengan ribuan: 1.234,56. Jangan memakai 1.234 untuk 1234.", "Keterangan opsional, maksimum 500 karakter.", "Satu data per kecamatan per bulan. Duplikat dan baris tidak valid dilewati.", "Maksimum 10 MB dan 5.000 baris per file. Format .xlsx atau .xls.", "Template kosong bukan data contoh. Tambahkan kecamatan dahulu bila referensi kosong."];
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["Petunjuk"], ...help.map(t => [t])]), "Petunjuk");
 }
 const bytes = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
 return new Response(new Uint8Array(bytes), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${rows ? "data_luas_lahan_tanam" : "template_luas_lahan_tanam"}.xlsx"`, "Cache-Control": "no-store" } });
}
