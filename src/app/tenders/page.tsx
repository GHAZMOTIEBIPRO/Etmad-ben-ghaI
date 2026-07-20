import Link from "next/link";
import { RefreshViewButton } from "@/components/refresh-view-button";
import { TenderExplorer } from "@/components/tender-explorer";
import { getFilterOptions, listTenders } from "@/lib/repository";
import { tenderQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function TendersPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const flat = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
  const parsed = tenderQuerySchema.safeParse(flat);
  const initialFilters = parsed.success ? parsed.data : tenderQuerySchema.parse({});
  const [options, initialData] = await Promise.all([
    getFilterOptions(),
    listTenders(initialFilters),
  ]);

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
      <section className="surface-card rounded-[2rem] p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl">
            <div className="text-xs font-black text-emerald-700">Opportunity Intelligence</div>
            <h1 className="mt-2 text-3xl font-black sm:text-4xl">المنافسات والفرص</h1>
            <p className="mt-3 leading-7 text-slate-600">طبقة الفرص التعاقدية داخل رادار المشاريع. استخدمها لمعرفة ما هو مفتوح الآن، ثم ارجع إلى ملف المشروع لفهم السياق الأكبر والمرحلة والأطراف.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm font-black">
            <Link href="/market" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-800 hover:text-emerald-800">لوحة السوق</Link>
            <Link href="/projects" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-800 hover:text-emerald-800">المشاريع</Link>
            <RefreshViewButton />
          </div>
        </div>
      </section>

      <section className="mt-6">
        <TenderExplorer initialData={initialData} options={options} initialFilters={initialFilters} />
      </section>
    </main>
  );
}
