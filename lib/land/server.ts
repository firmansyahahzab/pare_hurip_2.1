import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/auth-guard";
import { type Filters } from "./domain";
export class RequestError extends Error {
 constructor(message: string, public status = 400, public fields?: Record<string, string>) { super(message); }
}
export function databaseError(error: { code?: string; message: string }): never {
 const code = error.code;
 if (code === "23505") throw new RequestError("Data sudah ada. Periksa kode wilayah atau pasangan kecamatan dan periode.", 409);
 if (code === "23503") throw new RequestError("Data masih digunakan atau referensinya tidak ditemukan. Kecamatan/akun yang masih terkait data tidak dapat dihapus.", 409);
 if (code === "42501") throw new RequestError("Akses ditolak. Periksa peran akun dan migrasi akses database.", 403);
 if (code === "P0002") throw new RequestError("Data tidak ditemukan; muat ulang daftar.", 404);
 if (["PGRST202", "42P01", "42883"].includes(code ?? "")) throw new RequestError("Struktur database belum siap. Jalankan migrasi 001_luas_tanam.sql terlebih dahulu.", 503);
 if (["22023", "23514", "22007", "22008", "22003"].includes(code ?? "")) throw new RequestError(error.message, 400);
 throw new RequestError("Operasi database gagal. Silakan coba lagi atau periksa konfigurasi Supabase.", 500);
}
export async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
 const client = await createClient();
 const { data, error } = await client.rpc(name, args);
 if (error) databaseError(error);
 return data as T;
}
export async function guarded(request: Request, run: () => Promise<Response>, superOnly = false) {
 try {
  if (request.method !== "GET") {
   const origin = request.headers.get("origin");
   if (origin && origin !== new URL(request.url).origin) throw new RequestError("Asal permintaan tidak diizinkan.", 403);
  }
  const auth = await requireAdmin(superOnly ? ["superadmin"] : ["admin", "superadmin"]);
  if (auth.error) return auth.error;
  return await run();
 } catch (e) {
  const err = e instanceof RequestError ? e : new RequestError("Permintaan gagal. Periksa koneksi dan konfigurasi server.", 500);
  return NextResponse.json({ error: err.message, fields: err.fields }, { status: err.status, headers: { "Cache-Control": "no-store" } });
 }
}
export async function jsonBody(request: Request): Promise<Record<string, unknown>> {
 const raw = await request.text();
 if (raw.length > 10 * 1024 * 1024) throw new RequestError("Permintaan melebihi 10 MB.", 413);
 try { const body = JSON.parse(raw); if (!body || Array.isArray(body) || typeof body !== "object") throw new Error(); return body; }
 catch { throw new RequestError("Isi permintaan tidak valid."); }
}
export function readFilters(request: Request): Filters {
 const s = new URL(request.url).searchParams;
 const result = { year: s.get("year") ?? "", month: s.get("month") ?? "", district: s.get("district") ?? "", search: s.get("search") ?? "" };
 if ((result.year && !/^(19\d{2}|[2-9]\d{3})$/.test(result.year)) || (result.month && !/^(0?[1-9]|1[0-2])$/.test(result.month)) || result.district.length > 20 || result.search.length > 100) throw new RequestError("Filter tidak valid.");
 return result;
}
