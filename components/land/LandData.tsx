"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Download, Upload, Plus, FileOutput, Pencil, Trash2, Search, Leaf } from "lucide-react";
import { api, download, message, send } from "@/lib/land/client";
import { emptyFilters, formatArea, paramsFor, periodLabel, type Filters, type Land } from "@/lib/land/domain";
import { DeleteModal, Empty, FiltersBar, Loading, Notice, Pager, Success, useOptions } from "./Common";
import { EditLand } from "./LandForm";
export default function LandData() {
 const [filters, setFilters] = useState<Filters>(emptyFilters); const [page, setPage] = useState(1); const [size, setSize] = useState(10); const [revision, setRevision] = useState(0);
 const [rows, setRows] = useState<Land[]>([]); const [count, setCount] = useState(0); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
 const [edit, setEdit] = useState<Land | null>(null); const [remove, setRemove] = useState<Land | null>(null); const [success, setSuccess] = useState(""); const [downloading, setDownloading] = useState(false); const downloadLock = useRef(false);
 const { options, error: optionError } = useOptions(revision);
 useEffect(() => { const saved = sessionStorage.getItem("ph-land-list"); if (saved) { try { const s = JSON.parse(saved); setFilters(s.filters); setPage(s.page); setSize(s.size); } catch { /* abaikan preferensi lokal yang rusak */ } } }, []);
 useEffect(() => {
  let active = true; setLoading(true); setError(""); const timeout = setTimeout(() => {
   sessionStorage.setItem("ph-land-list", JSON.stringify({ filters, page, size }));
   api<{ rows: Land[]; count: number }>(`/api/admin/land?${paramsFor(filters)}&page=${page}&size=${size}`).then(result => {
    if (!active) return; const last = Math.max(1, Math.ceil(result.count / size)); if (page > last) { setPage(last); return; } setRows(result.rows); setCount(result.count);
   }).catch(e => { if (active) { setRows([]); setError(message(e)); } }).finally(() => { if (active) setLoading(false); });
  }, 200); return () => { active = false; clearTimeout(timeout); };
 }, [filters, page, size, revision]);
 const finish = (text: string) => { setEdit(null); setRemove(null); setSuccess(text); setRevision(r => r + 1); };
 const file = async (template: boolean) => { if (downloadLock.current) return; downloadLock.current = true; setDownloading(true); setError(""); try { await download(template ? "/api/admin/land/template" : `/api/admin/land/export?${paramsFor(filters)}`, template ? "template_luas_lahan_tanam.xlsx" : "data_luas_lahan_tanam.xlsx"); } catch (e) { setError(message(e)); } finally { downloadLock.current = false; setDownloading(false); } };
 return <div className="ph-page"><section className="ph-toolbar"><h2><Leaf size={22} /> Aksi Data Luas Tanam</h2><div className="ph-toolbar-buttons"><button className="ph-btn" disabled={downloading} onClick={() => file(true)}><Download size={18} />Unduh Template</button><Link className="ph-btn" href="/admin/land-data/import"><Upload size={18} />Import Data</Link><button className="ph-btn" disabled={downloading} onClick={() => file(false)}><FileOutput size={18} />Export Data</button><Link className="ph-btn" href="/admin/land-data/new"><Plus size={18} />Tambah Data</Link></div></section>
 <FiltersBar value={filters} options={options} onApply={f => { setFilters(f); setPage(1); }} /><Notice error={error || optionError} />
 <section className="ph-panel"><div className="ph-search"><Search size={17} /><input aria-label="Cari kecamatan" placeholder="Cari Kecamatan…" value={filters.search} maxLength={100} onChange={e => { setFilters(f => ({ ...f, search: e.target.value })); setPage(1); }} /></div>
 {loading ? <Loading /> : error ? <Empty text="Data belum dapat dimuat." /> : !rows.length ? <Empty /> : <div className="ph-table-wrap"><table className="ph-table"><thead><tr>{["No", "Kecamatan", "Periode", "Luas Lahan Tanam (ha)", "Keterangan", "Aksi"].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={r.id}><td>{(page - 1) * size + i + 1}</td><td><strong>{r.nama_kecamatan}</strong><small>{r.kode_wilayah}</small></td><td>{periodLabel(r.periode)}</td><td className="ph-number">{formatArea(r.luas_ha)}</td><td className="ph-note">{r.keterangan || "—"}</td><td><div className="ph-row-actions"><button className="ph-icon ph-edit" aria-label={`Edit ${r.nama_kecamatan} ${periodLabel(r.periode)}`} onClick={() => setEdit(r)}><Pencil size={16} /></button><button className="ph-icon ph-delete" aria-label={`Hapus ${r.nama_kecamatan} ${periodLabel(r.periode)}`} onClick={() => setRemove(r)}><Trash2 size={16} /></button></div></td></tr>)}</tbody></table></div>}
 <Pager page={page} size={size} count={count} onPage={setPage} onSize={n => { setSize(n); setPage(1); }} /></section>
 {edit && <EditLand row={edit} regions={options.regions} onClose={() => setEdit(null)} onSuccess={() => finish("Data luas lahan tanam berhasil diperbarui.")} />}
 {remove && <DeleteModal title="Hapus Data Luas Lahan Tanam?" onClose={() => setRemove(null)} onDelete={async () => { await send("/api/admin/land", "DELETE", { id: remove.id }); finish("Data luas lahan tanam berhasil dihapus."); }}>Hapus data <strong>{remove.nama_kecamatan}</strong> periode <strong>{periodLabel(remove.periode)}</strong>? Data yang dihapus tidak dapat dikembalikan.</DeleteModal>}
 {success && <Success text={success} onClose={() => setSuccess("")} />}</div>;
}
