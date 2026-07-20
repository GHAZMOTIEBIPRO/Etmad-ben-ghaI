import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { chunkedUpsert } from "@/lib/db/chunked-upsert";
import type { SyncResult } from "@/lib/data-sources/types";
import { fetchWithPolicy } from "@/lib/http/fetch-with-policy";
import { inferOpenDataFormat, normalizeOpenDataRow, parseOpenDataBuffer } from "@/lib/ingestion/open-data-parser";

function boundedEnv(name: string, fallback: number, min: number, max: number): number {
  const parsed = Number(process.env[name] ?? fallback);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.trunc(parsed))) : fallback;
}

function hashJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function isMissingRelation(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || /does not exist|could not find the table/i.test(error.message ?? "");
}

function datasetKey(sourceKey: string, externalId: string): string {
  return `${sourceKey}:${externalId}`;
}

export async function syncPublicDatasetResources(supabase: SupabaseClient): Promise<SyncResult> {
  const result: SyncResult = { source: "public-dataset-resources", fetched: 0, upserted: 0, skipped: 0, errors: [] };
  const availability = await supabase.from("public_dataset_rows").select("id", { count: "exact", head: true });
  if (isMissingRelation(availability.error)) return result;
  if (availability.error) {
    result.errors.push(availability.error.message);
    return result;
  }

  const sourceName = "محرك استيراد ملفات البيانات المفتوحة CSV/XLSX/JSON";
  const source = await supabase.from("data_sources")
    .upsert({ key: result.source, name: sourceName, is_active: true }, { onConflict: "key" })
    .select("id")
    .single();
  if (source.error || !source.data) {
    result.errors.push(source.error?.message ?? "Could not initialize public dataset resource source");
    return result;
  }

  const log = await supabase.from("sync_logs")
    .insert({ data_source_id: source.data.id, started_at: new Date().toISOString(), status: "running" })
    .select("id")
    .single();
  if (log.error || !log.data) {
    result.errors.push(log.error?.message ?? "Could not create dataset resource sync log");
    return result;
  }

  try {
    // Keep the daily Vercel cron bounded. Unseen datasets are prioritized so coverage expands over time.
    const datasetLimit = boundedEnv("OPEN_DATA_RESOURCE_INGEST_LIMIT", 8, 1, 40);
    const rowLimit = boundedEnv("OPEN_DATA_RESOURCE_ROW_LIMIT", 3_000, 100, 20_000);
    const candidateLimit = Math.max(datasetLimit * 8, 50);

    const [datasetsResult, ingestedResult] = await Promise.all([
      supabase
        .from("public_datasets")
        .select("source_key,external_id,title,format,resource_url,source_updated_at,updated_at")
        .not("resource_url", "is", null)
        .order("source_updated_at", { ascending: false, nullsFirst: false })
        .order("updated_at", { ascending: false })
        .limit(candidateLimit),
      supabase
        .from("public_dataset_rows")
        .select("source_key,dataset_external_id")
        .limit(10_000),
    ]);
    if (datasetsResult.error) throw datasetsResult.error;
    if (ingestedResult.error) throw ingestedResult.error;

    const ingestedKeys = new Set((ingestedResult.data ?? []).map((row) => datasetKey(String(row.source_key), String(row.dataset_external_id))));
    const candidates = (datasetsResult.data ?? [])
      .filter((dataset) => {
        const url = String(dataset.resource_url ?? "");
        return inferOpenDataFormat(url, "", String(dataset.format ?? "")) !== "unknown";
      })
      .sort((left, right) => {
        const leftSeen = ingestedKeys.has(datasetKey(String(left.source_key), String(left.external_id)));
        const rightSeen = ingestedKeys.has(datasetKey(String(right.source_key), String(right.external_id)));
        return Number(leftSeen) - Number(rightSeen);
      })
      .slice(0, datasetLimit);

    for (const dataset of candidates) {
      const resourceUrl = String(dataset.resource_url ?? "");
      if (!resourceUrl) continue;
      try {
        const fetched = await fetchWithPolicy(resourceUrl, {
          headers: { Accept: "application/json,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,*/*" },
          retries: 2,
          minIntervalMs: 650,
          timeoutMs: 20_000,
          maxResponseBytes: 20 * 1024 * 1024,
        });
        const format = inferOpenDataFormat(resourceUrl, fetched.contentType, String(dataset.format ?? ""));
        if (format === "unknown") {
          result.skipped += 1;
          continue;
        }

        const parsed = parseOpenDataBuffer(fetched.body, format, { maxRows: rowLimit });
        result.fetched += parsed.length;
        if (!parsed.length) {
          result.skipped += 1;
          continue;
        }

        const sourceKey = String(dataset.source_key);
        const externalId = String(dataset.external_id);
        const rows = parsed.map((row, index) => {
          const normalized = normalizeOpenDataRow(row);
          return {
            source_key: sourceKey,
            dataset_external_id: externalId,
            row_number: index + 1,
            content_hash: hashJson(row),
            title: normalized.title,
            region: normalized.region,
            city: normalized.city,
            entity_name: normalized.entity,
            estimated_value: normalized.estimatedValue,
            event_date: normalized.eventDate,
            row_data: normalized.data,
            ingested_at: new Date().toISOString(),
          };
        });

        const deletion = await supabase.from("public_dataset_rows")
          .delete()
          .eq("source_key", sourceKey)
          .eq("dataset_external_id", externalId);
        if (deletion.error) throw deletion.error;
        result.upserted += await chunkedUpsert(supabase, "public_dataset_rows", rows, {
          onConflict: "source_key,dataset_external_id,content_hash",
          chunkSize: 500,
        });
      } catch (datasetError) {
        result.errors.push(`${String(dataset.title ?? dataset.external_id)}: ${datasetError instanceof Error ? datasetError.message : String(datasetError)}`);
      }
    }

    result.skipped += Math.max(0, result.fetched - result.upserted);
    await supabase.from("sync_logs").update({
      status: result.errors.length ? "partial" : "success",
      completed_at: new Date().toISOString(),
      fetched_count: result.fetched,
      upserted_count: result.upserted,
      error_count: result.errors.length,
      error_message: result.errors.slice(0, 10).join("\n") || null,
    }).eq("id", log.data.id);
  } catch (syncError) {
    result.errors.push(syncError instanceof Error ? syncError.message : String(syncError));
    await supabase.from("sync_logs").update({
      status: "failed",
      completed_at: new Date().toISOString(),
      fetched_count: result.fetched,
      upserted_count: result.upserted,
      error_count: result.errors.length,
      error_message: result.errors.slice(0, 10).join("\n"),
    }).eq("id", log.data.id);
  }

  return result;
}
