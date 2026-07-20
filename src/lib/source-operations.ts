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

const connectorKeysByCatalogName: Record<string, string> = {
  "منصة مقاول — المشاريع": "muqawil-projects",
  "اعتماد — البيانات المفتوحة": "etimad-public",
  "المركز الوطني للتخصيص — المشاريع والفرص": "ncp-ppp",
  "الشركة السعودية لشراكات المياه — المشاريع المستقبلية": "swpc-future-projects",
  "PIF Private Sector Hub — Explore Opportunities": "pif-opportunities",
};

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
  if (!url || !key) return sourceCatalog.map(emptyOperation);

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const [{ data: sourceRows, error: sourceError }, { data: logs, error: logsError }] = await Promise.all([
      supabase.from("data_sources").select("id,key,name,is_active"),
      supabase.from("sync_logs")
        .select("data_source_id,status,started_at,completed_at,fetched_count,upserted_count,error_count,error_message")
        .order("started_at", { ascending: false })
        .limit(250),
    ]);

    if (sourceError || logsError) return sourceCatalog.map(emptyOperation);

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

    const counts = new Map<string, number>();
    await Promise.all((sourceRows ?? []).map(async (row) => {
      const { count } = await supabase.from("tenders").select("id", { count: "exact", head: true }).eq("data_source_id", row.id);
      counts.set(String(row.id), count ?? 0);
    }));

    return sourceCatalog.map((source) => {
      const base = emptyOperation(source);
      if (!base.connectorKey) return base;
      const sourceRow = sourceByKey.get(base.connectorKey);
      if (!sourceRow) return base;

      const sourceId = String(sourceRow.id);
      const latest = latestBySourceId.get(sourceId);
      if (!latest) return { ...base, recordCount: counts.get(sourceId) ?? 0 };

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
        recordCount: counts.get(sourceId) ?? 0,
        errorMessage: latest.error_message ? String(latest.error_message) : null,
      };
    });
  } catch {
    return sourceCatalog.map(emptyOperation);
  }
});
