import "server-only";
import { cache } from "react";

const API_URL = "https://apiservices.balady.gov.sa/v1/momrah-services/open-data?items_per_page=All";

export interface BaladyOpenDataSignal {
  id: string;
  title: string;
  year: string;
  changed: string;
  category: string;
  files: string[];
}

type BaladyRow = {
  nid?: string;
  title?: string;
  field_year_g?: string;
  created?: string;
  changed?: string;
  field_file?: string[] | string;
  field_opendata_category?: string;
};

const relevantPattern = /(رخص|ترخيص|إنشا|بناء|مقاول|تصنيف|طرق|جسور|أنفاق|مواقف|مخططات|أراض|نزع الملكية|construction|permit|contractor|road|bridge|tunnel|parking|plan|land)/i;

function normalizeFiles(value: BaladyRow["field_file"]): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && /^https?:\/\//i.test(item));
  if (typeof value === "string" && /^https?:\/\//i.test(value)) return [value];
  return [];
}

export const getBaladyOpenDataSignals = cache(async (): Promise<BaladyOpenDataSignal[]> => {
  try {
    const response = await fetch(API_URL, {
      headers: { Accept: "application/json", "User-Agent": "ConstructionRadar/1.0 (+public-data-indexer)" },
      next: { revalidate: 21600 },
    });
    if (!response.ok) return [];

    const payload = await response.json() as {
      data?: { result?: { rows?: BaladyRow[] } };
    };
    const rows = payload.data?.result?.rows ?? [];

    return rows
      .filter((row) => relevantPattern.test(`${row.title ?? ""} ${row.field_opendata_category ?? ""}`))
      .map((row) => ({
        id: String(row.nid ?? `${row.title ?? "dataset"}-${row.field_year_g ?? ""}`),
        title: String(row.title ?? "بيانات بلدية مفتوحة"),
        year: String(row.field_year_g ?? ""),
        changed: String(row.changed ?? row.created ?? ""),
        category: String(row.field_opendata_category ?? ""),
        files: normalizeFiles(row.field_file),
      }))
      .sort((a, b) => `${b.year}-${b.changed}`.localeCompare(`${a.year}-${a.changed}`))
      .slice(0, 12);
  } catch {
    return [];
  }
});
