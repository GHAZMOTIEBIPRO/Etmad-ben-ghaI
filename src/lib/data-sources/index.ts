import type { DataSourceConnector } from "@/lib/data-sources/types";
import { EtimadOpenDataConnector } from "@/lib/data-sources/etimad-open-data-connector";
import { FurasInvestmentConnector } from "@/lib/data-sources/furas-investment-connector";
import { MockDataConnector } from "@/lib/data-sources/mock-connector";
import { MuqawilProjectsConnector } from "@/lib/data-sources/muqawil-projects-connector";
import { NcpPppConnector } from "@/lib/data-sources/ncp-ppp-connector";
import { PifOpportunitiesConnector } from "@/lib/data-sources/pif-opportunities-connector";
import { SwpcFutureProjectsConnector } from "@/lib/data-sources/swpc-future-projects-connector";

function etimadConfigured(): boolean {
  return Boolean(
    process.env.ETIMAD_PUBLIC_API_URL ||
    (process.env.ETIMAD_OPEN_DATA_BASE_URL && process.env.ETIMAD_OPEN_DATA_GROUP_ID),
  );
}

export function getDataConnectors(): DataSourceConnector[] {
  const raw = process.env.DATA_SOURCES ?? process.env.DATA_SOURCE ?? "";
  const configuredKeys = raw.split(",").map((value) => value.trim()).filter(Boolean);
  const keys = [...new Set([
    "muqawil-projects",
    "ncp-ppp",
    "swpc-future-projects",
    "pif-opportunities",
    "furas-investment",
    ...configuredKeys,
  ])];
  const connectors: DataSourceConnector[] = [];

  for (const key of keys) {
    if (key === "muqawil-projects") connectors.push(new MuqawilProjectsConnector());
    if (key === "ncp-ppp") connectors.push(new NcpPppConnector());
    if (key === "swpc-future-projects") connectors.push(new SwpcFutureProjectsConnector());
    if (key === "pif-opportunities") connectors.push(new PifOpportunitiesConnector());
    if (key === "furas-investment") connectors.push(new FurasInvestmentConnector());
    if (key === "etimad-public" && etimadConfigured()) connectors.push(new EtimadOpenDataConnector());
    if (key === "mock" && process.env.ALLOW_MOCK_DATA === "true") connectors.push(new MockDataConnector());
  }

  return connectors;
}

export function getDataConnector(): DataSourceConnector {
  return getDataConnectors()[0];
}
