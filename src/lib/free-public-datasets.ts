import type { SupabaseClient } from "@supabase/supabase-js";
import { chunkedUpsert } from "@/lib/db/chunked-upsert";
import type { SyncResult } from "@/lib/data-sources/types";
import { fetchWithPolicy } from "@/lib/http/fetch-with-policy";

const BALADY_API_URL = "https://apiservices.balady.gov.sa/v1/momrah-services/open-data?items_per_page=All";
const SAUDI_OPEN_DATA_API = "https://open.data.gov.sa/data/api/datasets";

const OPEN_DATA_SEARCH_TERMS = [
  "بيانات المنافسات",
  "المنافسات",
  "المشتريات",
  "المقاولات",
  "رخص البناء",
  "التشييد",
  "البنية التحتية",
  "الإسكان",
  "العقار",
  "الطرق",
  "contractor",
  "construction",
  "tenders",
];

export interface PublicDatasetRecord {
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

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null;
}

function pickString(object: JsonObject, keys: string[]): string {
  for (const key of keys) {
    const value = object[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function nestedString(value: unknown, keys: string[]): string {
  const object = asObject(value);
  if (!object) return "";
  return pickString(object, keys);
}

function collectObjectArrays(value: unknown, depth = 0): JsonObject[][] {
  if (depth > 4) return [];
  if (Array.isArray(value)) {
    const objects = value.map(asObject).filter((item): item is JsonObject => Boolean(item));
    return objects.length ? [objects] : value.flatMap((item) => collectObjectArrays(item, depth + 1));
  }
  const object = asObject(value);
  if (!object) return [];

  const preferredKeys = ["datasets", "items", "rows", "results", "result", "data", "content", "records"];
  const preferred = preferredKeys.flatMap((key) => key in object ? collectObjectArrays(object[key], depth + 1) : []);
  if (preferred.length) return preferred;
  return Object.values(object).flatMap((item) => collectObjectArrays(item, depth + 1));
}

function normalizeResourceUrl(value: unknown): string {
  if (typeof value === "string" && /^https?:\/\//i.test(value)) return value;
  const object = asObject(value);
  if (!object) return "";
  return pickString(object, ["downloadUrl", "download_url", "resourceUrl", "resource_url", "url", "link"]);
}

function firstResource(dataset: JsonObject): { url: string; format: string } {
  const resources = dataset.resources ?? dataset.resource ?? dataset.files ?? dataset.attachments;
  if (!Array.isArray(resources)) return { url: normalizeResourceUrl(resources), format: pickString(dataset, ["format", "fileFormat", "file_format"]) };

  for (const resource of resources) {
    const object = asObject(resource);
    const url = normalizeResourceUrl(resource);
    if (!url) continue;
    return {
      url,
      format: object ? pickString(object, ["format", "fileFormat", "file_format", "type", "extension"]) : "",
    };
  }
  return { url: "", format: "" };
}

function dateOrNull(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function fetchBaladyDatasets(): Promise<PublicDatasetRecord[]> {
  const fetched = await fetchWithPolicy(BALADY_API_URL, {
    headers: { Accept: "application/json" },
    retries: 3,
    minIntervalMs: 750,
    timeoutMs: 30_000,
    maxResponseBytes: 30 * 1024 * 1024,
  });
  const payload = fetched.json<JsonObject>();
  const data = asObject(payload.data);
  const result = asObject(data?.result);
  const rows = Array.isArray(result?.rows) ? result.rows : [];

  return rows.flatMap((raw): PublicDatasetRecord[] => {
    const row = asObject(raw);
    if (!row) return [];
    const externalId = pickString(row, ["nid", "id"]) || `${pickString(row, ["title"])}-${pickString(row, ["field_year_g"])}`;
    const title = pickString(row, ["title"]) || "بيانات بلدية مفتوحة";
    const rawFiles = row.field_file;
    const fileValues = Array.isArray(rawFiles) ? rawFiles : rawFiles ? [rawFiles] : [];
    const resourceUrl = fileValues.map(normalizeResourceUrl).find(Boolean) ?? "";

    return [{
      sourceKey: "balady-open-data",
      externalId,
      title,
      description: `مجموعة بيانات مفتوحة من منصة بلدي. السنة: ${pickString(row, ["field_year_g"])}.`.trim(),
      organization: "وزارة البلديات والإسكان",
      category: pickString(row, ["field_opendata_category"]),
      format: resourceUrl.split(".").pop()?.split("?")[0]?.toUpperCase() ?? "",
      datasetUrl: "https://balady.gov.sa/ar/open-data",
      resourceUrl,
      sourceUpdatedAt: dateOrNull(pickString(row, ["changed", "created"])),
      metadata: row,
    }];
  });
}

function normalizeNationalDataset(dataset: JsonObject): PublicDatasetRecord | null {
  const externalId = pickString(dataset, ["id", "datasetId", "dataset_id", "dataset", "guid", "uuid", "identifier"]);
  const title = pickString(dataset, ["title", "name", "datasetName", "dataset_name", "titleAr", "title_ar"]);
  if (!externalId || !title) return null;

  const organization = pickString(dataset, ["organizationName", "organization_name", "publisher", "owner"])
    || nestedString(dataset.organization, ["name", "title", "nameAr", "name_ar"]);
  const resource = firstResource(dataset);
  const description = pickString(dataset, ["description", "notes", "summary", "descriptionAr", "description_ar"]);
  const category = pickString(dataset, ["category", "theme", "sector", "classification"])
    || nestedString(dataset.category, ["name", "title"]);
  const updated = pickString(dataset, ["updatedAt", "updated_at", "modified", "lastUpdated", "last_updated", "updateDate"]);

  return {
    sourceKey: "saudi-open-data",
    externalId,
    title,
    description,
    organization,
    category,
    format: resource.format || pickString(dataset, ["format", "fileFormat", "file_format"]),
    datasetUrl: `https://open.data.gov.sa/data/api/datasets?version=-1&dataset=${encodeURIComponent(externalId)}`,
    resourceUrl: resource.url,
    sourceUpdatedAt: dateOrNull(updated),
    metadata: dataset,
  };
}

async function fetchNationalSearch(term: string): Promise<PublicDatasetRecord[]> {
  const parameterNames = ["searchValue", "search", "query"];

  for (const parameter of parameterNames) {
    try {
      const url = `${SAUDI_OPEN_DATA_API}?version=-1&${parameter}=${encodeURIComponent(term)}`;
      const fetched = await fetchWithPolicy(url, {
        headers: { Accept: "application/json" },
        retries: 2,
        minIntervalMs: 700,
        timeoutMs: 25_000,
      });
      const payload = fetched.json<unknown>();
      const arrays = collectObjectArrays(payload);
      const rows = arrays.flat().map(normalizeNationalDataset).filter((item): item is PublicDatasetRecord => Boolean(item));
      if (rows.length) return rows;
    } catch {
      // Try the next common search parameter shape without bypassing access controls.
    }
  }

  return [];
}

async function fetchSaudiOpenDataDatasets(): Promise<PublicDatasetRecord[]> {
  const batches = await Promise.allSettled(OPEN_DATA_SEARCH_TERMS.map(fetchNationalSearch));
  const rows = batches.flatMap((batch) => batch.status === "fulfilled" ? batch.value : []);
  return [...new Map(rows.map((row) => [row.externalId, row])).values()].slice(0, 2000);
}

async function syncCatalog(
  supabase: SupabaseClient,
  sourceKey: string,
  sourceName: string,
  fetcher: () => Promise<PublicDatasetRecord[]>,
): Promise<SyncResult> {
  const result: SyncResult = { source: sourceKey, fetched: 0, upserted: 0, skipped: 0, errors: [] };
  const startedAt = new Date().toISOString();

  const sourceUpsert = await supabase
    .from("data_sources")
    .upsert({ key: sourceKey, name: sourceName, is_active: true }, { onConflict: "key" })
    .select("id")
    .single();
  if (sourceUpsert.error || !sourceUpsert.data) {
    result.errors.push(sourceUpsert.error?.message ?? `Could not initialize ${sourceKey}`);
    return result;
  }

  const logInsert = await supabase
    .from("sync_logs")
    .insert({ data_source_id: sourceUpsert.data.id, started_at: startedAt, status: "running" })
    .select("id")
    .single();
  if (logInsert.error || !logInsert.data) {
    result.errors.push(logInsert.error?.message ?? `Could not create sync log for ${sourceKey}`);
    return result;
  }

  try {
    const rows = await fetcher();
    result.fetched = rows.length;
    const now = new Date().toISOString();
    const payload = rows.map((row) => ({
      source_key: row.sourceKey,
      external_id: row.externalId,
      title: row.title,
      description: row.description,
      organization: row.organization || null,
      category: row.category || null,
      format: row.format || null,
      dataset_url: row.datasetUrl || null,
      resource_url: row.resourceUrl || null,
      source_updated_at: row.sourceUpdatedAt,
      metadata: row.metadata,
      updated_at: now,
    }));
    result.upserted = await chunkedUpsert(supabase, "public_datasets", payload, { onConflict: "source_key,external_id", chunkSize: 500 });
    result.skipped = Math.max(0, result.fetched - result.upserted);

    await supabase.from("sync_logs").update({
      status: "success",
      completed_at: new Date().toISOString(),
      fetched_count: result.fetched,
      upserted_count: result.upserted,
      error_count: 0,
      error_message: null,
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

export async function syncFreePublicDatasetCatalogs(supabase: SupabaseClient): Promise<SyncResult[]> {
  const [balady, national] = await Promise.all([
    syncCatalog(supabase, "balady-open-data", "بلدي — كتالوج البيانات المفتوحة المجاني", fetchBaladyDatasets),
    syncCatalog(supabase, "saudi-open-data", "البوابة الوطنية للبيانات المفتوحة — بيانات مجانية", fetchSaudiOpenDataDatasets),
  ]);
  return [balady, national];
}
