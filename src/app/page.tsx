import Link from "next/link";
import { RefreshViewButton } from "@/components/refresh-view-button";
import { StatCards } from "@/components/stat-cards";
import { TenderExplorer } from "@/components/tender-explorer";
import { getDashboardStats, getFilterOptions, listTenders } from "@/lib/repository";
import { tenderQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const flat = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
  const parsed = tenderQuerySchema.safeParse(flat);
  const initialFilters = parsed.success ? parsed.data : tenderQuerySchema.parse({});
  const [stats, options, initialData] = await Promise.all([
    getDashboardStats(),
    getFilterOptions(),
    listTenders(initialFilters),
  ]);

  return (
    <main>
      <section className="border-b border-slate-200/70">
        <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
          <div className="surface-card overflow-hidden rounded-[2rem] p-6 sm:p-8 lg:p-10">
            <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
              <div>
                <div className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">ذكاء فرص المقاولات السعودي</div>
                <h1 className="mt-4 max-w-4xl text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">كل فرصة مهمة. في مكان واحد.</h1>
                <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600 sm:text-lg">رادار موحد للمشاريع والمنافسات والمقاولين والمصادر الرسمية والعامة. نميز بوضوح بين البيانات المتصلة فعليًا والمصادر التي تتم مراقبتها أو تتطلب تأهيلًا.</p>
                <div className="mt-6 flex flex-wrap gap-2 text-sm font-black">
                  <a href="#opportunities" className="rounded-xl bg-emerald-800 px-4 py-2.5 text-white shadow-sm transition hover:bg-emerald-900">عرض الفرص الآن</a>
                  <Link href="/sources" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-800 transition hover:border-emerald-200 hover:text-emerald-800">حالة المصادر</Link>
                  <RefreshViewButton />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs font-black text-slate-600">
                <div className="rounded-2xl bg-slate-50 px-3 py-4"><div className="text-lg text-emerald-800">01</div><div className="mt-1">رصد</div></div>
                <div className="rounded-2xl bg-slate-50 px-3 py-4"><div className="text-lg text-emerald-800">02</div><div className="mt-1">تحليل</div></div>
                <div className="rounded-2xl bg-slate-50 px-3 py-4"><div className="text-lg text-emerald-800">03</div><div className="mt-1">قرار</div></div>
              </div>
            </div>
            <div className="mt-8"><StatCards stats={stats} /></div>
          </div>
        </div>
      </section>

      <section id="opportunities" className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-black text-emerald-700">الرادار المباشر</div>
            <h2 className="mt-1 text-2xl font-black">الفرص والمنافسات</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">تظهر البيانات الحية المتاحة تلقائيًا حتى عند خلو قاعدة البيانات، مع الحفاظ على مصدر كل سجل.</p>
          </div>
          <Link href="/contractors" className="text-sm font-black text-emerald-800 hover:underline">استكشف دليل المقاولين ←</Link>
        </div>
        <TenderExplorer initialData={initialData} options={options} initialFilters={initialFilters} />
      </section>
    </main>
  );
}
