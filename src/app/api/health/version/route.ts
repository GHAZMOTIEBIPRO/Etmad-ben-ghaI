import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const buildSha = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? "local";
  return NextResponse.json({
    service: "saudi-projects-radar",
    product: "رادار المشاريع السعودي",
    repository: "GHAZMOTIEBIPRO/Etmad-ben-ghaI",
    buildSha,
    buildShortSha: buildSha.slice(0, 7),
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
    routes: ["/market", "/projects", "/tenders", "/data", "/sources"],
    timestamp: new Date().toISOString(),
  }, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
