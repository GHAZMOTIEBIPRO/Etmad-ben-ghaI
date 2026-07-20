import type { Tender } from "@/lib/types";

export interface OpportunityFitResult {
  score: number;
  label: "ممتازة" | "جيدة جدًا" | "جيدة" | "ضعيفة";
  reasons: string[];
  breakdown: {
    geography: number;
    activity: number;
    value: number;
    timing: number;
    stage: number;
  };
}

const regionWeights: Array<[RegExp, number, string]> = [
  [/الرياض|riyadh/i, 25, "الرياض ضمن أعلى الأولويات الجغرافية"],
  [/المنطقة الشرقية|الشرقية|الدمام|الخبر|الظهران|الأحساء|eastern|dammam|khobar|dhahran|ahsa/i, 22, "المنطقة الشرقية ضمن نطاق الأولوية"],
  [/القصيم|بريدة|عنيزة|الرس|qassim|buraydah|unaizah/i, 20, "القصيم ضمن نطاق الأولوية"],
];

const highFitKeywords = [
  "مقاولات", "إنشاء", "انشاء", "بناء", "مباني", "مدني", "بنية تحتية", "طرق", "جسور", "أنفاق", "مرافق",
  "صيانة", "تشغيل", "تأهيل", "ترميم", "تشطيب", "تشطيبات", "fit-out", "fitout", "me p", "mep",
  "فندق", "ضيافة", "تجاري", "تجزئة", "retail", "industrial", "صناعي", "مستودع", "warehouse", "سكني", "فلل",
  "mixed-use", "متعدد الاستخدامات", "landscape", "تنسيق مواقع", "utilities", "construction", "infrastructure", "building",
];

const specialistHeavyKeywords = [
  "محطة تحلية", "محطة كهرباء", "خط أنابيب", "pipeline", "سد", "سكك حديدية", "railway", "nuclear", "نووي",
  "offshore", "منصة بحرية", "منشأة بتروكيماوية متخصصة",
];

function geographyScore(regionName: string): { score: number; reason: string } {
  const match = regionWeights.find(([pattern]) => pattern.test(regionName));
  if (match) return { score: match[1], reason: match[2] };
  return { score: 6, reason: "الموقع خارج مناطق الأولوية المباشرة" };
}

function activityScore(haystack: string): { score: number; reason: string } {
  const matches = highFitKeywords.filter((keyword) => haystack.includes(keyword.toLowerCase()));
  const specialist = specialistHeavyKeywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
  if (specialist && matches.length < 2) return { score: 5, reason: "النطاق تخصصي ثقيل وقد يحتاج تحالفًا أو مقاولًا متخصصًا" };
  if (matches.length >= 5) return { score: 30, reason: "تطابق قوي مع الإنشاءات والبنية التحتية والصيانة" };
  if (matches.length >= 2) return { score: 24, reason: "النشاط قريب جدًا من أعمال المقاولات المستهدفة" };
  if (matches.length === 1) return { score: 15, reason: "يوجد تطابق جزئي مع نشاط المقاولات" };
  return { score: 7, reason: "النشاط يحتاج مراجعة فنية قبل اعتباره ضمن النطاق" };
}

function valueScore(value: number | null): { score: number; reason: string } {
  if (value == null || value <= 0) return { score: 10, reason: "القيمة غير معلنة؛ لم تُحتسب كعامل ترجيح كامل" };
  if (value >= 500_000 && value <= 20_000_000) return { score: 25, reason: "القيمة ضمن النطاق التنفيذي المباشر المستهدف" };
  if (value < 500_000) return { score: 16, reason: "القيمة منخفضة نسبيًا وقد تناسب الأعمال السريعة أو المتخصصة" };
  if (value <= 35_000_000) return { score: 17, reason: "القيمة أعلى من القدرة السنوية المباشرة وقد تناسب تنفيذًا مرحليًا" };
  if (value <= 75_000_000) return { score: 9, reason: "القيمة كبيرة وقد تكون أنسب لتحالف أو مقاولة باطن" };
  return { score: 3, reason: "القيمة تتجاوز النطاق المباشر المستهدف بصورة واضحة" };
}

function timingScore(deadline: string): { score: number; reason: string } {
  if (!deadline) return { score: 4, reason: "لا يوجد موعد إغلاق موثق" };
  const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000);
  if (!Number.isFinite(days)) return { score: 3, reason: "موعد الإغلاق غير قابل للتحقق" };
  if (days < 0) return { score: 0, reason: "انتهت مهلة التقديم" };
  if (days < 4) return { score: 1, reason: "مهلة التقديم قصيرة جدًا" };
  if (days < 10) return { score: 5, reason: "مهلة التقديم محدودة" };
  return { score: 10, reason: "المهلة المتاحة تسمح بدراسة وتسعير أفضل" };
}

function stageScore(tender: Tender): { score: number; reason: string } {
  const text = `${tender.name} ${tender.description} ${tender.activityName} ${tender.sector}`.toLowerCase();
  if (tender.status === "open" || /rfp|طرح|منافس|tender|request for proposal/.test(text)) return { score: 10, reason: "الفرصة في مرحلة طرح قابلة للتحرك التجاري" };
  if (/rfq|eoi|تأهيل|طلب التأهيل|expression of interest/.test(text)) return { score: 8, reason: "الفرصة في مرحلة تأهيل مبكرة ومفيدة لتطوير الأعمال" };
  if (/تصميم|design|planning|تخطيط/.test(text)) return { score: 6, reason: "المشروع مبكر ويمكن متابعته قبل الطرح" };
  if (tender.status === "awarded" || tender.award) return { score: 2, reason: "تمت الترسية؛ القيمة الآن في فرص المقاولة الباطنة وسلسلة التوريد" };
  if (tender.status === "closed") return { score: 1, reason: "الفرصة مغلقة حاليًا" };
  return { score: 4, reason: "مرحلة المشروع غير محسومة من المصدر" };
}

export function scoreOpportunity(tender: Tender): OpportunityFitResult {
  const haystack = `${tender.name} ${tender.description} ${tender.activityName} ${tender.sector}`.toLowerCase();
  const geography = geographyScore(tender.regionName);
  const activity = activityScore(haystack);
  const value = valueScore(tender.estimatedValue);
  const timing = timingScore(tender.submissionDeadline);
  const stage = stageScore(tender);

  const breakdown = {
    geography: geography.score,
    activity: activity.score,
    value: value.score,
    timing: timing.score,
    stage: stage.score,
  };
  const score = Math.max(0, Math.min(100, Object.values(breakdown).reduce((sum, item) => sum + item, 0)));
  const label = score >= 85 ? "ممتازة" : score >= 70 ? "جيدة جدًا" : score >= 55 ? "جيدة" : "ضعيفة";

  const rankedReasons = [geography, activity, value, timing, stage]
    .sort((a, b) => b.score - a.score)
    .map((item) => item.reason);

  return { score, label, reasons: rankedReasons.slice(0, 4), breakdown };
}
