"use client";

import { useEffect, useRef, useState } from "react";
import { BarChart3, CalendarDays, ChevronLeft, ChevronRight, Database, Download, FileText, Filter, Leaf, Lightbulb, Map, MapPin, RotateCcw, Sprout } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, message } from "@/lib/land/client";
import { formatArea, MONTHS } from "@/lib/land/domain";
import { areaPercentage, defaultPublicFilters, landInsight, publicLandCsv, recordedPeriod, selectedPeriod, type PublicLandData, type PublicLandFilters } from "@/lib/land/public";
import styles from "./PublicLandDashboard.module.css";

const GREEN = "var(--land-chart)";
const PAGE_SIZE = 5;
const areaTooltip = (value: unknown) => [`${formatArea(Number(value))} ha`, "Luas tanam"];

export default function PublicLandDashboard() {
 const [draft, setDraft] = useState<PublicLandFilters>(defaultPublicFilters);
 const [filters, setFilters] = useState<PublicLandFilters>(defaultPublicFilters);
 const [data, setData] = useState<PublicLandData | null>(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState("");
 const [refresh, setRefresh] = useState(0);
 const [page, setPage] = useState(1);
 const [chartType, setChartType] = useState("bar");
 const syncDraft = useRef(true);
 const resolvedFilters = useRef<PublicLandFilters>(defaultPublicFilters());

 useEffect(() => {
  const controller = new AbortController();
  setLoading(true);
  setError("");
  const query = !filters.year && !syncDraft.current ? { ...filters, year: resolvedFilters.current.year } : filters;
  api<PublicLandData>(`/api/public/land?${new URLSearchParams(query)}`, { signal: controller.signal })
   .then(result => {
    if (controller.signal.aborted) return;
    setData(result);
    resolvedFilters.current = result.filters;
    setPage(p => Math.min(p, Math.max(1, Math.ceil(result.comparison.length / PAGE_SIZE))));
    if (syncDraft.current) { setDraft(result.filters); syncDraft.current = false; }
   })
   .catch(e => { if (!controller.signal.aborted) { setData(null); setError(message(e)); } })
   .finally(() => { if (!controller.signal.aborted) setLoading(false); });
  return () => controller.abort();
 }, [filters, refresh]);

 // Ambil perubahan admin saat pengunjung kembali ke tab ini.
 useEffect(() => {
  const reload = () => { if (document.visibilityState === "visible") setRefresh(n => n + 1); };
  window.addEventListener("focus", reload);
  return () => window.removeEventListener("focus", reload);
 }, []);

 const apply = (event: React.FormEvent) => {
  event.preventDefault();
  syncDraft.current = !draft.year;
  setPage(1);
  setFilters({ ...draft });
 };
 const reset = () => {
  syncDraft.current = true;
  setDraft(defaultPublicFilters());
  setFilters(defaultPublicFilters());
  setPage(1);
 };
 const download = () => {
  if (!data) return;
  const href = URL.createObjectURL(new Blob([publicLandCsv(data)], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = href;
  link.download = `luas-lahan-tanam-${data.filters.year}${data.filters.month ? "-" + data.filters.month.padStart(2, "0") : ""}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
 };
 const trend = data?.trend.map(row => ({ ...row, label: MONTHS[row.month - 1].slice(0, 3) })) ?? [];
 const peak = Math.max(0, ...trend.map(row => row.total ?? 0));
 const comparison = data?.comparison ?? [];
 const chartComparison = comparison.filter(row => row.total !== null);
 const pages = Math.max(1, Math.ceil(comparison.length / PAGE_SIZE));
 const visibleRows = comparison.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
 const district = data?.options.regions.find(row => row.kode_wilayah === data.filters.district);
 const hasData = !!data?.summary.records;

 return <main className={styles.page}>
  <header className={styles.intro}>
   <h1>Informasi Luas Lahan Tanam Padi</h1>
   <p>Pantau perkembangan luas lahan tanam padi di Kota Tasikmalaya berdasarkan wilayah dan periode.</p>
  </header>

  <section className={styles.filterPanel} aria-labelledby="land-filter-title">
   <h2 id="land-filter-title"><Filter size={22} aria-hidden="true" />Filter Data</h2>
   <form className={styles.filters} onSubmit={apply}>
    <label htmlFor="public-land-year">Tahun<span className={styles.selectWrap}><CalendarDays aria-hidden="true" size={17} /><select id="public-land-year" value={draft.year} disabled={loading} onChange={e => setDraft({ ...draft, year: e.target.value })}>
     <option value="">Tahun terbaru</option>
     {data?.options.years.map(year => <option key={year} value={year}>{year}</option>)}
    </select></span></label>
    <label htmlFor="public-land-month">Periode/Bulan<span className={styles.selectWrap}><CalendarDays aria-hidden="true" size={17} /><select id="public-land-month" value={draft.month} disabled={loading} onChange={e => setDraft({ ...draft, month: e.target.value })}>
     <option value="">Semua Bulan</option>
     {MONTHS.map((month, i) => <option key={month} value={i + 1}>{month}</option>)}
    </select></span></label>
    <label htmlFor="public-land-district">Kecamatan<span className={styles.selectWrap}><MapPin aria-hidden="true" size={17} /><select id="public-land-district" value={draft.district} disabled={loading} onChange={e => setDraft({ ...draft, district: e.target.value })}>
     <option value="">Semua Kecamatan</option>
     {data?.options.regions.map(row => <option key={row.kode_wilayah} value={row.kode_wilayah}>{row.nama_kecamatan}</option>)}
    </select></span></label>
    <div className={styles.filterActions}>
     <button className={styles.primary} type="submit" disabled={loading}><Filter size={16} aria-hidden="true" />Terapkan Filter</button>
     <button className={styles.secondary} type="button" onClick={reset} disabled={loading}><RotateCcw size={17} aria-hidden="true" />Reset</button>
    </div>
   </form>
  </section>

  <div aria-live="polite" role="status">{loading && <p className={styles.status}>Memuat data luas lahan tanam…</p>}</div>
  {error && <div className={styles.error} role="alert"><p>{error}</p><button type="button" className={styles.secondary} onClick={() => setRefresh(n => n + 1)}>Coba lagi</button></div>}

  {data && <div className={loading ? styles.updating : undefined} aria-busy={loading}>
   <section className={styles.stats} aria-label="Ringkasan luas tanam">
    {[
     { icon: Sprout, label: "Total Luas Tanam", value: data.summary.total === null ? "Belum ada data" : `${formatArea(data.summary.total)} ha`, detail: selectedPeriod(data.filters) },
     { icon: MapPin, label: "Jumlah Kecamatan", value: String(data.summary.districts), detail: "Kecamatan dengan data" },
     { icon: CalendarDays, label: "Periode Data", value: recordedPeriod(data.summary), detail: `${data.summary.months} bulan tercatat` },
     { icon: Leaf, label: "Cakupan Wilayah", value: "Kota Tasikmalaya", detail: district?.nama_kecamatan ?? (data.filters.district ? "Kecamatan tidak ditemukan" : "Seluruh kecamatan") },
    ].map(item => <article className={styles.stat} key={item.label}><span className={styles.iconCircle}><item.icon size={29} aria-hidden="true" /></span><div><h2>{item.label}</h2><strong>{item.value}</strong><p>{item.detail}</p></div></article>)}
   </section>

   <section className={styles.panel} aria-labelledby="land-trend-title">
    <div className={styles.panelHeading}><div className={styles.headingText}><BarChart3 size={30} aria-hidden="true" /><div><h2 id="land-trend-title">Tren Luas Lahan Tanam per Periode</h2><p>Perkembangan luas lahan tanam padi pada {selectedPeriod(data.filters)}.</p></div></div>
     <label className={styles.chartSelect}><span className={styles.srOnly}>Jenis grafik</span><BarChart3 size={19} aria-hidden="true" /><select aria-label="Jenis grafik" value={chartType} onChange={e => setChartType(e.target.value)}><option value="bar">Grafik Batang</option><option value="line">Grafik Garis</option></select></label>
    </div>
    {hasData ? <>
     <div className={styles.chartScroll}><div className={styles.trendChart} role="img" aria-label="Grafik luas tanam bulanan. Angka tersedia pada rincian bulanan di bawah grafik.">
      <ResponsiveContainer width="100%" height={270}>
       {chartType === "bar" ? <BarChart data={trend} margin={{ top: 24, right: 20, bottom: 16, left: 18 }} accessibilityLayer>
        <CartesianGrid vertical={false} stroke="var(--land-grid)" /><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--land-muted)", fontSize: 12 }} dy={10} />
        <YAxis domain={[0, "auto"]} tickLine={false} tick={{ fill: "var(--land-muted)", fontSize: 12 }} label={{ value: "Luas Tanam (ha)", angle: -90, position: "insideLeft", style: { fill: "var(--land-muted)", textAnchor: "middle", fontSize: 12 } }} />
        <Tooltip formatter={areaTooltip} labelFormatter={(_, payload) => MONTHS[(payload[0]?.payload.month ?? 1) - 1]} contentStyle={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }} />
        <Bar dataKey="total" maxBarSize={38} isAnimationActive={false}>{trend.map(row => <Cell key={row.month} fill={row.total !== null && row.total === peak ? GREEN : "var(--land-bar)"} />)}</Bar>
       </BarChart> : <LineChart data={trend} margin={{ top: 24, right: 20, bottom: 16, left: 18 }} accessibilityLayer>
        <CartesianGrid vertical={false} stroke="var(--land-grid)" /><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--land-muted)", fontSize: 12 }} dy={10} />
        <YAxis domain={[0, "auto"]} tickLine={false} tick={{ fill: "var(--land-muted)", fontSize: 12 }} label={{ value: "Luas Tanam (ha)", angle: -90, position: "insideLeft", style: { fill: "var(--land-muted)", textAnchor: "middle", fontSize: 12 } }} />
        <Tooltip formatter={areaTooltip} labelFormatter={(_, payload) => MONTHS[(payload[0]?.payload.month ?? 1) - 1]} contentStyle={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }} />
        <Line dataKey="total" stroke={GREEN} strokeWidth={3} dot={{ r: 4, fill: GREEN }} connectNulls={false} isAnimationActive={false} />
       </LineChart>}
      </ResponsiveContainer>
     </div></div>
     <p className={styles.legend}><span />{chartType === "bar" ? "Luas lahan tanam padi tertinggi" : "Luas lahan tanam padi per bulan"}</p>
    </> : <Empty />}
    <details className={styles.details}><summary>Lihat rincian bulanan</summary><div className={styles.tableScroll}><table className={styles.table}><caption className={styles.srOnly}>Rincian luas tanam bulanan sesuai filter</caption><thead><tr><th scope="col">Bulan</th><th scope="col">Luas Tanam (ha)</th></tr></thead><tbody>{trend.map(row => <tr key={row.month}><th scope="row">{MONTHS[row.month - 1]}</th><td>{formatArea(row.total)}</td></tr>)}</tbody></table></div></details>
    <p className={styles.note}>Bulan tanpa data tidak disamakan dengan luas tanam 0 ha.</p>
   </section>

   <section className={styles.panel} aria-labelledby="land-comparison-title">
    <div className={styles.panelHeading}><div className={styles.headingText}><Map size={30} aria-hidden="true" /><div><h2 id="land-comparison-title">Perbandingan Luas Tanam per Kecamatan</h2><p>Luas lahan tanam padi pada {selectedPeriod(data.filters)} di setiap kecamatan.</p></div></div></div>
    {hasData ? <div className={styles.chartScroll}><div className={styles.comparisonChart} role="img" aria-label="Grafik perbandingan luas tanam per kecamatan. Nilai lengkap tersedia pada tabel rekapitulasi.">
     <ResponsiveContainer width="100%" height={Math.max(220, chartComparison.length * 36 + 75)}>
      <BarChart data={chartComparison} layout="vertical" margin={{ top: 6, right: 100, bottom: 28, left: 0 }} accessibilityLayer>
       <CartesianGrid horizontal={false} stroke="var(--land-grid)" />
       <XAxis type="number" domain={[0, "auto"]} tickLine={false} tick={{ fill: "var(--land-muted)", fontSize: 12 }} label={{ value: "Luas Tanam (ha)", position: "bottom", offset: 12, fill: "var(--land-muted)", fontSize: 12 }} />
       <YAxis type="category" dataKey="nama_kecamatan" width={180} axisLine={false} tickLine={false} interval={0} tick={{ fill: "var(--foreground)", fontSize: 12 }} />
       <Tooltip formatter={areaTooltip} cursor={{ fill: "var(--land-soft)" }} contentStyle={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }} />
       <Bar dataKey="total" fill={GREEN} maxBarSize={20} isAnimationActive={false}><LabelList dataKey="total" position="right" formatter={value => `${formatArea(Number(value))} ha`} style={{ fill: "var(--foreground)", fontSize: 12, fontWeight: 600 }} /></Bar>
      </BarChart>
     </ResponsiveContainer>
    </div></div> : <Empty />}
    {comparison.some(row => row.total === null) && hasData && <p className={styles.note}>Kecamatan yang belum memiliki data tersedia pada tabel di bawah.</p>}
   </section>

   <section className={styles.panel} aria-labelledby="land-recap-title">
    <div className={styles.panelHeading}><div className={styles.headingText}><FileText size={29} aria-hidden="true" /><div><h2 id="land-recap-title">Rekapitulasi Luas Tanam per Kecamatan</h2><p>Tabel rincian luas lahan tanam padi berdasarkan kecamatan.</p></div></div><button className={styles.primary} onClick={download} disabled={loading || !hasData}><Download size={18} aria-hidden="true" />Unduh Data</button></div>
    <div className={styles.tableScroll}><table className={styles.table}><caption className={styles.srOnly}>Rekapitulasi {selectedPeriod(data.filters)}</caption><thead><tr><th scope="col">No</th><th scope="col">Kecamatan</th><th scope="col">Luas Tanam (ha)</th><th scope="col">Persentase</th></tr></thead><tbody>
     {visibleRows.map((row, index) => <tr key={row.kode_wilayah}><td>{(page - 1) * PAGE_SIZE + index + 1}</td><th scope="row">{row.nama_kecamatan}</th><td>{row.total === null ? "Belum ada data" : `${formatArea(row.total)} ha`}</td><td>{areaPercentage(row.total, data.summary.total) === null ? "—" : `${formatArea(areaPercentage(row.total, data.summary.total))}%`}</td></tr>)}
     {!visibleRows.length && <tr><td colSpan={4}>Belum ada kecamatan untuk pilihan ini.</td></tr>}
    </tbody></table></div>
    <div className={styles.tableFooter}><p>Menampilkan {comparison.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, comparison.length)} dari {comparison.length} kecamatan</p>
     <nav aria-label="Halaman rekapitulasi" className={styles.pagination}><button aria-label="Halaman sebelumnya" disabled={loading || page === 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={17} /></button><span aria-current="page">{page}</span><span>dari {pages}</span><button aria-label="Halaman berikutnya" disabled={loading || page === pages} onClick={() => setPage(p => p + 1)}><ChevronRight size={17} /></button></nav>
    </div>
    <p className={styles.note}>Persentase dihitung dari total luas sesuai filter. Tanda — berarti persentase tidak tersedia. Unduhan mencakup seluruh kecamatan sesuai filter.</p>
   </section>

   <div className={styles.bottomGrid}>
    <section className={styles.panel} aria-labelledby="land-source-title"><div className={styles.headingText}><span className={styles.smallCircle}><Database size={23} aria-hidden="true" /></span><h2 id="land-source-title">Sumber Data</h2></div><div className={styles.source}><p>Instansi: Dinas Pertanian Kota Tasikmalaya</p><p>Data luas tanam yang dikelola melalui halaman admin.</p><p>Terakhir diperbarui: {data.updatedAt ? new Date(data.updatedAt).toLocaleString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) + " WIB" : "Belum ada pembaruan"}</p><button className={styles.textButton} onClick={() => setRefresh(n => n + 1)} disabled={loading}><RotateCcw size={14} aria-hidden="true" />Perbarui data</button></div></section>
    <section className={styles.panel} aria-labelledby="land-insight-title"><div className={styles.headingText}><span className={styles.smallCircle}><Lightbulb size={25} aria-hidden="true" /></span><h2 id="land-insight-title">Insight Data</h2></div><p className={styles.insight}>{landInsight(data)}</p><p className={styles.note}>Total merupakan penjumlahan luas tanam setiap periode, sehingga lahan yang ditanam kembali dapat terhitung pada bulan berbeda.</p></section>
   </div>
  </div>}
 </main>;
}

function Empty() {
 return <div className={styles.empty}><Sprout size={34} aria-hidden="true" /><strong>Belum ada data luas tanam</strong><p>Data akan tampil setelah admin menyimpan input untuk wilayah dan periode ini.</p></div>;
}
