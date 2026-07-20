import Link from "next/link";
import { ProjectCard } from "@/components/project-card";
import { filterProjects, getProjectIntelligence, projectStageLabels, type ProjectFilters } from "@/lib/project-intelligence";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function ProjectsPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const allProjects = await getProjectIntelligence();
  const page = Math.max(1, Number(first(raw.page) || 1) || 1);
  const pageSize = 20;
  const filters: ProjectFilters = {
    q: first(raw.q).trim() || undefined,
    region: first(raw.region).trim() || undefined,
    sector: first(raw.sector).trim() || undefined,
    stage: (first(raw.stage).trim() || undefined) as ProjectFilters["stage"],
    minValue: first(raw.minValue) ? Number(first(raw.minValue)) : undefined,
    maxValue: first(raw.maxValue) ? Number(first(raw.maxValue)) : undefined,
  };
  const filtered = filterProjects(allProjects, filters);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const items = filtered.slice((page - 1) * pageSize, page * pageSize);
  const regions = [...new Set(allProjects.map((project) => project.regionName))].sort((a, b) => a.localeCompare(b, "ar"));
  const sectors = [...new Set(allProjects.map((project) => project.sector))].sort((a, b) => a.localeCompare(b, "ar"));
  const querySuffix = [
    filters.q ? `q=${encodeURIComponent(filters.q)}` : "",
    filters.region ? `region=${encodeURIComponent(filters.region)}` : "",
    filters.sector ? `sector=${encodeURIComponent(filters.sector)}` : "",
    filters.stage ? `stage=${encodeURIComponent(filters.stage)}` : "",
    filters.minValue != null ? `minValue=${filters.minValue}` : "",
    filters.maxValue != null ? `maxValue=${filters.maxValue}` : "",
  ].filter(Boolean).join("&");

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
      <section className="surface-card rounded-[2rem] p-6 sm:p-8">
        <div className="max-w-4xl">
          <div className="text-xs font-black text-emerald-700">Project Intelligence</div>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">مستكشف المشاريع السعودي</h1>
          <p className="mt-3 leading-7 text-slate-600">ابحث في المشاريع حسب المرحلة والمنطقة والقطاع، ثم افتح ملف المشروع لفهم مصادره والفرص والمقاولين المرتبطين به.</p>
        </div>

        <form className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <input name="q" defaultValue={filters.q ?? ""} placeholder="اسم المشروع، المالك، القطاع..." className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-emerald-600 xl:col-span-2" />
          <select name="stage" defaultValue={filters.stage ?? ""} className="h-12 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-emerald-600">
            <option value="">كل المراحل</option>
            {projectStageLabels().map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select name="region" defaultValue={filters.region ?? ""} className="h-12 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-emerald-600">
            <option value="">كل المناطق</option>
            {regions.map((region) => <option key={region} value={region}>{region}</option>)}
          </select>
          <select name="sector" defaultValue={filters.sector ?? ""} className="h-12 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-emerald-600">
            <option value="">كل القطاعات</option>
            {sectors.map((sector) => <option key={sector} value={sector}>{sector}</option>)}
          </select>
          <button className="h-12 rounded-xl bg-emerald-800 px-5 text-sm font-black text-white hover:bg-emerald-900">تطبيق</button>
          <input name="minValue" type="number" min="0" defaultValue={filters.minValue ?? ""} placeholder="أقل قيمة" className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-emerald-600" />
          <input name="maxValue" type="number" min="0" defaultValue={filters.maxValue ?? ""} placeholder="أعلى قيمة" className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-emerald-600" />
          <Link href="/projects" className="flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-black text-slate-600 hover:text-emerald-800">مسح الفلاتر</Link>
        </form>
      </section>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
        <span>تم العثور على <strong className="text-slate-950">{filtered.length.toLocaleString("ar-SA")}</strong> مشروعًا</span>
        <Link href="/market" className="font-black text-emerald-800 hover:underline">العودة إلى لوحة السوق ←</Link>
      </div>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        {items.map((project) => <ProjectCard key={project.id} project={project} />)}
      </section>

      {!items.length ? <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500">لا توجد مشاريع مطابقة لهذه الفلاتر.</div> : null}

      <div className="mt-8 flex items-center justify-center gap-3">
        <Link href={`/projects?page=${Math.max(1, page - 1)}${querySuffix ? `&${querySuffix}` : ""}`} className={`rounded-xl border bg-white px-4 py-2 text-sm font-black ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}>السابق</Link>
        <span className="text-sm font-bold text-slate-500">صفحة {page.toLocaleString("ar-SA")} من {totalPages.toLocaleString("ar-SA")}</span>
        <Link href={`/projects?page=${Math.min(totalPages, page + 1)}${querySuffix ? `&${querySuffix}` : ""}`} className={`rounded-xl border bg-white px-4 py-2 text-sm font-black ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`}>التالي</Link>
      </div>
    </main>
  );
}
