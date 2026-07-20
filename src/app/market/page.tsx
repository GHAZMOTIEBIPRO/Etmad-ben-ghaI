import Link from "next/link";
import { ProjectCard } from "@/components/project-card";
import { currency, number } from "@/lib/format";
import { getMarketIntelligence } from "@/lib/project-intelligence";

export const dynamic = "force-dynamic";

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-black text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-black text-slate-950">{value}</div>
      <div className="mt-2 text-xs font-bold leading-5 text-slate-500">{note}</div>
    </div>
  );
}

function Distribution({ title, items }: { title: string; items: Array<{ label: string; count: number; value: number }> }) {
  const max = Math.max(1, ...items.map((item) => item.count));
  return (
    <section className="surface-card rounded-2xl p-5 sm:p-6">
      <h2 className="text-lg font-black">{title}</h2>
      <div className="mt-5 space-y-4">
        {items.slice(0, 8).map((item) => (
          <div key={item.label}>
            <div className="flex items-center justify-between gap-3 text-sm font-bold">
              <span className="truncate text-slate-700">{item.label}</span>
              <span className="shrink-0 text-slate-950">{number.format(item.count)}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-700" style={{ width: `${Math.max(4, Math.round((item.count / max) * 100))}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function MarketPage() {
  const market = await getMarketIntelligence();

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
      <section className="surface-card overflow-hidden rounded-[2rem] p-6 sm:p-8 lg:p-10">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div>
            <div className="text-xs font-black text-emerald-700">Saudi Projects Intelligence</div>
            <h1 className="mt-2 max-w-4xl text-3xl font-black leading-tight sm:text-5xl">سوق المشاريع السعودي في صورة واحدة</h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">نحوّل المنافسات والفرص وخطط المشتريات وإشارات المشاريع العامة إلى ملفات مشاريع موحدة: أين المشروع، من مالكه، ما مرحلته، وما الفرصة التالية المحتملة.</p>
            <div className="mt-6 flex flex-wrap gap-2 text-sm font-black">
              <Link href="/projects" className="rounded-xl bg-emerald-800 px-4 py-2.5 text-white hover:bg-emerald-900">استكشف المشاريع</Link>
              <Link href="/tenders" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-800 hover:text-emerald-800">المنافسات والفرص</Link>
              <Link href="/sources" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-800 hover:text-emerald-800">صحة المصادر</Link>
            </div>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <div className="text-xs font-black text-amber-800">مؤشر تكلفة البناء الرسمي</div>
            <div className="mt-2 text-3xl font-black text-amber-950">+2.6%</div>
            <p className="mt-2 text-sm leading-7 text-amber-900">الارتفاع السنوي لمؤشر تكلفة البناء في مايو 2026. ارتفع شهريًا 0.2% عن أبريل.</p>
            <a href="https://www.stats.gov.sa/en/w/cci" target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs font-black text-amber-900 underline">المصدر: الهيئة العامة للإحصاء ↗</a>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Metric label="المشاريع المرصودة" value={number.format(market.totalProjects)} note="مشاريع موحدة مستخلصة من الإشارات والفرص المتاحة" />
        <Metric label="القيمة المعروفة" value={market.knownProjectValue ? currency.format(market.knownProjectValue) : "—"} note="القيم التقديرية والترسيات المعلنة فقط" />
        <Metric label="خط الأنابيب" value={number.format(market.pipelineProjects)} note="تخطيط وتصميم وتأهيل وطرح" />
        <Metric label="فرص مفتوحة" value={number.format(market.openOpportunities)} note="فرص ومنافسات ما زالت مفتوحة" />
        <Metric label="جديد خلال 7 أيام" value={number.format(market.newLast7Days)} note="مشاريع أو إشارات ظهرت حديثًا" />
        <Metric label="تحديثات خلال 30 يومًا" value={number.format(market.updatedLast30Days)} note="نشاط حديث داخل ملفات المشاريع" />
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-3">
        <Distribution title="المشاريع حسب المرحلة" items={market.stages} />
        <Distribution title="المشاريع حسب المنطقة" items={market.regions} />
        <Distribution title="المشاريع حسب القطاع" items={market.sectors} />
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
            <div className="text-xs font-black text-blue-700">لماذا هذه اللوحة؟</div>
            <h2 className="mt-2 text-xl font-black text-blue-950">المنافسة وحدها لا تشرح السوق</h2>
            <p className="mt-3 text-sm leading-7 text-blue-900">القيمة هنا في ربط المنافسة بالمشروع ومرحلته ومالكه ومصادره. كلما تعددت الإشارات الرسمية حول نفس المشروع ترتفع درجة الثقة في ملفه.</p>
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
