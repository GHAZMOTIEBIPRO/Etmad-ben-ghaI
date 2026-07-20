import {
  sourceAccessLabels,
  sourceCatalog,
  sourcePriorityLabels,
  type SourceAccess,
  type SourceCatalogItem,
  type SourcePriority,
} from "@/lib/source-catalog";

const accessClass: Record<SourceAccess, string> = {
  live: "bg-emerald-100 text-emerald-900",
  public: "bg-sky-100 text-sky-900",
  registration: "bg-amber-100 text-amber-900",
  configured: "bg-violet-100 text-violet-900",
};

const priorityClass: Record<SourcePriority, string> = {
  high: "border-rose-200 bg-rose-50 text-rose-800",
  medium: "border-amber-200 bg-amber-50 text-amber-800",
  watch: "border-slate-200 bg-slate-50 text-slate-700",
};

const priorityOrder: Record<SourcePriority, number> = { high: 0, medium: 1, watch: 2 };

function groupSources(): Array<[string, SourceCatalogItem[]]> {
  const grouped = new Map<string, SourceCatalogItem[]>();
  for (const source of sourceCatalog) {
    grouped.set(source.category, [...(grouped.get(source.category) ?? []), source]);
  }
  return [...grouped.entries()]
    .map(([category, sources]) => [category, [...sources].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])] as [string, SourceCatalogItem[]])
    .sort(([, left], [, right]) => priorityOrder[left[0]?.priority ?? "watch"] - priorityOrder[right[0]?.priority ?? "watch"]);
}

export default function SourcesPage() {
  const grouped = groupSources();
  return (
    <main className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-8">
      <div className="max-w-4xl">
        <div className="text-sm font-black text-emerald-700">شبكة البحث والمصادر</div>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">أين يبحث رادار المقاولات؟</h1>
        <p className="mt-3 leading-7 text-slate-600">تم توسيع الشبكة لتشمل المناقصات الحكومية، مشاريع PPP، المشاريع المستقبلية، بوابات الموردين، الرخص الإنشائية، بيانات الشركات، وسلاسل القيمة. كل مصدر مصنف حسب أولوية البحث وإمكانية الوصول والإشارات التي يقدمها.</p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Summary label="مصادر متصلة حيًا" value={sourceCatalog.filter((source) => source.access === "live").length} />
        <Summary label="مصادر عامة مفتوحة" value={sourceCatalog.filter((source) => source.access === "public").length} />
        <Summary label="بوابات تسجيل وتأهيل" value={sourceCatalog.filter((source) => source.access === "registration").length} />
        <Summary label="أولوية قصوى" value={sourceCatalog.filter((source) => source.priority === "high").length} />
        <Summary label="إجمالي المصادر المرصودة" value={sourceCatalog.length} />
      </div>

      <div className="mt-9 space-y-9">
        {grouped.map(([category, sources]) => (
          <section key={category}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-black text-slate-950">{category}</h2>
              <span className="text-xs font-bold text-slate-400">{sources.length.toLocaleString("ar-SA")} مصدر</span>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {sources.map((source) => (
                <article key={source.name} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h3 className="text-lg font-black">{source.name}</h3>
                    <div className="flex flex-wrap gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${accessClass[source.access]}`}>{sourceAccessLabels[source.access]}</span>
                      <span className={`rounded-full border px-3 py-1 text-xs font-black ${priorityClass[source.priority]}`}>{sourcePriorityLabels[source.priority]}</span>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{source.description}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {source.signals.map((signal) => <span key={signal} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{signal}</span>)}
                  </div>
                  <a href={source.url} target="_blank" rel="noreferrer" className="mt-5 inline-flex text-sm font-black text-emerald-800 hover:underline">فتح المصدر الرسمي ↗</a>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-sm font-bold text-slate-500">{label}</div><div className="mt-2 text-3xl font-black">{value.toLocaleString("ar-SA")}</div></div>;
}
