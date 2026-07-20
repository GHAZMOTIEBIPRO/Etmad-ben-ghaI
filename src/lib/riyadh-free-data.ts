import type { SupabaseClient } from "@supabase/supabase-js";
import type { SyncResult } from "@/lib/data-sources/types";

const BASE_URL = "https://www.alriyadh.gov.sa";
const LIST_PAGES = [
  `${BASE_URL}/ar/data-sets/competitions`,
  `${BASE_URL}/ar/data-sets/investment-contracts`,
];
const USER_AGENT = "ConstructionRadar/1.0 (+public-data-indexer)";
const RESOURCE_PATTERN = /\.(csv|xlsx?|json|xml)(?:\?|$)/i;

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;|&#160;/gi, " ");
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

function stableId(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function dateFromText(text: string): string | null {
  const matches = [
    text.match(/(?:تاريخ التحديث|updated date|التاريخ|date)[^\d]*(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2})/i),
    text.match(/(?:تاريخ التحديث|updated date|التاريخ|date)[^\d]*(20\d{2})[\/\-](\d{1,2})[\/\-](\d{1,2})/i),
  ];
  const dayFirst = matches[0];
  if (dayFirst) return new Date(`${dayFirst[3]}-${dayFirst[2].padStart(2, "0")}-${dayFirst[1].padStart(2, "0")}T00:00:00Z`).toISOString();
  const yearFirst = matches[1];
  if (yearFirst) return new Date(`${yearFirst[1]}-${yearFirst[2].padStart(2, "0")}-${yearFirst[3].padStart(2, "0")}T00:00:00Z`).toISOString();
  return null;
}

function extractLinks(html: string): Array<{ href: string; text: string }> {
  return [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({ href: absoluteUrl(decodeHtml(match[1].trim())), text: textFromHtml(match[2]) }))
    .filter((item) => item.href.startsWith(BASE_URL) || RESOURCE_PATTERN.test(item.href));
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": USER_AGENT },
    next: { revalidate: 21600 },
  });
  if (!response.ok) throw new Error(`Riyadh Municipality open data request failed (${response.status}) for ${url}`);
  return response.text();
}

async function discoverDatasetPages(): Promise<string[]> {
  const batches = await Promise.allSettled(LIST_PAGES.map(fetchText));
  const pages = batches.flatMap((batch, index) => {
    if (batch.status !== "fulfilled") return [];
    const category = index === 0 ? "/data-sets/competitions/" : "/data-sets/investment-contracts/";
    return extractLinks(batch.value)
      .filter((link) => link.href.includes(category))
      .filter((link) => /2026|2025/i.test(`${link.href} ${link.text}`))
      .map((link) => link.href);
  });
  return [...new Set(pages)].slice(0, 40);
}

export async function syncRiyadhMunicipalityOpenData(supabase: SupabaseClient): Promise<SyncResult> {
  const sourceKey = "riyadh-municipality-open-data";
  const result: SyncResult = { source: sourceKey, fetched: 0, upserted: 0, skipped: 0, errors: [] };
  const startedAt = new Date().toISOString();

  const sourceUpsert = await supabase
    .from("data_sources")
    .upsert({ key: sourceKey, name: "أمانة الرياض — البيانات المفتوحة للمنافسات والعقود", is_active: true }, { onConflict: "key" })
    .select("id")
    .single();
  if (sourceUpsert.error || !sourceUpsert.data) {
    result.errors.push(sourceUpsert.error?.message ?? "Could not initialize Riyadh Municipality open data source");
    return result;
  }

  const logInsert = await supabase
    .from("sync_logs")
    .insert({ data_source_id: sourceUpsert.data.id, started_at: startedAt, status: "running" })
    .select("id")
    .single();
  if (logInsert.error || !logInsert.data) {
    result.errors.push(logInsert.error?.message ?? "Could not create Riyadh Municipality sync log");
    return result;
  }

  try {
    const pages = await discoverDatasetPages();
    result.fetched = pages.length;

    for (const pageUrl of pages) {
      try {
        const html = await fetchText(pageUrl);
        const pageText = textFromHtml(html);
        const title = textFromHtml(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "")
          || pageText.slice(0, 180)
          || "بيانات أمانة الرياض المفتوحة";
        const resources = extractLinks(html)
          .map((link) => link.href)
          .filter((href) => RESOURCE_PATTERN.test(href));
        const uniqueResources = [...new Set(resources)];
        const preferredResource = uniqueResources.find((url) => /\.json(?:\?|$)/i.test(url))
          ?? uniqueResources.find((url) => /\.csv(?:\?|$)/i.test(url))
          ?? uniqueResources[0]
          ?? "";
        const format = preferredResource.match(/\.(csv|xlsx?|json|xml)(?:\?|$)/i)?.[1]?.toUpperCase() ?? "";
        const category = pageUrl.includes("investment-contracts") ? "العقود الاستثمارية" : "المنافسات الاستثمارية";
        const externalId = stableId(pageUrl);

        const upsert = await supabase.from("public_datasets").upsert({
          source_key: sourceKey,
          external_id: externalId,
          title,
          description: pageText.slice(0, 1200),
          organization: "أمانة منطقة الرياض",
          category,
          format: format || null,
          dataset_url: pageUrl,
          resource_url: preferredResource || null,
          source_updated_at: dateFromText(pageText),
          metadata: { resources: uniqueResources, discovered_at: new Date().toISOString() },
          updated_at: new Date().toISOString(),
        }, { onConflict: "source_key,external_id" });

        if (upsert.error) result.errors.push(upsert.error.message);
        else result.upserted += 1;
      } catch (error) {
        result.errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    result.skipped = Math.max(0, result.fetched - result.upserted);
    await supabase.from("sync_logs").update({
      status: result.errors.length ? "partial" : "success",
      completed_at: new Date().toISOString(),
      fetched_count: result.fetched,
      upserted_count: result.upserted,
      error_count: result.errors.length,
      error_message: result.errors.slice(0, 10).join("\n") || null,
    }).eq("id", logInsert.data.id);
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error));
    await supabase.from("sync_logs").update({
      status: "failed",
      completed_at: new Date().toISOString(),
      fetched_count: result.fetched,
      upserted_count: result.upserted,
      error_count: result.errors.length,
      error_message: result.errors.slice(0, 10).join("\n"),
    }).eq("id", logInsert.data.id);
  }

  return result;
}
