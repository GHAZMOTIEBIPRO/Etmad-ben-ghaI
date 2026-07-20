const USER_AGENT = "ConstructionRadar/1.0 (+public-data-indexer)";

export interface OfficialProcurementFileRecord {
  sourceKey: string;
  externalId: string;
  title: string;
  description: string;
  organization: string;
  category: string;
  format: string;
  datasetUrl: string;
  resourceUrl: string;
  sourceUpdatedAt: string | null;
  metadata: Record<string, unknown>;
}

type SourceConfig = {
  key: string;
  organization: string;
  url: string;
  category: string;
};

const SOURCES: SourceConfig[] = [
  {
    key: "mahd-2026-procurement-plan",
    organization: "أكاديمية مهد الرياضية",
    url: "https://mahd.gov.sa/competitions-and-purchases",
    category: "خطة مشتريات 2026",
  },
  {
    key: "saso-procurement-files",
    organization: "الهيئة السعودية للمواصفات والمقاييس والجودة",
    url: "https://www.saso.gov.sa/ar/about/Pages/Competitions.aspx",
    category: "خطط ومنافسات ومشتريات",
  },
  {
    key: "rega-procurement-files",
    organization: "الهيئة العامة للعقار",
    url: "https://rega.gov.sa/الهيئة/المنافسات-والمشتريات/",
    category: "مشاريع ومشتريات 2026",
  },
  {
    key: "zatca-procurement-files",
    organization: "هيئة الزكاة والضريبة والجمارك",
    url: "https://zatca.gov.sa/ar/MediaCenter/Elan/Pages/Procurement-and-Tenders-for-the-Fiscal-Year-2026.aspx",
    category: "خطة مشتريات 2026",
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
  return decodeHtml(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function fileFormat(url: string): string {
  const match = url.match(/\.(pdf|xlsx?|csv|json|xml)(?:$|[?#])/i);
  return match?.[1]?.toUpperCase() ?? "FILE";
}

function isProcurementFile(url: string): boolean {
  return /\.(pdf|xlsx?|csv|json|xml)(?:$|[?#])/i.test(url);
}

function resolveUrl(href: string, base: string): string {
  try {
    return new URL(decodeHtml(href), base).toString();
  } catch {
    return "";
  }
}

function extractFiles(html: string, source: SourceConfig): OfficialProcurementFileRecord[] {
  const rows: OfficialProcurementFileRecord[] = [];
  const anchors = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];

  for (const anchor of anchors) {
    const resourceUrl = resolveUrl(anchor[1], source.url);
    if (!resourceUrl || !isProcurementFile(resourceUrl)) continue;

    const anchorText = textFromHtml(anchor[2]);
    const contextStart = Math.max(0, (anchor.index ?? 0) - 260);
    const contextEnd = Math.min(html.length, (anchor.index ?? 0) + anchor[0].length + 260);
    const context = textFromHtml(html.slice(contextStart, contextEnd));
    const title = anchorText || context || `${source.organization} — ملف مشتريات رسمي`;
    const externalId = `${source.key}:${stableHash(resourceUrl)}`;

    rows.push({
      sourceKey: "official-procurement-files",
      externalId,
      title: title.slice(0, 500),
      description: `ملف مجاني منشور على الصفحة الرسمية لـ${source.organization}. ${context}`.slice(0, 1600),
      organization: source.organization,
      category: source.category,
      format: fileFormat(resourceUrl),
      datasetUrl: source.url,
      resourceUrl,
      sourceUpdatedAt: null,
      metadata: {
        sourcePage: source.url,
        sourceKey: source.key,
        discoveredFromPublicPage: true,
      },
    });
  }

  return [...new Map(rows.map((row) => [row.resourceUrl, row])).values()];
}

export async function fetchOfficialProcurementFiles(): Promise<OfficialProcurementFileRecord[]> {
  const batches = await Promise.allSettled(
    SOURCES.map(async (source) => {
      const response = await fetch(source.url, {
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": USER_AGENT,
        },
        next: { revalidate: 21600 },
      });
      if (!response.ok) throw new Error(`${source.key} request failed (${response.status})`);
      return extractFiles(await response.text(), source);
    }),
  );

  const rows = batches.flatMap((batch) => batch.status === "fulfilled" ? batch.value : []);
  return [...new Map(rows.map((row) => [row.externalId, row])).values()].slice(0, 500);
}
