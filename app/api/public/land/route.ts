import { NextResponse } from "next/server";
import { rpc, readFilters, RequestError } from "@/lib/land/server";
import type { PublicLandData } from "@/lib/land/public";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
export async function GET(request: Request) {
 try {
  const filters = readFilters(request);
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
   throw new RequestError("Layanan data luas tanam belum tersedia. Silakan coba lagi nanti.", 503);
  }
  const data = await rpc<PublicLandData>("ph_public_lahan_dashboard", {
   p_year: filters.year ? Number(filters.year) : null,
   p_month: filters.month ? Number(filters.month) : null,
   p_district: filters.district || null,
  });
  return NextResponse.json(data, { headers });
 } catch (error) {
  const status = error instanceof RequestError ? error.status : 500;
  return NextResponse.json({ error: status === 400 ? "Filter tidak valid." : "Data luas tanam belum dapat dimuat. Silakan coba lagi nanti." }, { status, headers });
 }
}
