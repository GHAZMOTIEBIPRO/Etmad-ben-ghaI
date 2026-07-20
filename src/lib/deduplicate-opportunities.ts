import type { Tender } from "@/lib/types";

const stopWords = new Set([
  "مشروع", "فرصة", "منافسة", "المنافسة", "إنشاء", "تشغيل", "وصيانة", "صيانة", "توريد", "تنفيذ", "development",
  "project", "opportunity", "construction", "operation", "maintenance", "supply",
]);

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string): Set<string> {
  return new Set(normalize(value).split(" ").filter((token) => token.length > 2 && !stopWords.has(token)));
}

function similarity(left: string, right: string): number {
  const a = tokens(left);
  const b = tokens(right);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / Math.max(a.size, b.size);
}

export function areLikelyDuplicateOpportunities(left: Tender, right: Tender): boolean {
  if (left.sourceExternalId === right.sourceExternalId) return true;
  if (left.competitionNumber && right.competitionNumber && normalize(left.competitionNumber) === normalize(right.competitionNumber)) return true;

  const sameRegion = normalize(left.regionName) === normalize(right.regionName)
    || left.regionName === "المملكة العربية السعودية"
    || right.regionName === "المملكة العربية السعودية";
  const titleSimilarity = similarity(left.name, right.name);
  const entitySimilarity = similarity(left.governmentEntityName, right.governmentEntityName);

  return sameRegion && titleSimilarity >= 0.72 && (entitySimilarity >= 0.45 || titleSimilarity >= 0.88);
}

export function deduplicateOpportunities(rows: Tender[]): Tender[] {
  const unique: Tender[] = [];
  for (const row of rows) {
    const existingIndex = unique.findIndex((candidate) => areLikelyDuplicateOpportunities(candidate, row));
    if (existingIndex < 0) {
      unique.push(row);
      continue;
    }

    const existing = unique[existingIndex];
    const existingRichness = Number(Boolean(existing.submissionDeadline)) + Number(Boolean(existing.estimatedValue)) + existing.description.length / 1000;
    const incomingRichness = Number(Boolean(row.submissionDeadline)) + Number(Boolean(row.estimatedValue)) + row.description.length / 1000;
    if (incomingRichness > existingRichness) unique[existingIndex] = row;
  }
  return unique;
}
