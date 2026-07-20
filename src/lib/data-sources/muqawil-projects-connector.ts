import type { DataSourceConnector } from "@/lib/data-sources/types";
import { fetchWithPolicy } from "@/lib/http/fetch-with-policy";
import type { CompetitionStatus, Tender } from "@/lib/types";

const BASE_URL = "https://muqawil.org";
const PROJECTS_PATH = "/ar/market/list";

type ConnectorOptions = { maxPages?: number };

type ProjectCard = {
  externalId: string;
  title: string;
  publicationDate: string;
  deliveryDate: string;
  location: string;
  activity: string;
  views: number | null;
  offers: number | null;
  daysRemaining: number | null;
};

function boundedInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

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

function parseProjectCards(html: string): ProjectCard[] {
  const projectAnchor = /<a\b[^>]*href=["'](?:https?:\/\/muqawil\.org)?\/ar\/market\/projects\/([0-9a-f-]{20,})["'][^>]*>([\s\S]*?)<\/a>/gi;
  const anchors = [...html.matchAll(projectAnchor)]
    .map((match) => ({ externalId: match[1], title: textFromHtml(match[2]), index: match.index ?? 0 }))
    .filter((item) => item.title && !/^(?:تفاصيل|عرض|المزيد)$/i.test(item.title));

  const uniqueAnchors = anchors.filter((item, index) => index === 0 || item.externalId !== anchors[index - 1]?.externalId);

  return uniqueAnchors
    .map((anchor, index) => {
      const end = uniqueAnchors[index + 1]?.index ?? html.length;
      const blockText = textFromHtml(html.slice(anchor.index, end));
      return {
        externalId: anchor.externalId,
        title: anchor.title,
        publicationDate: capture(blockText, /تاريخ النشر\s+(\d{4}-\d{2}-\d{2})/),
        deliveryDate: capture(blockText, /موعد التسليم\s+(\d{4}-\d{2}-\d{2})/),
        location: capture(blockText, /المكان\s+(.+?)\s+النشاط\s+/),
        activity: capture(blockText, /النشاط\s+(.+?)(?:\s+\d+\s+يوم متبقي|\s+يوم متبقي|$)/) || "مقاولات عامة",
        views: toNumber(capture(blockText, /المشاهدات\s+([0-9,]+)/)),
        offers: toNumber(capture(blockText, /عدد العروض\s+([0-9,]+)/)),
        daysRemaining: toNumber(capture(blockText, /(?:النشاط\s+.+?\s+)?([0-9]+)\s+يوم متبقي/)),
      };
    })
    .filter((item) => item.publicationDate && item.title);
}

function regionFromLocation(location: string): string {
  const parts = location.split("-").map((part) => part.trim()).filter(Boolean);
  return parts.length >= 2 ? parts[1] : parts[0] || "غير محدد";
}

function statusFromCard(card: ProjectCard): CompetitionStatus {
  if (card.daysRemaining !== null) return card.daysRemaining > 0 ? "open" : "closed";
  if (card.deliveryDate) return card.deliveryDate >= new Date().toISOString().slice(0, 10) ? "open" : "closed";
  return "open";
}

function mapCardToTender(card: ProjectCard): Tender {
  const regionName = regionFromLocation(card.location);
  const activityName = card.activity || "مقاولات عامة";
  const sourceExternalId = `muqawil-project:${card.externalId}`;
  const detailUrl = `${BASE_URL}/ar/market/projects/${card.externalId}`;
  const details = [
    card.location ? `الموقع: ${card.location}` : "",
    card.deliveryDate ? `موعد التسليم المعلن: ${card.deliveryDate}` : "",
    card.offers !== null ? `عدد العروض الظاهر: ${card.offers}` : "",
    card.views !== null ? `المشاهدات: ${card.views}` : "",
  ].filter(Boolean).join(" | ");

  return {
    id: `muqawil-${stableHash(card.externalId)}`,
    competitionNumber: `MUQAWIL-${card.externalId.slice(0, 8).toUpperCase()}`,
    name: card.title,
    description: details,
    governmentEntityId: "entity-muqawil-project-market",
    governmentEntityName: "منصة مقاول — سوق المشاريع",
    governmentEntitySlug: "muqawil-project-market",
    activityId: `activity-${stableHash(activityName)}`,
    activityName,
    sector: "مشاريع ومقاولات القطاع الخاص",
    regionId: `region-${stableHash(regionName)}`,
    regionName,
    publicationDate: card.publicationDate,
    submissionDeadline: "",
    bidOpeningDate: "",
    brochurePrice: null,
    estimatedValue: null,
    status: statusFromCard(card),
    awarded: false,
    award: null,
    sourceUrl: detailUrl,
    sourceExternalId,
    updatedAt: new Date().toISOString(),
  };
}

export class MuqawilProjectsConnector implements DataSourceConnector {
  readonly key = "muqawil-projects";
  readonly name = "منصة مقاول — المشاريع العامة";
  readonly isLive = true;
  readonly parserVersion = "2.0.0";
  private readonly maxPages: number;

  constructor(options: ConnectorOptions = {}) {
    this.maxPages = options.maxPages ?? boundedInteger(process.env.MUQAWIL_PROJECTS_MAX_PAGES, 5, 1, 200);
  }

  async fetchTenders(since?: string): Promise<Tender[]> {
    const records = new Map<string, Tender>();
    for (let page = 1; page <= this.maxPages; page += 1) {
      const url = `${BASE_URL}${PROJECTS_PATH}?page=${page}`;
      const fetched = await fetchWithPolicy(url, {
        headers: { Accept: "text/html,application/xhtml+xml" },
        retries: 3,
        minIntervalMs: 650,
        timeoutMs: 20_000,
      });
      const cards = parseProjectCards(fetched.text());
      if (!cards.length) break;
      for (const card of cards) {
        if (since && card.publicationDate < since.slice(0, 10)) continue;
        const tender = mapCardToTender(card);
        records.set(tender.sourceExternalId, tender);
      }
    }
    return [...records.values()];
  }
}
