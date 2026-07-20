import {
  sourceAccessLabels,
  sourcePriorityLabels,
  type SourceAccess,
  type SourcePriority,
} from "@/lib/source-catalog";
import { getSourceOperations, type OperationalState, type SourceOperation } from "@/lib/source-operations";

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

const operationClass: Record<OperationalState, string> = {
  healthy: "bg-emerald-100 text-emerald-900",
  partial: "bg-amber-100 text-amber-900",
  failed: "bg-rose-100 text-rose-900",
  running: "bg-blue-100 text-blue-900",
  ready: "bg-cyan-100 text-cyan-900",
  direct: "bg-teal-100 text-teal-900",
  configured: "bg-violet-100 text-violet-900",
  registration: "bg-orange-100 text-orange-900",
  monitored: "bg-slate-100 text-slate-700",
};

const priorityOrder: Record<SourcePriority, number> = { high: 0, medium: 1, watch: 2 };

function groupSources(items: SourceOperation[]): Array<[string, SourceOperation[]]> {
  const grouped = new Map<string, SourceOperation[]>();
  for (const source of items) grouped.set(source.category, [...(grouped.get(source.category) ?? []), source]);
  return [...grouped.entries()]
    .map(([category, sources]) => [category, [...sources].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])] as [string, SourceOperation[]])
    .sort(([, left], [, right]) => priorityOrder[left[0]?.priority ?? "watch"] - priorityOrder[right[0]?.priority ?? "watch"]);
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Riyadh" }).format(date);
}

export default async function SourcesPage() {
  const operations = await getSourceOperations();
  const grouped = groupSources(operations);
  const connected = operations.filter((source) => source.connectorKey || source.operationalState === "direct").length;
  const healthy = operations.filter((source) => source.operationalState === "healthy" || source.operationalState === "direct").length;
  const failed = operations.filter((source) => source.operationalState === "failed" || source.operationalState === "partial").length;
  const totalRecords = operations.reduce((sum, source) => sum + (source.recordCount ?? 0), 0);

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-8">
      <div className="max-w-5xl">
        <div className="text-sm font-black text-emerald-700">مركز تشغيل المصادر</div>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">من أين يجلب رادار المقاولات بياناته؟ وهل المصدر يعمل الآن؟</h1>
        <p className="mt-3 leading-7 text-slate-600">هذه الصفحة تفرق بين المصدر الذي يغذي قاعدة البيانات فعليًا، والقراءة المباشرة، والمصدر العام الذي تتم مراقبته، والبوابات التي تتطلب تسجيلًا أو إعدادًا رسميًا. عند توفر Supabase تظهر حالة آخر مزامنة وعدد السجلات لكل موصل.</p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Summary label="موصلات/قراءات فعلية" value={connected} />
        <Summary label="سليمة أو مباشرة" value={healthy} />
        <Summary label="تحتاج انتباهًا" value={failed} />
        <Summary label="سجلات مخزنة" value={totalRecords} />
        <Summary label="إجمالي المصادر المرصودة" value={operations.length} />
      </div>

      <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm leading-7 text-emerald-950">
        <span className="font-black">الموصلات الأساسية المفعلة في الكود:</span> منصة مقاول للمشاريع، المركز الوطني للتخصيص لفرص PPP، والشركة السعودية لشراكات المياه للمشاريع المستقبلية. اعتماد يُفعّل تلقائيًا عند اكتمال إعداد واجهته الرسمية.
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
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${operationClass[source.operationalState]}`}>{source.operationalLabel}</span>
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${accessClass[source.access]}`}>{sourceAccessLabels[source.access]}</span>
                      <span className={`rounded-full border px-3 py-1 text-xs font-black ${priorityClass[source.priority]}`}>{sourcePriorityLabels[source.priority]}</span>
                    </div>
                  </div>

                  <p className="mt-3 text-sm leading-7 text-slate-600">{source.description}</p>

                  {(source.connectorKey || source.operationalState === "direct") && (
                    <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-xs sm:grid-cols-4">
                      <Metric label="آخر مزامنة" value={formatDate(source.lastSyncAt)} />
                      <Metric label="آخر نجاح" value={formatDate(source.lastSuccessAt)} />
                      <Metric label="سجلات مخزنة" value={source.recordCount == null ? "—" : source.recordCount.toLocaleString("ar-SA")} />
                      <Metric label="آخر دفعة" value={source.upsertedCount == null ? "—" : `${source.upsertedCount.toLocaleString("ar-SA")} سجل`} />
                    </div>
                  )}

                  {source.errorMessage && <div className="mt-3 rounded-lg bg-rose-50 p-3 text-xs leading-6 text-rose-800">{source.errorMessage}</div>}

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

function Metric({ label, value }: { label: string; value: string }) {
  return <div><div className="font-bold text-slate-400">{label}</div><div className="mt-1 font-black text-slate-800">{value}</div></div>;
}
