import { NextRequest, NextResponse } from "next/server";
import { filterProjects, getProjectIntelligence, type ProjectFilters, type ProjectStage } from "@/lib/project-intelligence";

export const dynamic = "force-dynamic";

function numberParam(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const page = Math.max(1, numberParam(params.get("page")) ?? 1);
  const pageSize = Math.min(100, Math.max(1, numberParam(params.get("pageSize")) ?? 20));
  const filters: ProjectFilters = {
    q: params.get("q") || undefined,
    region: params.get("region") || undefined,
    sector: params.get("sector") || undefined,
    stage: (params.get("stage") || undefined) as ProjectStage | undefined,
    minValue: numberParam(params.get("minValue")),
    maxValue: numberParam(params.get("maxValue")),
  };

  const projects = filterProjects(await getProjectIntelligence(), filters);
  const start = (page - 1) * pageSize;

  return NextResponse.json({
    items: projects.slice(start, start + pageSize),
    page,
    pageSize,
    total: projects.length,
    totalPages: Math.max(1, Math.ceil(projects.length / pageSize)),
  });
}
