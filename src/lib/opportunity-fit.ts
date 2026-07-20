import type { Tender } from "@/lib/types";

export interface OpportunityFitResult {
  score: number;
  label: "ممتازة" | "جيدة جدًا" | "جيدة" | "ضعيفة";
  reasons: string[];
}

const preferredRegions = ["الرياض", "مكة المكرمة", "المدينة المنورة", "جدة", "المنطقة الغربية"];
const strongKeywords = [
  "صيانة", "تشغيل", "fit-out", "fitout", "تشطيب", "تشطيبات", "مدني", "مباني", "فندق", "ضيافة",
  "تجاري", "تجزئة", "retail", "industrial", "صناعي", "مستودع", "warehouse", "villa", "فلل", "مختلط", "mixed-use",
];
const weakKeywords = ["محطة تحلية", "محطة كهرباء", "pipeline", "خط أنابيب", "سد", "مطار دولي", "سكك حديدية"];

export function scoreOpportunity(tender: Tender): OpportunityFitResult {
  let score = 35;
  const reasons: string[] = [];
  const haystack = `${tender.name} ${tender.description} ${tender.activityName} ${tender.sector}`.toLowerCase();

  if (preferredRegions.some((region) => tender.regionName.includes(region))) {
    score += 20;
    reasons.push("المنطقة ضمن نطاق العمل المفضل");
  }

  const strongMatches = strongKeywords.filter((keyword) => haystack.includes(keyword.toLowerCase()));
  if (strongMatches.length) {
    score += Math.min(25, 10 + strongMatches.length * 3);
    reasons.push("النشاط قريب من خبرات المقاولات والصيانة والتشطيبات");
  }

  if (weakKeywords.some((keyword) => haystack.includes(keyword.toLowerCase()))) {
    score -= 15;
    reasons.push("النطاق يبدو تخصصيًا أو ثقيلًا مقارنة بالنشاط المستهدف");
  }

  if (tender.estimatedValue != null) {
    if (tender.estimatedValue <= 20_000_000) {
      score += 15;
      reasons.push("القيمة التقديرية ضمن القدرة السنوية المستهدفة");
    } else if (tender.estimatedValue <= 35_000_000) {
      score += 5;
      reasons.push("القيمة أعلى من الهدف المباشر وقد تناسب تحالفًا أو تنفيذًا مرحليًا");
    } else {
      score -= 10;
      reasons.push("القيمة المحتملة أعلى من النطاق المستهدف مباشرة");
    }
  }

  if (tender.submissionDeadline) {
    const days = Math.ceil((new Date(tender.submissionDeadline).getTime() - Date.now()) / 86_400_000);
    if (days >= 10) {
      score += 5;
      reasons.push("وقت التقديم يسمح بدراسة أفضل");
    } else if (days >= 0 && days < 4) {
      score -= 8;
      reasons.push("مدة التقديم قصيرة");
    }
  }

  score = Math.max(0, Math.min(100, score));
  const label = score >= 85 ? "ممتازة" : score >= 70 ? "جيدة جدًا" : score >= 55 ? "جيدة" : "ضعيفة";
  return { score, label, reasons: reasons.slice(0, 3) };
}
