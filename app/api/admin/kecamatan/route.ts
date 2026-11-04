import { NextResponse } from "next/server";
import { guarded, rpc, jsonBody, RequestError } from "@/lib/land/server";
import { uuidValid } from "@/lib/land/domain";
async function save(req: Request, edit: boolean) { return guarded(req, async () => {
 const b = await jsonBody(req); const code = typeof b.kode_wilayah === "string" ? b.kode_wilayah.trim() : "";
 const name = typeof b.nama_kecamatan === "string" ? b.nama_kecamatan.trim() : "";
 const fields: Record<string, string> = {};
 if (!code || code.length > 20) fields.kode_wilayah = "Kode wajib diisi, maksimum 20 karakter.";
 if (!name || name.length > 100) fields.nama_kecamatan = "Nama wajib diisi, maksimum 100 karakter.";
 if (Object.keys(fields).length) throw new RequestError("Periksa isian formulir.", 400, fields);
 if (edit && !uuidValid(b.id)) throw new RequestError("ID kecamatan tidak valid.");
 const id = await rpc("ph_kecamatan_save", { p_id: edit ? b.id : null, p_code: code, p_name: name });
 return NextResponse.json({ success: true, id });
}); }
export async function POST(req: Request) { return save(req, false); }
export async function PATCH(req: Request) { return save(req, true); }
export async function DELETE(req: Request) { return guarded(req, async () => {
 const b = await jsonBody(req); if (!uuidValid(b.id)) throw new RequestError("ID kecamatan tidak valid.");
 await rpc("ph_kecamatan_delete", { p_id: b.id }); return NextResponse.json({ success: true });
}); }
