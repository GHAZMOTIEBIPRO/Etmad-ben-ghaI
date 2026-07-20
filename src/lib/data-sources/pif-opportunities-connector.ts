import type { DataSourceConnector } from "@/lib/data-sources/types";
import { fetchWithPolicy } from "@/lib/http/fetch-with-policy";
import type { Tender } from "@/lib/types";

const BASE_URL = "https://www.pif.gov.sa";
const PAGES = [
  { url: `${BASE_URL}/en/private-sector-hub/explore-opportunities/urban-development-and-livability/`, label: "التطوير العمراني والتنمية الحضرية" },
  { url: `${BASE_URL}/en/private-sector-hub/explore-opportunities/tourism-travel-and-entertainment/`, label: "السياحة والسفر والترفيه" },
  { url: `${BASE_URL}/en/private-sector-hub/explore-opportunities/industrials-and-logistics/`, label: "الصناعة والخدمات اللوجستية" },
  { url: `${BASE_URL}/en/private-sector-hub/explore-opportunities/clean-energy-water-and-renewables-infrastructure/`, label: "الطاقة والمياه والبنية التحتية" },
];

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
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)));
}

function textFromHtml(value: string): string {
  return decodeHtml(value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " "))
    .replace(/[\t\r]+/g, " ")
    .replace(/ +/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function isConstructionRelevant(text: string): boolean {
  return /(development|infrastructure|hotel|hospitality|residential|stadium|opera|park|utilities|water|waste|maintenance|construction|facility|warehouse|building|mixed[- ]use|tourism|landscap|road|rail|airport|إنشاء|تطوير|بنية|فندق|ضيافة|سكن|ملعب|حديقة|مياه|صيانة|مستودع|مطار|طرق)/i.test(text);
}

function regionFromText(text: string): string {
  const rules: Array<[RegExp, string]> = [
    [/Riyadh|الرياض/i, "الرياض"],
    [/Jeddah|جدة|Makkah|Mecca|مكة/i, "مكة المكرمة"],
    [/Madinah|Medina|المدينة|AlUla|Al-Ula|العلا/i, "المدينة المنورة"],
    [/Soudah|Aseer|Asir|السودة|عسير/i, "عسير"],
    [/Hail|حائل/i, "حائل"],
    [/Eastern|Dammam|الشرقية|الدمام/i, "المنطقة الشرقية"],
    [/Red Sea|البحر الأحمر/i, "الساحل الغربي"],
  ];
  return rules.find(([pattern]) => pattern.test(text))?.[1] ?? "المملكة العربية السعودية";
}

function activityFromText(text: string): string {
  if (/hotel|hospitality|resort|ضيافة|فندق|منتجع/i.test(text)) return "ضيافة وفنادق وتطوير سياحي";
  if (/stadium|opera|entertainment|ملعب|أوبرا|ترفيه/i.test(text)) return "مرافق ترفيهية وثقافية";
  if (/water|utilities|waste|مياه|مرافق|نفايات/i.test(text)) return "مياه ومرافق وبنية تحتية";
  if (/rail|airport|road|سكك|مطار|طرق/i.test(text)) return "نقل وبنية تحتية";
  if (/maintenance|صيانة/i.test(text)) return "تشغيل وصيانة";
  if (/residential|mixed[- ]use|urban|سكن|متعدد الاستخدام|حضري/i.test(text)) return "تطوير عقاري وعمراني";
  return "مشاريع وتطوير وبنية تحتية";
}

function extractEstimatedValue(text: string): number | null {
  const match = text.match(/Indicative investment size\s*(?:SAR)?\s*([0-9,.]+)\s*(Billion|Million|B|M)?/i);
  if (!match) return null;
  const raw = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(raw)) return null;
  const unit = (match[2] ?? "").toLowerCase();
  if (unit === "billion" || unit === "b") return raw * 1_000_000_000;
  if (unit === "million" || unit === "m") return raw * 1_000_000;
  return raw;
}

function parsePage(html: string, pageUrl: string, ecosystem: string): Tender[] {
  const headings = [...html.matchAll(/<h([23])\b[^>]*>([\s\S]*?)<\/h\1>/gi)]
    .map((match) => ({ title: textFromHtml(match[2] ?? ""), index: match.index ?? 0 }))
    .filter((item) => item.title.length >= 8);
  const records = new Map<string, Tender>();

  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    if (/List of Opportunities|Indicative investment size|Indicative addressable demand|Portfolio Company|Description of Investment Opportunity|Opportunity Rationale/i.test(heading.title)) continue;
    const end = headings[index + 1]?.index ?? html.length;
    const block = textFromHtml(html.slice(heading.index, end));
    if (!/Description of Investment Opportunity|Opportunity Rationale|Indicative investment size|Register your interest/i.test(block)) continue;
    if (!isConstructionRelevant(`${heading.title} ${block}`)) continue;

    const externalId = `pif-opportunity:${stableHash(`${pageUrl}|${heading.title}`)}`;
    const regionName = regionFromText(`${heading.title} ${block}`);
    const activityName = activityFromText(`${heading.title} ${block}`);
    const estimatedValue = extractEstimatedValue(block);
    const today = new Date().toISOString().slice(0, 10);

    records.set(externalId, {
      id: `pif-${stableHash(externalId)}`,
      competitionNumber: `PIF-${stableHash(heading.title).toUpperCase()}`,
      name: heading.title,
      description: `${ecosystem} | ${block.slice(0, 900)}`,
      governmentEntityId: "entity-pif-private-sector-hub",
      governmentEntityName: "صندوق الاستثمارات العامة — منصة القطاع الخاص",
      governmentEntitySlug: "pif-private-sector-hub",
      activityId: `activity-${stableHash(activityName)}`,
      activityName,
      sector: "فرص مشاريع وسلاسل قيمة — PIF",
      regionId: `region-${stableHash(regionName)}`,
      regionName,
      publicationDate: today,
      submissionDeadline: "",
      bidOpeningDate: "",
      brochurePrice: null,
      estimatedValue,
      status: "open",
      awarded: false,
      award: null,
      sourceUrl: pageUrl,
      sourceExternalId: externalId,
      updatedAt: new Date().toISOString(),
    });
  }

  return [...records.values()];
}

export class PifOpportunitiesConnector implements DataSourceConnector {
  readonly key = "pif-opportunities";
  readonly name = "PIF — فرص المشاريع وسلاسل القيمة";
  readonly isLive = true;
  readonly parserVersion = "2.0.0";

  async fetchTenders(since?: string): Promise<Tender[]> {
    const records = new Map<string, Tender>();
    for (const page of PAGES) {
      try {
        const fetched = await fetchWithPolicy(page.url, {
          headers: { Accept: "text/html,application/xhtml+xml" },
          retries: 3,
          minIntervalMs: 900,
          timeoutMs: 25_000,
        });
        for (const tender of parsePage(fetched.text(), page.url, page.label)) {
          if (since && tender.publicationDate < since.slice(0, 10)) continue;
          records.set(tender.sourceExternalId, tender);
        }
      } catch (error) {
        console.error(`PIF page sync failed for ${page.url}`, error);
      }
    }
    return [...records.values()].slice(0, 250);
  }
}
