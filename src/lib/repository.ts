import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { activities, companies, governmentEntities, regions, tenders as mockTenders } from "@/lib/mock-data";
import { MuqawilProjectsConnector } from "@/lib/data-sources/muqawil-projects-connector";
import type { Activity, AnalyticsBucket, AnalyticsData, CompanyProfile, DashboardStats, GovernmentEntity, PaginatedTenders, Region, Tender, TenderFilters } from "@/lib/types";

function normalize(value: string) {
  return value.toLocaleLowerCase("ar-SA").trim();
}

function applyFilters(rows: Tender[], filters: TenderFilters): Tender[] {
  const q = filters.q ? normalize(filters.q) : "";
  const winner = filters.winner ? normalize(filters.winner) : "";
  return rows.filter((tender) => {
    if (q && ![
      tender.competitionNumber,
      tender.name,
      tender.description,
      tender.governmentEntityName,
      tender.activityName,
      tender.regionName,
      tender.award?.companyName ?? "",
    ].some((field) => normalize(field).includes(q))) return false;
    if (filters.awarded !== undefined && tender.awarded !== filters.awarded) return false;
    if (filters.governmentEntity && tender.governmentEntityId !== filters.governmentEntity) return false;
    if (filters.activity && tender.activityId !== filters.activity) return false;
    if (filters.sector && tender.sector !== filters.sector) return false;
    if (filters.region && tender.regionId !== filters.region) return false;
    if (filters.publicationFrom && tender.publicationDate < filters.publicationFrom) return false;
    if (filters.publicationTo && tender.publicationDate > filters.publicationTo) return false;
    if (filters.awardFrom && (!tender.award || tender.award.awardDate < filters.awardFrom)) return false;
    if (filters.awardTo && (!tender.award || tender.award.awardDate > filters.awardTo)) return false;
    if (filters.estimatedMin !== undefined && (tender.estimatedValue ?? 0) < filters.estimatedMin) return false;
    if (filters.estimatedMax !== undefined && (tender.estimatedValue ?? Number.MAX_SAFE_INTEGER) > filters.estimatedMax) return false;
    if (filters.awardMin !== undefined && (tender.award?.amount ?? 0) < filters.awardMin) return false;
    if (filters.awardMax !== undefined && (tender.award?.amount ?? Number.MAX_SAFE_INTEGER) > filters.awardMax) return false;
    if (filters.status && tender.status !== filters.status) return false;
    if (winner && !normalize(tender.award?.companyName ?? "").includes(winner)) return false;
    return true;
  });
}

function sortRows(items: Tender[], filters: TenderFilters): Tender[] {
  const order = filters.order === "asc" ? 1 : -1;
  const sort = filters.sort ?? "publicationDate";
  return [...items].sort((a, b) => {
    const values: Record<string, [string | number, string | number]> = {
      publicationDate: [a.publicationDate, b.publicationDate],
      awardDate: [a.award?.awardDate ?? "", b.award?.awardDate ?? ""],
      awardAmount: [a.award?.amount ?? -1, b.award?.amount ?? -1],
      estimatedValue: [a.estimatedValue ?? -1, b.estimatedValue ?? -1],
      name: [a.name, b.name],
    };
    const [left, right] = values[sort];
    return left > right ? order : left < right ? -order : 0;
  });
}

function paginateRows(rows: Tender[], filters: TenderFilters): PaginatedTenders {
  const filtered = sortRows(applyFilters(rows, filters), filters);
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 10;
  const start = (page - 1) * pageSize;
  return {
    items: filtered.slice(start, start + pageSize),
    page,
    pageSize,
    total: filtered.length,
    totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
  };
}

function bucket(rows: Tender[], label: (tender: Tender) => string, onlyAwards = false): AnalyticsBucket[] {
  const map = new Map<string, AnalyticsBucket>();
  rows.forEach((tender) => {
    if (onlyAwards && !tender.award) return;
    const key = label(tender) || "غير محدد";
    const current = map.get(key) ?? { label: key, count: 0, value: 0 };
    current.count += 1;
    current.value += tender.award?.amount ?? 0;
    map.set(key, current);
  });
  return [...map.values()];
}

export function hasSupabaseConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase environment variables are not configured");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function livePageCount(): number {
  const parsed = Number(process.env.MUQAWIL_LIVE_MAX_PAGES ?? 3);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(10, Math.trunc(parsed))) : 3;
}

const getLiveFallbackTenders = cache(async (): Promise<Tender[]> => {
  try {
    const rows = await new MuqawilProjectsConnector({ maxPages: livePageCount() }).fetchTenders();
    if (rows.length) return rows;
  } catch (error) {
    console.error("Live Muqawil fallback failed", error);
  }
  return process.env.ALLOW_MOCK_DATA === "true" ? mockTenders : [];
});

const isSupabaseEmpty = cache(async (): Promise<boolean> => {
  if (!hasSupabaseConfig()) return true;
  try {
    const { count, error } = await supabaseAdmin().from("tenders").select("id", { count: "exact", head: true });
    if (error) return true;
    return (count ?? 0) === 0;
  } catch {
    return true;
  }
});

async function fallbackRowsIfNeeded(): Promise<Tender[] | null> {
  if (!hasSupabaseConfig() || await isSupabaseEmpty()) return getLiveFallbackTenders();
  return null;
}

export async function listTenders(filters: TenderFilters): Promise<PaginatedTenders> {
  const fallback = await fallbackRowsIfNeeded();
  if (fallback) return paginateRows(fallback, filters);

  const supabase = supabaseAdmin();
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 10;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let query = supabase.from("tender_search_view").select("*", { count: "exact" }).range(from, to);

  if (filters.q) query = query.or(`competition_number.ilike.%${filters.q}%,name.ilike.%${filters.q}%,government_entity_name.ilike.%${filters.q}%,winner_name.ilike.%${filters.q}%`);
  if (filters.awarded !== undefined) query = query.eq("awarded", filters.awarded);
  if (filters.governmentEntity) query = query.eq("government_entity_id", filters.governmentEntity);
  if (filters.activity) query = query.eq("activity_id", filters.activity);
  if (filters.sector) query = query.eq("sector", filters.sector);
  if (filters.region) query = query.eq("region_id", filters.region);
  if (filters.publicationFrom) query = query.gte("publication_date", filters.publicationFrom);
  if (filters.publicationTo) query = query.lte("publication_date", filters.publicationTo);
  if (filters.awardFrom) query = query.gte("award_date", filters.awardFrom);
  if (filters.awardTo) query = query.lte("award_date", filters.awardTo);
  if (filters.estimatedMin !== undefined) query = query.gte("estimated_value", filters.estimatedMin);
  if (filters.estimatedMax !== undefined) query = query.lte("estimated_value", filters.estimatedMax);
  if (filters.awardMin !== undefined) query = query.gte("award_amount", filters.awardMin);
  if (filters.awardMax !== undefined) query = query.lte("award_amount", filters.awardMax);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.winner) query = query.ilike("winner_name", `%${filters.winner}%`);

  const sortMap: Record<string, string> = {
    publicationDate: "publication_date",
    awardDate: "award_date",
    awardAmount: "award_amount",
    estimatedValue: "estimated_value",
    name: "name",
  };
  query = query.order(sortMap[filters.sort ?? "publicationDate"], { ascending: filters.order === "asc", nullsFirst: false });

  const { data, error, count } = await query;
  if (error) throw error;
  const items: Tender[] = (data ?? []).map(mapViewRowToTender);
  return { items, page, pageSize, total: count ?? 0, totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)) };
}

function mapViewRowToTender(row: Record<string, unknown>): Tender {
  return {
    id: String(row.id),
    competitionNumber: String(row.competition_number),
    name: String(row.name),
    description: String(row.description ?? ""),
    governmentEntityId: String(row.government_entity_id),
    governmentEntityName: String(row.government_entity_name),
    governmentEntitySlug: String(row.government_entity_slug),
    activityId: String(row.activity_id),
    activityName: String(row.activity_name),
    sector: String(row.sector),
    regionId: String(row.region_id),
    regionName: String(row.region_name),
    publicationDate: String(row.publication_date),
    submissionDeadline: row.submission_deadline ? String(row.submission_deadline) : "",
    bidOpeningDate: row.bid_opening_date ? String(row.bid_opening_date) : "",
    brochurePrice: row.brochure_price == null ? null : Number(row.brochure_price),
    estimatedValue: row.estimated_value == null ? null : Number(row.estimated_value),
    status: row.status as Tender["status"],
    awarded: Boolean(row.awarded),
    award: row.award_id ? {
      id: String(row.award_id),
      tenderId: String(row.id),
      companyId: String(row.winner_company_id),
      companyName: String(row.winner_name),
      companySlug: String(row.winner_slug),
      awardDate: row.award_date ? String(row.award_date) : "",
      amount: Number(row.award_amount ?? 0),
      status: String(row.award_status) as "announced" | "final",
    } : null,
    sourceUrl: row.source_url ? String(row.source_url) : undefined,
    sourceExternalId: String(row.source_external_id),
    updatedAt: String(row.updated_at),
  };
}

export async function getTender(id: string): Promise<Tender | null> {
  const fallback = await fallbackRowsIfNeeded();
  if (fallback) return fallback.find((tender) => tender.id === id) ?? null;
  const { data, error } = await supabaseAdmin().from("tender_search_view").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapViewRowToTender(data) : null;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const fallback = await fallbackRowsIfNeeded();
  if (fallback) {
    const awards = fallback.filter((tender) => tender.award);
    return {
      totalTenders: fallback.length,
      totalAwards: awards.length,
      totalAwardValue: awards.reduce((sum, tender) => sum + (tender.award?.amount ?? 0), 0),
      totalGovernmentEntities: new Set(fallback.map((tender) => tender.governmentEntityId)).size,
      totalWinningCompanies: new Set(awards.map((tender) => tender.award!.companyId)).size,
    };
  }

  const supabase = supabaseAdmin();
  const [{ count: totalTenders }, { count: totalAwards }, awards, entities, winners] = await Promise.all([
    supabase.from("tenders").select("id", { count: "exact", head: true }),
    supabase.from("awards").select("id", { count: "exact", head: true }),
    supabase.from("awards").select("amount"),
    supabase.from("government_entities").select("id", { count: "exact", head: true }),
    supabase.from("awards").select("company_id"),
  ]);
  return {
    totalTenders: totalTenders ?? 0,
    totalAwards: totalAwards ?? 0,
    totalAwardValue: (awards.data ?? []).reduce((sum, item) => sum + Number(item.amount ?? 0), 0),
    totalGovernmentEntities: entities.count ?? 0,
    totalWinningCompanies: new Set((winners.data ?? []).map((item) => item.company_id)).size,
  };
}

export async function getFilterOptions(): Promise<{ governmentEntities: GovernmentEntity[]; activities: Activity[]; regions: Region[]; sectors: string[] }> {
  const fallback = await fallbackRowsIfNeeded();
  if (fallback) {
    if (!fallback.length && process.env.ALLOW_MOCK_DATA === "true") {
      return { governmentEntities, activities, regions, sectors: [...new Set(activities.map((activity) => activity.sector))] };
    }
    const entityMap = new Map<string, GovernmentEntity>();
    const activityMap = new Map<string, Activity>();
    const regionMap = new Map<string, Region>();
    fallback.forEach((tender) => {
      entityMap.set(tender.governmentEntityId, { id: tender.governmentEntityId, name: tender.governmentEntityName, slug: tender.governmentEntitySlug });
      activityMap.set(tender.activityId, { id: tender.activityId, name: tender.activityName, sector: tender.sector, slug: tender.activityName.toLowerCase().replace(/\s+/g, "-") });
      regionMap.set(tender.regionId, { id: tender.regionId, name: tender.regionName, slug: tender.regionName.toLowerCase().replace(/\s+/g, "-") });
    });
    return {
      governmentEntities: [...entityMap.values()].sort((a, b) => a.name.localeCompare(b.name, "ar")),
      activities: [...activityMap.values()].sort((a, b) => a.name.localeCompare(b.name, "ar")),
      regions: [...regionMap.values()].sort((a, b) => a.name.localeCompare(b.name, "ar")),
      sectors: [...new Set(fallback.map((tender) => tender.sector))].sort((a, b) => a.localeCompare(b, "ar")),
    };
  }

  const supabase = supabaseAdmin();
  const [entityResult, activityResult, regionResult] = await Promise.all([
    supabase.from("government_entities").select("id,name,slug").order("name"),
    supabase.from("activities").select("id,name,sector,slug").order("name"),
    supabase.from("regions").select("id,name,slug").order("name"),
  ]);
  if (entityResult.error || activityResult.error || regionResult.error) throw entityResult.error ?? activityResult.error ?? regionResult.error;
  return {
    governmentEntities: entityResult.data ?? [],
    activities: activityResult.data ?? [],
    regions: regionResult.data ?? [],
    sectors: [...new Set((activityResult.data ?? []).map((item) => item.sector))],
  };
}

export async function getCompanyProfile(slug: string): Promise<CompanyProfile | null> {
  const fallback = await fallbackRowsIfNeeded();
  if (fallback) {
    const company = companies.find((item) => item.slug === slug);
    if (!company) return null;
    const linked = fallback.filter((tender) => tender.award?.companyId === company.id);
    const wins = linked.length;
    const losses = 0;
    const values = linked.map((tender) => tender.award?.amount ?? 0).filter(Boolean);
    return {
      company,
      appearances: wins + losses,
      wins,
      losses,
      winRate: wins + losses ? (wins / (wins + losses)) * 100 : 0,
      totalAwardValue: values.reduce((sum, value) => sum + value, 0),
      averageAwardValue: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0,
      largestAward: values.length ? Math.max(...values) : 0,
      smallestAward: values.length ? Math.min(...values) : 0,
      tenders: linked,
    };
  }

  const supabase = supabaseAdmin();
  const { data: company, error } = await supabase.from("companies").select("id,name,slug,commercial_registration").eq("slug", slug).maybeSingle();
  if (error) throw error;
  if (!company) return null;
  const [{ data: participations }, { data: wonRows }] = await Promise.all([
    supabase.from("company_participations").select("tender_id,result").eq("company_id", company.id),
    supabase.from("tender_search_view").select("*").eq("winner_company_id", company.id),
  ]);
  const wins = (participations ?? []).filter((item) => item.result === "won").length;
  const losses = (participations ?? []).filter((item) => item.result === "lost").length;
  const linked = (wonRows ?? []).map(mapViewRowToTender);
  const values = linked.map((tender) => tender.award?.amount ?? 0).filter(Boolean);
  return {
    company: { id: company.id, name: company.name, slug: company.slug, commercialRegistration: company.commercial_registration ?? undefined },
    appearances: (participations ?? []).length,
    wins,
    losses,
    winRate: wins + losses ? (wins / (wins + losses)) * 100 : 0,
    totalAwardValue: values.reduce((sum, value) => sum + value, 0),
    averageAwardValue: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0,
    largestAward: values.length ? Math.max(...values) : 0,
    smallestAward: values.length ? Math.min(...values) : 0,
    tenders: linked,
  };
}

export async function getAnalytics(): Promise<AnalyticsData> {
  const fallback = await fallbackRowsIfNeeded();
  if (fallback) {
    const rows = fallback;
    const byCompany = bucket(rows.filter((tender) => tender.award), (tender) => tender.award!.companyName, true);
    return {
      topCompaniesByWins: [...byCompany].sort((a, b) => b.count - a.count).slice(0, 10),
      topCompaniesByValue: [...byCompany].sort((a, b) => b.value - a.value).slice(0, 10),
      topEntitiesByTenders: bucket(rows, (tender) => tender.governmentEntityName).sort((a, b) => b.count - a.count).slice(0, 10),
      topEntitiesByAwardValue: bucket(rows, (tender) => tender.governmentEntityName, true).sort((a, b) => b.value - a.value).slice(0, 10),
      awardsByRegion: bucket(rows, (tender) => tender.regionName).sort((a, b) => b.count - a.count),
      awardsByActivity: bucket(rows, (tender) => tender.activityName).sort((a, b) => b.count - a.count),
      awardsByMonth: bucket(rows, (tender) => tender.award?.awardDate.slice(0, 7) ?? "", true).sort((a, b) => a.label.localeCompare(b.label)),
    };
  }

  const supabase = supabaseAdmin();
  const [companiesResult, entitiesTendersResult, entitiesAwardsResult, regionsResult, activitiesResult, monthsResult, opportunityRows] = await Promise.all([
    supabase.from("analytics_company_awards").select("label,count,value"),
    supabase.from("analytics_entity_tenders").select("label,count,value"),
    supabase.from("analytics_entity_awards").select("label,count,value"),
    supabase.from("analytics_region_awards").select("label,count,value"),
    supabase.from("analytics_activity_awards").select("label,count,value"),
    supabase.from("analytics_monthly_awards").select("label,count,value"),
    supabase.from("tender_search_view").select("region_name,activity_name"),
  ]);
  const firstError = [companiesResult, entitiesTendersResult, entitiesAwardsResult, regionsResult, activitiesResult, monthsResult, opportunityRows].find((result) => result.error)?.error;
  if (firstError) throw firstError;

  const mapBuckets = (data: Array<{ label: string; count: number | string; value: number | string }> | null): AnalyticsBucket[] =>
    (data ?? []).map((item) => ({ label: item.label, count: Number(item.count), value: Number(item.value) }));
  const companyBuckets = mapBuckets(companiesResult.data);
  const regionMap = new Map<string, AnalyticsBucket>();
  const activityMap = new Map<string, AnalyticsBucket>();
  (opportunityRows.data ?? []).forEach((row) => {
    const region = String(row.region_name ?? "غير محدد");
    const activity = String(row.activity_name ?? "غير محدد");
    const regionBucket = regionMap.get(region) ?? { label: region, count: 0, value: 0 };
    regionBucket.count += 1;
    regionMap.set(region, regionBucket);
    const activityBucket = activityMap.get(activity) ?? { label: activity, count: 0, value: 0 };
    activityBucket.count += 1;
    activityMap.set(activity, activityBucket);
  });

  return {
    topCompaniesByWins: [...companyBuckets].sort((a, b) => b.count - a.count).slice(0, 10),
    topCompaniesByValue: [...companyBuckets].sort((a, b) => b.value - a.value).slice(0, 10),
    topEntitiesByTenders: mapBuckets(entitiesTendersResult.data).sort((a, b) => b.count - a.count).slice(0, 10),
    topEntitiesByAwardValue: mapBuckets(entitiesAwardsResult.data).sort((a, b) => b.value - a.value).slice(0, 10),
    awardsByRegion: [...regionMap.values()].sort((a, b) => b.count - a.count),
    awardsByActivity: [...activityMap.values()].sort((a, b) => b.count - a.count),
    awardsByMonth: mapBuckets(monthsResult.data).sort((a, b) => a.label.localeCompare(b.label)),
  };
}
