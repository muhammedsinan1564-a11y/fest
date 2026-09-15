/**
 * Cloud sync for Festize.
 *
 * Data model in Firestore:
 *   fests / {festId}            — one document per fest, holds { id, name, nameLower, code, createdAt, mainUsers, data, updatedAt, updatedBy }
 *   index / lookup              — one document, holds { [nameLower]: festId } so login can find a fest by name
 *   index / codeLookup          — one document, holds { [CODE]: festId } so join-by-code works from any device
 *
 * The client stays authoritative locally. Every local write mirrors to Firestore.
 * Firestore's realtime listeners push remote changes back into the local DB.
 * If Firebase isn't configured, every function is a no-op and the app runs local-only.
 */
import { CLOUD_ENABLED, firebaseConfig } from "./firebase.config";
import type { Fest, Session } from "./store";
import { normalizeFestCode } from "./store";

type FbFirestore = unknown;
interface DocRef { path: string; }
interface Snap { data(): unknown; exists(): boolean; }

let _db: FbFirestore | null = null;
let _uid: string | null = null;
let _ready: Promise<void> | null = null;
let _mods: {
  doc: (db: unknown, ...path: string[]) => DocRef;
  setDoc: (r: DocRef, v: unknown, o?: unknown) => Promise<void>;
  updateDoc: (r: DocRef, v: unknown) => Promise<void>;
  getDoc: (r: DocRef) => Promise<Snap>;
  onSnapshot: (r: DocRef, cb: (s: Snap) => void) => () => void;
  collection: (db: unknown, ...path: string[]) => unknown;
  onCollection: (q: unknown, cb: (docs: { id: string; data: unknown }[]) => void) => () => void;
  serverTimestamp: () => unknown;
} | null = null;

/** Initialise Firebase lazily. Safe to call many times. */
export function initCloud(): Promise<void> {
  if (!CLOUD_ENABLED) return Promise.resolve();
  if (_ready) return _ready;
  _ready = (async () => {
    try {
      const { initializeApp } = await import("firebase/app");
      const { getAuth, signInAnonymously, onAuthStateChanged } = await import("firebase/auth");
      const fs = await import("firebase/firestore");
      const app = initializeApp(firebaseConfig);
      const auth = getAuth(app);
      const db = fs.getFirestore(app);
      _db = db;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyFs: any = fs;
      _mods = {
        doc: (d: unknown, ...p: string[]) => (p.length === 1 ? anyFs.doc(d, p[0]) : anyFs.doc(d, p[0], p[1])) as DocRef,
        setDoc: (r, v, o) => fs.setDoc(r as never, v as never, o as never),
        updateDoc: (r, v) => fs.updateDoc(r as never, v as never),
        getDoc: (r) => fs.getDoc(r as never) as unknown as Promise<Snap>,
        onSnapshot: (r, cb) => fs.onSnapshot(r as never, (s) => cb(s as unknown as Snap)),
        collection: (d: unknown, ...p: string[]) => (p.length === 1 ? anyFs.collection(d, p[0]) : anyFs.collection(d, p[0], p[1])),
        onCollection: (q, cb) => fs.onSnapshot(q as never, (snap) => {
          const out: { id: string; data: unknown }[] = [];
          (snap as unknown as { forEach: (cb: (d: { id: string; data(): unknown }) => void) => void })
            .forEach((d) => out.push({ id: d.id, data: d.data() }));
          cb(out);
        }),
        serverTimestamp: () => fs.serverTimestamp(),
      };
      await new Promise<void>((res) => {
        const stop = onAuthStateChanged(auth, (u) => {
          const user = u as { uid: string } | null;
          if (user) { _uid = user.uid; stop(); res(); }
          else signInAnonymously(auth).catch(() => res());
        });
      });
      // eslint-disable-next-line no-console
      console.info("[festize] cloud sync ready · uid=" + _uid);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[festize] cloud sync failed to init — running local-only", e);
      _db = null;
    }
  })();
  return _ready;
}

export const cloudEnabled = () => CLOUD_ENABLED;

/** Push one fest to the cloud (idempotent). Called on every local write. */
export async function pushFest(fest: Fest, byUser: string) {
  await initCloud();
  if (!_db || !_mods) return;
  try {
    const ref = _mods.doc(_db, "fests", fest.id);
    await _mods.setDoc(ref, {
      id: fest.id,
      name: fest.name,
      nameLower: fest.name.toLowerCase(),
      code: fest.code || "",
      createdAt: fest.createdAt || null,
      mainUsers: fest.mainUsers,
      data: fest.data,
      updatedAt: _mods.serverTimestamp(),
      updatedBy: byUser,
      updatedByUid: _uid,
    });
    const idx = _mods.doc(_db, "index", "lookup");
    await _mods.setDoc(idx, { [fest.name.toLowerCase()]: fest.id }, { merge: true });
    if (fest.code) {
      const codeIdx = _mods.doc(_db, "index", "codeLookup");
      await _mods.setDoc(codeIdx, { [normalizeFestCode(fest.code)]: fest.id }, { merge: true });
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[festize] pushFest failed", e);
  }
}

/** Remove a fest from the cloud (admin delete). */
export async function deleteCloudFest(fest: Fest) {
  await initCloud();
  if (!_db || !_mods) return;
  try {
    const fs = await import("firebase/firestore");
    await fs.deleteDoc(_mods.doc(_db, "fests", fest.id) as never);
    const idx = _mods.doc(_db, "index", "lookup");
    const snap = await _mods.getDoc(idx);
    const cur = (snap.exists() ? (snap.data() as Record<string, unknown>) : {}) as Record<string, unknown>;
    delete cur[fest.name.toLowerCase()];
    await _mods.setDoc(idx, cur);
    if (fest.code) {
      const codeIdx = _mods.doc(_db, "index", "codeLookup");
      const codeSnap = await _mods.getDoc(codeIdx);
      const codeCur = (codeSnap.exists() ? (codeSnap.data() as Record<string, unknown>) : {}) as Record<string, unknown>;
      delete codeCur[normalizeFestCode(fest.code)];
      await _mods.setDoc(codeIdx, codeCur);
    }
    // tombstone so other devices prune their stale local copy on next pull
    const tomb = _mods.doc(_db, "index", "deleted");
    await _mods.setDoc(tomb, { [fest.id]: Date.now() }, { merge: true });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[festize] deleteCloudFest failed", e);
  }
}

/** One-shot pull of every fest doc (used by the admin console on login). */
export async function fetchAllFests(): Promise<Fest[]> {
  await initCloud();
  if (!_db || !_mods) return [];
  try {
    const fs = await import("firebase/firestore");
    const snap = await fs.getDocs(_mods.collection(_db, "fests") as never);
    const out: Fest[] = [];
    (snap as unknown as { forEach: (cb: (d: { data(): unknown }) => void) => void }).forEach((d) => {
      const f = d.data() as Fest;
      if (f && f.id && f.data) out.push(f);
    });
    return out;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[festize] fetchAllFests failed", e);
    return [];
  }
}

/** Ids deleted elsewhere (tombstones) so this device can prune stale local copies. */
export async function fetchDeletedFestIds(): Promise<string[]> {
  await initCloud();
  if (!_db || !_mods) return [];
  try {
    const snap = await _mods.getDoc(_mods.doc(_db, "index", "deleted"));
    if (!snap.exists()) return [];
    return Object.keys(snap.data() as Record<string, unknown>);
  } catch {
    return [];
  }
}

/** Subscribe to every fest we can see. Merges each incoming fest into the local DB. */
export function subscribeAllFests(onFest: (fest: Fest) => void): () => void {
  if (!CLOUD_ENABLED) return () => {};
  let cancel: () => void = () => {};
  initCloud().then(() => {
    if (!_db || !_mods) return;
    const col = _mods.collection(_db, "fests");
    cancel = _mods.onCollection(col, (docs) => {
      for (const d of docs) {
        const f = d.data as Fest;
        if (f && f.id && f.data) onFest(f);
      }
    });
  });
  return () => cancel();
}

/**
 * Log in from a fresh device. Looks up the fest in the cloud by name and returns it,
 * so credentials in the fest doc can be checked.
 */
export async function fetchFestByName(name: string): Promise<Fest | null> {
  await initCloud();
  if (!_db || !_mods) return null;
  try {
    const idx = _mods.doc(_db, "index", "lookup");
    const snap = await _mods.getDoc(idx);
    if (!snap.exists()) return null;
    const map = snap.data() as Record<string, string>;
    const id = map[name.toLowerCase()];
    if (!id) return null;
    const fs = await _mods.getDoc(_mods.doc(_db, "fests", id));
    return fs.exists() ? (fs.data() as Fest) : null;
  } catch {
    return null;
  }
}

/**
 * Fetch one fest directly by its ID — fallback so a fest can be
 * joined from any device, even when this device has never seen it before.
 */
export async function fetchFestById(id: string): Promise<Fest | null> {
  await initCloud();
  if (!_db || !_mods) return null;
  try {
    const snap = await _mods.getDoc(_mods.doc(_db, "fests", id));
    if (!snap.exists()) return null;
    const f = snap.data() as Fest;
    return f && f.id && f.data ? f : null;
  } catch {
    return null;
  }
}

/**
 * Fetch one fest by its join code (e.g. RIVE-20260513-K7Q2) so the
 * "have a fest?" screen works from any device.
 */
export async function fetchFestByCode(code: string): Promise<Fest | null> {
  await initCloud();
  if (!_db || !_mods) return null;
  try {
    const normalized = normalizeFestCode(code);
    if (!normalized) return null;
    const codeIdx = _mods.doc(_db, "index", "codeLookup");
    const snap = await _mods.getDoc(codeIdx);
    if (snap.exists()) {
      const map = snap.data() as Record<string, string>;
      const id = map[normalized];
      if (id) {
        const fs = await _mods.getDoc(_mods.doc(_db, "fests", id));
        if (fs.exists()) {
          const f = fs.data() as Fest;
          if (f && f.id && f.data) return f;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Convenience: are we signed in and ready? */
export const cloudUid = () => _uid;
export type SessionForCloud = Session;
