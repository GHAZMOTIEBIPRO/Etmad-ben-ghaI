import { RefreshViewButton } from "@/components/refresh-view-button";
import {
  sourceAccessLabels,
  sourcePriorityLabels,
  type SourceAccess,
  type SourcePriority,
} from "@/lib/source-catalog";
import { getSourceOperations, type OperationalState, type SourceOperation } from "@/lib/source-operations";
import { getBaladyOpenDataSignals } from "@/lib/balady-open-data";
import { marketPlatforms } from "@/lib/market-platforms";

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

const platformClass = {
  connected: "bg-emerald-100 text-emerald-900",
  "public-monitor": "bg-sky-100 text-sky-900",
  "agreement-required": "bg-amber-100 text-amber-900",
  "signal-only": "bg-slate-100 text-slate-700",
} as const;

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
  const [operations, baladySignals] = await Promise.all([getSourceOperations(), getBaladyOpenDataSignals()]);
  const grouped = groupSources(operations);
  const connected = operations.filter((source) => source.connectorKey || source.operationalState === "direct").length;
  const healthy = operations.filter((source) => source.operationalState === "healthy" || source.operationalState === "direct").length;
  const failed = operations.filter((source) => source.operationalState === "failed" || source.operationalState === "partial").length;
  const totalRecords = operations.reduce((sum, source) => sum + (source.recordCount ?? 0), 0);

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
      <section className="surface-card rounded-[2rem] p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl">
            <div className="text-xs font-black text-emerald-700">مركز تشغيل المصادر</div>
            <h1 className="mt-2 text-3xl font-black sm:text-4xl">مصادر واضحة. حالة تشغيل واضحة.</h1>
            <p className="mt-3 leading-7 text-slate-600">نفرق بين مصدر يغذي قاعدة البيانات فعليًا، وقراءة عامة مباشرة، ومصدر تتم مراقبته، وبوابة تحتاج تسجيلًا أو اتفاقية. لا نعرض المصدر كـ«متصل» إلا إذا كان يرسل بيانات فعلية للنظام.</p>
          </div>
          <RefreshViewButton />
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Summary label="موصلات/قراءات فعلية" value={connected} />
          <Summary label="سليمة أو مباشرة" value={healthy} />
          <Summary label="تحتاج انتباهًا" value={failed} />
          <Summary label="سجلات مخزنة" value={totalRecords} />
          <Summary label="إجمالي المصادر" value={operations.length} />
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 text-sm leading-7 text-emerald-950">
        <span className="font-black">الموصلات الأساسية:</span> مقاول للمشاريع، NCP لفرص PPP، وSWPC للمشاريع المستقبلية. كتالوج بيانات بلدي يُقرأ مباشرة. اعتماد ينتظر اكتمال إعداد واجهته الرسمية.
      </section>

      <section className="mt-8">
        <div className="mb-4">
          <div className="text-xs font-black text-emerald-700">منصات منافسات ومشاريع اكتشفناها</div>
          <h2 className="mt-1 text-2xl font-black">ما الذي يمكن جلبه الآن وما الذي يحتاج اتفاقية؟</h2>
          <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-500">هذه الطبقة تمنع خلط المنصات المدفوعة أو المقيدة بالمصادر المفتوحة. نراقب العام، ونطلب تكاملًا رسميًا لما هو خلف اشتراك أو تسجيل.</p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {marketPlatforms.map((platform) => (
            <article key={platform.name} className="surface-card rounded-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-black text-slate-950">{platform.name}</h3>
                  <div className="mt-1 text-xs font-bold text-slate-400">{platform.scope}</div>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black ${platformClass[platform.ingestion]}`}>{platform.ingestionLabel}</span>
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-600">{platform.note}</p>
              <a href={platform.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex text-sm font-black text-emerald-800 hover:underline">فتح المنصة ↗</a>
            </article>
          ))}
        </div>
      </section>

      {baladySignals.length > 0 && (
        <section className="mt-8 rounded-2xl border border-teal-200 bg-teal-50/70 p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-xs font-black text-teal-700">قراءة مباشرة من API بلدي</div>
              <h2 className="mt-1 text-xl font-black">أحدث مجموعات البيانات المرتبطة بالبناء</h2>
            </div>
            <span className="text-xs font-bold text-teal-800">{baladySignals.length.toLocaleString("ar-SA")} مجموعة</span>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {baladySignals.map((item) => (
              <article key={item.id} className="rounded-xl border border-teal-100 bg-white p-4">
                <h3 className="font-black text-slate-900">{item.title}</h3>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                  {item.year && <span>السنة: {item.year}</span>}
                  {item.category && <span>• {item.category}</span>}
                  {item.changed && <span>• تحديث: {item.changed}</span>}
                </div>
                {item.files.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{item.files.map((file, index) => <a key={file} href={file} target="_blank" rel="noreferrer" className="rounded-lg bg-teal-100 px-2.5 py-1 text-xs font-black text-teal-900 hover:underline">ملف {index + 1} ↗</a>)}</div>}
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="mt-9 space-y-8">
        {grouped.map(([category, sources]) => (
          <section key={category}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-black text-slate-950">{category}</h2>
              <span className="text-xs font-bold text-slate-400">{sources.length.toLocaleString("ar-SA")} مصدر</span>
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {sources.map((source) => (
                <article key={source.name} className="surface-card rounded-2xl p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h3 className="font-black">{source.name}</h3>
                    <div className="flex flex-wrap gap-1.5">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${operationClass[source.operationalState]}`}>{source.operationalLabel}</span>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${accessClass[source.access]}`}>{sourceAccessLabels[source.access]}</span>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${priorityClass[source.priority]}`}>{sourcePriorityLabels[source.priority]}</span>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{source.description}</p>

                  {(source.connectorKey || source.operationalState === "direct") && (
                    <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-xs sm:grid-cols-4">
                      <Metric label="آخر مزامنة" value={formatDate(source.lastSyncAt)} />
                      <Metric label="آخر نجاح" value={formatDate(source.lastSuccessAt)} />
                      <Metric label="السجلات" value={source.recordCount == null ? "—" : source.recordCount.toLocaleString("ar-SA")} />
                      <Metric label="آخر دفعة" value={source.upsertedCount == null ? "—" : source.upsertedCount.toLocaleString("ar-SA")} />
                    </div>
                  )}

                  {source.errorMessage && <div className="mt-3 rounded-lg bg-rose-50 p-3 text-xs leading-6 text-rose-800">{source.errorMessage}</div>}
                  <div className="mt-4 flex flex-wrap gap-1.5">{source.signals.map((signal) => <span key={signal} className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">{signal}</span>)}</div>
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
  return <div className="rounded-2xl border border-slate-200/80 bg-white p-4"><div className="text-xs font-bold text-slate-500">{label}</div><div className="mt-2 text-2xl font-black">{value.toLocaleString("ar-SA")}</div></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><div className="font-bold text-slate-400">{label}</div><div className="mt-1 truncate font-black text-slate-800" title={value}>{value}</div></div>;
}
