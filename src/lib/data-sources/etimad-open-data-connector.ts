import type { DataSourceConnector } from "@/lib/data-sources/types";
import type { Tender } from "@/lib/types";

/** Placeholder for a lawful public Etimad/open-data endpoint. No scraping or access-control bypass. */
export class EtimadOpenDataConnector implements DataSourceConnector {
  readonly key = "etimad-public"; readonly name = "مصدر اعتماد العام"; readonly isLive = true;
  async fetchTenders(since?: string): Promise<Tender[]> {
    const endpoint = process.env.ETIMAD_PUBLIC_API_URL; if (!endpoint) throw new Error("ETIMAD_PUBLIC_API_URL is not configured");
    const url = new URL(endpoint); if (since) url.searchParams.set("since", since);
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`Etimad public endpoint returned ${response.status}`);
    const payload: unknown = await response.json(); if (!Array.isArray(payload)) throw new Error("Unexpected Etimad public endpoint response shape");
    return payload as Tender[];
  }
}
