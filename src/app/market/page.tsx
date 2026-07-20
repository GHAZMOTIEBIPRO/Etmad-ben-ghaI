import Link from "next/link";
import { MarketCharts } from "@/components/market-charts";
import { ProjectCard } from "@/components/project-card";
import { currency, number } from "@/lib/format";
import { getMarketSnapshot } from "@/lib/project-repository";

export const revalidate = 300;

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-black text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-black text-slate-950">{value}</div>
      <div className="mt-2 text-xs font-bold leading-5 text-slate-500">{note}</div>
    </div>
  );
}

export default async function MarketPage() {
  const market = await getMarketSnapshot();
  const knownValueNote = market.knownProjectValue
    ? "القيم التقديرية والترسيات المعلنة فقط — لا تمثل إنفاقًا حكوميًا فعليًا"
    : "لا توجد قيمة مالية موثقة في السجلات الحالية";

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
      <section className="surface-card overflow-hidden rounded-[2rem] p-6 sm:p-8 lg:p-10">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <div className="text-xs font-black text-emerald-700">Saudi Projects Intelligence</div>
            <h1 className="mt-2 max-w-4xl text-3xl font-black leading-tight sm:text-5xl">سوق المشاريع السعودي في صورة واحدة</h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">نحوّل المنافسات والفرص وخطط المشتريات وإشارات المشاريع العامة إلى ملفات مشاريع موحدة، ثم نعرض المرحلة والمالك والقيمة المعروفة والفرص المرتبطة في طبقة ذكاء سوق واحدة.</p>
            <div className="mt-6 flex flex-wrap gap-2 text-sm font-black">
              <Link href="/projects" className="rounded-xl bg-emerald-800 px-4 py-2.5 text-white hover:bg-emerald-900">استكشف المشاريع</Link>
              <Link href="/tenders" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-800 hover:text-emerald-800">المنافسات والفرص</Link>
              <Link href="/sources" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-800 hover:text-emerald-800">صحة المصادر</Link>
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="text-xs font-black text-emerald-700">قراءة السوق الحالية</div>
            <div className="mt-2 text-3xl font-black text-emerald-950">{number.format(market.pipelineProjects)} مشروع في خط الأنابيب</div>
            <p className="mt-2 text-sm leading-7 text-emerald-900">يشمل التخطيط والتصميم والتأهيل والطرح. توجد {number.format(market.openOpportunities)} فرصة مفتوحة و{number.format(market.awardedOpportunities)} سجل ترسية مرتبط بالمشاريع المرصودة.</p>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Metric label="المشاريع المرصودة" value={number.format(market.totalProjects)} note="مشاريع موحدة مستخلصة من الإشارات والفرص المتاحة" />
        <Metric label="القيمة المعروفة" value={market.knownProjectValue ? currency.format(market.knownProjectValue) : "—"} note={knownValueNote} />
        <Metric label="خط الأنابيب" value={number.format(market.pipelineProjects)} note="تخطيط وتصميم وتأهيل وطرح" />
        <Metric label="فرص مفتوحة" value={number.format(market.openOpportunities)} note="فرص ومنافسات ما زالت مفتوحة" />
        <Metric label="جديد خلال 7 أيام" value={number.format(market.newLast7Days)} note="مشاريع أو إشارات ظهرت حديثًا" />
        <Metric label="تحديثات خلال 30 يومًا" value={number.format(market.updatedLast30Days)} note="نشاط حديث داخل ملفات المشاريع" />
      </section>

      <section className="mt-6">
        <MarketCharts stages={market.stages} regions={market.regions} sectors={market.sectors} />
      </section>

      <section className="mt-10">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs font-black text-emerald-700">فرص بن غازي</div>
            <h2 className="mt-1 text-2xl font-black">أعلى المشاريع ملاءمة للنشاط المستهدف</h2>
          </div>
          <Link href="/projects" className="text-sm font-black text-emerald-800 hover:underline">عرض كل المشاريع ←</Link>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {market.bestFitProjects.slice(0, 6).map((project) => <ProjectCard key={project.id} project={project} />)}
        </div>
      </section>

      <section className="mt-10 grid gap-5 lg:grid-cols-[1fr_0.8fr]">
        <div>
          <div className="mb-5">
            <div className="text-xs font-black text-emerald-700">تحديثات السوق</div>
            <h2 className="mt-1 text-2xl font-black">أحدث المشاريع والإشارات</h2>
          </div>
          <div className="space-y-4">
            {market.recentProjects.slice(0, 5).map((project) => <ProjectCard key={project.id} project={project} />)}
          </div>
        </div>
        <aside className="space-y-4">
          <section className="rounded-2xl border border-blue-200 bg-blue-50 p-6">
            <div className="text-xs font-black text-blue-700">منهجية المؤشرات</div>
            <h2 className="mt-2 text-xl font-black text-blue-950">القيمة المعروفة ليست إنفاقًا فعليًا</h2>
            <p className="mt-3 text-sm leading-7 text-blue-900">نحسب فقط القيم التقديرية والترسيات المعلنة في المصادر. أي مشروع بلا قيمة معلنة يبقى ضمن عدد المشاريع ولا يضاف إلى القيمة المالية، حفاظًا على دقة المؤشر.</p>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="text-xs font-black text-slate-400">المصادر ذات القيمة العالية</div>
            <div className="mt-4 space-y-3 text-sm font-bold text-slate-700">
              <a className="block hover:text-emerald-800" href="https://www.pif.gov.sa/en/private-sector-hub/explore-opportunities/" target="_blank" rel="noreferrer">PIF — فرص وسلاسل قيمة المشاريع ↗</a>
              <a className="block hover:text-emerald-800" href="https://ncp.gov.sa/" target="_blank" rel="noreferrer">NCP — مشاريع PPP ومراحل EOI/RFQ/RFP ↗</a>
              <a className="block hover:text-emerald-800" href="https://furas.momah.gov.sa/" target="_blank" rel="noreferrer">فرص — الفرص الاستثمارية البلدية ↗</a>
              <a className="block hover:text-emerald-800" href="https://muqawil.org/ar/market/list" target="_blank" rel="noreferrer">مقاول — مشاريع وفرص المقاولين ↗</a>
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
