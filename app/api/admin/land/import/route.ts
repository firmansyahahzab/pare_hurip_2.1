import { NextResponse } from "next/server";
import { guarded, rpc, jsonBody, RequestError } from "@/lib/land/server";
import { normalizeRow, previewRows, uuidValid, type Options } from "@/lib/land/domain";
import { parseExcel } from "@/lib/land/excel";
export const runtime = "nodejs";
export async function POST(req: Request) { return guarded(req, async () => {
 if (req.headers.get("content-type")?.includes("multipart/form-data")) {
  if (Number(req.headers.get("content-length") || 0) > 11 * 1024 * 1024) throw new RequestError("File melebihi 10 MB.", 413);
  const form = await req.formData(); const file = form.get("file");
  if (!(file instanceof File)) throw new RequestError("Pilih file Excel terlebih dahulu.");
  const raw = await parseExcel(file);
  const [options, existing] = await Promise.all([rpc<Options>("ph_lahan_options"), rpc<{ kode_wilayah: string; periode: string }[]>("ph_lahan_existing", { p_rows: raw })]);
  return NextResponse.json({ rows: previewRows(raw, options.regions, existing), raw });
 }
 const b = await jsonBody(req);
 if (!uuidValid(b.requestId) || !Array.isArray(b.rows) || b.rows.length < 1 || b.rows.length > 5000) throw new RequestError("Permintaan impor tidak valid.");
 // Database memvalidasi ulang setiap baris, termasuk relasi, duplikasi dan batas angka.
 return NextResponse.json(await rpc("ph_lahan_import", { p_request: b.requestId, p_rows: b.rows.map(normalizeRow) }));
}); }
