import type { SupabaseClient } from "@supabase/supabase-js";
import type { SyncResult } from "@/lib/data-sources/types";
import { fetchOfficialProcurementFiles } from "@/lib/official-procurement-files";

const SOURCE_KEY = "official-procurement-files";
const SOURCE_NAME = "ملفات خطط المشتريات الرسمية المجانية";

export async function syncOfficialProcurementFiles(supabase: SupabaseClient): Promise<SyncResult> {
  const result: SyncResult = { source: SOURCE_KEY, fetched: 0, upserted: 0, skipped: 0, errors: [] };
  const startedAt = new Date().toISOString();

  const sourceUpsert = await supabase
    .from("data_sources")
    .upsert({ key: SOURCE_KEY, name: SOURCE_NAME, is_active: true }, { onConflict: "key" })
    .select("id")
    .single();

  if (sourceUpsert.error || !sourceUpsert.data) {
    result.errors.push(sourceUpsert.error?.message ?? `Could not initialize ${SOURCE_KEY}`);
    return result;
  }

  const logInsert = await supabase
    .from("sync_logs")
    .insert({ data_source_id: sourceUpsert.data.id, started_at: startedAt, status: "running" })
    .select("id")
    .single();

  if (logInsert.error || !logInsert.data) {
    result.errors.push(logInsert.error?.message ?? `Could not create sync log for ${SOURCE_KEY}`);
    return result;
  }

  try {
    const rows = await fetchOfficialProcurementFiles();
    result.fetched = rows.length;

    for (const row of rows) {
      const upsert = await supabase.from("public_datasets").upsert({
        source_key: row.sourceKey,
        external_id: row.externalId,
        title: row.title,
        description: row.description,
        organization: row.organization || null,
        category: row.category || null,
        format: row.format || null,
        dataset_url: row.datasetUrl || null,
        resource_url: row.resourceUrl || null,
        source_updated_at: row.sourceUpdatedAt,
        metadata: row.metadata,
        updated_at: new Date().toISOString(),
      }, { onConflict: "source_key,external_id" });

      if (upsert.error) result.errors.push(upsert.error.message);
      else result.upserted += 1;
    }

    result.skipped = Math.max(0, result.fetched - result.upserted);
    await supabase.from("sync_logs").update({
      status: result.errors.length ? "partial" : "success",
      completed_at: new Date().toISOString(),
      fetched_count: result.fetched,
      upserted_count: result.upserted,
      error_count: result.errors.length,
      error_message: result.errors.slice(0, 10).join("\n") || null,
    }).eq("id", logInsert.data.id);
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error));
    await supabase.from("sync_logs").update({
      status: "failed",
      completed_at: new Date().toISOString(),
      fetched_count: result.fetched,
      upserted_count: result.upserted,
      error_count: result.errors.length,
      error_message: result.errors.slice(0, 10).join("\n"),
    }).eq("id", logInsert.data.id);
  }

  return result;
}
