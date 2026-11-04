import { NextResponse } from "next/server";
import { guarded, rpc } from "@/lib/land/server";
export async function GET(req: Request) { return guarded(req, async () => NextResponse.json(await rpc("ph_lahan_options"))); }
