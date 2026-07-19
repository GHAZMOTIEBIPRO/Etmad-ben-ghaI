import { NextResponse } from "next/server";
import { getCompanyProfile } from "@/lib/repository";

export async function GET(_: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  try { const profile = await getCompanyProfile(slug); if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 }); return NextResponse.json(profile); }
  catch (error) { console.error("GET /api/companies/[slug] failed", error); return NextResponse.json({ error: "تعذر تحميل الشركة" }, { status: 500 }); }
}
