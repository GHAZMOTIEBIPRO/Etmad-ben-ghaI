import type { DataSourceConnector } from "@/lib/data-sources/types";
import type { Tender } from "@/lib/types";

const BASE_URL = "https://furas.momah.gov.sa";
const LIST_URL = `${BASE_URL}/en/opportunities-listing/Investment`;

function stableHash(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function clean(value: string): string {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDate(value: string): string {
  const match = value.match(/(\d{1,2})\/(\d{1,2})\/(20\d{2})/);
  if (!match) return "";
  return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

function regionFromText(text: string): string {
  const rules: Array<[RegExp, string]> = [
    [/الرياض|Riyadh/i, "الرياض"],
    [/المدينة|Madinah|Medina/i, "المدينة المنورة"],
    [/مكة|جدة|الطائف|Makkah|Mecca|Jeddah|Taif/i, "مكة المكرمة"],
    [/عسير|أبها|خميس مشيط|Asir|Abha/i, "عسير"],
    [/تبوك|Tabuk/i, "تبوك"],
    [/القصيم|بريدة|البدائع|Qassim/i, "القصيم"],
    [/الجوف|سكاكا|Jouf|Sakaka/i, "الجوف"],
    [/الشرقية|الدمام|الخبر|الأحساء|Eastern|Dammam|Khobar/i, "المنطقة الشرقية"],
    [/الباحة|Baha/i, "الباحة"],
    [/جازان|Jazan/i, "جازان"],
    [/نجران|Najran/i, "نجران"],
    [/حائل|Hail/i, "حائل"],
    [/الحدود الشمالية|عرعر|Northern Borders|Arar/i, "الحدود الشمالية"],
  ];
  return rules.find(([pattern]) => pattern.test(text))?.[1] ?? "المملكة العربية السعودية";
}

function activityFromText(text: string): string {
  if (/تشغيل.*صيانة|operation.*maintenance/i.test(text)) return "تشغيل وصيانة";
  if (/مطعم|مقهى|غذاء|restaurant|cafe|food/i.test(text)) return "ضيافة وأغذية";
  if (/فندق|سياحي|hotel|tourism/i.test(text)) return "سياحة وضيافة";
  if (/تجاري.*سكني|mixed.use|متعدد الاستخدامات/i.test(text)) return "تطوير متعدد الاستخدامات";
  if (/تجاري|commercial/i.test(text)) return "تطوير تجاري";
  if (/مواقف|parking/i.test(text)) return "مواقف وبنية حضرية";
  if (/مياه|water/i.test(text)) return "مياه وبنية تحتية";
  if (/مصنع|factory|plant/i.test(text)) return "صناعة وتطوير منشآت";
  if (/حديقة|متنزه|park|landscape/i.test(text)) return "حدائق وتنسيق مواقع";
  return "استثمار وتطوير وتشغيل";
}

function extractCards(html: string): Tender[] {
  const text = clean(html);
  const referencePattern = /\b\d{2}-\d{2,}-\d{4,}(?:-\d+)?\b/g;
  const refs = [...text.matchAll(referencePattern)];
  const rows: Tender[] = [];

  for (let index = 0; index < refs.length; index += 1) {
    const ref = refs[index];
    const start = Math.max(0, (refs[index - 1]?.index ?? 0) + (refs[index - 1]?.[0]?.length ?? 0));
    const end = Math.min(text.length, refs[index + 1]?.index ?? text.length);
    const block = text.slice(start, end).trim();
    const competitionNumber = ref[0];
    const refOffset = block.indexOf(competitionNumber);
    const beforeRef = refOffset >= 0 ? block.slice(0, refOffset).trim() : block;
    const afterRef = refOffset >= 0 ? block.slice(refOffset + competitionNumber.length).trim() : "";

    const titleCandidate = beforeRef
      .replace(/^.*?(وزارة|أمانة|هيئة|المركز|General Authority|Ministry)\s+/i, "")
      .trim();
    const title = titleCandidate.length > 12 ? titleCandidate.slice(-320) : `فرصة استثمارية ${competitionNumber}`;
    const context = `${beforeRef} ${afterRef}`.trim();
    const deadline = parseDate(context.match(/(?:اخر موعد لتقديم العطاء|آخر موعد لتقديم العطاء|deadline)[^\d]*(\d{1,2}\/\d{1,2}\/20\d{2})/i)?.[1] ?? "");
    const priceMatch = context.match(/price\s*([\d,.]+)\s*SAR/i) ?? context.match(/(?:سعر|price)[^\d]*([\d,.]+)/i);
    const brochurePrice = priceMatch ? Number(priceMatch[1].replace(/,/g, "")) : null;
    const regionName = regionFromText(context);
    const activityName = activityFromText(context);
    const externalId = `furas:${competitionNumber}`;

    rows.push({
      id: `furas-${stableHash(externalId)}`,
      competitionNumber,
      name: title,
      description: context.slice(0, 900),
      governmentEntityId: `entity-furas-${stableHash(beforeRef.slice(0, 120) || "furas")}`,
      governmentEntityName: beforeRef.slice(0, 140) || "فرص — البوابة الموحدة للاستثمار في المدن السعودية",
      governmentEntitySlug: `furas-${stableHash(beforeRef.slice(0, 120) || "furas")}`,
      activityId: `activity-${stableHash(activityName)}`,
      activityName,
      sector: "فرص استثمارية بلدية وحكومية",
      regionId: `region-${stableHash(regionName)}`,
      regionName,
      publicationDate: new Date().toISOString().slice(0, 10),
      submissionDeadline: deadline,
      bidOpeningDate: "",
      brochurePrice: Number.isFinite(brochurePrice) ? brochurePrice : null,
      estimatedValue: null,
      status: deadline && deadline < new Date().toISOString().slice(0, 10) ? "closed" : "open",
      awarded: false,
      award: null,
      sourceUrl: `${LIST_URL}?keys=${encodeURIComponent(competitionNumber)}`,
      sourceExternalId: externalId,
      updatedAt: new Date().toISOString(),
    });
  }

  return [...new Map(rows.map((row) => [row.sourceExternalId, row])).values()].slice(0, 100);
}

export class FurasInvestmentConnector implements DataSourceConnector {
  readonly key = "furas-investment";
  readonly name = "فرص — المنافسات والفرص الاستثمارية";
  readonly isLive = true;

  async fetchTenders(): Promise<Tender[]> {
    const response = await fetch(LIST_URL, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "ConstructionRadar/1.0 (+public-data-indexer)",
      },
      next: { revalidate: 1800 },
    });
    if (!response.ok) throw new Error(`Furas public opportunities request failed (${response.status})`);
    return extractCards(await response.text());
  }
}
