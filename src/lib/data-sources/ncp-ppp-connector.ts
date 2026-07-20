import type { DataSourceConnector } from "@/lib/data-sources/types";
import type { Tender } from "@/lib/types";

const BASE_URL = "https://www.ncp.gov.sa";
const HOME_URL = `${BASE_URL}/`;

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
  return decodeHtml(value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteUrl(href: string): string {
  if (/^https?:\/\//i.test(href)) return href;
  return `${BASE_URL}${href.startsWith("/") ? "" : "/"}${href}`;
}

function parseDate(text: string): string {
  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1];
  if (iso) return iso;
  const english = text.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(20\d{2})\b/i);
  if (english) {
    const parsed = new Date(`${english[1]} ${english[2]}, ${english[3]} UTC`);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  const dayFirst = text.match(/\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/i);
  if (dayFirst) {
    const parsed = new Date(`${dayFirst[2]} ${dayFirst[1]}, ${dayFirst[3]} UTC`);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

function regionFromTitle(title: string): string {
  const rules: Array<[RegExp, string]> = [
    [/Riyadh|الرياض/i, "الرياض"],
    [/Makkah|Mecca|مكة/i, "مكة المكرمة"],
    [/Madinah|Medina|المدينة/i, "المدينة المنورة"],
    [/Jeddah|جدة/i, "مكة المكرمة"],
    [/Taif|الطائف/i, "مكة المكرمة"],
    [/Eastern|Dammam|الشرقية|الدمام/i, "المنطقة الشرقية"],
  ];
  return rules.find(([pattern]) => pattern.test(title))?.[1] ?? "المملكة العربية السعودية";
}

function activityFromTitle(title: string): string {
  if (/park|حدائق|landscap/i.test(title)) return "تشغيل وصيانة وتطوير الحدائق";
  if (/airport|مطار/i.test(title)) return "مطارات وبنية تحتية للنقل";
  if (/waste|نفايات/i.test(title)) return "إدارة النفايات والبنية البيئية";
  if (/land|mixed-use|development|تطوير|أرض/i.test(title)) return "تطوير عقاري متعدد الاستخدامات";
  if (/hospital|health|dialysis|صحة|مستشفى/i.test(title)) return "مرافق صحية وشراكات PPP";
  return "شراكات بين القطاعين العام والخاص PPP";
}

function isOpportunity(text: string): boolean {
  return /(PPP|Project|EOI|RFQ|RFP|Expression of Interest|Request for Qualification|Request for Proposals|مشروع|إبداء الرغبة|طلب التأهيل|طلب العروض)/i.test(text)
    && !/(privacy|terms|site map|contact|training|workshop)/i.test(text);
}

function parseOpportunities(html: string): Tender[] {
  const anchors = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const records = new Map<string, Tender>();

  for (const anchor of anchors) {
    const href = anchor[1]?.trim() ?? "";
    const title = textFromHtml(anchor[2] ?? "");
    if (!href || title.length < 18 || !isOpportunity(title)) continue;
    if (!/(MediaCenter\/News\/Pages|investors\.ncp\.gov\.sa|Project)/i.test(href) && !/PPP|EOI|RFQ|RFP/i.test(title)) continue;

    const start = Math.max(0, (anchor.index ?? 0) - 450);
    const end = Math.min(html.length, (anchor.index ?? 0) + (anchor[0]?.length ?? 0) + 450);
    const context = textFromHtml(html.slice(start, end));
    const sourceUrl = absoluteUrl(href);
    const externalId = `ncp-ppp:${stableHash(`${sourceUrl}|${title}`)}`;
    const activityName = activityFromTitle(title);
    const regionName = regionFromTitle(title);
    const publicationDate = parseDate(context);

    records.set(externalId, {
      id: `ncp-${stableHash(externalId)}`,
      competitionNumber: `NCP-${stableHash(title).toUpperCase()}`,
      name: title,
      description: context.slice(0, 700),
      governmentEntityId: "entity-ncp-ppp",
      governmentEntityName: "المركز الوطني للتخصيص والشراكة بين القطاعين العام والخاص",
      governmentEntitySlug: "ncp-ppp",
      activityId: `activity-${stableHash(activityName)}`,
      activityName,
      sector: "مشاريع PPP والتخصيص",
      regionId: `region-${stableHash(regionName)}`,
      regionName,
      publicationDate,
      submissionDeadline: "",
      bidOpeningDate: "",
      brochurePrice: null,
      estimatedValue: null,
      status: "open",
      awarded: false,
      award: null,
      sourceUrl,
      sourceExternalId: externalId,
      updatedAt: new Date().toISOString(),
    });
  }

  return [...records.values()].slice(0, 40);
}

export class NcpPppConnector implements DataSourceConnector {
  readonly key = "ncp-ppp";
  readonly name = "المركز الوطني للتخصيص — فرص PPP";
  readonly isLive = true;

  async fetchTenders(since?: string): Promise<Tender[]> {
    const response = await fetch(HOME_URL, {
      headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": "ConstructionRadar/1.0 (+public-data-indexer)" },
      next: { revalidate: 1800 },
    });
    if (!response.ok) throw new Error(`NCP public opportunities request failed (${response.status})`);
    const rows = parseOpportunities(await response.text());
    return since ? rows.filter((row) => row.publicationDate >= since.slice(0, 10)) : rows;
  }
}
