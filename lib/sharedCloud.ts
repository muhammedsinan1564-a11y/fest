/**
 * Shared zero-config cloud for Festize (kvdb.io bucket, no signup needed).
 *
 * Purpose: the admin's added fests must show up on ANY device at ANY time,
 * even when Firebase has not been configured. Every install of this published
 * app reads/writes the same shared bucket, so all devices converge on the
 * same fest list. Firestore (when configured) keeps working in parallel as
 * the primary robust sync; this layer guarantees cross-device visibility
 * with zero setup.
 *
 * Layout inside the bucket (values capped at 16KB, so fests are chunked):
 *   fz1v1:idx            -> { ids, codes: {CODE: id}, deleted: {id: ts}, touchedAt }
 *   fz1v1:f:{id}:meta    -> { id, name, code, createdAt, chunks, hash, updatedAt } | { deleted: true }
 *   fz1v1:f:{id}:c{i}    -> slice i of the full fest JSON
 *
 * Notes:
 * - Evaluation/demo fests are NEVER synced here (they are per-device playgrounds).
 * - Keys expire server-side after inactivity; every write and every admin visit
 *   refreshes them, and a periodic full touch keeps long-lived fests alive.
 * - All functions fail silently (offline-first) — local data always wins locally.
 */
import type { Fest } from "./store";
import { normalizeFestCode } from "./store";

const BUCKET = "GpMaczWgGhbzRDMAFriXtD";
const P = "fz1v1:";
const CHUNK = 12000;
const IDX_KEY = `${P}idx`;
const TOUCH_EVERY_MS = 14 * 24 * 3600 * 1000; // re-touch everything every 14 days

interface Idx {
  ids: string[];
  codes: Record<string, string>;
  deleted: Record<string, number>;
  touchedAt: number;
}
interface Meta {
  id: string;
  name: string;
  code: string;
  createdAt: number;
  chunks: number;
  hash: string;
  updatedAt: number;
  deleted?: boolean;
}

const api = (key: string) => `https://kvdb.io/${BUCKET}/${encodeURIComponent(key)}`;

async function kvGet(key: string): Promise<string | null> {
  try {
    const r = await fetch(api(key), { method: "GET" });
    if (!r.ok) return null;
    const t = await r.text();
    if (!t || t === "Not Found") return null;
    return t;
  } catch {
    return null;
  }
}

async function kvSet(key: string, value: string): Promise<boolean> {
  try {
    const r = await fetch(api(key), {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: value,
    });
    return r.ok;
  } catch {
    return false;
  }
}

/** FNV-1a hash — cheap change detection so we only push when bytes differ. */
export function festHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}

async function readIdx(): Promise<Idx> {
  const raw = await kvGet(IDX_KEY);
  if (raw) {
    try {
      const p = JSON.parse(raw) as Partial<Idx>;
      return {
        ids: Array.isArray(p.ids) ? p.ids : [],
        codes: p.codes && typeof p.codes === "object" ? (p.codes as Record<string, string>) : {},
        deleted: p.deleted && typeof p.deleted === "object" ? (p.deleted as Record<string, number>) : {},
        touchedAt: typeof p.touchedAt === "number" ? p.touchedAt : 0,
      };
    } catch {
      /* fall through to empty */
    }
  }
  return { ids: [], codes: {}, deleted: {}, touchedAt: 0 };
}

async function writeIdx(idx: Idx): Promise<void> {
  idx.touchedAt = Date.now();
  await kvSet(IDX_KEY, JSON.stringify(idx));
}

async function readMeta(id: string): Promise<Meta | null> {
  const raw = await kvGet(`${P}f:${id}:meta`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Meta;
  } catch {
    return null;
  }
}

async function readFestChunks(id: string, chunks: number): Promise<Fest | null> {
  try {
    const parts: string[] = [];
    for (let i = 0; i < chunks; i++) {
      const part = await kvGet(`${P}f:${id}:c${i}`);
      if (part == null) return null; // incomplete — ignore this fest for now
      parts.push(part);
    }
    const f = JSON.parse(parts.join("")) as Fest;
    return f && f.id && f.data ? f : null;
  } catch {
    return null;
  }
}

// in-memory: last hash we pushed per fest (skip redundant pushes within a session)
const pushedHash = new Map<string, string>();
// trailing debounce timers per fest so rapid edits collapse into one push
const pushTimers = new Map<string, number>();

/** Mirror one fest to the shared cloud (debounced, skips unchanged). Never throws. */
export function pushSharedFest(fest: Fest): void {
  try {
    if (!fest || !fest.id || fest.isEvaluation) return;
    if (pushTimers.has(fest.id)) window.clearTimeout(pushTimers.get(fest.id));
    pushTimers.set(
      fest.id,
      window.setTimeout(() => {
        pushTimers.delete(fest.id);
        void doPushSharedFest(fest);
      }, 1500),
    );
  } catch {
    /* offline-first: ignore */
  }
}

async function doPushSharedFest(fest: Fest): Promise<void> {
  try {
    const json = JSON.stringify(fest);
    const hash = festHash(json);
    if (pushedHash.get(fest.id) === hash) {
      const meta = await readMeta(fest.id);
      if (meta && !meta.deleted && meta.hash === hash && meta.chunks === Math.ceil(json.length / CHUNK)) return;
    }
    const chunks = Math.max(1, Math.ceil(json.length / CHUNK));
    if (chunks > 400) return; // ~4.8MB sanity cap — fest too large for the shared tier
    for (let i = 0; i < chunks; i++) {
      const ok = await kvSet(`${P}f:${fest.id}:c${i}`, json.slice(i * CHUNK, (i + 1) * CHUNK));
      if (!ok) return; // offline or quota — try again on the next write
    }
    const meta: Meta = {
      id: fest.id,
      name: fest.name,
      code: fest.code || "",
      createdAt: fest.createdAt || Date.now(),
      chunks,
      hash,
      updatedAt: Date.now(),
    };
    await kvSet(`${P}f:${fest.id}:meta`, JSON.stringify(meta));
    const idx = await readIdx();
    if (!idx.ids.includes(fest.id)) idx.ids.push(fest.id);
    if (fest.code) idx.codes[normalizeFestCode(fest.code)] = fest.id;
    delete idx.deleted[fest.id];
    await writeIdx(idx);
    pushedHash.set(fest.id, hash);
  } catch {
    /* offline-first: ignore */
  }
}

/** Remove one fest from the shared cloud (tombstone so other devices prune it). Never throws. */
export async function deleteSharedFest(fest: Fest): Promise<void> {
  try {
    if (!fest || !fest.id) return;
    pushedHash.delete(fest.id);
    const idx = await readIdx();
    idx.ids = idx.ids.filter((x) => x !== fest.id);
    if (fest.code) delete idx.codes[normalizeFestCode(fest.code)];
    idx.deleted[fest.id] = Date.now();
    await writeIdx(idx);
    await kvSet(`${P}f:${fest.id}:meta`, JSON.stringify({ deleted: true, ts: Date.now() }));
    // old chunks are left to expire naturally (meta no longer references them)
  } catch {
    /* offline-first: ignore */
  }
}

export interface SharedPull {
  fests: Fest[];
  removedIds: string[];
  indexCount: number;
}

/**
 * Pull every shared fest (skipping ones whose hash we already have).
 * Returns fresh fests plus ids tombstoned as deleted elsewhere.
 */
export async function pullSharedFests(known?: Map<string, string>): Promise<SharedPull> {
  const out: SharedPull = { fests: [], removedIds: [], indexCount: 0 };
  try {
    const idx = await readIdx();
    out.indexCount = idx.ids.length;
    out.removedIds = Object.keys(idx.deleted || {});
    for (const id of idx.ids.slice(0, 300)) {
      try {
        const meta = await readMeta(id);
        if (!meta || meta.deleted || !meta.chunks || meta.chunks < 1 || meta.chunks > 400) continue;
        if (known && known.get(id) === meta.hash) continue;
        const f = await readFestChunks(id, meta.chunks);
        if (f) out.fests.push(f);
      } catch {
        /* skip broken entries */
      }
    }
    // keep long-lived keys from expiring
    if (Date.now() - (idx.touchedAt || 0) > TOUCH_EVERY_MS) {
      await writeIdx(idx);
    }
  } catch {
    /* offline-first: ignore */
  }
  return out;
}

/** Fetch a single shared fest by its join code (for "have a fest?"). */
export async function fetchSharedFestByCode(code: string): Promise<Fest | null> {
  try {
    const normalized = normalizeFestCode(code);
    if (!normalized) return null;
    const idx = await readIdx();
    const id = idx.codes[normalized];
    if (!id) return null;
    const meta = await readMeta(id);
    if (!meta || meta.deleted || !meta.chunks || meta.chunks < 1 || meta.chunks > 400) return null;
    return await readFestChunks(id, meta.chunks);
  } catch {
    return null;
  }
}
