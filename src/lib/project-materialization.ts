import type { SupabaseClient } from "@supabase/supabase-js";
import { getProjectIntelligence } from "@/lib/project-intelligence";
import type { SyncResult } from "@/lib/data-sources/types";

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isMissingRelation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || /relation .* does not exist|could not find the table/i.test(error.message ?? "");
}

export async function syncProjectIntelligence(supabase: SupabaseClient): Promise<SyncResult> {
  const result: SyncResult = { source: "project-intelligence", fetched: 0, upserted: 0, skipped: 0, errors: [] };
  const startedAt = new Date().toISOString();

  const availability = await supabase.from("projects").select("id", { count: "exact", head: true });
  if (isMissingRelation(availability.error)) {
    // Migration may not be applied yet. Keep the main source sync healthy; the UI can still derive projects on demand.
    return result;
  }
  if (availability.error) {
    result.errors.push(availability.error.message);
    return result;
  }

  const sourceUpsert = await supabase
    .from("data_sources")
    .upsert({ key: "project-intelligence", name: "محرك توحيد المشاريع", is_active: true }, { onConflict: "key" })
    .select("id")
    .single();
  if (sourceUpsert.error || !sourceUpsert.data) {
    result.errors.push(sourceUpsert.error?.message ?? "Could not initialize project intelligence source");
    return result;
  }

  const logInsert = await supabase
    .from("sync_logs")
    .insert({ data_source_id: sourceUpsert.data.id, started_at: startedAt, status: "running" })
    .select("id")
    .single();
  if (logInsert.error || !logInsert.data) {
    result.errors.push(logInsert.error?.message ?? "Could not create project intelligence sync log");
    return result;
  }

  try {
    const projects = await getProjectIntelligence();
    result.fetched = projects.length;

    if (projects.length) {
      const projectRows = projects.map((project) => ({
        id: project.id,
        name: project.name,
        normalized_name: normalizeName(project.name),
        owner_name: project.ownerName || null,
        region_name: project.regionName || null,
        sector: project.sector || null,
        activity_name: project.activityName || null,
        stage: project.stage,
        estimated_value: project.estimatedValue,
        award_value: project.awardValue,
        confidence: project.confidence,
        fit_score: project.fitScore,
        first_seen_at: project.firstSeen || null,
        last_seen_at: project.latestUpdate || null,
        updated_at: new Date().toISOString(),
      }));
      const projectUpsert = await supabase.from("projects").upsert(projectRows, { onConflict: "id" });
      if (projectUpsert.error) throw projectUpsert.error;

      const sourceRows = projects.flatMap((project) => project.sourceRefs.map((source) => ({
        project_id: project.id,
        source_name: source.label,
        source_external_id: source.externalId,
        source_url: source.url,
        last_seen_at: source.lastUpdated || new Date().toISOString(),
        metadata: {},
      })));
      if (sourceRows.length) {
        const sourceResult = await supabase.from("project_sources").upsert(sourceRows, { onConflict: "project_id,source_url" });
        if (sourceResult.error) throw sourceResult.error;
      }

      const partyRows = projects.flatMap((project) => project.parties.map((party) => ({
        project_id: project.id,
        role: party.role,
        party_name: party.name,
        metadata: {},
      })));
      if (partyRows.length) {
        const partyResult = await supabase.from("project_parties").upsert(partyRows, { onConflict: "project_id,role,party_name" });
        if (partyResult.error) throw partyResult.error;
      }

      const opportunityRows = projects.flatMap((project) => project.opportunities.map((opportunity) => ({
        project_id: project.id,
        opportunity_external_id: opportunity.sourceExternalId,
        opportunity_name: opportunity.name,
        status: opportunity.status,
        publication_date: opportunity.publicationDate || null,
        submission_deadline: opportunity.submissionDeadline || null,
        source_url: opportunity.sourceUrl || null,
        estimated_value: opportunity.estimatedValue,
        award_value: opportunity.award?.amount ?? null,
        metadata: {
          competitionNumber: opportunity.competitionNumber,
          governmentEntity: opportunity.governmentEntityName,
          activity: opportunity.activityName,
        },
      })));
      if (opportunityRows.length) {
        const opportunityResult = await supabase.from("project_opportunities").upsert(opportunityRows, { onConflict: "project_id,opportunity_external_id" });
        if (opportunityResult.error) throw opportunityResult.error;
      }

      result.upserted = projects.length;
    }

    result.skipped = Math.max(0, result.fetched - result.upserted);
    await supabase.from("sync_logs").update({
      status: "success",
      completed_at: new Date().toISOString(),
      fetched_count: result.fetched,
      upserted_count: result.upserted,
      error_count: 0,
      error_message: null,
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
      error_message: message,
    }).eq("id", logInsert.data.id);
  }

  return result;
}
