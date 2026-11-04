import { formatArea, MONTHS, periodLabel } from "./domain";

export type PublicLandFilters = { year: string; month: string; district: string };
export type PublicLandData = {
 filters: PublicLandFilters;
 options: { years: number[]; regions: { kode_wilayah: string; nama_kecamatan: string }[] };
 summary: { total: number | null; records: number; districts: number; months: number; start: string | null; end: string | null };
 trend: { month: number; total: number | null; records: number }[];
 comparison: { kode_wilayah: string; nama_kecamatan: string; total: number | null; records: number }[];
 updatedAt: string | null;
};

export const defaultPublicFilters = (): PublicLandFilters => ({ year: "", month: "", district: "" });
export function selectedPeriod(filters: PublicLandFilters) {
 return filters.month ? `${MONTHS[Number(filters.month) - 1]} ${filters.year}` : `Januari–Desember ${filters.year}`;
}
export function recordedPeriod(summary: PublicLandData["summary"]) {
 if (!summary.start) return "Belum ada data";
 return summary.start === summary.end ? periodLabel(summary.start) : `${periodLabel(summary.start)} – ${periodLabel(summary.end)}`;
}
export function areaPercentage(area: number | null, total: number | null) {
 return area === null || total === null || total === 0 ? null : area / total * 100;
}
export function landInsight(data: PublicLandData) {
 const rows = data.comparison.filter((r): r is typeof r & { total: number } => r.total !== null);
 if (!rows.length) return "Belum ada data luas tanam pada pilihan ini. Silakan pilih tahun, bulan, atau kecamatan lain.";
 const period = selectedPeriod(data.filters);
 if (rows.length === 1) return `Pada periode ${period}, luas tanam tercatat di ${rows[0].nama_kecamatan} sebesar ${formatArea(rows[0].total)} ha.`;
 const high = Math.max(...rows.map(r => r.total));
 const low = Math.min(...rows.map(r => r.total));
 if (high === low) return `Pada periode ${period}, seluruh ${rows.length} kecamatan yang memiliki data mencatat luas tanam yang sama, yaitu ${formatArea(high)} ha.`;
 return `Pada periode ${period}, luas tanam tertinggi tercatat di ${rows.filter(r => r.total === high).map(r => r.nama_kecamatan).join(", ")} sebesar ${formatArea(high)} ha, sedangkan yang terendah di ${rows.filter(r => r.total === low).map(r => r.nama_kecamatan).join(", ")} sebesar ${formatArea(low)} ha.`;
}
function csvCell(value: string | number) {
 const text = String(value);
 // Nama wilayah berasal dari input admin; cegah formula spreadsheet.
 return "\"" + (/^\s*[=+\-@\t\r\n]/.test(text) ? "'" + text : text).replaceAll("\"", "\"\"") + "\"";
}
export function publicLandCsv(data: PublicLandData) {
 const rows: (string | number)[][] = [
  ["No", "Kecamatan", "Tahun", "Bulan", "Luas Tanam (ha)", "Persentase (%)"],
  ...data.comparison.map((r, i) => [
   i + 1, r.nama_kecamatan, data.filters.year,
   data.filters.month ? MONTHS[Number(data.filters.month) - 1] : "Semua bulan",
   r.total === null ? "Belum ada data" : formatArea(r.total),
   areaPercentage(r.total, data.summary.total) === null ? "Tidak tersedia" : formatArea(areaPercentage(r.total, data.summary.total)),
  ]),
 ];
 return "\uFEFF" + rows.map(row => row.map(csvCell).join(";")).join("\r\n");
}
