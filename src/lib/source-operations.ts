import "server-only";
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { sourceCatalog, type SourceCatalogItem } from "@/lib/source-catalog";

export type OperationalState = "healthy" | "partial" | "failed" | "running" | "ready" | "direct" | "configured" | "registration" | "monitored";

export interface SourceOperation extends SourceCatalogItem {
  connectorKey?: string;
  operationalState: OperationalState;
  operationalLabel: string;
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  fetchedCount: number | null;
  upsertedCount: number | null;
  errorCount: number | null;
  recordCount: number | null;
  errorMessage: string | null;
}

const extraOperationalSources: SourceCatalogItem[] = [
  {
    name: "فرص — المنافسات والفرص الاستثمارية",
    category: "فرص استثمارية حكومية وبلدية",
    access: "live",
    priority: "high",
    signals: ["منافسات استثمارية", "تطوير", "تشغيل وصيانة", "مساحة", "سعر كراسة", "موعد تقديم"],
    url: "https://furas.momah.gov.sa/en/opportunities-listing/Investment",
    description: "قائمة عامة للفرص الاستثمارية الحكومية والبلدية. متصلة بالرادار لالتقاط الحقول الظاهرة للعامة دون الدخول إلى حساب المستثمر أو شراء كراسة الشروط.",
  },
  {
    name: "صفحات المنافسات والمشتريات الحكومية المجانية",
    category: "منافسات وخطط مشتريات حكومية",
    access: "live",
    priority: "high",
    signals: ["بلدي", "هيئة المواصفات", "وزارة الصحة", "هيئة الزكاة والضريبة والجمارك", "الهيئة العامة للعقار", "خطط مشتريات", "مشاريع 2026"],
    url: "https://zatca.gov.sa/ar/MediaCenter/Elan/Pages/Procurement-and-Tenders-for-the-Fiscal-Year-2026.aspx",
    description: "موصل مجاني يقرأ الجداول المنشورة للعامة مباشرة من صفحات الجهات الحكومية، ويجمع المنافسات الحالية وخطط الأعمال والمشتريات دون استخدام API مدفوع.",
  },
  {
    name: "بلدي — كتالوج البيانات المفتوحة المجاني",
    category: "بيانات حكومية مفتوحة",
    access: "live",
    priority: "high",
    signals: ["API مجاني", "رخص", "تصنيف مقاولين", "طرق", "جسور", "أراض", "ملفات قابلة للتحميل"],
    url: "https://apiservices.balady.gov.sa/v1/momrah-services/open-data?items_per_page=All",
    description: "مزامنة مجانية لجميع مجموعات البيانات المفتوحة المتاحة عبر API بلدي، مع حفظ روابط الملفات والبيانات الوصفية في جدول مستقل عن المنافسات.",
  },
  {
    name: "البوابة الوطنية للبيانات المفتوحة — بيانات مجانية",
    category: "بيانات حكومية مفتوحة",
    access: "live",
    priority: "high",
    signals: ["API مجاني", "CSV", "XLS", "JSON", "منافسات", "مقاولات", "رخص بناء", "بنية تحتية"],
    url: "https://open.data.gov.sa/",
    description: "موصل بحث مجاني للبوابة الوطنية للبيانات المفتوحة يلتقط مجموعات البيانات المرتبطة بالمقاولات والمنافسات والبناء والإسكان والعقار والبنية التحتية ويخزن بياناتها الوصفية وروابط الموارد المتاحة.",
  },
  {
    name: "أمانة الرياض — البيانات المفتوحة للمنافسات والعقود",
    category: "بيانات الرياض المفتوحة",
    access: "live",
    priority: "high",
    signals: ["منافسات استثمارية", "عقود استثمارية", "CSV", "XLSX", "JSON", "XML", "الرياض"],
    url: "https://www.alriyadh.gov.sa/ar/data-sets/competitions",
    description: "يرصد تلقائيًا مجموعات بيانات أمانة الرياض للمنافسات والعقود الاستثمارية لعامي 2025 و2026 ويحفظ روابط ملفات CSV/XLSX/JSON/XML المنشورة للعامة.",
  },
];

const operationalCatalog = [
  ...sourceCatalog,
  ...extraOperationalSources.filter((extra) => !sourceCatalog.some((source) => source.name === extra.name)),
];

const connectorKeysByCatalogName: Record<string, string> = {
  "منصة مقاول — المشاريع": "muqawil-projects",
  "اعتماد — البيانات المفتوحة": "etimad-public",
  "المركز الوطني للتخصيص — المشاريع والفرص": "ncp-ppp",
  "الشركة السعودية لشراكات المياه — المشاريع المستقبلية": "swpc-future-projects",
  "PIF Private Sector Hub — Explore Opportunities": "pif-opportunities",
  "فرص — المنافسات والفرص الاستثمارية": "furas-investment",
  "صفحات المنافسات والمشتريات الحكومية المجانية": "public-procurement-pages",
  "بلدي — كتالوج البيانات المفتوحة المجاني": "balady-open-data",
  "البوابة الوطنية للبيانات المفتوحة — بيانات مجانية": "saudi-open-data",
  "أمانة الرياض — البيانات المفتوحة للمنافسات والعقود": "riyadh-municipality-open-data",
};

const datasetSourceKeys = new Set(["balady-open-data", "saudi-open-data", "riyadh-municipality-open-data"]);

const directLiveSources = new Set([
  "منصة مقاول — دليل المقاولين",
  "بلدي — البيانات المفتوحة",
]);

const stateLabels: Record<OperationalState, string> = {
  healthy: "متصل ويزامن",
  partial: "مزامنة جزئية",
  failed: "فشل آخر تشغيل",
  running: "تجري المزامنة",
  ready: "موصل جاهز — ينتظر أول مزامنة",
  direct: "قراءة مباشرة",
  configured: "يتطلب إعدادًا رسميًا",
  registration: "يتطلب تسجيل/تأهيل",
  monitored: "مصدر مراقب",
};

function baseState(source: SourceCatalogItem, connectorKey?: string): OperationalState {
  if (connectorKey) return "ready";
  if (directLiveSources.has(source.name)) return "direct";
  if (source.access === "configured") return "configured";
  if (source.access === "registration") return "registration";
  return "monitored";
}

function emptyOperation(source: SourceCatalogItem): SourceOperation {
  const connectorKey = connectorKeysByCatalogName[source.name];
  const operationalState = baseState(source, connectorKey);
  return {
    ...source,
    connectorKey,
    operationalState,
    operationalLabel: stateLabels[operationalState],
    lastSyncAt: null,
    lastSuccessAt: null,
    fetchedCount: null,
    upsertedCount: null,
    errorCount: null,
    recordCount: null,
    errorMessage: null,
  };
}

export const getSourceOperations = cache(async (): Promise<SourceOperation[]> => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return operationalCatalog.map(emptyOperation);

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const [{ data: sourceRows, error: sourceError }, { data: logs, error: logsError }] = await Promise.all([
      supabase.from("data_sources").select("id,key,name,is_active"),
      supabase.from("sync_logs")
        .select("data_source_id,status,started_at,completed_at,fetched_count,upserted_count,error_count,error_message")
        .order("started_at", { ascending: false })
        .limit(500),
    ]);

    if (sourceError || logsError) return operationalCatalog.map(emptyOperation);

    const sourceByKey = new Map((sourceRows ?? []).map((row) => [String(row.key), row]));
    const latestBySourceId = new Map<string, Record<string, unknown>>();
    const lastSuccessBySourceId = new Map<string, string>();

    for (const log of logs ?? []) {
      const sourceId = String(log.data_source_id);
      if (!latestBySourceId.has(sourceId)) latestBySourceId.set(sourceId, log as Record<string, unknown>);
      if (String(log.status) === "success" && !lastSuccessBySourceId.has(sourceId)) {
        lastSuccessBySourceId.set(sourceId, String(log.completed_at ?? log.started_at ?? ""));
      }
    }

    const countsBySourceId = new Map<string, number>();
    const datasetCountsByKey = new Map<string, number>();

    await Promise.all((sourceRows ?? []).map(async (row) => {
      const sourceKey = String(row.key);
      if (datasetSourceKeys.has(sourceKey)) {
        const { count } = await supabase.from("public_datasets").select("id", { count: "exact", head: true }).eq("source_key", sourceKey);
        datasetCountsByKey.set(sourceKey, count ?? 0);
        return;
      }
      const { count } = await supabase.from("tenders").select("id", { count: "exact", head: true }).eq("data_source_id", row.id);
      countsBySourceId.set(String(row.id), count ?? 0);
    }));

    return operationalCatalog.map((source) => {
      const base = emptyOperation(source);
      if (!base.connectorKey) return base;
      const sourceRow = sourceByKey.get(base.connectorKey);
      if (!sourceRow) return base;

      const sourceId = String(sourceRow.id);
      const latest = latestBySourceId.get(sourceId);
      const recordCount = datasetSourceKeys.has(base.connectorKey)
        ? datasetCountsByKey.get(base.connectorKey) ?? 0
        : countsBySourceId.get(sourceId) ?? 0;
      if (!latest) return { ...base, recordCount };

      const rawStatus = String(latest.status ?? "");
      const operationalState: OperationalState = rawStatus === "success"
        ? "healthy"
        : rawStatus === "partial"
          ? "partial"
          : rawStatus === "failed"
            ? "failed"
            : rawStatus === "running"
              ? "running"
              : "ready";

      return {
        ...base,
        operationalState,
        operationalLabel: stateLabels[operationalState],
        lastSyncAt: latest.completed_at ? String(latest.completed_at) : latest.started_at ? String(latest.started_at) : null,
        lastSuccessAt: lastSuccessBySourceId.get(sourceId) || null,
        fetchedCount: latest.fetched_count == null ? null : Number(latest.fetched_count),
        upsertedCount: latest.upserted_count == null ? null : Number(latest.upserted_count),
        errorCount: latest.error_count == null ? null : Number(latest.error_count),
        recordCount,
        errorMessage: latest.error_message ? String(latest.error_message) : null,
      };
    });
  } catch {
    return operationalCatalog.map(emptyOperation);
  }
});
