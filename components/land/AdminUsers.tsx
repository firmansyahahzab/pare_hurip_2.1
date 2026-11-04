"use client";
import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Pencil, Plus, Trash2, Users, Search } from "lucide-react";
import { ApiError, api, message, send } from "@/lib/land/client";
import { type AdminUser } from "@/lib/land/domain";
import { useAdminAuth } from "@/components/pages/admin-page/AdminAuthContext";
import { isStrongPassword } from "@/lib/password";
import { isValidEmail } from "@/lib/email";
import { DeleteModal, Empty, Field, Loading, Modal, Notice, Pager, Success } from "./Common";
function UserForm({ user, onClose, onSuccess }: { user: AdminUser | null; onClose: () => void; onSuccess: () => void }) {
 const [name, setName] = useState(user?.name ?? ""); const [email, setEmail] = useState(user?.email ?? ""); const [password, setPassword] = useState(""); const [visible, setVisible] = useState(false);
 const [error, setError] = useState(""); const [fields, setFields] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false); const lock = useRef(false);
 const submit = async (e: React.FormEvent) => {
  e.preventDefault(); if (lock.current) return; const errs: Record<string, string> = {};
  if (!name.trim()) errs.name = "Nama lengkap wajib diisi."; if (!isValidEmail(email.trim())) errs.email = "Masukkan email yang valid.";
  if ((!user || password) && !isStrongPassword(password)) errs.password = "Minimal 8 karakter: huruf besar, huruf kecil, angka, dan simbol.";
  setFields(errs); if (Object.keys(errs).length) return;
  setError(""); lock.current = true; setBusy(true);
  try { await send("/api/admin/users", user ? "PATCH" : "POST", { name, email, password, ...(user ? { userId: user.id } : {}) }); onSuccess(); }
  catch (e) { setError(message(e)); if (e instanceof ApiError) setFields(e.fields); } finally { setBusy(false); lock.current = false; }
 };
 return <Modal title={user ? "Edit Pengguna Admin" : "Tambah Admin Baru"} onClose={onClose} busy={busy}><p className="ph-dialog-subtitle">{user ? "Perbarui identitas pengguna. Peran tidak dapat diubah melalui formulir ini." : "Tambahkan akun admin untuk mengelola data."}</p><form onSubmit={submit} noValidate><div className="ph-form-body"><Notice error={error} />
 <Field label="Nama Lengkap" htmlFor="user-name" error={fields.name} required><input id="user-name" value={name} onChange={e => setName(e.target.value)} maxLength={100} disabled={busy} autoComplete="name" aria-invalid={!!fields.name} aria-describedby={fields.name ? "user-name-error" : undefined} /></Field>
 <Field label="Email" htmlFor="user-email" error={fields.email} required><input id="user-email" type="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={254} disabled={busy} autoComplete="email" aria-invalid={!!fields.email} aria-describedby={fields.email ? "user-email-error" : undefined} /></Field>
 <Field label={user ? "Password Baru (opsional)" : "Password"} htmlFor="user-password" error={fields.password} required={!user}><div className="ph-password"><input id="user-password" type={visible ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} disabled={busy} maxLength={128} autoComplete="new-password" aria-invalid={!!fields.password} aria-describedby={fields.password ? "user-password-error" : undefined} /><button className="ph-icon" type="button" aria-label={visible ? "Sembunyikan password" : "Tampilkan password"} onClick={() => setVisible(v => !v)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div><small>{user ? "Kosongkan jika tidak ingin mengubah password. " : ""}Minimal 8 karakter: huruf besar, huruf kecil, angka, dan simbol.</small></Field>
 {user && <div className="ph-field"><span>Peran</span><strong>{user.role === "superadmin" ? "Superadmin" : "Admin"}</strong></div>}</div><div className="ph-actions"><button className="ph-btn" type="button" onClick={onClose} disabled={busy}>Batal</button><button className="ph-btn ph-primary" disabled={busy}>{busy ? "Menyimpan…" : user ? "Simpan Perubahan" : "Simpan"}</button></div></form></Modal>;
}
export default function AdminUsers() {
 const { role } = useAdminAuth(); const [rows, setRows] = useState<AdminUser[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [revision, setRevision] = useState(0);
 const [form, setForm] = useState<{ user: AdminUser | null } | null>(null); const [remove, setRemove] = useState<AdminUser | null>(null); const [success, setSuccess] = useState(""); const [search, setSearch] = useState(""); const [page, setPage] = useState(1);
 useEffect(() => { if (role !== "superadmin") return; let active = true; setLoading(true); api<{ users: AdminUser[] }>("/api/admin/users").then(r => { if (active) { setRows(r.users); setError(""); } }).catch(e => { if (active) setError(message(e)); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [role, revision]);
 if (role !== "superadmin") return <div className="ph-page"><Notice error="Hanya superadmin yang dapat mengelola pengguna admin." /></div>;
 const filtered = rows.filter(r => `${r.name} ${r.email}`.toLowerCase().includes(search.toLowerCase())); const current = Math.min(page, Math.max(1, Math.ceil(filtered.length / 10)));
 const finish = (text: string) => { setForm(null); setRemove(null); setSuccess(text); setRevision(r => r + 1); };
 return <div className="ph-page"><Notice error={error} /><section className="ph-panel"><div className="ph-panel-heading"><div className="ph-heading-icon"><Users /><div><h2>Manajemen Pengguna</h2><p>Kelola akun admin yang dapat mengakses sistem.</p></div></div><button className="ph-btn ph-primary" onClick={() => setForm({ user: null })}><Plus size={17} />Tambah Admin</button></div>
 <div className="ph-search"><Search size={17} /><input aria-label="Cari pengguna admin" value={search} placeholder="Cari nama atau email…" onChange={e => { setSearch(e.target.value); setPage(1); }} /></div>
 {loading ? <Loading /> : !filtered.length ? <Empty /> : <div className="ph-table-wrap"><table className="ph-table ph-table-plain"><thead><tr><th>Nama / Email</th><th>Jabatan</th><th>Tanggal dibuat</th><th>Aksi</th></tr></thead><tbody>{filtered.slice((current - 1) * 10, current * 10).map(r => <tr key={r.id}><td><strong>{r.name}</strong><small>{r.email}</small></td><td><span className="ph-badge">{r.role === "superadmin" ? "Superadmin" : "Admin"}</span></td><td>{new Date(r.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" })}</td><td><div className="ph-row-actions"><button className="ph-icon ph-edit" aria-label={`Edit ${r.name}`} onClick={() => setForm({ user: r })}><Pencil size={16} /></button>{r.role !== "superadmin" && <button className="ph-icon ph-delete" aria-label={`Hapus ${r.name}`} onClick={() => setRemove(r)}><Trash2 size={16} /></button>}</div></td></tr>)}</tbody></table></div>}
 <Pager page={current} count={filtered.length} size={10} onPage={setPage} /></section>
 {form && <UserForm user={form.user} onClose={() => setForm(null)} onSuccess={() => finish(form.user ? "Data pengguna admin berhasil diperbarui." : "Pengguna admin berhasil ditambahkan.")} />}
 {remove && <DeleteModal title="Hapus Pengguna Admin?" onClose={() => setRemove(null)} onDelete={async () => { await send("/api/admin/users", "DELETE", { id: remove.id }); finish("Pengguna admin berhasil dihapus."); }}>Yakin ingin menghapus <strong>{remove.name} ({remove.email})</strong>? Tindakan ini tidak dapat dibatalkan.</DeleteModal>}
 {success && <Success text={success} onClose={() => setSuccess("")} />}</div>;
}
