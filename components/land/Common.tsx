"use client";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight, Filter, Loader2, RotateCcw, X } from "lucide-react";
import { MONTHS, currentYear, type Filters, type Options } from "@/lib/land/domain";
import { api, message } from "@/lib/land/client";
export function useOptions(version = 0) {
 const [options, setOptions] = useState<Options>({ regions: [], years: [] }); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
 useEffect(() => { let active = true; setLoading(true); api<Options>("/api/admin/land/options").then(o => { if (active) { setOptions(o); setError(""); } }).catch(e => { if (active) setError(message(e)); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [version]);
 return { options, error, loading };
}
export function Notice({ error }: { error: string }) { return error ? <div className="ph-error" role="alert">{error}</div> : null; }
export function Loading() { return <div className="ph-state" role="status"><Loader2 className="size-5 animate-spin" /> Memuat data…</div>; }
export function Empty({ text = "Belum ada data yang sesuai." }: { text?: string }) { return <div className="ph-state">{text}</div>; }
export function Modal({ title, children, onClose, busy = false, narrow = false }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean; narrow?: boolean }) {
 const ref = useRef<HTMLDialogElement>(null); const titleId = useId();
 useEffect(() => {
  const trigger = document.activeElement as HTMLElement | null; const dialog = ref.current;
  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  dialog?.showModal();
  return () => { dialog?.close(); document.body.style.overflow = previousOverflow; if (trigger?.isConnected) trigger.focus(); };
 }, []);
 return <dialog ref={ref} className={`ph-dialog ${narrow ? "ph-dialog-small" : ""}`} aria-labelledby={titleId} aria-busy={busy} onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}>
  <div className="ph-dialog-title"><h2 id={titleId}>{title}</h2><button className="ph-icon" aria-label="Tutup dialog" disabled={busy} onClick={onClose}><X size={20} /></button></div>{children}
 </dialog>;
}
export function Success({ text, onClose }: { text: string; onClose: () => void }) {
 return <Modal title="Berhasil!" onClose={onClose} narrow><div className="ph-success"><span className="ph-check"><Check size={38} /></span><h3>Perubahan berhasil disimpan</h3><p>{text}</p><button className="ph-btn ph-primary" onClick={onClose}>Tutup</button></div></Modal>;
}
export function DeleteModal({ title, children, onClose, onDelete }: { title: string; children: ReactNode; onClose: () => void; onDelete: () => Promise<void> }) {
 const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const lock = useRef(false);
 const submit = async () => { if (lock.current) return; lock.current = true; setBusy(true); setError(""); try { await onDelete(); } catch (e) { setError(message(e)); } finally { lock.current = false; setBusy(false); } };
 return <Modal title={title} onClose={onClose} busy={busy} narrow><div className="ph-dialog-body"><p>{children}</p><Notice error={error} /></div><div className="ph-actions"><button className="ph-btn" disabled={busy} onClick={onClose}>Batal</button><button className="ph-btn ph-danger" disabled={busy} onClick={submit}>{busy ? "Menghapus…" : "Ya, Hapus"}</button></div></Modal>;
}
export function Field({ label, htmlFor, error, children, required = false }: { label: string; htmlFor: string; error?: string; children: ReactNode; required?: boolean }) {
 return <div className="ph-field"><label htmlFor={htmlFor}>{label} {required && <span className="text-red-600">*</span>}</label>{children}{error && <p id={`${htmlFor}-error`} className="ph-field-error" role="alert">{error}</p>}</div>;
}
export function Pager({ page, count, size, onPage, onSize }: { page: number; count: number; size: number; onPage: (n: number) => void; onSize?: (n: number) => void }) {
 const total = Math.max(1, Math.ceil(count / size));
 return <div className="ph-pager"><div>{count ? `Menampilkan ${(page - 1) * size + 1}–${Math.min(page * size, count)} dari ${count} data` : "0 data"}</div>
 <div className="ph-pager-controls">{onSize && <label>Baris <select aria-label="Baris per halaman" value={size} onChange={e => onSize(Number(e.target.value))}>{[10, 25, 50].map(n => <option key={n}>{n}</option>)}</select></label>}
 <button className="ph-icon" aria-label="Halaman sebelumnya" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft size={18} /></button><span className="ph-page-number">{page}</span><span>/ {total}</span><button className="ph-icon" aria-label="Halaman berikutnya" disabled={page >= total} onClick={() => onPage(page + 1)}><ChevronRight size={18} /></button></div></div>;
}
export function FiltersBar({ value, options, onApply, dashboard = false }: { value: Filters; options: Options; onApply: (f: Filters) => void; dashboard?: boolean }) {
 const [draft, setDraft] = useState(value);
 useEffect(() => setDraft(value), [value]);
 const update = (key: keyof Filters, v: string) => setDraft(d => ({ ...d, [key]: v }));
 const reset = useCallback(() => { const f = { year: dashboard ? currentYear() : "", month: "", district: "", search: value.search }; setDraft(f); onApply(f); }, [dashboard, onApply, value.search]);
 const years = [...new Set([Number(currentYear()), ...options.years, ...(value.year ? [Number(value.year)] : [])])].sort((a, b) => b - a);
 return <form className={`ph-filters ${dashboard ? "ph-filter-panel" : ""}`} onSubmit={e => { e.preventDefault(); onApply({ ...draft, search: value.search }); }}>
 {dashboard && <div className="ph-filter-heading"><Filter size={24} /><div><h3>Filter Data</h3><p>Tahun memengaruhi kedua grafik. Bulan memengaruhi grafik per kecamatan.</p></div></div>}
 <div className="ph-filter-fields"><label>Tahun<select value={draft.year} onChange={e => update("year", e.target.value)}>{!dashboard && <option value="">Semua Tahun</option>}{years.map(y => <option key={y} value={y}>{y}</option>)}</select></label>
 <label>Bulan<select value={draft.month} onChange={e => update("month", e.target.value)}><option value="">Semua Bulan</option>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></label>
 <label>Kecamatan<select value={draft.district} onChange={e => update("district", e.target.value)}><option value="">Semua Kecamatan</option>{options.regions.map(k => <option key={k.id} value={k.kode_wilayah}>{k.nama_kecamatan}</option>)}</select></label>
 <button className="ph-btn ph-primary" type="submit"><Filter size={16} /> Terapkan Filter</button><button className="ph-btn" type="button" onClick={reset}><RotateCcw size={16} /> Reset</button></div></form>;
}
