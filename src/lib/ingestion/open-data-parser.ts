import "server-only";
import * as XLSX from "xlsx";

export type OpenDataFormat = "csv" | "json" | "xlsx" | "xls" | "unknown";
export type OpenDataRow = Record<string, unknown>;

function normalizeHeader(value: string, index: number): string {
  const normalized = value.replace(/^\uFEFF/, "").trim().replace(/\s+/g, " ");
  return normalized || `column_${index + 1}`;
}

export function inferOpenDataFormat(url: string, contentType = "", explicitFormat = ""): OpenDataFormat {
  const hint = `${explicitFormat} ${contentType} ${url}`.toLowerCase();
  if (/\.xlsx(?:$|\?)|spreadsheetml|xlsx/.test(hint)) return "xlsx";
  if (/\.xls(?:$|\?)|ms-excel|\bxls\b/.test(hint)) return "xls";
  if (/\.csv(?:$|\?)|text\/csv|\bcsv\b/.test(hint)) return "csv";
  if (/\.json(?:$|\?)|application\/json|\bjson\b/.test(hint)) return "json";
  return "unknown";
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      cells.push(value.trim());
      value = "";
    } else {
      value += char;
    }
  }
  cells.push(value.trim());
  return cells;
}

function detectDelimiter(header: string): string {
  const candidates = [",", ";", "\t", "|"];
  return candidates
    .map((delimiter) => ({ delimiter, count: header.split(delimiter).length }))
    .sort((a, b) => b.count - a.count)[0]?.delimiter ?? ",";
}

function parseCsv(text: string, maxRows: number): OpenDataRow[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delimiter).map(normalizeHeader);
  return lines.slice(1, maxRows + 1).map((line) => {
    const values = parseCsvLine(line, delimiter);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? null]));
  });
}

function collectJsonRows(value: unknown, depth = 0): OpenDataRow[] {
  if (depth > 5) return [];
  if (Array.isArray(value)) {
    const objects = value.filter((item): item is OpenDataRow => Boolean(item) && typeof item === "object" && !Array.isArray(item));
    if (objects.length) return objects;
    return value.flatMap((item) => collectJsonRows(item, depth + 1));
  }
  if (!value || typeof value !== "object") return [];
  const object = value as OpenDataRow;
  const preferred = ["rows", "records", "items", "results", "result", "data", "content", "datasets"];
  for (const key of preferred) {
    if (key in object) {
      const rows = collectJsonRows(object[key], depth + 1);
      if (rows.length) return rows;
    }
  }
  return Object.values(object).flatMap((item) => collectJsonRows(item, depth + 1));
}

function parseWorkbook(buffer: ArrayBuffer, maxRows: number): OpenDataRow[] {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const rows: OpenDataRow[] = [];
  for (const sheetName of workbook.SheetNames.slice(0, 5)) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const parsed = XLSX.utils.sheet_to_json<OpenDataRow>(sheet, { defval: null, raw: false });
    rows.push(...parsed.slice(0, Math.max(0, maxRows - rows.length)));
    if (rows.length >= maxRows) break;
  }
  return rows;
}

export function parseOpenDataBuffer(
  buffer: ArrayBuffer,
  format: OpenDataFormat,
  options: { maxRows?: number } = {},
): OpenDataRow[] {
  const maxRows = Math.max(1, Math.min(options.maxRows ?? 5_000, 50_000));
  if (format === "xlsx" || format === "xls") return parseWorkbook(buffer, maxRows);

  const text = new TextDecoder("utf-8").decode(buffer);
  if (format === "csv") return parseCsv(text, maxRows);
  if (format === "json") {
    const payload = JSON.parse(text) as unknown;
    return collectJsonRows(payload).slice(0, maxRows);
  }
  return [];
}

const FIELD_ALIASES = {
  title: ["project", "project name", "project_name", "name", "title", "اسم المشروع", "المشروع", "اسم المنافسة", "المنافسة"],
  region: ["region", "region_name", "province", "المنطقة", "المنطقه"],
  city: ["city", "municipality", "المدينة", "المدينه", "الأمانة", "الامانة"],
  entity: ["entity", "organization", "owner", "agency", "الجهة", "الجهه", "المالك"],
  value: ["estimated value", "estimated_value", "value", "amount", "contract value", "القيمة", "القيمه", "قيمة المشروع", "قيمة العقد"],
  date: ["date", "publication date", "publication_date", "updated_at", "تاريخ", "تاريخ النشر", "تاريخ الطرح"],
} as const;

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function pickField(row: OpenDataRow, aliases: readonly string[]): unknown {
  const aliasSet = new Set(aliases.map(normalizeKey));
  for (const [key, value] of Object.entries(row)) {
    if (aliasSet.has(normalizeKey(key)) && value !== null && value !== "") return value;
  }
  return null;
}

function numericValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const normalized = value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/)?.[0];
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export interface NormalizedOpenDataRow {
  title: string | null;
  region: string | null;
  city: string | null;
  entity: string | null;
  estimatedValue: number | null;
  eventDate: string | null;
  data: OpenDataRow;
}

export function normalizeOpenDataRow(row: OpenDataRow): NormalizedOpenDataRow {
  const dateValue = pickField(row, FIELD_ALIASES.date);
  const parsedDate = dateValue ? new Date(String(dateValue)) : null;
  return {
    title: pickField(row, FIELD_ALIASES.title) != null ? String(pickField(row, FIELD_ALIASES.title)) : null,
    region: pickField(row, FIELD_ALIASES.region) != null ? String(pickField(row, FIELD_ALIASES.region)) : null,
    city: pickField(row, FIELD_ALIASES.city) != null ? String(pickField(row, FIELD_ALIASES.city)) : null,
    entity: pickField(row, FIELD_ALIASES.entity) != null ? String(pickField(row, FIELD_ALIASES.entity)) : null,
    estimatedValue: numericValue(pickField(row, FIELD_ALIASES.value)),
    eventDate: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : null,
    data: row,
  };
}
