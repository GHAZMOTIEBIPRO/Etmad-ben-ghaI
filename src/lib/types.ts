export type CompetitionStatus = "open" | "closed" | "awarded" | "cancelled";
export interface Region { id: string; name: string; slug: string; }
export interface Activity { id: string; name: string; sector: string; slug: string; }
export interface GovernmentEntity { id: string; name: string; slug: string; }
export interface Company { id: string; name: string; slug: string; commercialRegistration?: string; }
export interface Award { id: string; tenderId: string; companyId: string; companyName: string; companySlug: string; awardDate: string; amount: number; status: "announced" | "final"; }
export interface Tender { id: string; competitionNumber: string; name: string; description: string; governmentEntityId: string; governmentEntityName: string; governmentEntitySlug: string; activityId: string; activityName: string; sector: string; regionId: string; regionName: string; publicationDate: string; submissionDeadline: string; bidOpeningDate: string; brochurePrice: number | null; estimatedValue: number | null; status: CompetitionStatus; awarded: boolean; award: Award | null; sourceUrl?: string; sourceExternalId: string; updatedAt: string; }
export interface TenderFilters { q?: string; awarded?: boolean; governmentEntity?: string; activity?: string; sector?: string; region?: string; publicationFrom?: string; publicationTo?: string; awardFrom?: string; awardTo?: string; estimatedMin?: number; estimatedMax?: number; awardMin?: number; awardMax?: number; status?: CompetitionStatus; winner?: string; sort?: TenderSortField; order?: "asc" | "desc"; page?: number; pageSize?: number; }
export type TenderSortField = "publicationDate" | "awardDate" | "awardAmount" | "estimatedValue" | "name";
export interface PaginatedTenders { items: Tender[]; page: number; pageSize: number; total: number; totalPages: number; }
export interface DashboardStats { totalTenders: number; totalAwards: number; totalAwardValue: number; totalGovernmentEntities: number; totalWinningCompanies: number; }
export interface CompanyProfile { company: Company; appearances: number; wins: number; losses: number; winRate: number; totalAwardValue: number; averageAwardValue: number; largestAward: number; smallestAward: number; tenders: Tender[]; }
export interface AnalyticsBucket { label: string; count: number; value: number; }
export interface AnalyticsData { topCompaniesByWins: AnalyticsBucket[]; topCompaniesByValue: AnalyticsBucket[]; topEntitiesByTenders: AnalyticsBucket[]; topEntitiesByAwardValue: AnalyticsBucket[]; awardsByRegion: AnalyticsBucket[]; awardsByActivity: AnalyticsBucket[]; awardsByMonth: AnalyticsBucket[]; }
