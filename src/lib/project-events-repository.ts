import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getProjectById } from "@/lib/project-intelligence";

export interface ProjectTimelineEvent {
  id: string;
  type: string;
  title: string;
  date: string;
  sourceUrl?: string;
}

function hasConfig(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase environment variables are not configured");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function missing(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || /does not exist|could not find the table/i.test(error.message ?? "");
}

async function fallback(id: string): Promise<ProjectTimelineEvent[]> {
  const project = await getProjectById(id);
  if (!project) return [];
  return project.opportunities.flatMap((opportunity) => {
    const rows: ProjectTimelineEvent[] = [];
    if (opportunity.publicationDate) rows.push({
      id: `${opportunity.id}-published`,
      type: opportunity.status === "open" ? "opportunity_published" : "opportunity_seen",
      title: opportunity.name,
      date: opportunity.publicationDate,
      sourceUrl: opportunity.sourceUrl,
    });
    if (opportunity.award?.awardDate) rows.push({
      id: `${opportunity.id}-award`,
      type: "award",
      title: `ترسية: ${opportunity.name}`,
      date: opportunity.award.awardDate,
      sourceUrl: opportunity.sourceUrl,
    });
    return rows;
  }).sort((a, b) => b.date.localeCompare(a.date));
}

export async function getProjectEvents(id: string): Promise<ProjectTimelineEvent[]> {
  if (!hasConfig()) return fallback(id);
  const supabase = client();
  const { data, error } = await supabase
    .from("project_events")
    .select("id,event_type,title,event_date,source_url")
    .eq("project_id", id)
    .order("event_date", { ascending: false, nullsFirst: false });
  if (missing(error)) return fallback(id);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: String(row.id),
    type: String(row.event_type),
    title: String(row.title),
    date: row.event_date ? String(row.event_date) : "",
    sourceUrl: row.source_url ? String(row.source_url) : undefined,
  }));
}
