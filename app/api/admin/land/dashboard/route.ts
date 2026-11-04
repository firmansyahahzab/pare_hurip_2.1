import { NextResponse } from "next/server";
import { guarded, rpc, readFilters, RequestError } from "@/lib/land/server";
export async function GET(req: Request) { return guarded(req, async () => {
 const f = readFilters(req); if (!f.year) throw new RequestError("Pilih tahun.");
 return NextResponse.json(await rpc("ph_lahan_dashboard", { p_year: Number(f.year), p_month: f.month ? Number(f.month) : null, p_district: f.district || null }));
}); }
