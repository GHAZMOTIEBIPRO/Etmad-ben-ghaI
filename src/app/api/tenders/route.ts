import { NextRequest, NextResponse } from "next/server";
import { listTenders } from "@/lib/repository";
import { tenderQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = tenderQuerySchema.safeParse(params);
  if (!parsed.success) return NextResponse.json({ error: "Invalid query parameters", details: parsed.error.flatten() }, { status: 400 });
  try { return NextResponse.json(await listTenders(parsed.data)); }
  catch (error) { console.error("GET /api/tenders failed", error); return NextResponse.json({ error: "تعذر تحميل المنافسات" }, { status: 500 }); }
}
