import type { DataSourceConnector } from "@/lib/data-sources/types";
import { EtimadOpenDataConnector } from "@/lib/data-sources/etimad-open-data-connector";
import { MockDataConnector } from "@/lib/data-sources/mock-connector";
import { MuqawilProjectsConnector } from "@/lib/data-sources/muqawil-projects-connector";

function etimadConfigured(): boolean {
  return Boolean(
    process.env.ETIMAD_PUBLIC_API_URL ||
    (process.env.ETIMAD_OPEN_DATA_BASE_URL && process.env.ETIMAD_OPEN_DATA_GROUP_ID),
  );
}

export function getDataConnectors(): DataSourceConnector[] {
  const raw = process.env.DATA_SOURCES ?? process.env.DATA_SOURCE ?? "muqawil-projects";
  const keys = [...new Set(raw.split(",").map((value) => value.trim()).filter(Boolean))];
  const connectors: DataSourceConnector[] = [];

  for (const key of keys) {
    if (key === "muqawil-projects") connectors.push(new MuqawilProjectsConnector());
    if (key === "etimad-public" && etimadConfigured()) connectors.push(new EtimadOpenDataConnector());
    if (key === "mock" && process.env.ALLOW_MOCK_DATA === "true") connectors.push(new MockDataConnector());
  }

  if (!connectors.length) connectors.push(new MuqawilProjectsConnector());
  return connectors;
}

export function getDataConnector(): DataSourceConnector {
  return getDataConnectors()[0];
}
