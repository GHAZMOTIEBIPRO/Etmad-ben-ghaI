import type { Tender } from "@/lib/types";

export interface SyncResult {
  source: string;
  fetched: number;
  upserted: number;
  skipped: number;
  errors: string[];
}

export interface SyncBatchResult {
  startedAt: string;
  completedAt: string;
  results: SyncResult[];
  totals: {
    sources: number;
    fetched: number;
    upserted: number;
    skipped: number;
    errors: number;
  };
}

export interface DataSourceConnector {
  readonly key: string;
  readonly name: string;
  readonly isLive: boolean;
  readonly parserVersion?: string;
  fetchTenders(since?: string): Promise<Tender[]>;
}
