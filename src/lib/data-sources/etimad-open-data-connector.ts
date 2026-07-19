import { randomUUID } from "node:crypto";

import type { DataSourceConnector } from "@/lib/data-sources/types";
import type { Award, CompetitionStatus, Tender } from "@/lib/types";

type RawRecord = Record<string, unknown>;

const FIELD_ALIASES = {
  externalId: ["sourceExternalId", "externalId", "id", "Id", "TenderId", "CompetitionId", "معرف المنافسة"],
  competitionNumber: ["competitionNumber", "CompetitionNumber", "tenderNumber", "TenderNumber", "referenceNumber", "رقم المنافسة"],
  name: ["name", "Name", "tenderName", "TenderName", "competitionName", "CompetitionName", "اسم المنافسة"],
  description: ["description", "Description", "tenderDescription", "competitionDescription", "وصف المنافسة"],
  entity: ["governmentEntityName", "GovernmentEntityName", "entityName", "EntityName", "agencyName", "اسم الجهة", "الجهة الحكومية"],
  activity: ["activityName", "ActivityName", "activity", "Activity", "النشاط"],
  sector: ["sector", "Sector", "field", "Field", "المجال"],
  region: ["regionName", "RegionName", "region", "Region", "المنطقة"],
  publicationDate: ["publicationDate", "PublicationDate", "publishDate", "PublishDate", "تاريخ النشر"],
  submissionDeadline: ["submissionDeadline", "SubmissionDeadline", "lastSubmissionDate", "LastSubmissionDate", "آخر موعد للتقديم"],
  bidOpeningDate: ["bidOpeningDate", "BidOpeningDate", "openingDate", "OpeningDate", "تاريخ فتح العروض"],
  brochurePrice: ["brochurePrice", "BrochurePrice", "documentPrice", "DocumentPrice", "قيمة الكراسة"],
  estimatedValue: ["estimatedValue", "EstimatedValue", "tenderValue", "TenderValue", "القيمة التقديرية", "قيمة المنافسة"],
  status: ["status", "Status", "tenderStatus", "TenderStatus", "حالة المنافسة"],
  winner: ["companyName", "CompanyName", "winner", "Winner", "winnerName", "WinnerName", "supplierName", "SupplierName", "المورد الفائز", "الشركة الفائزة"],
  awardDate: ["awardDate", "AwardDate", "awardedDate", "AwardedDate", "تاريخ الترسية"],
  awardAmount: ["awardAmount", "AwardAmount", "awardedValue", "AwardedValue", "contractValue", "ContractValue", "قيمة الترسية"],
  sourceUrl: ["sourceUrl", "SourceUrl", "url", "Url", "detailsUrl", "DetailsUrl"],
  updatedAt: ["updatedAt", "UpdatedAt", "lastUpdateDate", "LastUpdateDate", "تاريخ آخر تحديث"],
} as const;

function getValue(record: RawRecord, aliases: readonly string[]): unknown {
  for (const alias of aliases) {
    const value = record[alias];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const normalized = value.replace(/[,%\s]/g, "").replace(/[^0-9.-]/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function stableHash(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function slugify(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || `item-${stableHash(value)}`;
}

function normalizeStatus(value: unknown, awarded: boolean): CompetitionStatus {
  const status = asString(value).toLowerCase();
  if (awarded || /award|ترسي|مرسا/.test(status)) return "awarded";
  if (/cancel|ملغ/.test(status)) return "cancelled";
  if (/close|انته|مغلق/.test(status)) return "closed";
  return "open";
}

function unwrapRecords(payload: unknown): RawRecord[] {
  if (Array.isArray(payload)) return payload.filter(isRecord);
  if (!isRecord(payload)) return [];

  const candidateKeys = ["File", "file", "Data", "data", "Items", "items", "Records", "records"];
  for (const key of candidateKeys) {
    const candidate = payload[key];
    if (Array.isArray(candidate)) return candidate.filter(isRecord);
    if (typeof candidate === "string") {
      const parsed = tryParseJson(candidate);
      if (parsed !== undefined) return unwrapRecords(parsed);
      const decoded = tryDecodeBase64(candidate);
      if (decoded !== undefined) return unwrapRecords(decoded);
    }
    if (isRecord(candidate)) return unwrapRecords(candidate);
  }

  return [payload];
}

function isRecord(value: unknown): value is RawRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function tryParseJson(value: string): unknown | undefined {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function tryDecodeBase64(value: string): unknown | undefined {
  try {
    const decoded = Buffer.from(value, "base64").toString("utf8");
    return tryParseJson(decoded);
  } catch {
    return undefined;
  }
}

function mapRecord(record: RawRecord): Tender | null {
  const competitionNumber = asString(getValue(record, FIELD_ALIASES.competitionNumber));
  const name = asString(getValue(record, FIELD_ALIASES.name));
  if (!competitionNumber && !name) return null;

  const sourceExternalId = asString(getValue(record, FIELD_ALIASES.externalId)) || competitionNumber || stableHash(name);
  const entityName = asString(getValue(record, FIELD_ALIASES.entity)) || "غير محدد";
  const activityName = asString(getValue(record, FIELD_ALIASES.activity)) || "غير محدد";
  const sector = asString(getValue(record, FIELD_ALIASES.sector)) || activityName;
  const regionName = asString(getValue(record, FIELD_ALIASES.region)) || "غير محدد";
  const winnerName = asString(getValue(record, FIELD_ALIASES.winner));
  const awardAmount = asNumber(getValue(record, FIELD_ALIASES.awardAmount));
  const awardDate = asString(getValue(record, FIELD_ALIASES.awardDate));
  const awarded = Boolean(winnerName || awardAmount !== null || awardDate);
  const tenderId = `etimad-${stableHash(sourceExternalId)}`;
  const companySlug = winnerName ? slugify(winnerName) : "";

  const award: Award | null = awarded
    ? {
        id: `award-${stableHash(`${sourceExternalId}-${winnerName}`)}`,
        tenderId,
        companyId: winnerName ? `company-${stableHash(winnerName)}` : "company-unknown",
        companyName: winnerName || "غير معلن",
        companySlug: companySlug || "unknown",
        awardDate,
        amount: awardAmount ?? 0,
        status: "announced",
      }
    : null;

  return {
    id: tenderId,
    competitionNumber: competitionNumber || sourceExternalId,
    name: name || "منافسة بدون اسم",
    description: asString(getValue(record, FIELD_ALIASES.description)),
    governmentEntityId: `entity-${stableHash(entityName)}`,
    governmentEntityName: entityName,
    governmentEntitySlug: slugify(entityName),
    activityId: `activity-${stableHash(activityName)}`,
    activityName,
    sector,
    regionId: `region-${stableHash(regionName)}`,
    regionName,
    publicationDate: asString(getValue(record, FIELD_ALIASES.publicationDate)),
    submissionDeadline: asString(getValue(record, FIELD_ALIASES.submissionDeadline)),
    bidOpeningDate: asString(getValue(record, FIELD_ALIASES.bidOpeningDate)),
    brochurePrice: asNumber(getValue(record, FIELD_ALIASES.brochurePrice)),
    estimatedValue: asNumber(getValue(record, FIELD_ALIASES.estimatedValue)),
    status: normalizeStatus(getValue(record, FIELD_ALIASES.status), awarded),
    awarded,
    award,
    sourceUrl: asString(getValue(record, FIELD_ALIASES.sourceUrl)) || undefined,
    sourceExternalId,
    updatedAt: asString(getValue(record, FIELD_ALIASES.updatedAt)) || new Date().toISOString(),
  };
}

export class EtimadOpenDataConnector implements DataSourceConnector {
  readonly key = "etimad-public";
  readonly name = "واجهة البيانات المفتوحة الرسمية لمنصة اعتماد";
  readonly isLive = true;

  async fetchTenders(since?: string): Promise<Tender[]> {
    const endpoint = this.buildEndpoint();
    const response = await fetch(endpoint, {
      headers: {
        Accept: "application/json",
        X_MOF_RqUID: randomUUID(),
      },
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Etimad Open Data API returned ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ""}`);
    }

    const payload = (await response.json()) as unknown;
    const tenders = unwrapRecords(payload).map(mapRecord).filter((item): item is Tender => item !== null);

    if (!since) return tenders;
    const sinceTime = Date.parse(since);
    if (Number.isNaN(sinceTime)) return tenders;
    return tenders.filter((tender) => {
      const updatedTime = Date.parse(tender.updatedAt);
      return Number.isNaN(updatedTime) || updatedTime >= sinceTime;
    });
  }

  private buildEndpoint(): URL {
    const legacyEndpoint = process.env.ETIMAD_PUBLIC_API_URL;
    if (legacyEndpoint) return new URL(legacyEndpoint);

    const baseUrl = process.env.ETIMAD_OPEN_DATA_BASE_URL;
    const groupId = process.env.ETIMAD_OPEN_DATA_GROUP_ID;
    const fileFormat = process.env.ETIMAD_OPEN_DATA_FILE_FORMAT ?? "2";

    if (!baseUrl || !groupId) {
      throw new Error(
        "Etimad Open Data API is not configured. Set ETIMAD_OPEN_DATA_BASE_URL and ETIMAD_OPEN_DATA_GROUP_ID from the official Etimad API/Open Data portal.",
      );
    }

    const endpoint = new URL(`${baseUrl.replace(/\/$/, "")}/etimad/v1/opendata/${encodeURIComponent(groupId)}`);
    endpoint.searchParams.set("fileFormat", fileFormat);
    return endpoint;
  }
}
