import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase as cloudClient, cloudEnabled } from "./lib/persistence";

/**
 * Optional Supabase client for cloud workspace snapshots.
 * When VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not configured,
 * `supabase` is `null` and Festize runs fully offline on localStorage.
 *
 * The client itself is created once in `lib/persistence.ts` (with per-tab
 * session storage) so auth and realtime sync share the same connection.
 */
export const supabase: SupabaseClient | null = cloudClient;

export function isCloudSyncEnabled(): boolean {
  return cloudEnabled;
}

export interface CloudSnapshotRow {
  id: string;
  created_at: string;
  label: string | null;
  payload: unknown;
}

export async function saveCloudSnapshot(
  label: string,
  payload: unknown
): Promise<void> {
  if (!supabase) {
    throw new Error("Supabase is not configured. Set VITE_SUPABASE_* env vars.");
  }
  const { error } = await supabase
    .from("festize_workspace_snapshots")
    .insert({ label, payload });
  if (error) throw error;
}

export async function loadLatestCloudSnapshot<T>(): Promise<{
  row: CloudSnapshotRow;
  payload: T;
} | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("festize_workspace_snapshots")
    .select("id, created_at, label, payload")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  if (!data || data.length === 0) return null;
  const row = data[0] as CloudSnapshotRow;
  return { row, payload: row.payload as T };
}
