import Link from "next/link";
import { listMuqawilContractors } from "@/lib/muqawil-contractors";
import { number } from "@/lib/format";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ContractorsPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const q = Array.isArray(raw.q) ? raw.q[0] ?? "" : raw.q ?? "";
  const rawPage = Array.isArray(raw.page) ? raw.page[0] : raw.page;
  const page = Math.max(1, Number(rawPage ?? 1) || 1);

  let data;
  let errorMessage = "";
  try {
    data = await listMuqawilContractors(page, q);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "تعذر جلب دليل المقاولين";
    data = { items: [], page, totalSaudi: null, totalNonSaudi: null };
  }

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-8">
      <div className="max-w-4xl">
        <div className="text-sm font-black text-emerald-700">دليل السوق</div>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">المقاولون والمنشآت المسجلة</h1>
        <p className="mt-3 leading-7 text-slate-600">عرض مباشر للبيانات العامة المنشورة في دليل منصة مقاول، مع بيانات العضوية والحجم والموقع والتصنيف الظاهر في المصدر.</p>
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-sm font-bold text-slate-500">مقاول سعودي في الدليل</div><div className="mt-2 text-3xl font-black">{data.totalSaudi == null ? "—" : number.format(data.totalSaudi)}</div></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-sm font-bold text-slate-500">مقاول غير سعودي في الدليل</div><div className="mt-2 text-3xl font-black">{data.totalNonSaudi == null ? "—" : number.format(data.totalNonSaudi)}</div></div>
      </div>

      <form className="mt-7 flex gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <input name="q" defaultValue={q} placeholder="ابحث بالاسم، رقم العضوية، المدينة أو التصنيف" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500" />
        <button className="rounded-xl bg-emerald-700 px-5 py-3 font-black text-white">بحث</button>
      </form>

      {errorMessage ? <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">المصدر الحي غير متاح مؤقتًا: {errorMessage}</div> : null}

      <div className="mt-7 grid gap-4 lg:grid-cols-2">
        {data.items.map((contractor) => (
          <article key={contractor.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div><h2 className="text-lg font-black text-slate-950">{contractor.name}</h2><p className="mt-1 text-sm text-slate-500">عضوية: {contractor.membershipNumber || "غير ظاهرة"}</p></div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">{contractor.accountStatus || "بيانات عامة"}</span>
            </div>
            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <Info label="حجم المنشأة" value={contractor.establishmentSize} />
              <Info label="الموقع" value={[contractor.city, contractor.region].filter(Boolean).join(" - ")} />
              <Info label="التصنيف" value={contractor.classification} />
              <Info label="ساعات التدريب" value={contractor.trainingHours == null ? "—" : `${number.format(contractor.trainingHours)} ساعة`} />
            </div>
            <a href={contractor.sourceUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex font-black text-emerald-800 hover:underline">فتح الملف في المصدر ↗</a>
          </article>
        ))}
      </div>

      {!data.items.length && !errorMessage ? <div className="mt-7 rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">لا توجد نتائج في الصفحة الحالية أو وفق عبارة البحث.</div> : null}

      <div className="mt-8 flex items-center justify-between">
        <Link href={`/contractors?page=${Math.max(1, page - 1)}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={`rounded-xl border px-4 py-2 font-black ${page <= 1 ? "pointer-events-none opacity-40" : "bg-white"}`}>السابق</Link>
        <span className="text-sm font-bold text-slate-500">الصفحة {number.format(page)}</span>
        <Link href={`/contractors?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className="rounded-xl border bg-white px-4 py-2 font-black">التالي</Link>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs font-bold text-slate-500">{label}</div><div className="mt-1 font-bold text-slate-800">{value || "—"}</div></div>;
}
