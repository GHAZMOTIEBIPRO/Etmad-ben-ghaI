import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "قاعدة البيانات غير مهيأة" }, { status: 503 });

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const source = request.nextUrl.searchParams.get("source")?.trim() ?? "";
  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get("pageSize") ?? 25) || 25));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  let query = supabase
    .from("public_datasets")
    .select("source_key,external_id,title,description,organization,category,format,dataset_url,resource_url,source_updated_at,updated_at", { count: "exact" })
    .order("source_updated_at", { ascending: false, nullsFirst: false })
    .range(from, to);

  if (source) query = query.eq("source_key", source);
  if (q) query = query.or(`title.ilike.%${q.replace(/[%_,]/g, " ")}%,description.ilike.%${q.replace(/[%_,]/g, " ")}%,organization.ilike.%${q.replace(/[%_,]/g, " ")}%`);

  const { data, count, error } = await query;
  if (error) {
    console.error("GET /api/public-datasets failed", error);
    return NextResponse.json({ error: "تعذر تحميل البيانات المفتوحة", details: error.message }, { status: 500 });
  }

  const total = count ?? 0;
  return NextResponse.json({
    items: data ?? [],
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}
