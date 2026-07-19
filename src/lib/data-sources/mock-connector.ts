import { tenders } from "@/lib/mock-data";
import type { DataSourceConnector } from "@/lib/data-sources/types";
export class MockDataConnector implements DataSourceConnector { readonly key = "mock"; readonly name = "بيانات تجريبية محلية"; readonly isLive = false; async fetchTenders(since?: string) { if (!since) return tenders; return tenders.filter((tender) => tender.updatedAt > since); } }
