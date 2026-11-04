import { guarded, rpc } from "@/lib/land/server";
import { type Options } from "@/lib/land/domain";
import { excelResponse } from "@/lib/land/excel";
export const runtime = "nodejs";
export async function GET(req: Request) { return guarded(req, async () => excelResponse(null, (await rpc<Options>("ph_lahan_options")).regions)); }
