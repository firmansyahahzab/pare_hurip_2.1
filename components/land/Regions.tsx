"use client";
import { useRef, useState } from "react";
import { LocateFixed, Pencil, Plus, Trash2, Search } from "lucide-react";
import { ApiError, message, send } from "@/lib/land/client";
import { type Region } from "@/lib/land/domain";
import { DeleteModal, Empty, Field, Loading, Modal, Notice, Pager, Success, useOptions } from "./Common";
function RegionForm({ initial, onClose, onSuccess }: { initial: Region | null; onClose: () => void; onSuccess: () => void }) {
 const [code, setCode] = useState(initial?.kode_wilayah ?? ""); const [name, setName] = useState(initial?.nama_kecamatan ?? ""); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [fields, setFields] = useState<Record<string, string>>({}); const lock = useRef(false);
 const save = async (e: React.FormEvent) => {
  e.preventDefault(); if (lock.current) return; const errors: Record<string, string> = {};
  if (!code.trim() || code.length > 20) errors.kode_wilayah = "Kode wajib diisi, maksimum 20 karakter.";
  if (!name.trim() || name.length > 100) errors.nama_kecamatan = "Nama wajib diisi, maksimum 100 karakter.";
  setFields(errors); if (Object.keys(errors).length) return;
  lock.current = true; setBusy(true); setError("");
  try { await send("/api/admin/kecamatan", initial ? "PATCH" : "POST", { id: initial?.id, kode_wilayah: code, nama_kecamatan: name }); onSuccess(); }
  catch (e) { setError(message(e)); if (e instanceof ApiError) setFields(e.fields); } finally { setBusy(false); lock.current = false; }
 };
 return <Modal title={initial ? "Edit Kecamatan" : "Tambah Kecamatan"} onClose={onClose} busy={busy}><p className="ph-dialog-subtitle">Kelola kode dan nama kecamatan.</p><form onSubmit={save} noValidate><div className="ph-form-body"><Notice error={error} />
 <Field label="Kode Kecamatan" htmlFor="region-code" error={fields.kode_wilayah} required><input id="region-code" value={code} maxLength={20} disabled={busy} onChange={e => setCode(e.target.value)} placeholder="Contoh: 3278010" aria-invalid={!!fields.kode_wilayah} aria-describedby={fields.kode_wilayah ? "region-code-error" : undefined} /></Field>
 <Field label="Nama Kecamatan" htmlFor="region-name" error={fields.nama_kecamatan} required><input id="region-name" value={name} maxLength={100} disabled={busy} onChange={e => setName(e.target.value)} placeholder="Masukkan nama kecamatan" aria-invalid={!!fields.nama_kecamatan} aria-describedby={fields.nama_kecamatan ? "region-name-error" : undefined} /></Field></div>
 <div className="ph-actions"><button className="ph-btn" type="button" disabled={busy} onClick={onClose}>Batal</button><button className="ph-btn ph-primary" disabled={busy}>{busy ? "Menyimpan…" : initial ? "Simpan Perubahan" : "Simpan"}</button></div></form></Modal>;
}
export default function Regions() {
 const [revision, setRevision] = useState(0); const { options, error, loading } = useOptions(revision); const [form, setForm] = useState<{ row: Region | null } | null>(null); const [remove, setRemove] = useState<Region | null>(null); const [success, setSuccess] = useState(""); const [search, setSearch] = useState(""); const [page, setPage] = useState(1);
 const all = options.regions.filter(r => `${r.nama_kecamatan} ${r.kode_wilayah}`.toLowerCase().includes(search.toLowerCase())); const current = Math.min(page, Math.max(1, Math.ceil(all.length / 10)));
 const finish = (text: string) => { setForm(null); setRemove(null); setSuccess(text); setRevision(r => r + 1); };
 return <div className="ph-page"><Notice error={error} /><section className="ph-panel"><div className="ph-panel-heading"><div className="ph-heading-icon"><LocateFixed /><div><h2>Kecamatan</h2><p>Tambahkan atau kelola kecamatan untuk data luas tanam.</p></div></div><button className="ph-btn ph-primary" onClick={() => setForm({ row: null })}><Plus size={17} />Tambah Kecamatan</button></div>
 <div className="ph-search"><Search size={17} /><input aria-label="Cari kecamatan" value={search} placeholder="Cari kode atau nama kecamatan…" onChange={e => { setSearch(e.target.value); setPage(1); }} /></div>
 {loading ? <Loading /> : !all.length ? <Empty text="Belum ada kecamatan. Tambahkan kecamatan untuk mulai mengisi data." /> : <div className="ph-table-wrap"><table className="ph-table ph-table-plain"><thead><tr><th>Kode Kecamatan</th><th>Nama Kecamatan</th><th>Aksi</th></tr></thead><tbody>{all.slice((current - 1) * 10, current * 10).map(r => <tr key={r.id}><td>{r.kode_wilayah}</td><td>{r.nama_kecamatan}</td><td><div className="ph-row-actions"><button className="ph-icon ph-edit" aria-label={`Edit ${r.nama_kecamatan}`} onClick={() => setForm({ row: r })}><Pencil size={16} /></button><button className="ph-icon ph-delete" aria-label={`Hapus ${r.nama_kecamatan}`} onClick={() => setRemove(r)}><Trash2 size={16} /></button></div></td></tr>)}</tbody></table></div>}
 <Pager page={current} count={all.length} size={10} onPage={setPage} /></section>
 {form && <RegionForm initial={form.row} onClose={() => setForm(null)} onSuccess={() => finish(form.row ? "Data kecamatan berhasil diperbarui." : "Kecamatan berhasil ditambahkan.")} />}
 {remove && <DeleteModal title="Hapus Kecamatan?" onClose={() => setRemove(null)} onDelete={async () => { await send("/api/admin/kecamatan", "DELETE", { id: remove.id }); finish("Kecamatan berhasil dihapus."); }}>Hapus kecamatan <strong>{remove.nama_kecamatan} ({remove.kode_wilayah})</strong>? Kecamatan yang masih digunakan oleh data luas tanam tidak dapat dihapus.</DeleteModal>}
 {success && <Success text={success} onClose={() => setSuccess("")} />}</div>;
}
