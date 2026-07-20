import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { currency, formatDate, statusLabel } from "@/lib/format";
import { getProjectById } from "@/lib/project-intelligence";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const project = await getProjectById(id);
  return { title: project ? `${project.name} — ملف المشروع` : "المشروع" };
}

function valueOrDash(value: number | null): string {
  return value ? currency.format(value) : "غير معلنة";
}

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProjectById(id);
  if (!project) notFound();

  const stageSteps = ["تخطيط", "تصميم", "تأهيل", "طرح ومنافسة", "تمت الترسية", "تحت التنفيذ", "تشغيل وصيانة"];
  const currentIndex = Math.max(0, stageSteps.indexOf(project.stageLabel));

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/projects" className="text-sm font-black text-emerald-800 hover:underline">← العودة إلى مستكشف المشاريع</Link>

      <section className="mt-5 surface-card rounded-[2rem] p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-4xl">
            <div className="flex flex-wrap gap-2 text-xs font-black">
              <span className="rounded-full bg-blue-100 px-3 py-1.5 text-blue-800">{project.stageLabel}</span>
              <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-emerald-800">ملاءمة بن غازي {project.fitScore}/100</span>
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700">ثقة البيانات {project.confidence}%</span>
            </div>
            <h1 className="mt-4 text-3xl font-black leading-tight text-slate-950 sm:text-5xl">{project.name}</h1>
            <p className="mt-4 text-base font-bold text-slate-500">{project.ownerName}</p>
          </div>
          <div className="grid min-w-[260px] gap-2 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-bold text-slate-400">القيمة التقديرية</div><div className="mt-2 font-black text-slate-950">{valueOrDash(project.estimatedValue)}</div></div>
            <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-bold text-slate-400">قيمة الترسية المعروفة</div><div className="mt-2 font-black text-slate-950">{valueOrDash(project.awardValue)}</div></div>
          </div>
        </div>

        <dl className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["المنطقة", project.regionName],
            ["القطاع", project.sector],
            ["النشاط", project.activityName],
            ["آخر تحديث", formatDate(project.latestUpdate.slice(0, 10))],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-slate-100 bg-white p-4">
              <dt className="text-xs font-black text-slate-400">{label}</dt>
              <dd className="mt-2 font-black text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-6 surface-card rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-black text-emerald-700">دورة حياة المشروع</div>
            <h2 className="mt-1 text-xl font-black">أين يقف المشروع الآن؟</h2>
          </div>
          <span className="text-sm font-black text-slate-500">المرحلة الحالية: {project.stageLabel}</span>
        </div>
        <div className="mt-6 grid gap-2 md:grid-cols-7">
          {stageSteps.map((step, index) => (
            <div key={step} className={`rounded-xl border p-3 text-center text-xs font-black ${index < currentIndex ? "border-emerald-200 bg-emerald-50 text-emerald-800" : index === currentIndex ? "border-blue-300 bg-blue-50 text-blue-900" : "border-slate-200 bg-slate-50 text-slate-400"}`}>
              <div className="text-base">{index < currentIndex ? "✓" : index === currentIndex ? "●" : "○"}</div>
              <div className="mt-1">{step}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_0.85fr]">
        <div className="space-y-5">
          <section className="surface-card rounded-2xl p-6">
            <div className="text-xs font-black text-emerald-700">الفرص والعقود المرتبطة</div>
            <h2 className="mt-1 text-xl font-black">سجل النشاط التعاقدي</h2>
            <div className="mt-5 space-y-3">
              {project.opportunities.map((opportunity) => (
                <article key={opportunity.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/tenders/${opportunity.id}`} className="font-black leading-7 text-slate-950 hover:text-emerald-800">{opportunity.name}</Link>
                      <div className="mt-1 text-xs font-bold text-slate-500">{opportunity.competitionNumber} · {opportunity.governmentEntityName}</div>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700">{statusLabel(opportunity.status)}</span>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs font-bold text-slate-500 sm:grid-cols-3">
                    <span>نشر: {formatDate(opportunity.publicationDate)}</span>
                    <span>إغلاق: {formatDate(opportunity.submissionDeadline)}</span>
                    <span>{opportunity.award ? `ترسية: ${currency.format(opportunity.award.amount)}` : "لا توجد ترسية معلنة"}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="surface-card rounded-2xl p-6">
            <div className="text-xs font-black text-emerald-700">الأطراف</div>
            <h2 className="mt-1 text-xl font-black">من يقف خلف المشروع؟</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {project.parties.map((party) => (
                <div key={`${party.role}:${party.name}`} className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs font-black text-slate-400">{party.role === "owner" ? "المالك / الجهة" : party.role === "contractor" ? "المقاول / الفائز" : "المورد"}</div>
                  <div className="mt-2 font-black text-slate-900">{party.name}</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
            <div className="text-xs font-black text-emerald-700">قراءة تطوير الأعمال</div>
            <h2 className="mt-2 text-xl font-black text-emerald-950">ملاءمة بن غازي: {project.fitScore}/100</h2>
            <p className="mt-3 text-sm leading-7 text-emerald-900">درجة أولية مبنية على المنطقة والنشاط والحجم والمهلة المتاحة في الفرص المرتبطة. تستخدم للفرز السريع وليست بديلًا عن مراجعة الكراسة.</p>
            <Link href="/tenders" className="mt-4 inline-block text-sm font-black text-emerald-950 underline">افتح المنافسات والفرص ←</Link>
          </section>

          <section className="surface-card rounded-2xl p-6">
            <div className="text-xs font-black text-slate-400">المصادر</div>
            <h2 className="mt-1 text-xl font-black">أدلة المشروع</h2>
            <p className="mt-2 text-sm leading-7 text-slate-500">نحتفظ بالمصدر الأصلي لكل إشارة. تعدد المصادر يرفع الثقة لكنه لا يعني أن كل السجلات تمثل عقدًا منفصلًا.</p>
            <div className="mt-4 space-y-3">
              {project.sourceRefs.length ? project.sourceRefs.map((source) => (
                <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="block rounded-xl border border-slate-200 p-3 text-sm font-black text-emerald-800 hover:border-emerald-300">
                  {source.label} ↗
                  <div className="mt-1 text-xs font-bold text-slate-400">آخر رصد: {formatDate(source.lastUpdated.slice(0, 10))}</div>
                </a>
              )) : <div className="rounded-xl bg-slate-50 p-4 text-sm font-bold text-slate-500">لا يوجد رابط مصدر عام محفوظ لهذا السجل حاليًا.</div>}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
