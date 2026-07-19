import { createClient } from "@supabase/supabase-js";
import { getDataConnector } from "@/lib/data-sources";
import type { SyncResult } from "@/lib/data-sources/types";

export async function runSync(): Promise<SyncResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase is required to persist synchronized data");

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const connector = getDataConnector();
  const startedAt = new Date().toISOString();

  const { data: sourceRow, error: sourceError } = await supabase.from("data_sources").upsert({ key: connector.key, name: connector.name, is_active: true }, { onConflict: "key" }).select("id").single();
  if (sourceError) throw sourceError;

  const { data: lastLog } = await supabase.from("sync_logs").select("completed_at").eq("data_source_id", sourceRow.id).eq("status", "success").order("completed_at", { ascending: false }).limit(1).maybeSingle();
  const logInsert = await supabase.from("sync_logs").insert({ data_source_id: sourceRow.id, started_at: startedAt, status: "running" }).select("id").single();
  if (logInsert.error) throw logInsert.error;

  const result: SyncResult = { source: connector.key, fetched: 0, upserted: 0, skipped: 0, errors: [] };
  try {
    const incoming = await connector.fetchTenders(lastLog?.completed_at ?? undefined);
    result.fetched = incoming.length;
    for (const tender of incoming) {
      try {
        const entity = await supabase.from("government_entities").upsert({ id: tender.governmentEntityId, name: tender.governmentEntityName, slug: tender.governmentEntitySlug }, { onConflict: "id" });
        if (entity.error) throw entity.error;
        const activity = await supabase.from("activities").upsert({ id: tender.activityId, name: tender.activityName, sector: tender.sector, slug: tender.activityName.toLowerCase().replace(/\s+/g, "-") }, { onConflict: "id" });
        if (activity.error) throw activity.error;
        const region = await supabase.from("regions").upsert({ id: tender.regionId, name: tender.regionName, slug: tender.regionName.toLowerCase().replace(/\s+/g, "-") }, { onConflict: "id" });
        if (region.error) throw region.error;
        const tenderUpsert = await supabase.from("tenders").upsert({ id: tender.id, competition_number: tender.competitionNumber, name: tender.name, description: tender.description, government_entity_id: tender.governmentEntityId, activity_id: tender.activityId, region_id: tender.regionId, publication_date: tender.publicationDate, submission_deadline: tender.submissionDeadline, bid_opening_date: tender.bidOpeningDate, brochure_price: tender.brochurePrice, estimated_value: tender.estimatedValue, status: tender.status, source_external_id: tender.sourceExternalId, source_url: tender.sourceUrl, data_source_id: sourceRow.id, source_updated_at: tender.updatedAt }, { onConflict: "source_external_id" }).select("id").single();
        if (tenderUpsert.error) throw tenderUpsert.error;
        if (tender.award) {
          const company = await supabase.from("companies").upsert({ id: tender.award.companyId, name: tender.award.companyName, slug: tender.award.companySlug }, { onConflict: "id" });
          if (company.error) throw company.error;
          const award = await supabase.from("awards").upsert({ id: tender.award.id, tender_id: tenderUpsert.data.id, company_id: tender.award.companyId, award_date: tender.award.awardDate, amount: tender.award.amount, status: tender.award.status, source_external_id: `${tender.sourceExternalId}-award` }, { onConflict: "source_external_id" });
          if (award.error) throw award.error;
          const participation = await supabase.from("company_participations").upsert({ company_id: tender.award.companyId, tender_id: tenderUpsert.data.id, result: "won" }, { onConflict: "company_id,tender_id" });
          if (participation.error) throw participation.error;
        }
        result.upserted += 1;
      } catch (error) { result.errors.push(error instanceof Error ? error.message : String(error)); }
    }
    result.skipped = Math.max(0, result.fetched - result.upserted);
    await supabase.from("sync_logs").update({ status: result.errors.length ? "partial" : "success", completed_at: new Date().toISOString(), fetched_count: result.fetched, upserted_count: result.upserted, error_count: result.errors.length, error_message: result.errors.slice(0, 10).join("\n") || null }).eq("id", logInsert.data.id);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabase.from("sync_logs").update({ status: "failed", completed_at: new Date().toISOString(), error_count: 1, error_message: message }).eq("id", logInsert.data.id);
    throw error;
  }
}
