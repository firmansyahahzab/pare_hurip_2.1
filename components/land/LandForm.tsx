"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, RotateCcw } from "lucide-react";
import { ApiError, message, send } from "@/lib/land/client";
import { normalizeArea, validateLand, type Land, type LandInput, type Region } from "@/lib/land/domain";
import { Field, Notice, Modal, Success, Loading, useOptions } from "./Common";
function Form({ initial, regions, onCancel, onSuccess, setBusyParent }: { initial?: Land; regions: Region[]; onCancel: () => void; onSuccess: () => void; setBusyParent?: (v: boolean) => void }) {
 const defaults = (): LandInput => ({ kode_wilayah: initial?.kode_wilayah ?? "", periode: initial?.periode ?? "", luas_ha: initial ? String(initial.luas_ha) : "", keterangan: initial?.keterangan ?? "" });
 const [data, setData] = useState(defaults); const [fields, setFields] = useState<Record<string, string>>({}); const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const lock = useRef(false);
 const update = (key: keyof LandInput, value: string) => { setData(d => ({ ...d, [key]: value })); setFields(f => ({ ...f, [key]: "" })); };
 const submit = async (event: React.FormEvent) => {
  event.preventDefault(); if (lock.current) return;
  const next = validateLand(data); if (!regions.some(r => r.kode_wilayah === data.kode_wilayah)) next.kode_wilayah = "Pilih kecamatan yang terdaftar.";
  setFields(next); setError(""); if (Object.keys(next).length) return;
  lock.current = true; setBusy(true); setBusyParent?.(true);
  try { await send("/api/admin/land", initial ? "PATCH" : "POST", { ...data, luas_ha: normalizeArea(data.luas_ha), ...(initial ? { id: initial.id } : {}) }); onSuccess(); }
  catch (e) { setError(message(e)); if (e instanceof ApiError) setFields(e.fields); }
  finally { lock.current = false; setBusy(false); setBusyParent?.(false); }
 };
 return <form onSubmit={submit} noValidate><div className="ph-form-body"><Notice error={error} />{!regions.length && <Notice error="Tambahkan kecamatan melalui Referensi Wilayah sebelum mengisi data." />}
 <Field label="Kecamatan" htmlFor="land-district" error={fields.kode_wilayah} required><select id="land-district" value={data.kode_wilayah} onChange={e => update("kode_wilayah", e.target.value)} disabled={busy} aria-invalid={!!fields.kode_wilayah} aria-describedby={fields.kode_wilayah ? "land-district-error" : undefined}><option value="">Pilih kecamatan</option>{regions.map(r => <option key={r.id} value={r.kode_wilayah}>{r.nama_kecamatan} — {r.kode_wilayah}</option>)}</select></Field>
 <Field label="Periode" htmlFor="land-period" error={fields.periode} required><input id="land-period" type="month" min="1900-01" max="9999-12" value={data.periode.slice(0, 7)} disabled={busy} aria-invalid={!!fields.periode} aria-describedby={fields.periode ? "land-period-error" : undefined} onChange={e => update("periode", e.target.value ? `${e.target.value}-01` : "")} /></Field>
 <Field label="Luas Lahan Tanam" htmlFor="land-area" error={fields.luas_ha} required><div className="ph-suffix"><input id="land-area" inputMode="decimal" value={data.luas_ha} onChange={e => update("luas_ha", e.target.value)} placeholder="Contoh: 25,5" disabled={busy} aria-invalid={!!fields.luas_ha} aria-describedby={fields.luas_ha ? "land-area-error" : undefined} /><span>ha</span></div></Field>
 <Field label="Keterangan (opsional)" htmlFor="land-note" error={fields.keterangan}><textarea id="land-note" value={data.keterangan} onChange={e => update("keterangan", e.target.value)} maxLength={500} rows={4} disabled={busy} placeholder="Catatan tambahan mengenai data luas tanam" /><small>{data.keterangan.length}/500</small></Field></div>
 <div className="ph-actions">{!initial && <button className="ph-btn mr-auto" type="button" disabled={busy} onClick={() => { setData(defaults()); setFields({}); setError(""); }}><RotateCcw size={16} /> Reset Form</button>}<button className="ph-btn" type="button" disabled={busy} onClick={onCancel}>Batal</button><button className="ph-btn ph-primary" type="submit" disabled={busy || !regions.length}><Save size={16} />{busy ? "Menyimpan…" : initial ? "Simpan Perubahan" : "Simpan Data"}</button></div></form>;
}
export function EditLand({ row, regions, onClose, onSuccess }: { row: Land; regions: Region[]; onClose: () => void; onSuccess: () => void }) {
 const [busy, setBusy] = useState(false);
 return <Modal title="Edit Data Luas Lahan Tanam" onClose={onClose} busy={busy}><Form initial={row} regions={regions} onCancel={onClose} onSuccess={onSuccess} setBusyParent={setBusy} /></Modal>;
}
export default function NewLand() {
 const { options, error, loading } = useOptions(); const [success, setSuccess] = useState(false); const router = useRouter();
 const back = () => router.push("/admin/land-data");
 return <div className="ph-page"><div className="ph-intro"><h2>Tambah Data Manual Luas Lahan Tanam</h2><p>Masukkan data luas tanam untuk satu kecamatan dan satu periode bulanan.</p></div><Notice error={error} />{loading ? <Loading /> : <section className="ph-panel"><div className="ph-panel-heading"><h3>Form Input Data</h3><span className="ph-muted">Tanda * wajib diisi</span></div><Form regions={options.regions} onCancel={back} onSuccess={() => setSuccess(true)} /></section>}{success && <Success text="Data luas lahan tanam berhasil ditambahkan." onClose={back} />}</div>;
}
