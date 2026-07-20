import Link from "next/link";
import { currency, formatDate } from "@/lib/format";
import type { ProjectIntelligenceRecord } from "@/lib/project-intelligence";

function fitClass(score: number): string {
  if (score >= 85) return "bg-emerald-100 text-emerald-800";
  if (score >= 70) return "bg-lime-100 text-lime-800";
  if (score >= 55) return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-600";
}

export function ProjectCard({ project }: { project: ProjectIntelligenceRecord }) {
  const value = project.estimatedValue ?? project.awardValue;
  return (
    <article className="surface-card rounded-2xl p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2 text-[11px] font-black">
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-800">{project.stageLabel}</span>
            <span className={`rounded-full px-2.5 py-1 ${fitClass(project.fitScore)}`}>ملاءمة {project.fitScore}/100</span>
          </div>
          <h3 className="mt-3 text-lg font-black leading-8 text-slate-950">
            <Link href={`/projects/${project.id}`} className="hover:text-emerald-800">{project.name}</Link>
          </h3>
          <p className="mt-1 text-sm font-bold text-slate-500">{project.ownerName}</p>
          {project.fitReasons[0] ? <p className="mt-2 text-xs font-bold leading-6 text-emerald-800">لماذا مهم؟ {project.fitReasons[0]}</p> : null}
        </div>
        <div className="text-left">
          <div className="text-xs font-bold text-slate-400">القيمة المعروفة</div>
          <div className="mt-1 text-sm font-black text-slate-900">{value ? currency.format(value) : "غير معلنة"}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold text-slate-600 sm:grid-cols-4">
        <div className="rounded-xl bg-slate-50 p-3"><div className="text-slate-400">المنطقة</div><div className="mt-1 text-slate-900">{project.regionName}</div></div>
        <div className="rounded-xl bg-slate-50 p-3"><div className="text-slate-400">القطاع</div><div className="mt-1 line-clamp-1 text-slate-900">{project.sector}</div></div>
        <div className="rounded-xl bg-slate-50 p-3"><div className="text-slate-400">الفرص المرتبطة</div><div className="mt-1 text-slate-900">{project.opportunityCount.toLocaleString("ar-SA")}</div></div>
        <div className="rounded-xl bg-slate-50 p-3"><div className="text-slate-400">آخر تحديث</div><div className="mt-1 text-slate-900">{formatDate(project.latestUpdate.slice(0, 10))}</div></div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs font-bold">
        <span className="text-slate-500">{project.sourceCount} مصدر · ثقة البيانات {project.confidence}%</span>
        <Link href={`/projects/${project.id}`} className="font-black text-emerald-800 hover:underline">ملف المشروع 360° ←</Link>
      </div>
    </article>
  );
}
