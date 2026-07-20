import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function chunkedUpsert<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  table: string,
  rows: T[],
  options: { onConflict?: string; chunkSize?: number } = {},
): Promise<number> {
  if (!rows.length) return 0;
  const chunkSize = Math.max(1, Math.min(options.chunkSize ?? 500, 2_000));
  let upserted = 0;
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    const { error } = await supabase.from(table).upsert(
      chunk,
      options.onConflict ? { onConflict: options.onConflict } : undefined,
    );
    if (error) throw error;
    upserted += chunk.length;
  }
  return upserted;
}
