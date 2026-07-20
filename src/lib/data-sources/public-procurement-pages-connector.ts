import type { DataSourceConnector } from "@/lib/data-sources/types";
import type { Tender } from "@/lib/types";

type SourceConfig = {
  key: string;
  name: string;
  url: string;
  entityName: string;
  entitySlug: string;
  defaultRegion: string;
  sector: string;
  minYear?: number;
};

const SOURCE_CONFIGS: SourceConfig[] = [
  {
    key: "balady-procurement",
    name: "بلدي — المنافسات والمشتريات العامة",
    url: "https://www.balady.gov.sa/ar/node/10981",
    entityName: "وزارة البلديات والإسكان",
    entitySlug: "momah-balady-procurement",
    defaultRegion: "المملكة العربية السعودية",
    sector: "منافسات ومشتريات حكومية",
    minYear: 2025,
  },
  {
    key: "saso-procurement-2026",
    name: "هيئة المواصفات — خطة الأعمال والمشتريات 2026",
    url: "https://www.saso.gov.sa/ar/about/Pages/Competitions.aspx",
    entityName: "الهيئة السعودية للمواصفات والمقاييس والجودة",
    entitySlug: "saso-procurement",
    defaultRegion: "الرياض",
    sector: "خطط مشتريات حكومية مستقبلية",
    minYear: 2026,
  },
  {
    key: "moh-procurement-plan",
    name: "وزارة الصحة — المنافسات والمشتريات المخطط لها",
    url: "https://www.moh.gov.sa/ministry/about/pages/tenders-and-procurement.aspx",
    entityName: "وزارة الصحة",
    entitySlug: "moh-procurement",
    defaultRegion: "المملكة العربية السعودية",
    sector: "خطط مشتريات حكومية مستقبلية",
    minYear: 2025,
  },
  {
    key: "zatca-procurement-2026",
    name: "هيئة الزكاة والضريبة والجمارك — خطة المشتريات 2026",
    url: "https://zatca.gov.sa/ar/MediaCenter/Elan/Pages/Procurement-and-Tenders-for-the-Fiscal-Year-2026.aspx",
    entityName: "هيئة الزكاة والضريبة والجمارك",
    entitySlug: "zatca-procurement",
    defaultRegion: "المملكة العربية السعودية",
    sector: "خطط مشتريات حكومية مستقبلية",
    minYear: 2026,
  },
  {
    key: "rega-procurement-2026",
    name: "الهيئة العامة للعقار — مشاريع ومشتريات 2026",
    url: "https://rega.gov.sa/ar/الهيئة/المنافسات-والمشتريات/",
    entityName: "الهيئة العامة للعقار",
    entitySlug: "rega-procurement",
    defaultRegion: "الرياض",
    sector: "منافسات وخطط مشتريات حكومية",
    minYear: 2026,
  },
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
    .replace(/&gt;/gi, ">");
}

function textFromHtml(value: string): string {
  return decodeHtml(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function parseDate(value: string): string {
  const iso = value.match(/\b(20\d{2})[-\/]([01]?\d)[-\/]([0-3]?\d)\b/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const dayFirst = value.match(/\b([0-3]?\d)[-\/]([01]?\d)[-\/](20\d{2})\b/);
  if (dayFirst) return `${dayFirst[3]}-${dayFirst[2].padStart(2, "0")}-${dayFirst[1].padStart(2, "0")}`;
  return "";
}

function extractYears(value: string): number[] {
  return [...value.matchAll(/\b(20\d{2})\b/g)].map((match) => Number(match[1]));
}

function regionFromText(text: string, fallback: string): string {
  const rules: Array<[RegExp, string]> = [
    [/الرياض|riyadh/i, "الرياض"],
    [/مكه|جده|الطائف|makkah|mecca|jeddah|taif/i, "مكة المكرمة"],
    [/المدينه|madinah|medina/i, "المدينة المنورة"],
    [/الشرقيه|الدمام|الخبر|الاحساء|eastern|dammam|khobar/i, "المنطقة الشرقية"],
    [/عسير|ابها|خميس مشيط|asir|abha/i, "عسير"],
    [/تبوك|tabuk/i, "تبوك"],
    [/القصيم|بريده|qassim|buraydah/i, "القصيم"],
    [/جازان|jazan/i, "جازان"],
    [/نجران|najran/i, "نجران"],
    [/حائل|hail/i, "حائل"],
    [/الباحه|baha/i, "الباحة"],
    [/الجوف|سكاكا|jouf|sakaka/i, "الجوف"],
    [/الحدود الشماليه|عرعر|northern borders|arar/i, "الحدود الشمالية"],
  ];
  return rules.find(([pattern]) => pattern.test(text))?.[1] ?? fallback;
}

function activityFromText(text: string): string {
  if (/تشغيل.*صيان|صيان.*تشغيل|operation.*maintenance|facility management/i.test(text)) return "تشغيل وصيانة";
  if (/انشا|بناء|تشييد|construction|building/i.test(text)) return "إنشاءات ومبانٍ";
  if (/ترميم|تاهيل|اعاده تاهيل|renovation|rehabilitation/i.test(text)) return "ترميم وتأهيل";
  if (/طرق|جسور|انفاق|بنيه تحتيه|road|bridge|tunnel|infrastructure/i.test(text)) return "طرق وبنية تحتية";
  if (/كهرب|شبكات|محولات|كابلات|electrical|power network/i.test(text)) return "أعمال كهربائية وشبكات";
  if (/مياه|صرف|تصريف|water|sewage|drainage/i.test(text)) return "مياه وتصريف وبنية تحتية";
  if (/تصميم|اشراف|هندس|engineering|design|supervision/i.test(text)) return "خدمات هندسية";
  if (/تقنيه|نظام|منصه|software|technology|cyber/i.test(text)) return "تقنية وأنظمة";
  if (/توريد|supply|procurement/i.test(text)) return "توريد";
  if (/استشار|consult/i.test(text)) return "خدمات استشارية";
  if (/ضيافه|لوجست|hospitality|logistics/i.test(text)) return "خدمات عامة ولوجستية";
  return "مشتريات وخدمات حكومية";
}

function statusFromText(text: string): Tender["status"] {
  if (/ملغ|cancel/i.test(text)) return "cancelled";
  if (/تمت الترس|مرساه|awarded/i.test(text)) return "awarded";
  if (/منتهي|مغلق|closed/i.test(text)) return "closed";
  return "open";
}

function parseTables(html: string, config: SourceConfig): Tender[] {
  const tables = [...html.matchAll(/<table\b[\s\S]*?<\/table>/gi)];
  const rows: Tender[] = [];
  const discoveredAt = new Date().toISOString();
  const today = discoveredAt.slice(0, 10);

  for (const tableMatch of tables) {
    const table = tableMatch[0];
    const rawRows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
    let headers: string[] = [];

    for (const rawRow of rawRows) {
      const cells = [...rawRow[1].matchAll(/<(th|td)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((cell) => textFromHtml(cell[2]));
      if (!cells.length) continue;

      const hasHeaderCell = /<th\b/i.test(rawRow[1]);
      if (hasHeaderCell || (!headers.length && cells.some((cell) => /اسم|عنوان|مشروع|منافس|project/i.test(cell)))) {
        headers = cells.map(normalize);
        continue;
      }

      const rowText = cells.join(" | ").trim();
      if (rowText.length < 8) continue;

      const years = extractYears(rowText);
      if (config.minYear && years.length && Math.max(...years) < config.minYear) continue;

      const titleIndex = headers.findIndex((header) => /اسم.*(مشروع|منافس)|عنوان.*منافس|project|competition|tender/.test(header));
      const candidateCells = cells.filter((cell) => cell.length >= 6 && !/^\d+$/.test(cell));
      const title = (titleIndex >= 0 ? cells[titleIndex] : candidateCells.sort((a, b) => b.length - a.length)[0] ?? "").trim();
      if (!title || /اسم المشروع|اسم المنافسه|عنوان المنافسه|project name/i.test(title)) continue;

      const competitionNumber = rowText.match(/\b\d{10,15}\b/)?.[0] ?? `${config.key.toUpperCase()}-${stableHash(title)}`;
      const dates = [...rowText.matchAll(/\b(?:20\d{2}[-\/]\d{1,2}[-\/]\d{1,2}|\d{1,2}[-\/]\d{1,2}[-\/]20\d{2})\b/g)]
        .map((match) => parseDate(match[0]))
        .filter(Boolean);
      const deadline = dates.at(-1) ?? "";
      const regionName = regionFromText(rowText, config.defaultRegion);
      const activityName = activityFromText(rowText);
      const sourceExternalId = `${config.key}:${competitionNumber}:${stableHash(title)}`;
      const status = deadline && deadline < today ? "closed" : statusFromText(rowText);

      rows.push({
        id: `${config.key}-${stableHash(sourceExternalId)}`,
        competitionNumber,
        name: title.slice(0, 500),
        description: `سجل مجاني مستخرج من صفحة عامة للجهة. تاريخ اكتشاف الرادار: ${today}. ${rowText}`.slice(0, 1800),
        governmentEntityId: `entity-${stableHash(config.entitySlug)}`,
        governmentEntityName: config.entityName,
        governmentEntitySlug: config.entitySlug,
        activityId: `activity-${stableHash(activityName)}`,
        activityName,
        sector: config.sector,
        regionId: `region-${stableHash(regionName)}`,
        regionName,
        publicationDate: dates[0] ?? today,
        submissionDeadline: deadline,
        bidOpeningDate: "",
        brochurePrice: null,
        estimatedValue: null,
        status,
        awarded: status === "awarded",
        award: null,
        sourceUrl: config.url,
        sourceExternalId,
        updatedAt: discoveredAt,
      });
    }
  }

  return [...new Map(rows.map((row) => [row.sourceExternalId, row])).values()].slice(0, 1000);
}

export class PublicProcurementPagesConnector implements DataSourceConnector {
  readonly key = "public-procurement-pages";
  readonly name = "صفحات المنافسات والمشتريات الحكومية المجانية";
  readonly isLive = true;

  async fetchTenders(since?: string): Promise<Tender[]> {
    const batches = await Promise.allSettled(
      SOURCE_CONFIGS.map(async (config) => {
        const response = await fetch(config.url, {
          headers: {
            Accept: "text/html,application/xhtml+xml",
            "User-Agent": "ConstructionRadar/1.0 (+public-data-indexer)",
          },
          next: { revalidate: 3600 },
        });
        if (!response.ok) throw new Error(`${config.key} public procurement request failed (${response.status})`);
        return parseTables(await response.text(), config);
      }),
    );

    const rows = batches.flatMap((batch) => batch.status === "fulfilled" ? batch.value : []);
    const deduped = [...new Map(rows.map((row) => [row.sourceExternalId, row])).values()];
    return since ? deduped.filter((row) => row.updatedAt >= since) : deduped;
  }
}
