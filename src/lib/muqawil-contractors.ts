const BASE_URL = "https://muqawil.org";

export interface ContractorDirectoryRecord {
  id: string;
  name: string;
  membershipNumber: string;
  establishmentSize: string;
  trainingHours: number | null;
  accountStatus: string;
  city: string;
  region: string;
  mainContractorCount: number | null;
  subcontractorCount: number | null;
  classification: string;
  sourceUrl: string;
}

export interface ContractorDirectoryPage {
  items: ContractorDirectoryRecord[];
  page: number;
  totalSaudi: number | null;
  totalNonSaudi: number | null;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function textFromHtml(value: string): string {
  return decodeHtml(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(?:div|p|li|h\d|section|article)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[\t\r]+/g, " ")
    .replace(/ +/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function capture(text: string, pattern: RegExp): string {
  return text.match(pattern)?.[1]?.trim() ?? "";
}

function toNumber(value: string): number | null {
  const normalized = value.replace(/[^0-9.-]/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCityRegion(value: string): { city: string; region: string } {
  const parts = value.split("-").map((item) => item.trim()).filter(Boolean);
  return { city: parts[0] ?? "غير محدد", region: parts[1] ?? parts[0] ?? "غير محدد" };
}

function parseContractors(html: string): ContractorDirectoryRecord[] {
  const profileAnchor = /<a\b[^>]*href=["'](?:https?:\/\/muqawil\.org)?\/ar\/contractors\/(\d+)\/(\d+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const anchors = [...html.matchAll(profileAnchor)]
    .map((match) => ({
      id: `${match[1]}/${match[2]}`,
      href: `/ar/contractors/${match[1]}/${match[2]}`,
      name: textFromHtml(match[3]),
      index: match.index ?? 0,
    }))
    .filter((item) => item.name && !/طلب تعاقد|عرض|المزيد|image/i.test(item.name));

  const unique = anchors.filter((item, index) => anchors.findIndex((candidate) => candidate.id === item.id) === index);

  return unique.map((anchor, index) => {
    const end = unique[index + 1]?.index ?? html.length;
    const block = textFromHtml(html.slice(anchor.index, end));
    const location = capture(block, /المدينة\s*-\s*المنطقه\s+(.+?)(?:\s+مقاول رئيسي|\s+مقاول من الباطن|\s+مصنف|$)/);
    const { city, region } = parseCityRegion(location);
    return {
      id: anchor.id,
      name: anchor.name,
      membershipNumber: capture(block, /رقم العضويه\s+([0-9]+)/),
      establishmentSize: capture(block, /حجم المنشأة\s+(.+?)(?:\s+عدد الساعات التدريبية|\s+الحالة|$)/),
      trainingHours: toNumber(capture(block, /عدد الساعات التدريبية\s+([0-9,.]+)\s*س?/)),
      accountStatus: capture(block, /الحالة\s+(.+?)(?:\s+المدينة\s*-\s*المنطقه|$)/),
      city,
      region,
      mainContractorCount: toNumber(capture(block, /مقاول رئيسي\s+([0-9,.]+)/)),
      subcontractorCount: toNumber(capture(block, /مقاول من الباطن\s+([0-9,.]+)/)),
      classification: capture(block, /(مصنف درجة\s+[^\n]+?)(?:\s+[0-9]+\s|$)/),
      sourceUrl: `${BASE_URL}${anchor.href}`,
    };
  });
}

export async function listMuqawilContractors(page = 1, query = ""): Promise<ContractorDirectoryPage> {
  const safePage = Math.max(1, Math.trunc(page));
  const response = await fetch(`${BASE_URL}/ar/contractors?page=${safePage}`, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "ConstructionRadar/1.0 (+public-data-indexer)",
    },
    next: { revalidate: 1800 },
  });
  if (!response.ok) throw new Error(`Muqawil contractors request failed (${response.status})`);
  const html = await response.text();
  const text = textFromHtml(html);
  const normalizedQuery = query.trim().toLocaleLowerCase("ar-SA");
  const items = parseContractors(html).filter((item) => {
    if (!normalizedQuery) return true;
    return [item.name, item.membershipNumber, item.city, item.region, item.classification, item.establishmentSize]
      .some((value) => value.toLocaleLowerCase("ar-SA").includes(normalizedQuery));
  });
  return {
    items,
    page: safePage,
    totalSaudi: toNumber(capture(text, /([0-9,]+)\s+مقاول سعود[ىي]/)),
    totalNonSaudi: toNumber(capture(text, /([0-9,]+)\s+مقاول غير سعود[ىي]/)),
  };
}
