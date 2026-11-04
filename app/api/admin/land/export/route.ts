import { guarded, rpc, readFilters } from "@/lib/land/server";
import { type Land } from "@/lib/land/domain";
import { excelResponse } from "@/lib/land/excel";
export const runtime = "nodejs";
export async function GET(req: Request) { return guarded(req, async () => excelResponse(await rpc<Land[]>("ph_lahan_export", { p_filter: readFilters(req) }))); }
