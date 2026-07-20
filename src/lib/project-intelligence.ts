import { cache } from "react";
import { listTenders } from "@/lib/repository";
import { scoreOpportunity } from "@/lib/opportunity-fit";
import type { Tender } from "@/lib/types";

export type ProjectStage =
  | "planning"
  | "design"
  | "qualification"
  | "tendering"
  | "awarded"
  | "construction"
  | "operation"
  | "completed"
  | "on_hold"
  | "cancelled";

export interface ProjectSourceRef {
  label: string;
  url: string;
  externalId: string;
  lastUpdated: string;
}

export interface ProjectParty {
  role: "owner" | "contractor" | "supplier";
  name: string;
}

export interface ProjectIntelligenceRecord {
  id: string;
  name: string;
  ownerName: string;
  regionName: string;
  sector: string;
  activityName: string;
  stage: ProjectStage;
  stageLabel: string;
  estimatedValue: number | null;
  awardValue: number | null;
  firstSeen: string;
  latestUpdate: string;
  opportunityCount: number;
  sourceCount: number;
  sourceRefs: ProjectSourceRef[];
  parties: ProjectParty[];
  opportunities: Tender[];
  fitScore: number;
  fitLabel: string;
  confidence: number;
}

export interface MarketBucket {
  label: string;
  count: number;
  value: number;
}

export interface MarketIntelligenceSnapshot {
  totalProjects: number;
  knownProjectValue: number;
  openOpportunities: number;
  awardedOpportunities: number;
  pipelineProjects: number;
  newLast7Days: number;
  updatedLast30Days: number;
  stages: MarketBucket[];
  regions: MarketBucket[];
  sectors: MarketBucket[];
  topProjects: ProjectIntelligenceRecord[];
  bestFitProjects: ProjectIntelligenceRecord[];
  recentProjects: ProjectIntelligenceRecord[];
}

export interface ProjectFilters {
  q?: string;
  region?: string;
  sector?: string;
  stage?: ProjectStage | "";
  minValue?: number;
  maxValue?: number;
}

const STAGE_LABELS: Record<ProjectStage, string> = {
  planning: "تخطيط",
  design: "تصميم",
  qualification: "تأهيل",
  tendering: "طرح ومنافسة",
  awarded: "تمت الترسية",
  construction: "تحت التنفيذ",
  operation: "تشغيل وصيانة",
  completed: "مكتمل",
  on_hold: "معلّق",
  cancelled: "ملغى",
};

function stableHash(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[ـ]/g, "")
    .replace(/\b(منافسه|مناقصة|مناقصه|مشروع|اعمال|توريد|تنفيذ|خدمات|procurement|tender|project)\b/gi, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function projectKey(tender: Tender): string {
  const normalized = normalizeText(tender.name).split(" ").slice(0, 12).join(" ");
  const identity = `${tender.governmentEntityName}|${tender.regionName}|${normalized || tender.name}`;
  return `project-${stableHash(identity)}`;
}

function inferStage(tender: Tender): ProjectStage {
  const text = `${tender.name} ${tender.description} ${tender.activityName} ${tender.sector}`.toLowerCase();
  if (tender.status === "cancelled" || /ملغ|cancel/.test(text)) return "cancelled";
  if (/مكتمل|تم الانتهاء|completed|completion/.test(text)) return "completed";
  if (/معلق|متوقف|on hold|suspend/.test(text)) return "on_hold";
  if (/تشغيل وصيان|operation and maintenance|operate.*maintain|o&m/.test(text)) return "operation";
  if (/تحت التنفيذ|قيد التنفيذ|under construction|construction-ready|بدء التنفيذ/.test(text)) return "construction";
  if (tender.status === "awarded" || tender.award) return "awarded";
  if (/rfq|eoi|expression of interest|تأهيل|تاهيل|طلب ابداء الاهتمام|طلب التأهيل/.test(text)) return "qualification";
  if (tender.status === "open" || /rfp|طرح|منافس|tender|request for proposal/.test(text)) return "tendering";
  if (/تصميم|design|engineering design/.test(text)) return "design";
  return "planning";
}

function stageRank(stage: ProjectStage): number {
  return {
    planning: 1,
    design: 2,
    qualification: 3,
    tendering: 4,
    awarded: 5,
    construction: 6,
    operation: 7,
    completed: 8,
    on_hold: 0,
    cancelled: -1,
  }[stage];
}

function sourceLabel(tender: Tender): string {
  const url = tender.sourceUrl ?? "";
  if (url.includes("muqawil")) return "مقاول";
  if (url.includes("furas")) return "فرص";
  if (url.includes("pif.gov.sa")) return "صندوق الاستثمارات العامة";
  if (url.includes("ncp.gov.sa")) return "المركز الوطني للتخصيص";
  if (url.includes("swpc.sa")) return "الشركة السعودية لشراكات المياه";
  if (url.includes("etimad")) return "اعتماد";
  return tender.governmentEntityName || "مصدر عام";
}

function buildProjects(tenders: Tender[]): ProjectIntelligenceRecord[] {
  const groups = new Map<string, Tender[]>();
  for (const tender of tenders) {
    const key = projectKey(tender);
    groups.set(key, [...(groups.get(key) ?? []), tender]);
  }

  return [...groups.entries()].map(([id, opportunities]) => {
    const ordered = [...opportunities].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const lead = ordered[0];
    const stage = ordered.map(inferStage).sort((a, b) => stageRank(b) - stageRank(a))[0] ?? "planning";
    const sourceRefs = [...new Map(ordered.filter((item) => item.sourceUrl).map((item) => [item.sourceUrl!, {
      label: sourceLabel(item),
      url: item.sourceUrl!,
      externalId: item.sourceExternalId,
      lastUpdated: item.updatedAt,
    }])).values()];
    const parties: ProjectParty[] = [
      { role: "owner", name: lead.governmentEntityName },
      ...ordered.filter((item) => item.award?.companyName).map((item): ProjectParty => ({ role: "contractor", name: item.award!.companyName })),
    ];
    const uniqueParties = [...new Map(parties.map((party) => [`${party.role}:${party.name}`, party])).values()];
    const fitResults = ordered.map(scoreOpportunity).sort((a, b) => b.score - a.score);
    const bestFit = fitResults[0] ?? { score: 0, label: "ضعيفة" };
    const estimatedValues = ordered.map((item) => item.estimatedValue).filter((value): value is number => value != null && value > 0);
    const awardValues = ordered.map((item) => item.award?.amount).filter((value): value is number => value != null && value > 0);
    const firstSeen = ordered.map((item) => item.publicationDate).filter(Boolean).sort()[0] ?? lead.publicationDate;
    const confidence = Math.min(100, 45 + Math.min(25, sourceRefs.length * 12) + Math.min(20, ordered.length * 5) + (lead.estimatedValue ? 10 : 0));

    return {
      id,
      name: lead.name,
      ownerName: lead.governmentEntityName,
      regionName: lead.regionName,
      sector: lead.sector,
      activityName: lead.activityName,
      stage,
      stageLabel: STAGE_LABELS[stage],
      estimatedValue: estimatedValues.length ? Math.max(...estimatedValues) : null,
      awardValue: awardValues.length ? Math.max(...awardValues) : null,
      firstSeen,
      latestUpdate: ordered.map((item) => item.updatedAt).sort().at(-1) ?? lead.updatedAt,
      opportunityCount: ordered.length,
      sourceCount: sourceRefs.length || 1,
      sourceRefs,
      parties: uniqueParties,
      opportunities: ordered,
      fitScore: bestFit.score,
      fitLabel: bestFit.label,
      confidence,
    };
  }).sort((a, b) => b.latestUpdate.localeCompare(a.latestUpdate));
}

const loadTendersForIntelligence = cache(async (): Promise<Tender[]> => {
  const all: Tender[] = [];
  const pageSize = 1000;
  for (let page = 1; page <= 5; page += 1) {
    const result = await listTenders({ page, pageSize, sort: "publicationDate", order: "desc" });
    all.push(...result.items);
    if (page >= result.totalPages || result.items.length < pageSize) break;
  }
  return [...new Map(all.map((item) => [item.sourceExternalId, item])).values()];
});

export const getProjectIntelligence = cache(async (): Promise<ProjectIntelligenceRecord[]> => {
  return buildProjects(await loadTendersForIntelligence());
});

export async function getProjectById(id: string): Promise<ProjectIntelligenceRecord | null> {
  return (await getProjectIntelligence()).find((project) => project.id === id) ?? null;
}

export function filterProjects(projects: ProjectIntelligenceRecord[], filters: ProjectFilters): ProjectIntelligenceRecord[] {
  const query = normalizeText(filters.q ?? "");
  return projects.filter((project) => {
    const value = project.estimatedValue ?? project.awardValue ?? 0;
    if (query && !normalizeText(`${project.name} ${project.ownerName} ${project.regionName} ${project.sector} ${project.activityName}`).includes(query)) return false;
    if (filters.region && project.regionName !== filters.region) return false;
    if (filters.sector && project.sector !== filters.sector) return false;
    if (filters.stage && project.stage !== filters.stage) return false;
    if (filters.minValue != null && value < filters.minValue) return false;
    if (filters.maxValue != null && value > filters.maxValue) return false;
    return true;
  });
}

function bucketProjects(projects: ProjectIntelligenceRecord[], key: (project: ProjectIntelligenceRecord) => string): MarketBucket[] {
  const map = new Map<string, MarketBucket>();
  for (const project of projects) {
    const label = key(project) || "غير محدد";
    const current = map.get(label) ?? { label, count: 0, value: 0 };
    current.count += 1;
    current.value += project.estimatedValue ?? project.awardValue ?? 0;
    map.set(label, current);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

export const getMarketIntelligence = cache(async (): Promise<MarketIntelligenceSnapshot> => {
  const projects = await getProjectIntelligence();
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 86_400_000;
  const thirtyDaysAgo = now - 30 * 86_400_000;
  const openOpportunities = projects.flatMap((project) => project.opportunities).filter((item) => item.status === "open").length;
  const awardedOpportunities = projects.flatMap((project) => project.opportunities).filter((item) => item.status === "awarded").length;
  const pipelineStages = new Set<ProjectStage>(["planning", "design", "qualification", "tendering"]);

  return {
    totalProjects: projects.length,
    knownProjectValue: projects.reduce((sum, project) => sum + (project.estimatedValue ?? project.awardValue ?? 0), 0),
    openOpportunities,
    awardedOpportunities,
    pipelineProjects: projects.filter((project) => pipelineStages.has(project.stage)).length,
    newLast7Days: projects.filter((project) => new Date(project.firstSeen).getTime() >= sevenDaysAgo).length,
    updatedLast30Days: projects.filter((project) => new Date(project.latestUpdate).getTime() >= thirtyDaysAgo).length,
    stages: bucketProjects(projects, (project) => project.stageLabel),
    regions: bucketProjects(projects, (project) => project.regionName),
    sectors: bucketProjects(projects, (project) => project.sector),
    topProjects: [...projects].sort((a, b) => (b.estimatedValue ?? b.awardValue ?? 0) - (a.estimatedValue ?? a.awardValue ?? 0)).slice(0, 8),
    bestFitProjects: [...projects].sort((a, b) => b.fitScore - a.fitScore).slice(0, 8),
    recentProjects: projects.slice(0, 8),
  };
});

export function projectStageLabels(): Array<[ProjectStage, string]> {
  return Object.entries(STAGE_LABELS) as Array<[ProjectStage, string]>;
}
