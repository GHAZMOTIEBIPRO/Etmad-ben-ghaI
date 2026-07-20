export type SourceAccess = "live" | "public" | "registration" | "configured";

export interface SourceCatalogItem {
  name: string;
  category: string;
  access: SourceAccess;
  url: string;
  description: string;
}

export const sourceCatalog: SourceCatalogItem[] = [
  {
    name: "منصة مقاول — المشاريع",
    category: "مشاريع وفرص مقاولات",
    access: "live",
    url: "https://muqawil.org/ar/market/list",
    description: "مشاريع وفرص عمل منشورة للعامة مع تاريخ النشر والموقع والنشاط وموعد التسليم وعدد العروض الظاهر.",
  },
  {
    name: "منصة مقاول — دليل المقاولين",
    category: "شركات ومقاولون",
    access: "live",
    url: "https://muqawil.org/ar/contractors",
    description: "دليل عام للمقاولين المسجلين مع العضوية والحجم والموقع والتصنيف وبيانات الجاهزية الظاهرة.",
  },
  {
    name: "اعتماد — البيانات المفتوحة",
    category: "منافسات وترسيات حكومية",
    access: "configured",
    url: "https://portal.etimad.sa/ar-sa/services/servicedetails?ServiceGuid=0c95a1ee-22b4-4cb2-b8f0-8b5dca89f17e",
    description: "المصدر الرسمي لبيانات المنافسات المفتوحة. موصل API موجود، ويُفعّل عند توفر BASE_URL وgroupId الرسميين.",
  },
  {
    name: "اعتماد — المنافسات المستقبلية",
    category: "خط أنابيب حكومي",
    access: "public",
    url: "https://portal.etimad.sa/",
    description: "خدمة رسمية لاستعراض المنافسات المستقبلية للجهات الحكومية ومتابعة الفرص قبل الطرح.",
  },
  {
    name: "البوابة الوطنية للبيانات المفتوحة",
    category: "بيانات حكومية",
    access: "public",
    url: "https://open.data.gov.sa/",
    description: "مستودع وطني لآلاف مجموعات البيانات الحكومية القابلة لإعادة الاستخدام والتحليل.",
  },
  {
    name: "بلدي — البيانات المفتوحة وواجهات API",
    category: "رخص وإنشاءات وبلديات",
    access: "public",
    url: "https://balady.gov.sa/ar/open-data",
    description: "مصادر بيانات وخدمات بلدية قابلة للربط عند توفر الواجهة العامة المناسبة لكل مجموعة بيانات.",
  },
  {
    name: "وزارة التجارة — البيانات المفتوحة",
    category: "شركات ومؤسسات",
    access: "public",
    url: "https://mc.gov.sa/ar/OpenData/Pages/default.aspx",
    description: "بيانات وإحصاءات السجلات التجارية والشركات والمؤسسات ومؤشرات الأنشطة التجارية.",
  },
  {
    name: "المركز السعودي للأعمال — البيانات المفتوحة",
    category: "شركات وبيئة أعمال",
    access: "public",
    url: "https://business.sa/",
    description: "مصدر داعم لبيانات الأعمال والخدمات التنظيمية والبيانات المفتوحة المرتبطة بالمنشآت.",
  },
  {
    name: "PIF Private Sector Hub — Explore Opportunities",
    category: "مشاريع كبرى وسلاسل قيمة",
    access: "public",
    url: "https://www.pif.gov.sa/en/private-sector-hub/explore-opportunities/",
    description: "فرص استثمار وأعمال وسلاسل قيمة لدى منظومة صندوق الاستثمارات العامة وشركات المحفظة.",
  },
  {
    name: "PIF Contractor Program",
    category: "تأهيل المقاولين",
    access: "registration",
    url: "https://www.pif.gov.sa/en/private-sector-hub/private-sector-initiatives/contractor-program/",
    description: "مسار التأهيل المسبق والتواصل والتمويل للمقاولين لدى شركات التطوير التابعة للصندوق.",
  },
  {
    name: "PIF MUSAHAMA",
    category: "موردون ومحتوى محلي",
    access: "registration",
    url: "https://www.pif.gov.sa/en/private-sector-hub/private-sector-initiatives/musahama-program/musahama-platform/",
    description: "منصة موحدة لربط الموردين المحليين بأكثر من 150 شركة محفظة وفرص سلاسل التوريد.",
  },
  {
    name: "NHC — بوابة الفرص والمنافسات",
    category: "إسكان وتطوير عقاري",
    access: "registration",
    url: "https://www.nhc.sa/procurement-gate/",
    description: "تسجيل وتأهيل مزودي الخدمة واستقبال طلبات عروض الأسعار والمنافسات وأوامر الشراء.",
  },
  {
    name: "NEOM Suppliers",
    category: "مشاريع كبرى",
    access: "registration",
    url: "https://www.neom.com/ar-sa/our-business/suppliers",
    description: "تسجيل الموردين والتأهل لتلقي الدعوات للمناقصات وRFP/RFQ/RFI عبر شبكة الموردين.",
  },
  {
    name: "Red Sea Global — Vendor Registration",
    category: "سياحة وضيافة وإنشاءات",
    access: "registration",
    url: "https://redseaglobal.com/ar/vendor-registration/",
    description: "تسجيل اهتمام الموردين والمقاولين؛ المؤهلون يصلون إلى خط المشتريات المخطط والمنافسات حسب التصنيف.",
  },
  {
    name: "Qiddiya — Vendor Registration",
    category: "مشاريع كبرى وترفيه",
    access: "registration",
    url: "https://qiddiya.com/ar/contact/vendor/",
    description: "بوابة تسجيل اهتمام الموردين للمشاركة في مشاريع وفرص القدية.",
  },
  {
    name: "New Murabba — Vendors",
    category: "تطوير حضري ومشاريع كبرى",
    access: "registration",
    url: "https://newmurabba.com/ar/vendors/",
    description: "شبكة الموردين للمربع الجديد وفرص المشاركة في أعمال التطوير الحضري في الرياض.",
  },
  {
    name: "الهيئة الملكية لمحافظة العلا — بوابة الموردين",
    category: "مشاريع حكومية وسياحية",
    access: "registration",
    url: "https://www.rcu.gov.sa/business-in-alula/supplier-portal",
    description: "التسجيل كمورد مؤهل شرط للمشاركة في عطاءات وطلبات عروض الهيئة، مع عرض المناقصات للموردين المسجلين.",
  },
  {
    name: "أرامكو السعودية — فرص التعاقد والمقاولات",
    category: "طاقة وصناعة وصيانة",
    access: "public",
    url: "https://www.aramco.com/ar/what-we-do/suppliers/contracting-opportunities",
    description: "تعريف بمجالات فرص التعاقد ومسارات التأهيل والإدراج في قوائم العطاءات العامة للمقاولين.",
  },
  {
    name: "الشركة السعودية للكهرباء — تسجيل المقاولين والموردين",
    category: "طاقة وبنية تحتية",
    access: "registration",
    url: "https://www.se.com.sa/en/Components/Mobile/Support/FAQs/Business/Page-Components/Contractor-and-Vendor-Registration",
    description: "تسجيل المقاولين والموردين للوصول إلى بوابة مقدمي العطاءات والخدمات المتاحة للمؤهلين.",
  },
  {
    name: "مدن — بوابة الموردين",
    category: "مدن صناعية ومشاريع",
    access: "registration",
    url: "https://modon.gov.sa/ar/Eservices/Pages/suppliers.aspx",
    description: "بوابة تسجيل وإدارة الموردين والمطالبات والتعاملات المرتبطة بعقود مدن.",
  },
  {
    name: "الهيئة العامة للإحصاء — مؤشر تكاليف البناء",
    category: "تحليل سوق وتكاليف",
    access: "public",
    url: "https://www.stats.gov.sa/ar/w/cci",
    description: "مؤشر رسمي شهري لتغير تكاليف مواد البناء والعمالة وتأجير المعدات والطاقة للقطاعين السكني وغير السكني.",
  },
];

export const sourceAccessLabels: Record<SourceAccess, string> = {
  live: "متصل حيًا",
  public: "عام ومفتوح",
  registration: "يتطلب تسجيل/تأهيل",
  configured: "يتطلب إعداد رسمي",
};
