import { EtimadOpenDataConnector } from "@/lib/data-sources/etimad-open-data-connector";
import { MockDataConnector } from "@/lib/data-sources/mock-connector";
export function getDataConnector() { return process.env.DATA_SOURCE === "etimad-public" ? new EtimadOpenDataConnector() : new MockDataConnector(); }
