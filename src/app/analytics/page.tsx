import { currency, number } from "@/lib/format";
import { getAnalytics } from "@/lib/repository";
import type { AnalyticsBucket } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const data = await getAnalytics();
  return (
    <main className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-8">
      <div className="max-w-3xl"><div className="text-sm font-black text-emerald-700">لوحة التحليل</div><h1 className="mt-2 text-3xl font-black sm:text-4xl">اتجاهات الترسيات والمنافسات</h1><p className="mt-3 leading-7 text-slate-600">قراءة سريعة للشركات والجهات والمناطق والأنشطة الأكثر حضورًا في البيانات الحالية.</p></div>
      <div className="mt-8 grid gap-5 xl:grid-cols-2">
        <Panel title="أكثر الشركات فوزًا بالعقود"><Bars data={data.topCompaniesByWins} metric="count" /></Panel>
        <Panel title="أعلى الشركات من حيث قيمة الترسيات"><Bars data={data.topCompaniesByValue} metric="value" /></Panel>
        <Panel title="أكثر الجهات طرحًا للمنافسات"><Bars data={data.topEntitiesByTenders} metric="count" /></Panel>
        <Panel title="أكثر الجهات من حيث قيمة الترسيات"><Bars data={data.topEntitiesByAwardValue} metric="value" /></Panel>
        <Panel title="الترسيات حسب المنطقة"><Bars data={data.awardsByRegion} metric="value" /></Panel>
        <Panel title="الترسيات حسب النشاط"><Bars data={data.awardsByActivity} metric="value" /></Panel>
        <div className="xl:col-span-2"><Panel title="الترسيات حسب السنة والشهر"><Bars data={data.awardsByMonth} metric="value" /></Panel></div>
      </div>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-black text-slate-950">{title}</h2><div className="mt-5">{children}</div></section>;
}

function Bars({ data, metric }: { data: AnalyticsBucket[]; metric: "count" | "value" }) {
  const max = Math.max(...data.map((item) => item[metric]), 1);
  return <div className="space-y-4">{data.map((item) => <div key={item.label}><div className="mb-1.5 flex items-center justify-between gap-3 text-sm"><span className="font-bold text-slate-700">{item.label}</span><span className="whitespace-nowrap font-black text-slate-950">{metric === "value" ? currency.format(item.value) : number.format(item.count)}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.max(4, (item[metric] / max) * 100)}%` }} /></div></div>)}</div>;
}
