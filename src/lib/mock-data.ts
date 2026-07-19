import type { Activity, Company, GovernmentEntity, Region, Tender } from "@/lib/types";

export const regions: Region[] = [
  { id: "reg-riyadh", name: "منطقة الرياض", slug: "riyadh" },
  { id: "reg-makkah", name: "منطقة مكة المكرمة", slug: "makkah" },
  { id: "reg-madinah", name: "منطقة المدينة المنورة", slug: "madinah" },
  { id: "reg-eastern", name: "المنطقة الشرقية", slug: "eastern" },
  { id: "reg-qassim", name: "منطقة القصيم", slug: "qassim" },
];
export const activities: Activity[] = [
  { id: "act-construction", name: "المقاولات والإنشاءات", sector: "الإنشاءات", slug: "construction" },
  { id: "act-it", name: "تقنية المعلومات", sector: "التقنية", slug: "information-technology" },
  { id: "act-health", name: "التجهيزات الطبية", sector: "الصحة", slug: "medical-equipment" },
  { id: "act-operation", name: "التشغيل والصيانة", sector: "الخدمات", slug: "operations-maintenance" },
  { id: "act-consulting", name: "الخدمات الاستشارية", sector: "الخدمات المهنية", slug: "consulting" },
];
export const governmentEntities: GovernmentEntity[] = [
  { id: "gov-health", name: "وزارة الصحة", slug: "ministry-of-health" },
  { id: "gov-education", name: "وزارة التعليم", slug: "ministry-of-education" },
  { id: "gov-municipal", name: "وزارة البلديات والإسكان", slug: "municipalities-housing" },
  { id: "gov-rc", name: "الهيئة الملكية للجبيل وينبع", slug: "royal-commission-jubail-yanbu" },
  { id: "gov-sdaia", name: "الهيئة السعودية للبيانات والذكاء الاصطناعي", slug: "sdaia" },
];
export const companies: Company[] = [
  { id: "cmp-binaa", name: "شركة البناء المتقدم للمقاولات", slug: "advanced-building" },
  { id: "cmp-tech", name: "شركة الحلول الرقمية السعودية", slug: "saudi-digital-solutions" },
  { id: "cmp-med", name: "شركة الإمداد الطبي المتكامل", slug: "integrated-medical-supply" },
  { id: "cmp-ops", name: "شركة أفق التشغيل والصيانة", slug: "ofuq-operations" },
  { id: "cmp-consult", name: "مكتب الرؤية للاستشارات", slug: "alruya-consulting" },
  { id: "cmp-gulf", name: "شركة الخليج للمشاريع", slug: "gulf-projects" },
];

const rows = [
  ["t-001","4600012451","تشغيل وصيانة مرافق صحية بمنطقة الرياض","gov-health","act-operation","reg-riyadh","2026-06-02",28500000,"awarded","cmp-ops","2026-07-14",27150000],
  ["t-002","4600012398","توريد أجهزة تشخيصية للمستشفيات المرجعية","gov-health","act-health","reg-makkah","2026-05-14",18600000,"awarded","cmp-med","2026-07-02",17980000],
  ["t-003","4400009177","تطوير منصة بيانات تعليمية موحدة","gov-education","act-it","reg-riyadh","2026-04-20",13200000,"awarded","cmp-tech","2026-06-23",12850000],
  ["t-004","4300007712","إنشاء مبانٍ تعليمية نموذجية","gov-education","act-construction","reg-qassim","2026-03-07",42000000,"awarded","cmp-binaa","2026-05-28",40700000],
  ["t-005","4700001881","إعادة تأهيل الواجهات البحرية والخدمات المساندة","gov-municipal","act-construction","reg-eastern","2026-02-15",56000000,"awarded","cmp-gulf","2026-05-11",53800000],
  ["t-006","4700001915","استشارات تحسين كفاءة الإنفاق للمشاريع البلدية","gov-municipal","act-consulting","reg-riyadh","2026-06-18",4800000,"open",null,null,null],
  ["t-007","5100004110","توسعة شبكات المرافق الصناعية بمدينة ينبع","gov-rc","act-construction","reg-madinah","2025-12-09",91500000,"awarded","cmp-binaa","2026-03-09",88900000],
  ["t-008","5100004194","تشغيل وصيانة مرافق إدارية بمدينة الجبيل الصناعية","gov-rc","act-operation","reg-eastern","2026-05-29",22900000,"awarded","cmp-ops","2026-07-17",21850000],
  ["t-009","5900000834","خدمات استشارية لحوكمة الذكاء الاصطناعي","gov-sdaia","act-consulting","reg-riyadh","2026-05-03",7600000,"awarded","cmp-consult","2026-06-29",7350000],
  ["t-010","5900000879","تطوير خدمات تكامل البيانات الحكومية","gov-sdaia","act-it","reg-riyadh","2026-06-27",16500000,"open",null,null,null],
] as const;

export const tenders: Tender[] = rows.map((row) => {
  const [id, number, name, entityId, activityId, regionId, publicationDate, estimatedValue, status, companyId, awardDate, amount] = row;
  const entity = governmentEntities.find((item) => item.id === entityId)!;
  const activity = activities.find((item) => item.id === activityId)!;
  const region = regions.find((item) => item.id === regionId)!;
  const company = companyId ? companies.find((item) => item.id === companyId)! : null;
  return {
    id, competitionNumber: number, name, description: `وصف تجريبي واقعي للمنافسة: ${name}.`,
    governmentEntityId: entityId, governmentEntityName: entity.name, governmentEntitySlug: entity.slug,
    activityId, activityName: activity.name, sector: activity.sector, regionId, regionName: region.name,
    publicationDate, submissionDeadline: publicationDate, bidOpeningDate: publicationDate,
    brochurePrice: 1000, estimatedValue, status: status as Tender["status"], awarded: Boolean(company),
    award: company && awardDate && amount ? { id: `award-${id}`, tenderId: id, companyId: company.id, companyName: company.name, companySlug: company.slug, awardDate, amount, status: "final" } : null,
    sourceExternalId: `mock-${number}`, sourceUrl: "https://portal.etimad.sa/", updatedAt: "2026-07-18T12:00:00.000Z",
  };
});
