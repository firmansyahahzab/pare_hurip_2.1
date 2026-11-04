import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RequestError, databaseError } from "@/lib/land/server";

type AccountInput = { name: string; email: string; password: string; adminModule?: "ksa" | "land" };
type SavedProfile = { id: string; name: string; email: string; role: string; admin_module?: string | null };

/** Called only after the API verifies the caller is a superadmin. */
export async function provisionAdmin(admin: SupabaseClient, input: AccountInput): Promise<void> {
 const { name, email, password, adminModule } = input;
 const columns = "id,name,email,role" + (adminModule ? ",admin_module" : "");
 // Check the schema/credentials before creating an Auth identity.
 const ready = await admin.from("profiles").select(columns, { head: true }).limit(0);
 if (ready.error) databaseError(ready.error);
 const { data, error } = await admin.auth.admin.createUser({
  email, password, email_confirm: true, user_metadata: { name },
  app_metadata: { parehurip_admin: true, ...(adminModule ? { admin_module: adminModule } : {}) },
 });
 if (error || !data.user) {
  if (error && ["email_exists", "user_already_exists"].includes(error.code ?? "")) {
   throw new RequestError("Email sudah terdaftar. Gunakan email lain atau edit akun yang sudah ada.", 409, { email: "Email sudah terdaftar." });
  }
  throw new RequestError("Akun belum dapat dibuat. Periksa koneksi dan pengaturan layanan akun.", 502);
 }
 const id = data.user.id;
 try {
  // Create the profile ourselves; an installed trigger may already have created it.
  // Only the new Auth ID is written. Role is never taken from the request body.
  const { data: profile, error: saveError } = await admin.from("profiles").upsert({
   id, name, email, role: "admin", ...(adminModule ? { admin_module: adminModule } : {}),
  }, { onConflict: "id" }).select(columns).single<SavedProfile>();
  if (saveError || !profile || profile.id !== id || profile.name !== name || profile.email !== email ||
      profile.role !== "admin" || (adminModule && profile.admin_module !== adminModule)) {
   throw new Error("Profile was not saved as requested");
  }
 } catch {
  // Auth and PostgREST are separate transactions: compensate on profile failure.
  let removed = false;
  try { removed = !(await admin.auth.admin.deleteUser(id)).error; } catch { /* Report incomplete cleanup below. */ }
  throw new RequestError(removed
   ? "Akun belum berhasil disimpan dan pembuatan telah dibatalkan. Silakan coba lagi."
   : "Akun login sudah dibuat, tetapi profil admin belum terverifikasi dan pembatalan belum berhasil. Hubungi pengelola untuk pemeriksaan sebelum mencoba kembali.",
  500);
 }
}
