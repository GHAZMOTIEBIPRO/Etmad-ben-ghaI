export type MarketPlatformIngestion = "connected" | "public-monitor" | "agreement-required" | "signal-only";

export interface MarketPlatform {
  name: string;
  scope: string;
  ingestion: MarketPlatformIngestion;
  ingestionLabel: string;
  url: string;
  note: string;
}

export const marketPlatforms: MarketPlatform[] = [
  {
    name: "Buyzo",
    scope: "مناقصات القطاع الخاص السعودي",
    ingestion: "public-monitor",
    ingestionLabel: "رصد الصفحة العامة",
    url: "https://www.buyzo.sa/",
    note: "منصة سعودية لإدارة المناقصات التجارية وربط الشركات بالموردين. يمكن مراقبة المنافسات التي تظهر للعامة، لكن لا توجد واجهة API عامة موثقة لدينا حاليًا، ولا يتم تجاوز التسجيل للوصول إلى البيانات المقيدة.",
  },
  {
    name: "فرص — الاستثمار البلدي",
    scope: "فرص استثمارية ومواقع بلدية",
    ingestion: "public-monitor",
    ingestionLabel: "قابل للرصد العام",
    url: "https://furas.momah.gov.sa/",
    note: "قاعدة موحدة للفرص الاستثمارية البلدية. ليست بديلًا عن مناقصات المقاولات، لكنها إشارة مبكرة لمشروعات ومواقع قد تولد أعمال تطوير وإنشاء وتشغيل لاحقًا.",
  },
  {
    name: "TendersInfo Gulf",
    scope: "تجميع مناقصات خليجية وسعودية",
    ingestion: "agreement-required",
    ingestionLabel: "يتطلب اتفاقية/اشتراك",
    url: "https://www.tendersinfogulf.com/",
    note: "قاعدة تجارية تجمع مناقصات من دول الخليج وتقدم مستندات ونتائج تاريخية. لا يتم نسخ أو سحب المحتوى المدفوع تلقائيًا دون ترخيص أو تكامل رسمي.",
  },
  {
    name: "مشاريع السعودية",
    scope: "أخبار ومتابعة المشاريع التنموية",
    ingestion: "signal-only",
    ingestionLabel: "إشارة سوقية",
    url: "https://saudiprojects.sa/",
    note: "مفيد لرصد تطورات المشاريع والإعلانات والمراحل التنفيذية، لكنه مصدر ذكاء مشاريع أكثر من كونه منصة طرح مناقصات. يستخدم كإشارة مبكرة للتحقق من مصادر الجهة المالكة.",
  },
];
