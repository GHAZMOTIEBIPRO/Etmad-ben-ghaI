import Link from "next/link";
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
      <section className="border-b border-emerald-900/10 bg-[radial-gradient(circle_at_top_right,#d1fae5,transparent_38%),linear-gradient(180deg,#f0fdf4_0%,#ffffff_100%)]">
        <div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <div className="max-w-4xl">
            <div className="mb-3 inline-flex rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-black text-emerald-800">رصد متعدد المصادر لسوق المقاولات السعودي</div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">رادار المقاولات</h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600 sm:text-lg">ابحث في المشاريع والفرص والمنافسات، راقب أنشطة المناطق والقطاعات، واستكشف المقاولين والمصادر الرسمية والعامة من واجهة واحدة بدل الاعتماد على منصة واحدة فقط.</p>
            <div className="mt-5 flex flex-wrap gap-2 text-sm font-black">
              <Link href="/contractors" className="rounded-xl bg-emerald-700 px-4 py-2.5 text-white">استكشف المقاولين</Link>
              <Link href="/sources" className="rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-emerald-900">راجع شبكة المصادر</Link>
            </div>
          </div>
          <div className="mt-8"><StatCards stats={stats} /></div>
        </div>
      </section>
      <section className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-5"><h2 className="text-2xl font-black">الفرص والمنافسات الحالية</h2><p className="mt-1 text-sm leading-6 text-slate-500">عند خلو قاعدة البيانات، يعرض النظام تلقائيًا بيانات عامة حية من المصادر المتصلة بدل إظهار شاشة فارغة.</p></div>
        <TenderExplorer initialData={initialData} options={options} initialFilters={initialFilters} />
      </section>
    </main>
  );
}
