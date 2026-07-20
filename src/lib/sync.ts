import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { chunkedUpsert } from "@/lib/db/chunked-upsert";
import { getDataConnectors } from "@/lib/data-sources";
import type { DataSourceConnector, SyncBatchResult, SyncResult } from "@/lib/data-sources/types";
import { deduplicateOpportunities } from "@/lib/deduplicate-opportunities";
import { syncFreePublicDatasetCatalogs } from "@/lib/free-public-datasets";
import { syncOfficialProcurementFiles } from "@/lib/official-procurement-file-sync";
import { syncProjectIntelligence } from "@/lib/project-materialization";
import { syncPublicDatasetResources } from "@/lib/public-dataset-resource-sync";
import { syncRiyadhMunicipalityOpenData } from "@/lib/riyadh-free-data";
import type { Tender } from "@/lib/types";

function boundedConcurrency(): number {
  const parsed = Number(process.env.SOURCE_SYNC_CONCURRENCY ?? 3);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(6, Math.trunc(parsed))) : 3;
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function run(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return results;
}

function contentHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function isMissingTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || /does not exist|could not find the table/i.test(error.message ?? "");
}

async function startSourceRun(supabase: SupabaseClient, connector: DataSourceConnector): Promise<string | null> {
  const { data, error } = await supabase.from("source_runs").insert({
    source_key: connector.key,
    status: "running",
    started_at: new Date().toISOString(),
    parser_version: connector.parserVersion ?? null,
  }).select("id").single();
  if (isMissingTable(error)) return null;
  if (error) throw error;
  return data ? String(data.id) : null;
}

async function finishSourceRun(
  supabase: SupabaseClient,
  runId: string | null,
  result: SyncResult,
  status: "success" | "partial" | "failed",
): Promise<void> {
  if (!runId) return;
  const { error } = await supabase.from("source_runs").update({
    status,
    completed_at: new Date().toISOString(),
    records_fetched: result.fetched,
    records_staged: result.fetched,
    records_upserted: result.upserted,
    error_message: result.errors.slice(0, 10).join("\n") || null,
  }).eq("id", runId);
  if (error && !isMissingTable(error)) console.error("Could not update source run", error);
}

async function stageRawItems(supabase: SupabaseClient, connector: DataSourceConnector, rows: Tender[]): Promise<void> {
  if (!rows.length) return;
  const staged = rows.map((row) => ({
    source_key: connector.key,
    source_external_id: row.sourceExternalId,
    source_url: row.sourceUrl ?? null,
    fetched_at: new Date().toISOString(),
    source_updated_at: row.updatedAt || null,
    content_hash: contentHash(row),
    parser_version: connector.parserVersion ?? null,
    parse_status: "parsed",
    raw_payload: row,
    metadata: { competitionNumber: row.competitionNumber },
  }));
  try {
    await chunkedUpsert(supabase, "raw_source_items", staged, { onConflict: "source_key,source_external_id", chunkSize: 500 });
  } catch (error) {
    const typed = error as { code?: string; message?: string };
    if (!isMissingTable(typed)) throw error;
  }
}

async function persistTenders(supabase: SupabaseClient, sourceId: string, rows: Tender[]): Promise<number> {
  if (!rows.length) return 0;

  const entities = [...new Map(rows.map((row) => [row.governmentEntityId, {
    id: row.governmentEntityId,
    name: row.governmentEntityName,
    slug: row.governmentEntitySlug,
  }])).values()];
  const activities = [...new Map(rows.map((row) => [row.activityId, {
    id: row.activityId,
    name: row.activityName,
    sector: row.sector,
    slug: row.activityName.toLowerCase().replace(/\s+/g, "-").replace(/[^\p{L}\p{N}-]+/gu, ""),
  }])).values()];
  const regions = [...new Map(rows.map((row) => [row.regionId, {
    id: row.regionId,
    name: row.regionName,
    slug: row.regionName.toLowerCase().replace(/\s+/g, "-").replace(/[^\p{L}\p{N}-]+/gu, ""),
  }])).values()];

  await Promise.all([
    chunkedUpsert(supabase, "government_entities", entities, { onConflict: "id" }),
    chunkedUpsert(supabase, "activities", activities, { onConflict: "id" }),
    chunkedUpsert(supabase, "regions", regions, { onConflict: "id" }),
  ]);

  const tenderRows = rows.map((row) => ({
    id: row.id,
    competition_number: row.competitionNumber,
    name: row.name,
    description: row.description,
    government_entity_id: row.governmentEntityId,
    activity_id: row.activityId,
    region_id: row.regionId,
    publication_date: row.publicationDate,
    submission_deadline: row.submissionDeadline || null,
    bid_opening_date: row.bidOpeningDate || null,
    brochure_price: row.brochurePrice,
    estimated_value: row.estimatedValue,
    status: row.status,
    source_external_id: row.sourceExternalId,
    source_url: row.sourceUrl ?? null,
    data_source_id: sourceId,
    source_updated_at: row.updatedAt,
  }));
  await chunkedUpsert(supabase, "tenders", tenderRows, { onConflict: "source_external_id", chunkSize: 500 });

  const awardedRows = rows.filter((row) => row.award && row.award.awardDate);
  const companies = [...new Map(awardedRows.map((row) => [row.award!.companyId, {
    id: row.award!.companyId,
    name: row.award!.companyName,
    slug: row.award!.companySlug,
  }])).values()];
  const awards = awardedRows.map((row) => ({
    id: row.award!.id,
    tender_id: row.id,
    company_id: row.award!.companyId,
    award_date: row.award!.awardDate,
    amount: row.award!.amount,
    status: row.award!.status,
    source_external_id: `${row.sourceExternalId}-award`,
  }));
  const participations = awardedRows.map((row) => ({ company_id: row.award!.companyId, tender_id: row.id, result: "won" }));

  if (companies.length) await chunkedUpsert(supabase, "companies", companies, { onConflict: "id" });
  if (awards.length) await chunkedUpsert(supabase, "awards", awards, { onConflict: "source_external_id" });
  if (participations.length) await chunkedUpsert(supabase, "company_participations", participations, { onConflict: "company_id,tender_id" });
  return rows.length;
}

export async function runSync(): Promise<SyncBatchResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase is required to persist synchronized data");

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const startedAt = new Date().toISOString();
  const connectors = getDataConnectors();
  const connectorResults = await mapWithConcurrency(connectors, boundedConcurrency(), (connector) => syncConnector(supabase, connector));

  const catalogResults = await syncFreePublicDatasetCatalogs(supabase);
  const secondaryResults = await Promise.all([
    syncRiyadhMunicipalityOpenData(supabase),
    syncOfficialProcurementFiles(supabase),
  ]);
  const resourceResult = await syncPublicDatasetResources(supabase);
  const projectResult = await syncProjectIntelligence(supabase);

  const results = [...connectorResults, ...catalogResults, ...secondaryResults, resourceResult, projectResult];
  const completedAt = new Date().toISOString();
  return {
    startedAt,
    completedAt,
    results,
    totals: {
      sources: results.length,
      fetched: results.reduce((sum, result) => sum + result.fetched, 0),
      upserted: results.reduce((sum, result) => sum + result.upserted, 0),
      skipped: results.reduce((sum, result) => sum + result.skipped, 0),
      errors: results.reduce((sum, result) => sum + result.errors.length, 0),
    },
  };
}

async function syncConnector(supabase: SupabaseClient, connector: DataSourceConnector): Promise<SyncResult> {
  const result: SyncResult = { source: connector.key, fetched: 0, upserted: 0, skipped: 0, errors: [] };
  const startedAt = new Date().toISOString();
  let sourceRunId: string | null = null;

  try {
    sourceRunId = await startSourceRun(supabase, connector);
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error));
  }

  const { data: sourceRow, error: sourceError } = await supabase
    .from("data_sources")
    .upsert({ key: connector.key, name: connector.name, is_active: true }, { onConflict: "key" })
    .select("id")
    .single();
  if (sourceError || !sourceRow) {
    result.errors.push(sourceError?.message ?? `Could not initialize data source ${connector.key}`);
    await finishSourceRun(supabase, sourceRunId, result, "failed");
    return result;
  }

  const { data: lastLog } = await supabase
    .from("sync_logs")
    .select("completed_at")
    .eq("data_source_id", sourceRow.id)
    .eq("status", "success")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const logInsert = await supabase
    .from("sync_logs")
    .insert({ data_source_id: sourceRow.id, started_at: startedAt, status: "running" })
    .select("id")
    .single();
  if (logInsert.error || !logInsert.data) {
    result.errors.push(logInsert.error?.message ?? `Could not create sync log for ${connector.key}`);
    await finishSourceRun(supabase, sourceRunId, result, "failed");
    return result;
  }

  try {
    const fetched = await connector.fetchTenders(lastLog?.completed_at ?? undefined);
    result.fetched = fetched.length;
    await stageRawItems(supabase, connector, fetched);
    const incoming = deduplicateOpportunities(fetched);
    result.skipped += Math.max(0, fetched.length - incoming.length);
    result.upserted = await persistTenders(supabase, String(sourceRow.id), incoming);
    result.skipped += Math.max(0, incoming.length - result.upserted);

    const status = result.errors.length ? "partial" : "success";
    await supabase.from("sync_logs").update({
      status,
      completed_at: new Date().toISOString(),
      fetched_count: result.fetched,
      upserted_count: result.upserted,
      error_count: result.errors.length,
      error_message: result.errors.slice(0, 10).join("\n") || null,
    }).eq("id", logInsert.data.id);
    await finishSourceRun(supabase, sourceRunId, result, status);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.errors.push(message);
    await supabase.from("sync_logs").update({
      status: "failed",
      completed_at: new Date().toISOString(),
      fetched_count: result.fetched,
      upserted_count: result.upserted,
      error_count: result.errors.length,
      error_message: result.errors.slice(0, 10).join("\n"),
    }).eq("id", logInsert.data.id);
    await finishSourceRun(supabase, sourceRunId, result, "failed");
  }

  return result;
}
