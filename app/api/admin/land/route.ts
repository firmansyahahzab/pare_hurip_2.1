import { NextResponse } from "next/server";
import { guarded, rpc, jsonBody, readFilters, RequestError } from "@/lib/land/server";
import { normalizeRow, uuidValid, validateLand } from "@/lib/land/domain";
export async function GET(req: Request) { return guarded(req, async () => {
 const p = new URL(req.url).searchParams; const page = Number(p.get("page") || 1); const size = Number(p.get("size") || 10);
 if (!Number.isInteger(page) || !Number.isInteger(size) || page < 1 || ![10, 25, 50].includes(size)) throw new RequestError("Pagination tidak valid.");
 return NextResponse.json(await rpc("ph_lahan_list", { p_filter: readFilters(req), p_page: page, p_size: size }));
}); }
async function save(req: Request, edit: boolean) { return guarded(req, async () => {
 const body = await jsonBody(req); const row = normalizeRow(body, 0); const fields = validateLand(row);
 if (Object.keys(fields).length) throw new RequestError("Periksa isian formulir.", 400, fields);
 if (edit && !uuidValid(body.id)) throw new RequestError("ID data tidak valid.");
 const id = await rpc("ph_lahan_save", { p_id: edit ? body.id : null, p_data: row });
 return NextResponse.json({ success: true, id });
}); }
export async function POST(req: Request) { return save(req, false); }
export async function PATCH(req: Request) { return save(req, true); }
export async function DELETE(req: Request) { return guarded(req, async () => {
 const body = await jsonBody(req); if (!uuidValid(body.id)) throw new RequestError("ID data tidak valid.");
 await rpc("ph_lahan_delete", { p_id: body.id }); return NextResponse.json({ success: true });
}); }
