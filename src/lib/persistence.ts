import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Fest, FestData, UserRecord } from "../types";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const cloudEnabled = Boolean(url && key);
export const supabase: SupabaseClient | null = cloudEnabled ? createClient(url!, key!, {
  // Per-tab sessions let two users or two different fests stay isolated in one browser.
  auth: { storage: typeof window !== "undefined" ? window.sessionStorage : undefined, storageKey: "festize-cloud-session" },
}) : null;

const storageKey = "festize-offline-workspaces-v1";

export function loadOfflineFests(): Fest[] {
  try { return JSON.parse(localStorage.getItem(storageKey) || "[]") as Fest[]; }
  catch { return []; }
}

export function saveOfflineFests(fests: Fest[]) {
  localStorage.setItem(storageKey, JSON.stringify(fests));
}

function assertClient(): SupabaseClient {
  if (!supabase) throw new Error("Cloud is not configured. Add your Supabase project settings first.");
  return supabase;
}

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

// These addresses are identities for Supabase Auth, not mailboxes. Disable email
// confirmation for provisioned users and deploy the provision-user Edge Function.
export function userEmail(code: string, name: string) {
  const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${slug(code)}.${slug(name)}@users.festize.app`;
}

function safeUser(user: UserRecord): UserRecord { return { ...user, password: "" }; }

function safeData(data: FestData): FestData {
  return { ...data, users: data.users.map(safeUser) };
}

function rowToFest(row: Record<string, unknown>, payload: FestData | undefined): Fest {
  return {
    id: String(row.id), name: String(row.name), code: String(row.code), date: String(row.date), ownerId: String(row.owner_id),
    mainUsers: (row.main_users as UserRecord[] || []).map(safeUser), data: payload || ({} as FestData),
  };
}

export async function loginAdmin(password: string) {
  const client = assertClient();
  const email = import.meta.env.VITE_FESTIZE_ADMIN_EMAIL as string | undefined;
  if (!email) throw new Error("Set VITE_FESTIZE_ADMIN_EMAIL for your Supabase admin account.");
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  check(error);
  if (!data.user) throw new Error("Unable to sign in.");
  return data.user.id;
}

export async function getAdminFests(): Promise<Fest[]> {
  const client = assertClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) throw new Error("Please sign in again.");
  const { data: rows, error } = await client.from("fests").select("*").eq("owner_id", auth.user.id).order("created_at", { ascending: false });
  check(error);
  if (!rows?.length) return [];
  const { data: snapshots, error: snapshotError } = await client.from("fest_snapshots").select("fest_id,payload").in("fest_id", rows.map(row => row.id));
  check(snapshotError);
  return rows.map(row => rowToFest(row, snapshots?.find(snapshot => snapshot.fest_id === row.id)?.payload as FestData | undefined));
}

export async function provisionUser(festId: string, code: string, user: UserRecord, action: "create" | "update" | "revoke" = "create") {
  const client = assertClient();
  const { error } = await client.functions.invoke("provision-user", { body: {
    action, festId, code, user: { id: user.id, name: user.name, password: user.password, role: user.role, teamId: user.teamId, memberId: user.memberId },
  } });
  check(error);
}

export async function createCloudFest(fest: Fest): Promise<Fest> {
  const client = assertClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) throw new Error("Please sign in again.");
  const { error } = await client.from("fests").insert({
    id: fest.id, name: fest.name, code: fest.code, date: fest.date, owner_id: auth.user.id, main_users: fest.mainUsers.map(safeUser),
  });
  check(error);
  const { error: snapshotError } = await client.from("fest_snapshots").insert({ fest_id: fest.id, owner_id: auth.user.id, payload: safeData(fest.data) });
  check(snapshotError);
  for (const user of fest.mainUsers) await provisionUser(fest.id, fest.code, user);
  return { ...fest, ownerId: auth.user.id };
}

export async function saveCloudFest(fest: Fest, updateMetadata = false) {
  const client = assertClient();
  if (updateMetadata) {
    const { error } = await client.from("fests").update({ name: fest.name, date: fest.date, main_users: fest.mainUsers.map(safeUser) }).eq("id", fest.id);
    check(error);
  }
  const { error } = await client.from("fest_snapshots").update({ payload: safeData(fest.data), updated_at: new Date().toISOString() }).eq("fest_id", fest.id);
  check(error);
}

export async function deleteCloudFest(festId: string) {
  const client = assertClient();
  const { error } = await client.functions.invoke("provision-user", { body: { action: "deleteFest", festId } });
  check(error);
}

export async function loginFest(code: string, name: string, password: string): Promise<{ fest: Fest; user: UserRecord }> {
  const client = assertClient();
  const { data: auth, error: authError } = await client.auth.signInWithPassword({ email: userEmail(code, name), password });
  check(authError);
  if (!auth.user) throw new Error("Invalid fest code or credentials.");
  const { data: row, error } = await client.from("fests").select("*").eq("code", code).single();
  check(error);
  const { data: membership, error: memberError } = await client.from("fest_members").select("*").eq("fest_id", row.id).eq("auth_user_id", auth.user.id).single();
  check(memberError);
  const { data: snapshot, error: snapshotError } = await client.from("fest_snapshots").select("payload").eq("fest_id", row.id).single();
  check(snapshotError);
  return {
    fest: rowToFest(row, snapshot!.payload as FestData),
    user: { id: membership.id, name: membership.username, role: membership.role, password: "", teamId: membership.team_id || undefined, memberId: membership.member_id || undefined },
  };
}

export function watchFest(festId: string, onData: (data: FestData) => void) {
  if (!supabase) return () => {};
  const channel = supabase.channel(`fest-${festId}`).on("postgres_changes", {
    event: "UPDATE", schema: "public", table: "fest_snapshots", filter: `fest_id=eq.${festId}`,
  }, payload => {
    const next = payload.new as { payload?: FestData };
    if (next.payload) onData(next.payload);
  }).subscribe();
  return () => { void supabase.removeChannel(channel); };
}