import "server-only";
import { createClient } from "@supabase/supabase-js";
import {
  filterProjects,
  getMarketIntelligence,
  getProjectById,
  getProjectIntelligence,
  projectStageLabels,
  type MarketBucket,
  type MarketIntelligenceSnapshot,
  type ProjectFilters,
  type ProjectIntelligenceRecord,
  type ProjectStage,
} from "@/lib/project-intelligence";
import type { Tender } from "@/lib/types";

export interface ProjectPageResult {
  items: ProjectIntelligenceRecord[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  regions: string[];
  sectors: string[];
}

const stageLabels = new Map<ProjectStage, string>(projectStageLabels());

function hasSupabaseConfig(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase environment variables are not configured");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function isMissingRelation(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || /does not exist|could not find the table/i.test(error.message ?? "");
}

function fitLabel(score: number): string {
  return score >= 85 ? "ممتازة" : score >= 70 ? "جيدة جدًا" : score >= 55 ? "جيدة" : "ضعيفة";
}

function asIso(value: unknown): string {
  if (!value) return new Date(0).toISOString();
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean).slice(0, 6);
  return [];
}

function mapProjectRow(row: Record<string, unknown>): ProjectIntelligenceRecord {
  const stage = String(row.stage ?? "planning") as ProjectStage;
  const score = Number(row.fit_score ?? 0);
  return {
    id: String(row.id),
    name: String(row.name ?? "مشروع غير مسمى"),
    ownerName: String(row.owner_name ?? "غير محدد"),
    regionName: String(row.region_name ?? "غير محدد"),
    sector: String(row.sector ?? "غير محدد"),
    activityName: String(row.activity_name ?? "غير محدد"),
    stage,
    stageLabel: stageLabels.get(stage) ?? stage,
    estimatedValue: row.estimated_value == null ? null : Number(row.estimated_value),
    awardValue: row.award_value == null ? null : Number(row.award_value),
    firstSeen: asIso(row.first_seen_at),
    latestUpdate: asIso(row.last_seen_at ?? row.updated_at),
    opportunityCount: Number(row.opportunity_count ?? 0),
    sourceCount: Number(row.source_count ?? 0),
    sourceRefs: [],
    parties: [],
    opportunities: [],
    fitScore: score,
    fitLabel: fitLabel(score),
    fitReasons: stringArray(row.fit_score_breakdown),
    confidence: Number(row.confidence ?? 0),
  };
}

function mapTenderViewRow(row: Record<string, unknown>): Tender {
  return {
    id: String(row.id),
    competitionNumber: String(row.competition_number ?? ""),
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    governmentEntityId: String(row.government_entity_id ?? ""),
    governmentEntityName: String(row.government_entity_name ?? ""),
    governmentEntitySlug: String(row.government_entity_slug ?? ""),
    activityId: String(row.activity_id ?? ""),
    activityName: String(row.activity_name ?? ""),
    sector: String(row.sector ?? ""),
    regionId: String(row.region_id ?? ""),
    regionName: String(row.region_name ?? ""),
    publicationDate: String(row.publication_date ?? ""),
    submissionDeadline: row.submission_deadline ? String(row.submission_deadline) : "",
    bidOpeningDate: row.bid_opening_date ? String(row.bid_opening_date) : "",
    brochurePrice: row.brochure_price == null ? null : Number(row.brochure_price),
    estimatedValue: row.estimated_value == null ? null : Number(row.estimated_value),
    status: String(row.status ?? "open") as Tender["status"],
    awarded: Boolean(row.awarded),
    award: row.award_id ? {
      id: String(row.award_id),
      tenderId: String(row.id),
      companyId: String(row.winner_company_id ?? ""),
      companyName: String(row.winner_name ?? ""),
      companySlug: String(row.winner_slug ?? ""),
      awardDate: row.award_date ? String(row.award_date) : "",
      amount: Number(row.award_amount ?? 0),
      status: String(row.award_status ?? "announced") as "announced" | "final",
    } : null,
    sourceUrl: row.source_url ? String(row.source_url) : undefined,
    sourceExternalId: String(row.source_external_id ?? ""),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

function sanitizeSearch(value: string): string {
  return value.replace(/[(),%]/g, " ").replace(/\s+/g, " ").trim();
}

async function fallbackProjectPage(filters: ProjectFilters, page: number, pageSize: number): Promise<ProjectPageResult> {
  const all = await getProjectIntelligence();
  const filtered = filterProjects(all, filters);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  return {
    items: filtered.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    total: filtered.length,
    totalPages,
    regions: [...new Set(all.map((project) => project.regionName))].sort((a, b) => a.localeCompare(b, "ar")),
    sectors: [...new Set(all.map((project) => project.sector))].sort((a, b) => a.localeCompare(b, "ar")),
  };
}

export async function listProjectsPage(filters: ProjectFilters, page = 1, pageSize = 20): Promise<ProjectPageResult> {
  const safePage = Math.max(1, page);
  const safeSize = Math.max(1, Math.min(pageSize, 100));
  if (!hasSupabaseConfig()) return fallbackProjectPage(filters, safePage, safeSize);

  const supabase = supabaseAdmin();
  const from = (safePage - 1) * safeSize;
  const to = from + safeSize - 1;
  let query = supabase.from("project_search_view").select("*", { count: "exact" }).range(from, to);

  if (filters.q) {
    const q = sanitizeSearch(filters.q);
    if (q) query = query.or(`name.ilike.%${q}%,owner_name.ilike.%${q}%,activity_name.ilike.%${q}%`);
  }
  if (filters.region) query = query.eq("region_name", filters.region);
  if (filters.sector) query = query.eq("sector", filters.sector);
  if (filters.stage) query = query.eq("stage", filters.stage);
  if (filters.minValue != null) query = query.gte("known_value", filters.minValue);
  if (filters.maxValue != null) query = query.lte("known_value", filters.maxValue);
  query = query.order("last_seen_at", { ascending: false, nullsFirst: false });

  const [rowsResult, regionsResult, sectorsResult] = await Promise.all([
    query,
    supabase.from("market_region_summary").select("key").order("count", { ascending: false }),
    supabase.from("market_sector_summary").select("key").order("count", { ascending: false }),
  ]);

  if (isMissingRelation(rowsResult.error) || isMissingRelation(regionsResult.error) || isMissingRelation(sectorsResult.error)) {
    return fallbackProjectPage(filters, safePage, safeSize);
  }
  if (rowsResult.error) throw rowsResult.error;

  const total = rowsResult.count ?? 0;
  return {
    items: (rowsResult.data ?? []).map((row) => mapProjectRow(row as Record<string, unknown>)),
    page: safePage,
    pageSize: safeSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / safeSize)),
    regions: (regionsResult.data ?? []).map((row) => String(row.key)).filter(Boolean),
    sectors: (sectorsResult.data ?? []).map((row) => String(row.key)).filter(Boolean),
  };
}

function mapBuckets(rows: Array<Record<string, unknown>> | null, stageMode = false): MarketBucket[] {
  return (rows ?? []).map((row) => {
    const raw = String(row.key ?? "غير محدد");
    const label = stageMode ? stageLabels.get(raw as ProjectStage) ?? raw : raw;
    return { label, count: Number(row.count ?? 0), value: Number(row.value ?? 0) };
  });
}

export async function getMarketSnapshot(): Promise<MarketIntelligenceSnapshot> {
  if (!hasSupabaseConfig()) return getMarketIntelligence();
  const supabase = supabaseAdmin();
  const [metrics, stages, regions, sectors, top, best, recent] = await Promise.all([
    supabase.from("market_metrics_view").select("*").maybeSingle(),
    supabase.from("market_stage_summary").select("key,count,value").order("count", { ascending: false }),
    supabase.from("market_region_summary").select("key,count,value").order("count", { ascending: false }).limit(12),
    supabase.from("market_sector_summary").select("key,count,value").order("count", { ascending: false }).limit(12),
    supabase.from("project_search_view").select("*").order("known_value", { ascending: false, nullsFirst: false }).limit(8),
    supabase.from("project_search_view").select("*").order("fit_score", { ascending: false }).order("last_seen_at", { ascending: false, nullsFirst: false }).limit(8),
    supabase.from("project_search_view").select("*").order("last_seen_at", { ascending: false, nullsFirst: false }).limit(8),
  ]);

  const allErrors = [metrics.error, stages.error, regions.error, sectors.error, top.error, best.error, recent.error];
  if (allErrors.some(isMissingRelation)) return getMarketIntelligence();
  const firstError = allErrors.find(Boolean);
  if (firstError) throw firstError;
  const row = (metrics.data ?? {}) as Record<string, unknown>;

  return {
    totalProjects: Number(row.total_projects ?? 0),
    knownProjectValue: Number(row.known_project_value ?? 0),
    openOpportunities: Number(row.open_opportunities ?? 0),
    awardedOpportunities: Number(row.awarded_opportunities ?? 0),
    pipelineProjects: Number(row.pipeline_projects ?? 0),
    newLast7Days: Number(row.new_last_7_days ?? 0),
    updatedLast30Days: Number(row.updated_last_30_days ?? 0),
    stages: mapBuckets((stages.data ?? []) as Array<Record<string, unknown>>, true),
    regions: mapBuckets((regions.data ?? []) as Array<Record<string, unknown>>),
    sectors: mapBuckets((sectors.data ?? []) as Array<Record<string, unknown>>),
    topProjects: (top.data ?? []).map((item) => mapProjectRow(item as Record<string, unknown>)),
    bestFitProjects: (best.data ?? []).map((item) => mapProjectRow(item as Record<string, unknown>)),
    recentProjects: (recent.data ?? []).map((item) => mapProjectRow(item as Record<string, unknown>)),
  };
}

export async function getProject360(id: string): Promise<ProjectIntelligenceRecord | null> {
  if (!hasSupabaseConfig()) return getProjectById(id);
  const supabase = supabaseAdmin();
  const projectResult = await supabase.from("project_search_view").select("*").eq("id", id).maybeSingle();
  if (isMissingRelation(projectResult.error)) return getProjectById(id);
  if (projectResult.error) throw projectResult.error;
  if (!projectResult.data) return getProjectById(id);

  const [sourcesResult, partiesResult, linksResult] = await Promise.all([
    supabase.from("project_sources").select("source_name,source_external_id,source_url,last_seen_at").eq("project_id", id).order("last_seen_at", { ascending: false }),
    supabase.from("project_parties").select("role,party_name").eq("project_id", id),
    supabase.from("project_opportunities").select("tender_id").eq("project_id", id),
  ]);
  const relationErrors = [sourcesResult.error, partiesResult.error, linksResult.error];
  if (relationErrors.some(isMissingRelation)) return getProjectById(id);
  const relationError = relationErrors.find(Boolean);
  if (relationError) throw relationError;

  const tenderIds = (linksResult.data ?? []).map((row) => String(row.tender_id ?? "")).filter(Boolean);
  const tenderResult = tenderIds.length
    ? await supabase.from("tender_search_view").select("*").in("id", tenderIds)
    : { data: [], error: null };
  if (tenderResult.error) throw tenderResult.error;

  const project = mapProjectRow(projectResult.data as Record<string, unknown>);
  project.sourceRefs = (sourcesResult.data ?? []).map((row) => ({
    label: String(row.source_name ?? "مصدر عام"),
    url: String(row.source_url ?? ""),
    externalId: String(row.source_external_id ?? ""),
    lastUpdated: asIso(row.last_seen_at),
  })).filter((source) => source.url);
  project.sourceCount = project.sourceRefs.length || project.sourceCount;
  project.parties = (partiesResult.data ?? []).map((row) => ({
    role: (["owner", "contractor", "supplier"].includes(String(row.role)) ? String(row.role) : "supplier") as "owner" | "contractor" | "supplier",
    name: String(row.party_name ?? "غير محدد"),
  }));
  project.opportunities = (tenderResult.data ?? []).map((row) => mapTenderViewRow(row as Record<string, unknown>));
  project.opportunityCount = project.opportunities.length || project.opportunityCount;
  return project;
}
