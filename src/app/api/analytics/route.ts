import { NextResponse } from "next/server";
import { getAnalytics } from "@/lib/repository";

export const dynamic = "force-dynamic";
export async function GET() {
  try { return NextResponse.json(await getAnalytics()); }
  catch (error) { console.error("GET /api/analytics failed", error); return NextResponse.json({ error: "تعذر تحميل التحليلات" }, { status: 500 }); }
}
