import { sourceAccessLabels, sourceCatalog, type SourceAccess, type SourceCatalogItem } from "@/lib/source-catalog";

const accessClass: Record<SourceAccess, string> = {
  live: "bg-emerald-100 text-emerald-900",
  public: "bg-sky-100 text-sky-900",
  registration: "bg-amber-100 text-amber-900",
  configured: "bg-violet-100 text-violet-900",
};

function groupSources(): Array<[string, SourceCatalogItem[]]> {
  const grouped = new Map<string, SourceCatalogItem[]>();
  for (const source of sourceCatalog) {
    grouped.set(source.category, [...(grouped.get(source.category) ?? []), source]);
  }
  return [...grouped.entries()];
}

export default function SourcesPage() {
  const grouped = groupSources();
  return (
    <main className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-8">
      <div className="max-w-4xl">
        <div className="text-sm font-black text-emerald-700">شبكة المصادر</div>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">من أين يجلب رادار المقاولات بياناته؟</h1>
        <p className="mt-3 leading-7 text-slate-600">نفرّق بوضوح بين المصدر المتصل حيًا، والمصدر العام المفتوح، والبوابات التي تتطلب تسجيلًا أو تأهيلًا. لا تُعرض البيانات التجريبية على أنها بيانات سوق حقيقية.</p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Summary label="مصادر متصلة حيًا" value={sourceCatalog.filter((source) => source.access === "live").length} />
        <Summary label="مصادر عامة مفتوحة" value={sourceCatalog.filter((source) => source.access === "public").length} />
        <Summary label="بوابات تسجيل وتأهيل" value={sourceCatalog.filter((source) => source.access === "registration").length} />
        <Summary label="إجمالي المصادر المرصودة" value={sourceCatalog.length} />
      </div>

      <div className="mt-9 space-y-9">
        {grouped.map(([category, sources]) => (
          <section key={category}>
            <h2 className="text-xl font-black text-slate-950">{category}</h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {sources.map((source) => (
                <article key={source.name} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h3 className="text-lg font-black">{source.name}</h3>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${accessClass[source.access]}`}>{sourceAccessLabels[source.access]}</span>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{source.description}</p>
                  <a href={source.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex text-sm font-black text-emerald-800 hover:underline">فتح المصدر الرسمي ↗</a>
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
