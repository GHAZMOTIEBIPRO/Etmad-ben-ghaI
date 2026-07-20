import { RefreshViewButton } from "@/components/refresh-view-button";
import { currency, number } from "@/lib/format";
import { getAnalytics } from "@/lib/repository";
import type { AnalyticsBucket } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const data = await getAnalytics();
  return (
    <main className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
      <section className="surface-card rounded-[2rem] p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl">
            <div className="text-xs font-black text-emerald-700">ذكاء السوق</div>
            <h1 className="mt-2 text-3xl font-black sm:text-4xl">تحليلات تساعد على القرار</h1>
            <p className="mt-3 leading-7 text-slate-600">قراءة مركزة للجهات والمصادر والمناطق والأنشطة الأكثر حضورًا، مع إظهار تحليلات الترسيات فور توفر بياناتها الرسمية.</p>
          </div>
          <RefreshViewButton />
        </div>
      </section>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Panel title="أكثر الشركات فوزًا بالعقود"><Bars data={data.topCompaniesByWins} metric="count" empty="لا تتوفر بيانات ترسيات وشركات فائزة في المصادر الحالية بعد." /></Panel>
        <Panel title="أعلى الشركات من حيث قيمة الترسيات"><Bars data={data.topCompaniesByValue} metric="value" empty="تظهر هذه اللوحة عند وصول بيانات ترسيات رسمية بقيم العقود." /></Panel>
        <Panel title="أكثر الجهات والمصادر طرحًا للفرص"><Bars data={data.topEntitiesByTenders} metric="count" /></Panel>
        <Panel title="أكثر الجهات من حيث قيمة الترسيات"><Bars data={data.topEntitiesByAwardValue} metric="value" empty="لا توجد قيم ترسيات متاحة في المصدر الحي الحالي." /></Panel>
        <Panel title="الفرص حسب المنطقة"><Bars data={data.awardsByRegion} metric="count" /></Panel>
        <Panel title="الفرص حسب النشاط"><Bars data={data.awardsByActivity} metric="count" /></Panel>
        <div className="xl:col-span-2"><Panel title="الترسيات حسب السنة والشهر"><Bars data={data.awardsByMonth} metric="value" empty="سيظهر الخط الزمني فور مزامنة بيانات الترسيات الرسمية." /></Panel></div>
      </div>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="surface-card rounded-2xl p-5"><h2 className="text-lg font-black text-slate-950">{title}</h2><div className="mt-5">{children}</div></section>;
}

function Bars({ data, metric, empty = "لا توجد بيانات كافية حاليًا." }: { data: AnalyticsBucket[]; metric: "count" | "value"; empty?: string }) {
  if (!data.length) return <div className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-500">{empty}</div>;
  const max = Math.max(...data.map((item) => item[metric]), 1);
  return <div className="space-y-4">{data.map((item) => <div key={item.label}><div className="mb-1.5 flex items-center justify-between gap-3 text-sm"><span className="font-bold text-slate-700">{item.label}</span><span className="whitespace-nowrap font-black text-slate-950">{metric === "value" ? currency.format(item.value) : number.format(item.count)}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-700" style={{ width: `${Math.max(4, (item[metric] / max) * 100)}%` }} /></div></div>)}</div>;
}
