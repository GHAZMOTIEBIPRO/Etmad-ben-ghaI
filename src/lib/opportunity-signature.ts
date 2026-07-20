import type { Tender } from "@/lib/types";

export interface OpportunitySignature {
  name: string;
  entity: string;
  region: string;
  reference: string;
}

const stopWords = new Set([
  "مشروع", "فرصة", "منافسة", "المنافسة", "انشاء", "إنشاء", "تشغيل", "وصيانة", "صيانة", "توريد", "تنفيذ",
  "development", "project", "opportunity", "construction", "operation", "maintenance", "supply",
]);

export function normalizeOpportunityText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(value: string): Set<string> {
  return new Set(normalizeOpportunityText(value).split(" ").filter((token) => token.length > 2 && !stopWords.has(token)));
}

function similarity(left: string, right: string): number {
  const a = tokenSet(left);
  const b = tokenSet(right);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / Math.max(a.size, b.size);
}

export function tenderSignature(tender: Tender): OpportunitySignature {
  return {
    name: tender.name,
    entity: tender.governmentEntityName,
    region: tender.regionName,
    reference: tender.competitionNumber,
  };
}

export function signaturesLikelyDuplicate(left: OpportunitySignature, right: OpportunitySignature): boolean {
  if (left.reference && right.reference && normalizeOpportunityText(left.reference) === normalizeOpportunityText(right.reference)) return true;
  const sameRegion = normalizeOpportunityText(left.region) === normalizeOpportunityText(right.region)
    || left.region === "المملكة العربية السعودية"
    || right.region === "المملكة العربية السعودية";
  const titleSimilarity = similarity(left.name, right.name);
  const entitySimilarity = similarity(left.entity, right.entity);
  return sameRegion && titleSimilarity >= 0.72 && (entitySimilarity >= 0.45 || titleSimilarity >= 0.88);
}
