export const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
export type Region = { id: string; kode_wilayah: string; nama_kecamatan: string; created_at: string };
export type Land = { id: string; kode_wilayah: string; nama_kecamatan: string; periode: string; luas_ha: number; keterangan: string | null; created_by: string; created_at: string };
export type Filters = { year: string; month: string; district: string; search: string };
export type Options = { regions: Region[]; years: number[] };
export type LandInput = { kode_wilayah: string; periode: string; luas_ha: string; keterangan: string };
export type RawRow = LandInput & { row_number: number; nama_kecamatan: string };
export type PreviewRow = RawRow & { status: "valid" | "invalid" | "duplicate"; reason: string };
export type ImportResult = { saved: number; skipped: number; failed: number; total: number; rows: { row_number: number; status: string; reason: string | null }[] };
export type AdminUser = { id: string; name: string; email: string; role: "admin" | "superadmin"; created_at: string };
export type DashboardData = { total: number; districts: number; imports: number; start: string | null; end: string | null;
 trend: { month: number; total: number | null; records: number }[];
 comparison: { nama_kecamatan: string; kode_wilayah: string; total: number | null; records: number }[];
 activities: { id: string; actor_name: string | null; action_type: string; description: string; created_at: string }[] };
export const emptyFilters = (): Filters => ({ year: "", month: "", district: "", search: "" });
export const currentYear = () => new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date());
export const uuidValid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export function periodLabel(period?: string | null) {
 if (!period) return "Belum ada data";
 return `${MONTHS[Number(period.slice(5, 7)) - 1]} ${period.slice(0, 4)}`;
}
export function formatArea(n: number | null) {
 return n === null ? "Belum ada data" : new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(n);
}
/** Dot decimal or Indonesian decimal comma; grouped Indonesian numbers require a comma. */
export function normalizeArea(value: unknown): string {
 let s = String(value ?? "").trim();
 if (/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(s)) s = s.replaceAll(".", "");
 if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(",", ".");
 if (/^\d+(\.\d{1,2})?$/.test(s) && Number.isFinite(Number(s))) return String(Number(s));
 return s;
}
export function validateLand(data: LandInput): Record<string, string> {
 const errors: Record<string, string> = {};
 if (!data.kode_wilayah.trim() || data.kode_wilayah.length > 20) errors.kode_wilayah = "Pilih kecamatan yang terdaftar.";
 if (!/^(19\d{2}|[2-9]\d{3})-(0[1-9]|1[0-2])-01$/.test(data.periode)) errors.periode = "Pilih bulan dan tahun (1900–9999).";
 const area = normalizeArea(data.luas_ha);
 if (!/^\d+(\.\d{1,2})?$/.test(area) || !Number.isFinite(Number(area)) || Number(area) > 9999999999.99) errors.luas_ha = "Isi luas 0–9.999.999.999,99 ha, maksimum dua desimal.";
 if (data.keterangan.length > 500) errors.keterangan = "Keterangan maksimum 500 karakter.";
 return errors;
}
export function normalizeRow(value: unknown, index: number): RawRow {
 const r = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
 return { row_number: Number.isSafeInteger(r.row_number) ? Number(r.row_number) : index + 2,
 kode_wilayah: String(r.kode_wilayah ?? "").trim(), nama_kecamatan: String(r.nama_kecamatan ?? "").trim(),
 periode: String(r.periode ?? "").trim(), luas_ha: normalizeArea(r.luas_ha), keterangan: String(r.keterangan ?? "").trim() };
}
export function previewRows(rows: RawRow[], regions: Region[], existing: { kode_wilayah: string; periode: string }[]): PreviewRow[] {
 const known = new Set(existing.map(r => `${r.kode_wilayah}|${r.periode}`));
 const seen = new Set<string>();
 const lookup = new Map(regions.map(r => [r.kode_wilayah, r.nama_kecamatan.trim().toLocaleLowerCase("id")]));
 return rows.map(row => {
  const errors = Object.values(validateLand(row));
  if (!lookup.has(row.kode_wilayah)) errors.unshift("Kode kecamatan belum terdaftar.");
  else if (lookup.get(row.kode_wilayah) !== row.nama_kecamatan.toLocaleLowerCase("id")) errors.unshift("Kode dan nama kecamatan tidak cocok.");
  if (errors.length) return { ...row, status: "invalid", reason: errors.join(" ") };
  const key = `${row.kode_wilayah}|${row.periode}`;
  if (seen.has(key) || known.has(key)) return { ...row, status: "duplicate", reason: seen.has(key) ? "Duplikat di dalam file." : "Kecamatan dan periode sudah ada di database." };
  seen.add(key);
  return { ...row, status: "valid", reason: "Siap disimpan" };
 });
}
export function rowsFromMatrix(matrix: unknown[][]): RawRow[] {
 const canonical = ["kode kecamatan", "kecamatan", "tahun", "bulan", "luas tanam (ha)", "keterangan"];
 const headers = (matrix[0] ?? []).map(v => String(v).trim().toLowerCase());
 if (canonical.slice(0, 5).some(h => !headers.includes(h))) throw new Error("Kolom wajib: Kode Kecamatan, Kecamatan, Tahun, Bulan, Luas Tanam (ha). Gunakan template resmi.");
 if (new Set(headers.filter(Boolean)).size !== headers.filter(Boolean).length) throw new Error("Nama kolom tidak boleh berulang.");
 const rows: RawRow[] = [];
 matrix.slice(1).forEach((row, i) => {
  if (row.every(v => String(v ?? "").trim() === "")) return;
  const cell = (h: string) => String(row[headers.indexOf(h)] ?? "").trim();
  const monthText = cell("bulan");
  const month = /^\d{1,2}$/.test(monthText) ? Number(monthText) : MONTHS.findIndex(m => m.toLowerCase() === monthText.toLowerCase()) + 1;
  rows.push(normalizeRow({ row_number: i + 2, kode_wilayah: cell("kode kecamatan"), nama_kecamatan: cell("kecamatan"),
   periode: `${cell("tahun")}-${String(month).padStart(2, "0")}-01`, luas_ha: cell("luas tanam (ha)"), keterangan: cell("keterangan") }, i));
 });
 if (!rows.length) throw new Error("File belum berisi data.");
 if (rows.length > 5000) throw new Error("Maksimum 5.000 baris per impor. Pecah file menjadi beberapa bagian.");
 return rows;
}
export function paramsFor(filters: Filters) { return new URLSearchParams(filters).toString(); }
