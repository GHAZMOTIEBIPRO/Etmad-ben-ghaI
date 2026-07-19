import { NextResponse } from "next/server";
import { getTender } from "@/lib/repository";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try { const tender = await getTender(id); if (!tender) return NextResponse.json({ error: "Not found" }, { status: 404 }); return NextResponse.json(tender); }
  catch (error) { console.error("GET /api/tenders/[id] failed", error); return NextResponse.json({ error: "تعذر تحميل المنافسة" }, { status: 500 }); }
}
