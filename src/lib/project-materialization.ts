import type { SupabaseClient } from "@supabase/supabase-js";
import { chunkedUpsert } from "@/lib/db/chunked-upsert";
import type { SyncResult } from "@/lib/data-sources/types";
import { canonicalEntityName, entityAliasSeedRows } from "@/lib/entity-resolution";
import { getProjectIntelligence, type ProjectIntelligenceRecord } from "@/lib/project-intelligence";

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

function isMissingFunction(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "PGRST202" || /function .* does not exist|could not find the function/i.test(error.message ?? "");
}

interface ResolvedProject {
  project: ProjectIntelligenceRecord;
  resolvedId: string;
  matchScore: number | null;
}

async function resolveProjectId(supabase: SupabaseClient, project: ProjectIntelligenceRecord): Promise<ResolvedProject> {
  const canonicalOwner = canonicalEntityName(project.ownerName);
  const rpc = await supabase.rpc("find_project_match", {
    p_name: project.name,
    p_owner: canonicalOwner,
    p_region: project.regionName,
    p_threshold: 0.74,
  }).limit(1).maybeSingle();

  if (isMissingFunction(rpc.error)) return { project, resolvedId: project.id, matchScore: null };
  if (rpc.error) throw rpc.error;
  if (!rpc.data) return { project, resolvedId: project.id, matchScore: null };

  const candidateId = String((rpc.data as Record<string, unknown>).project_id ?? "");
  const score = Number((rpc.data as Record<string, unknown>).match_score ?? 0);
  if (!candidateId || candidateId === project.id) return { project, resolvedId: project.id, matchScore: score };
  if (score >= 0.9) return { project, resolvedId: candidateId, matchScore: score };

  if (score >= 0.75) {
    const candidate = await supabase.from("project_merge_candidates").upsert({
      incoming_project_id: project.id,
      candidate_project_id: candidateId,
      similarity_score: score,
      status: "pending",
      reasons: {
        name: project.name,
        owner: canonicalOwner,
        originalOwner: project.ownerName,
        region: project.regionName,
      },
    }, { onConflict: "incoming_project_id,candidate_project_id" });
    if (candidate.error && !isMissingRelation(candidate.error)) throw candidate.error;
  }

  return { project, resolvedId: project.id, matchScore: score };
}

async function resolveProjects(supabase: SupabaseClient, projects: ProjectIntelligenceRecord[]): Promise<ResolvedProject[]> {
  const resolved: ResolvedProject[] = [];
  const concurrency = 8;
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < projects.length) {
      const index = cursor;
      cursor += 1;
      resolved[index] = await resolveProjectId(supabase, projects[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, projects.length) }, () => worker()));
  return resolved;
}

function eventRowsForProject(project: ProjectIntelligenceRecord, projectId: string): Array<Record<string, unknown>> {
  return project.opportunities.flatMap((opportunity) => {
    const rows: Array<Record<string, unknown>> = [];
    if (opportunity.publicationDate) {
      rows.push({
        project_id: projectId,
        event_type: opportunity.status === "open" ? "opportunity_published" : "opportunity_seen",
        title: opportunity.name,
        event_date: opportunity.publicationDate,
        source_url: opportunity.sourceUrl ?? null,
        metadata: { tenderId: opportunity.id, competitionNumber: opportunity.competitionNumber },
      });
    }
    if (opportunity.award?.awardDate) {
      rows.push({
        project_id: projectId,
        event_type: "award",
        title: `ترسية: ${opportunity.name}`,
        event_date: opportunity.award.awardDate,
        source_url: opportunity.sourceUrl ?? null,
        metadata: { tenderId: opportunity.id, company: opportunity.award.companyName, amount: opportunity.award.amount },
      });
    }
    return rows;
  });
}

async function rebuildProjectEvents(supabase: SupabaseClient, resolvedProjects: ResolvedProject[]): Promise<void> {
  const projectIds = [...new Set(resolvedProjects.map(({ resolvedId }) => resolvedId))];
  const deleteChunkSize = 100;
  for (let index = 0; index < projectIds.length; index += deleteChunkSize) {
    const ids = projectIds.slice(index, index + deleteChunkSize);
    const deletion = await supabase.from("project_events").delete().in("project_id", ids);
    if (deletion.error) throw deletion.error;
  }

  const events = resolvedProjects.flatMap(({ project, resolvedId }) => eventRowsForProject(project, resolvedId));
  if (events.length) await chunkedUpsert(supabase, "project_events", events, { chunkSize: 500 });
}

export async function syncProjectIntelligence(supabase: SupabaseClient): Promise<SyncResult> {
  const result: SyncResult = { source: "project-intelligence", fetched: 0, upserted: 0, skipped: 0, errors: [] };
  const startedAt = new Date().toISOString();

  const availability = await supabase.from("projects").select("id", { count: "exact", head: true });
  if (isMissingRelation(availability.error)) return result;
  if (availability.error) {
    result.errors.push(availability.error.message);
    return result;
  }

  try {
    await chunkedUpsert(supabase, "entity_aliases", entityAliasSeedRows(), { onConflict: "entity_type,normalized_alias", chunkSize: 200 });
  } catch (error) {
    const typed = error as { code?: string; message?: string };
    if (!isMissingRelation(typed)) result.errors.push(typed.message ?? String(error));
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
    const resolvedProjects = await resolveProjects(supabase, projects);

    if (resolvedProjects.length) {
      const now = new Date().toISOString();
      const projectRows = resolvedProjects.map(({ project, resolvedId }) => {
        const canonicalOwner = canonicalEntityName(project.ownerName || "");
        return {
          id: resolvedId,
          name: project.name,
          normalized_name: normalizeName(project.name),
          owner_name: canonicalOwner || null,
          normalized_owner: normalizeName(canonicalOwner),
          region_name: project.regionName || null,
          sector: project.sector || null,
          activity_name: project.activityName || null,
          stage: project.stage,
          estimated_value: project.estimatedValue,
          award_value: project.awardValue,
          confidence: project.confidence,
          fit_score: project.fitScore,
          fit_score_breakdown: project.fitReasons,
          first_seen_at: project.firstSeen || null,
          last_seen_at: project.latestUpdate || null,
          updated_at: now,
        };
      });
      await chunkedUpsert(supabase, "projects", projectRows, { onConflict: "id", chunkSize: 500 });

      const sourceRows = resolvedProjects.flatMap(({ project, resolvedId }) => project.sourceRefs.map((source) => ({
        project_id: resolvedId,
        source_name: source.label,
        source_external_id: source.externalId,
        source_url: source.url,
        last_seen_at: source.lastUpdated || now,
        metadata: {},
      })));
      if (sourceRows.length) await chunkedUpsert(supabase, "project_sources", sourceRows, { onConflict: "project_id,source_url", chunkSize: 500 });

      const partyRows = resolvedProjects.flatMap(({ project, resolvedId }) => project.parties.map((party) => ({
        project_id: resolvedId,
        role: party.role,
        party_name: canonicalEntityName(party.name),
        metadata: { originalName: party.name },
      })));
      if (partyRows.length) await chunkedUpsert(supabase, "project_parties", partyRows, { onConflict: "project_id,role,party_name", chunkSize: 500 });

      const opportunityRows = resolvedProjects.flatMap(({ project, resolvedId }) => project.opportunities.map((opportunity) => ({
        project_id: resolvedId,
        tender_id: opportunity.id,
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
          governmentEntity: canonicalEntityName(opportunity.governmentEntityName),
          activity: opportunity.activityName,
        },
      })));
      if (opportunityRows.length) await chunkedUpsert(supabase, "project_opportunities", opportunityRows, { onConflict: "project_id,opportunity_external_id", chunkSize: 500 });

      await rebuildProjectEvents(supabase, resolvedProjects);
      result.upserted = resolvedProjects.length;
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
