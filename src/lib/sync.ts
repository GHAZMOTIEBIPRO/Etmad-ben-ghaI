import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getDataConnectors } from "@/lib/data-sources";
import type { DataSourceConnector } from "@/lib/data-sources/types";
import type { SyncBatchResult, SyncResult } from "@/lib/data-sources/types";

export async function runSync(): Promise<SyncBatchResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase is required to persist synchronized data");

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const connectors = getDataConnectors();
  const startedAt = new Date().toISOString();
  const results: SyncResult[] = [];

  for (const connector of connectors) {
    results.push(await syncConnector(supabase, connector));
  }

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

  const { data: sourceRow, error: sourceError } = await supabase
    .from("data_sources")
    .upsert({ key: connector.key, name: connector.name, is_active: true }, { onConflict: "key" })
    .select("id")
    .single();
  if (sourceError || !sourceRow) {
    result.errors.push(sourceError?.message ?? `Could not initialize data source ${connector.key}`);
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
    return result;
  }

  try {
    const incoming = await connector.fetchTenders(lastLog?.completed_at ?? undefined);
    result.fetched = incoming.length;

    for (const tender of incoming) {
      try {
        const entity = await supabase.from("government_entities").upsert(
          { id: tender.governmentEntityId, name: tender.governmentEntityName, slug: tender.governmentEntitySlug },
          { onConflict: "id" },
        );
        if (entity.error) throw entity.error;

        const activity = await supabase.from("activities").upsert(
          {
            id: tender.activityId,
            name: tender.activityName,
            sector: tender.sector,
            slug: tender.activityName.toLowerCase().replace(/\s+/g, "-").replace(/[^\p{L}\p{N}-]+/gu, ""),
          },
          { onConflict: "id" },
        );
        if (activity.error) throw activity.error;

        const region = await supabase.from("regions").upsert(
          {
            id: tender.regionId,
            name: tender.regionName,
            slug: tender.regionName.toLowerCase().replace(/\s+/g, "-").replace(/[^\p{L}\p{N}-]+/gu, ""),
          },
          { onConflict: "id" },
        );
        if (region.error) throw region.error;

        const tenderUpsert = await supabase.from("tenders").upsert(
          {
            id: tender.id,
            competition_number: tender.competitionNumber,
            name: tender.name,
            description: tender.description,
            government_entity_id: tender.governmentEntityId,
            activity_id: tender.activityId,
            region_id: tender.regionId,
            publication_date: tender.publicationDate,
            submission_deadline: tender.submissionDeadline || null,
            bid_opening_date: tender.bidOpeningDate || null,
            brochure_price: tender.brochurePrice,
            estimated_value: tender.estimatedValue,
            status: tender.status,
            source_external_id: tender.sourceExternalId,
            source_url: tender.sourceUrl,
            data_source_id: sourceRow.id,
            source_updated_at: tender.updatedAt,
          },
          { onConflict: "source_external_id" },
        ).select("id").single();
        if (tenderUpsert.error) throw tenderUpsert.error;

        if (tender.award && tender.award.awardDate) {
          const company = await supabase.from("companies").upsert(
            { id: tender.award.companyId, name: tender.award.companyName, slug: tender.award.companySlug },
            { onConflict: "id" },
          );
          if (company.error) throw company.error;

          const award = await supabase.from("awards").upsert(
            {
              id: tender.award.id,
              tender_id: tenderUpsert.data.id,
              company_id: tender.award.companyId,
              award_date: tender.award.awardDate,
              amount: tender.award.amount,
              status: tender.award.status,
              source_external_id: `${tender.sourceExternalId}-award`,
            },
            { onConflict: "source_external_id" },
          );
          if (award.error) throw award.error;

          const participation = await supabase.from("company_participations").upsert(
            { company_id: tender.award.companyId, tender_id: tenderUpsert.data.id, result: "won" },
            { onConflict: "company_id,tender_id" },
          );
          if (participation.error) throw participation.error;
        }

        result.upserted += 1;
      } catch (error) {
        result.errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    result.skipped = Math.max(0, result.fetched - result.upserted);
    await supabase.from("sync_logs").update({
      status: result.errors.length ? "partial" : "success",
      completed_at: new Date().toISOString(),
      fetched_count: result.fetched,
      upserted_count: result.upserted,
      error_count: result.errors.length,
      error_message: result.errors.slice(0, 10).join("\n") || null,
    }).eq("id", logInsert.data.id);
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
  }

  return result;
}
