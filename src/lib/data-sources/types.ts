import type { Tender } from "@/lib/types";
export interface SyncResult { source: string; fetched: number; upserted: number; skipped: number; errors: string[]; }
export interface DataSourceConnector { readonly key: string; readonly name: string; readonly isLive: boolean; fetchTenders(since?: string): Promise<Tender[]>; }
