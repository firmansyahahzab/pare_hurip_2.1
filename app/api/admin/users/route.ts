import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { provisionAdmin } from "@/lib/supabase/provision-admin";
import { guarded, jsonBody, rpc, RequestError, databaseError } from "@/lib/land/server";
import { isStrongPassword } from "@/lib/password";
import { isValidEmail } from "@/lib/email";
import { uuidValid, type AdminUser } from "@/lib/land/domain";
function fields(b: Record<string, unknown>, edit: boolean) {
 const name = typeof b.name === "string" ? b.name.trim() : "";
 const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
 const password = typeof b.password === "string" ? b.password : "";
 const errors: Record<string, string> = {};
 if (!name || name.length > 100) errors.name = "Nama wajib diisi, maksimum 100 karakter.";
 if (!isValidEmail(email) || email.length > 254) errors.email = "Masukkan email yang valid.";
 if ((!edit || password) && !isStrongPassword(password)) errors.password = "Minimal 8 karakter: huruf besar, huruf kecil, angka, dan simbol.";
 if (password.length > 128) errors.password = "Password maksimum 128 karakter.";
 if (Object.keys(errors).length) throw new RequestError("Periksa isian formulir.", 400, errors);
 return { name, email, password };
}
export async function GET(req: Request) { return guarded(req, async () => {
 const admin = createAdminClient(); const users: AdminUser[] = [];
 for (let start = 0; ; start += 1000) {
  const { data, error } = await admin.from("profiles").select("id,name,email,role,created_at").in("role", ["admin", "superadmin"]).order("created_at", { ascending: false }).order("id").range(start, start + 999);
  if (error) databaseError(error);
  users.push(...data as AdminUser[]); if (data.length < 1000) break;
 }
 return NextResponse.json({ users });
}, true); }
export async function POST(req: Request) { return guarded(req, async () => {
 const { name, email, password } = fields(await jsonBody(req), false);
 await provisionAdmin(createAdminClient(), { name, email, password });
 return NextResponse.json({ success: true });
}, true); }
export async function PATCH(req: Request) { return guarded(req, async () => {
 const b = await jsonBody(req); const { name, email, password } = fields(b, true);
 if (!uuidValid(b.userId)) throw new RequestError("ID pengguna tidak valid.");
 await rpc("ph_lahan_options"); const admin = createAdminClient();
 const { data: target, error: targetError } = await admin.from("profiles").select("role").eq("id", b.userId).single();
 if (targetError || !target || !["admin", "superadmin"].includes(target.role)) throw new RequestError("Pengguna admin tidak ditemukan.", 404);
 // Perubahan Auth dan sinkronisasi profil berjalan dalam satu transaksi melalui trigger.
 const { error } = await admin.auth.admin.updateUserById(b.userId, { email, email_confirm: true, user_metadata: { name }, ...(password ? { password } : {}) });
 if (error) throw new RequestError(error.message);
 const { data: profile, error: check } = await admin.from("profiles").select("name,email,role").eq("id", b.userId).single();
 if (check || profile?.email !== email || profile?.name !== name || profile?.role !== target.role) throw new RequestError("Perubahan Auth selesai tetapi profil belum terverifikasi. Hubungi pengelola untuk memeriksa trigger sinkronisasi.", 500);
 return NextResponse.json({ success: true });
}, true); }
export async function DELETE(req: Request) { return guarded(req, async () => {
 const b = await jsonBody(req); if (!uuidValid(b.id)) throw new RequestError("ID pengguna tidak valid.");
 const admin = createAdminClient(); const { data: target, error } = await admin.from("profiles").select("role").eq("id", b.id).single();
 if (error || !target) throw new RequestError("Pengguna tidak ditemukan.", 404);
 if (target.role === "superadmin") throw new RequestError("Akun superadmin tidak boleh dihapus.", 403);
 const [land, ksa] = await Promise.all([
  admin.from("luas_lahan_tanam").select("id", { count: "exact", head: true }).eq("created_by", b.id),
  admin.from("data_ksa").select("id", { count: "exact", head: true }).eq("created_by", b.id)
 ]);
 if (land.error) databaseError(land.error); if (ksa.error) databaseError(ksa.error);
 if (land.count || ksa.count) throw new RequestError("Akun masih tercatat sebagai penginput data. Penghapusan ditolak agar riwayat data tetap utuh.", 409);
 const result = await admin.auth.admin.deleteUser(b.id);
 if (result.error) throw new RequestError("Akun gagal dihapus. Pastikan tidak sedang digunakan data lain dan migrasi Auth sudah diterapkan.", 409);
 const check = await admin.from("profiles").select("id").eq("id", b.id).maybeSingle();
 if (check.error || check.data) throw new RequestError("Penghapusan profil belum terverifikasi. Hubungi pengelola.", 500);
 return NextResponse.json({ success: true });
}, true); }
