import type { DataSourceConnector } from "@/lib/data-sources/types";
import type { Tender } from "@/lib/types";

const SOURCE_URL = "https://www.swpc.sa/en/developer-qualification-initiative/";
const FALLBACK_URL = "https://old.swpc.sa/en/pre-qualification-program-for-swpc-projects/";

function stableHash(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function textFromHtml(value: string): string {
  return decodeHtml(value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

type FutureProject = { name: string; type: string; capacity?: string; expectedLaunch?: string };

function parseProjects(html: string): FutureProject[] {
  const projects = new Map<string, FutureProject>();
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];

  for (const row of rows) {
    const cells = [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => textFromHtml(cell[1]));
    if (cells.length < 2) continue;
    const [name, type, capacity, expectedLaunch] = cells;
    if (!name || !/^(IWP|ISTP|IWTP|ISWR|STP|Reservoir|Transmission)/i.test(type ?? "")) continue;
    projects.set(`${name}|${type}`, { name, type, capacity, expectedLaunch });
  }

  if (!projects.size) {
    const text = textFromHtml(html);
    const knownTypes = "IWP|ISTP|IWTP|ISWR";
    const pattern = new RegExp(`([A-Za-z0-9][A-Za-z0-9 \\-–]+?)\\s+(${knownTypes})\\b`, "g");
    for (const match of text.matchAll(pattern)) {
      const name = match[1].trim().replace(/^(Project Name|List of Projects)\s+/i, "");
      const type = match[2];
      if (name.length < 3 || name.length > 80) continue;
      projects.set(`${name}|${type}`, { name, type });
    }
  }

  return [...projects.values()].slice(0, 80);
}

function regionFromProject(name: string): string {
  const rules: Array<[RegExp, string]> = [
    [/Ras Al Khair|Hafar|Eastern|Jubail/i, "المنطقة الشرقية"],
    [/Tabuk|Alula/i, "تبوك"],
    [/Shuqaiq|Jazan|Abu Arish/i, "جازان"],
    [/Riyadh|Al Kharj/i, "الرياض"],
    [/Hadda|Aranah|Jeddah|Makkah/i, "مكة المكرمة"],
    [/Najran/i, "نجران"],
  ];
  return rules.find(([pattern]) => pattern.test(name))?.[1] ?? "المملكة العربية السعودية";
}

function activityName(type: string): string {
  if (/IWP/i.test(type)) return "محطات إنتاج وتحلية المياه المستقلة";
  if (/ISTP|STP/i.test(type)) return "محطات معالجة مياه الصرف المستقلة";
  if (/IWTP|Transmission/i.test(type)) return "خطوط ونقل المياه";
  if (/ISWR|Reservoir/i.test(type)) return "الخزن الاستراتيجي للمياه";
  return "مشاريع بنية تحتية للمياه";
}

function mapProject(project: FutureProject): Tender {
  const regionName = regionFromProject(project.name);
  const activity = activityName(project.type);
  const externalId = `swpc-future:${stableHash(`${project.name}|${project.type}`)}`;
  const details = [
    `نوع المشروع: ${project.type}`,
    project.capacity ? `السعة: ${project.capacity}` : "",
    project.expectedLaunch ? `موعد الإطلاق المتوقع: ${project.expectedLaunch}` : "",
    "المصدر: برنامج التأهيل والمشاريع المستقبلية للشركة السعودية لشراكات المياه",
  ].filter(Boolean).join(" | ");

  return {
    id: `swpc-${stableHash(externalId)}`,
    competitionNumber: `SWPC-${stableHash(project.name).toUpperCase()}`,
    name: `${project.name} — ${project.type}`,
    description: details,
    governmentEntityId: "entity-swpc",
    governmentEntityName: "الشركة السعودية لشراكات المياه",
    governmentEntitySlug: "swpc",
    activityId: `activity-${stableHash(activity)}`,
    activityName: activity,
    sector: "مياه وبنية تحتية — PPP",
    regionId: `region-${stableHash(regionName)}`,
    regionName,
    publicationDate: "2024-05-29",
    submissionDeadline: "",
    bidOpeningDate: "",
    brochurePrice: null,
    estimatedValue: null,
    status: "open",
    awarded: false,
    award: null,
    sourceUrl: SOURCE_URL,
    sourceExternalId: externalId,
    updatedAt: new Date().toISOString(),
  };
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": "ConstructionRadar/1.0 (+public-data-indexer)" },
    next: { revalidate: 3600 },
  });
  if (!response.ok) throw new Error(`SWPC public projects request failed (${response.status})`);
  return response.text();
}

export class SwpcFutureProjectsConnector implements DataSourceConnector {
  readonly key = "swpc-future-projects";
  readonly name = "الشركة السعودية لشراكات المياه — المشاريع المستقبلية";
  readonly isLive = true;

  async fetchTenders(since?: string): Promise<Tender[]> {
    let projects: FutureProject[] = [];
    try {
      projects = parseProjects(await fetchHtml(SOURCE_URL));
    } catch {
      projects = parseProjects(await fetchHtml(FALLBACK_URL));
    }
    const rows = projects.map(mapProject);
    return since ? rows.filter((row) => row.updatedAt >= since) : rows;
  }
}
