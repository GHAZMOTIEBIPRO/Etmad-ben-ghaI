import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type DatasetRow = {
  source_key: string;
  external_id: string;
  title: string;
  description: string;
  organization: string | null;
  category: string | null;
  format: string | null;
  dataset_url: string | null;
  resource_url: string | null;
  source_updated_at: string | null;
};

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeZone: "Asia/Riyadh" }).format(date);
}

function sourceLabel(sourceKey: string): string {
  if (sourceKey === "balady-open-data") return "بلدي";
  if (sourceKey === "riyadh-municipality-open-data") return "أمانة الرياض";
  return "البيانات الوطنية";
}

export default async function PublicDataPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const q = first(raw.q).trim();
  const source = first(raw.source).trim();
  const page = Math.max(1, Number(first(raw.page) || 1) || 1);
  const pageSize = 30;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  let rows: DatasetRow[] = [];
  let total = 0;
  let errorMessage = "";

  if (!url || !key) {
    errorMessage = "قاعدة البيانات غير مهيأة بعد لحفظ كتالوجات البيانات المفتوحة.";
  } else {
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let query = supabase
      .from("public_datasets")
      .select("source_key,external_id,title,description,organization,category,format,dataset_url,resource_url,source_updated_at", { count: "exact" })
      .order("source_updated_at", { ascending: false, nullsFirst: false })
      .range(from, to);

    if (source) query = query.eq("source_key", source);
    if (q) {
      const safe = q.replace(/[%_,]/g, " ");
      query = query.or(`title.ilike.%${safe}%,description.ilike.%${safe}%,organization.ilike.%${safe}%`);
    }

    const result = await query;
    if (result.error) errorMessage = result.error.message;
    else {
      rows = (result.data ?? []) as DatasetRow[];
      total = result.count ?? 0;
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const querySuffix = `${q ? `&q=${encodeURIComponent(q)}` : ""}${source ? `&source=${encodeURIComponent(source)}` : ""}`;

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
      <section className="surface-card rounded-[2rem] p-6 sm:p-8">
        <div className="max-w-4xl">
          <div className="text-xs font-black text-emerald-700">بيانات مجانية 100%</div>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">البيانات المفتوحة</h1>
          <p className="mt-3 leading-7 text-slate-600">مجموعات بيانات حكومية مجانية يجمعها الرادار من الواجهات والبوابات المفتوحة، وتبقى منفصلة عن المنافسات حتى لا نخلط بيانات السوق بالفرص التعاقدية.</p>
        </div>

        <form className="mt-6 grid gap-3 md:grid-cols-[1fr_240px_auto]">
          <input name="q" defaultValue={q} placeholder="ابحث: منافسات، رخص بناء، مقاولين، طرق، إسكان..." className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-emerald-600" />
          <select name="source" defaultValue={source} className="h-12 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-emerald-600">
            <option value="">كل المصادر</option>
            <option value="balady-open-data">بلدي</option>
            <option value="riyadh-municipality-open-data">أمانة الرياض</option>
            <option value="saudi-open-data">البوابة الوطنية للبيانات المفتوحة</option>
          </select>
          <button className="h-12 rounded-xl bg-emerald-800 px-6 text-sm font-black text-white">بحث</button>
        </form>
      </section>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
        <span>إجمالي السجلات المطابقة: <strong className="text-slate-950">{total.toLocaleString("ar-SA")}</strong></span>
        <Link href="/sources" className="font-black text-emerald-800 hover:underline">مراقبة حالة المصادر ←</Link>
      </div>

      {errorMessage ? (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-bold leading-7 text-amber-900">
          تعذر قراءة جدول البيانات المفتوحة حاليًا: {errorMessage}
        </div>
      ) : null}

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        {rows.map((row) => (
          <article key={`${row.source_key}:${row.external_id}`} className="surface-card rounded-2xl p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-black leading-7 text-slate-950">{row.title}</h2>
                <div className="mt-1 text-xs font-bold text-slate-400">{row.organization || "جهة حكومية"}</div>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-900">{sourceLabel(row.source_key)}</span>
            </div>
            {row.description ? <p className="mt-3 line-clamp-3 text-sm leading-7 text-slate-600">{row.description}</p> : null}
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
              {row.category ? <span className="rounded-lg bg-slate-100 px-2.5 py-1">{row.category}</span> : null}
              {row.format ? <span className="rounded-lg bg-slate-100 px-2.5 py-1">{row.format}</span> : null}
              <span className="rounded-lg bg-slate-100 px-2.5 py-1">تحديث المصدر: {formatDate(row.source_updated_at)}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-sm font-black text-emerald-800">
              {row.resource_url ? <a href={row.resource_url} target="_blank" rel="noreferrer" className="hover:underline">تحميل الملف ↗</a> : null}
              {row.dataset_url ? <a href={row.dataset_url} target="_blank" rel="noreferrer" className="hover:underline">فتح المصدر ↗</a> : null}
            </div>
          </article>
        ))}
      </section>

      {!rows.length && !errorMessage ? <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500">لا توجد نتائج مطابقة حاليًا.</div> : null}

      <div className="mt-8 flex items-center justify-center gap-3">
        <Link href={`/data?page=${Math.max(1, page - 1)}${querySuffix}`} className={`rounded-xl border bg-white px-4 py-2 text-sm font-black ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}>السابق</Link>
        <span className="text-sm font-bold text-slate-500">صفحة {page.toLocaleString("ar-SA")} من {totalPages.toLocaleString("ar-SA")}</span>
        <Link href={`/data?page=${Math.min(totalPages, page + 1)}${querySuffix}`} className={`rounded-xl border bg-white px-4 py-2 text-sm font-black ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`}>التالي</Link>
      </div>
    </main>
  );
}
