import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { initCloud, cloudEnabled, pushFest, deleteCloudFest, subscribeAllFests, fetchFestByName, fetchFestById, fetchFestByCode, fetchAllFests, fetchDeletedFestIds } from "./cloud";
import { pushSharedFest, deleteSharedFest } from "./sharedCloud";

/* ============================= types ============================= */
export type Role = "MAIN" | "JUDGE" | "MEDIA" | "TEAM MANAGER" | "MONITOR" | "STAGE MANAGER" | "MEMBER";
export type Status = "NOT_STARTED" | "REPORTING" | "STARTED" | "FINISHED" | "JUDGEMENTS" | "FINALYSED" | "PUBLISHED";

export interface MainUser { name: string; password: string; }
export interface AccessUser { id: string; name: string; role: Role; password: string; teamId?: string; }
export interface Team { id: string; name: string; }
export interface Category { id: string; name: string; type: "REGULAR" | "GENERAL"; }
export interface Member {
  id: string; name: string; teamId: string; categoryId: string;
  phone?: string; place?: string; photo?: string; code: string;
}
export interface Entry { id: string; memberIds: string[]; teamId: string; color: string; }
export interface Program {
  id: string; name: string; desc: string; categoryId: string;
  maxPerTeam: number; marks: { first: number; second: number; third: number };
  venue: "STAGE" | "OFF STAGE"; kind: "INDIVIDUAL" | "GROUP"; groupSize: number;
  entries: Entry[];
  /** Which named scale converts marks to grades for this program. */
  gradeScaleId?: string;
}
export interface Grade { id: string; name: string; min: number; max: number; point: number; }
export interface GradeScale { id: string; name: string; grades: Grade[]; }
export interface Marker { id: string; x: number; y: number; icon: string; name: string; visible: boolean; }
export interface Stage { id: string; name: string; details: string; image: string; markers: Marker[]; }
export interface Activity { id: string; user: string; action: string; at: number; }
export interface ScheduleSlot { id: string; date: string; time: string; endTime: string; }
/** schedule cell = stageId + slotId -> programId */
export type Schedule = Record<string, string>;

export interface TplEl {
  id: string; kind: "text" | "image" | "shape" | "qrcode";
  bind?: string; text?: string; src?: string;
  x: number; y: number; w: number; h: number;
  font?: string; size?: number; color?: string; bold?: boolean;
  align?: "left" | "center" | "right";
  shape?: "rect" | "circle" | "heart";
  zoom?: number;
  qrColor?: string;
}
export interface Poster { id: string; name: string; w: number; h: number; bg: string; bgImage?: string; els: TplEl[]; }
export interface IdTemplate {
  w: number; h: number; bg: string; bgImage?: string; els: TplEl[];
  preset?: string;
  wMm?: number;
  hMm?: number;
  orientation?: "portrait" | "landscape";
  paper?: string;
  marginMm?: number;
  gapMm?: number;
  cropMarks?: boolean;
  teamPageBreak?: boolean;
  showQrCode?: boolean;
}

export interface FestData {
  teams: Team[]; categories: Category[]; members: Member[]; programs: Program[];
  accessUsers: AccessUser[]; grades: Grade[]; gradeScales: GradeScale[]; stages: Stage[];
  statuses: Record<string, { status: Status; history: Status[] }>;
  codeLetters: Record<string, Record<string, string>>;
  lettersDone: Record<string, boolean>;
  judgementMarks: Record<string, Record<string, number>>;
  judgementSaved: Record<string, Record<string, boolean>>;
  monitorDone: Record<string, boolean>;
  posters: Poster[]; idTemplate: IdTemplate;
  activities: Activity[];
  publicReleased: Record<string, boolean>;
  scheduleSlots: ScheduleSlot[];
  schedule: Schedule;
  /** programId -> 1-based result number, fixed in the order results were published */
  publishOrder: Record<string, number>;
  /** Selected sound effect for the judge & stage bell */
  bellToneId?: string;
}
export interface Fest { id: string; name: string; mainUsers: MainUser[]; data: FestData; isEvaluation?: boolean; code?: string; createdAt?: number; }
export interface DB { fests: Fest[]; }
export interface Session { festId: string; name: string; role: Role; memberId?: string; teamId?: string; isEvaluation?: boolean; }

/* ============================= helpers ============================= */
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);
const PASS_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
export const randPass = (n = 8) => Array.from({ length: n }, () => PASS_CHARS[Math.floor(Math.random() * PASS_CHARS.length)]).join("");
export const randCode = () => "#" + (Math.floor(Math.random() * 90) + 10) + "@" + (Math.floor(Math.random() * 900) + 100);
export function randMainName(f: Fest) {
  let n = "";
  do { n = "MAIN" + (Math.floor(Math.random() * 900) + 100); } while (f.mainUsers.some((u) => u.name === n));
  return n;
}

/* -------- fest join codes: {NAME}{DATE} + random suffix, e.g. RIVE-20260513-K7Q2 -------- */
export const normalizeFestCode = (code: string) => (code || "").trim().toUpperCase().replace(/\s+/g, "");

export function makeFestCode(name: string, ts: number = Date.now()): string {
  const clean = (name || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const prefix = (clean.slice(0, 4) || "FEST").padEnd(4, "X");
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const datePart = `${y}${m}${day}`;
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let rand = "";
  for (let i = 0; i < 4; i++) rand += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}-${datePart}-${rand}`;
}

export function ensureUniqueFestCode(db: DB, name: string, ts: number): string {
  let code = makeFestCode(name, ts);
  let guard = 0;
  while (db.fests.some((f) => f.code && normalizeFestCode(f.code) === normalizeFestCode(code)) && guard < 60) {
    code = makeFestCode(name, ts);
    guard++;
  }
  return code;
}

export const GROUP_COLORS = ["#e4572e", "#0e7c6b", "#f2a20c", "#5b8def", "#c05299", "#6fc3df", "#7fa650", "#a06cd5", "#e07a5f", "#3d84a8"];
export const groupColor = (i: number) => GROUP_COLORS[i % GROUP_COLORS.length];

export const STATUS_FLOW: Status[] = ["NOT_STARTED", "REPORTING", "STARTED", "FINISHED", "JUDGEMENTS", "FINALYSED", "PUBLISHED"];
export const STATUS_LABEL: Record<Status, string> = {
  NOT_STARTED: "Not Started", REPORTING: "Reporting", STARTED: "Started", FINISHED: "Finished",
  JUDGEMENTS: "Judgements", FINALYSED: "Finalysed", PUBLISHED: "Published",
};

export const MEMBER_FIELDS = [
  { key: "name", label: "Name" }, { key: "code", label: "Code" },
  { key: "team", label: "Team" }, { key: "category", label: "Category" },
];
export const POSTER_FIELDS = [
  { key: "program", label: "Program Name" }, { key: "category", label: "Category" },
  { key: "resultNo", label: "Result Number" },
  { key: "wName", label: "Winner Name" }, { key: "wGp", label: "Winner Grade" },
  { key: "rName", label: "Runner Name" }, { key: "rGp", label: "Runner Grade" },
  { key: "r2Name", label: "2nd Runner Name" }, { key: "r2Gp", label: "2nd Runner Grade" },
];

export function defaultGrades(): Grade[] {
  const g = (name: string, min: number, max: number, point: number): Grade => ({ id: uid(), name, min, max, point });
  return [g("A+", 91, 100, 10), g("A", 81, 90, 9), g("B", 71, 80, 8), g("C", 55, 70, 7), g("D", 41, 54, 6), g("F", 0, 40, 0)];
}
export function defaultGradeScales(): GradeScale[] {
  const strict = (name: string, min: number, max: number, point: number): Grade => ({ id: uid(), name, min, max, point });
  return [
    { id: uid(), name: "Standard (out of 10)", grades: defaultGrades() },
    { id: uid(), name: "Simple (out of 5)", grades: [
      strict("A", 80, 100, 5), strict("B", 60, 79, 4), strict("C", 40, 59, 3), strict("D", 25, 39, 2), strict("F", 0, 24, 0),
    ] },
  ];
}

export function defaultPoster(): Poster {
  return {
    id: uid(), name: "Classic Result", w: 750, h: 1000, bg: "#10231c",
    els: [
      { id: uid(), kind: "shape", shape: "rect", color: "#ffc53d", x: 0, y: 0, w: 750, h: 14 },
      { id: uid(), kind: "text", bind: "category", text: "CATEGORY", x: 60, y: 52, w: 300, h: 40, font: "Manrope", size: 20, color: "#ffc53d", bold: true, align: "left" },
      { id: uid(), kind: "text", bind: "resultNo", text: "RESULT NO. 1", x: 620, y: 52, w: 240, h: 40, font: "Manrope", size: 17, color: "#9fb3a5", bold: true, align: "right" },
      { id: uid(), kind: "text", bind: "program", text: "PROGRAM NAME", x: 375, y: 110, w: 630, h: 80, font: "Bebas Neue", size: 62, color: "#f2f4ec", bold: false, align: "center" },
      { id: uid(), kind: "shape", shape: "rect", color: "#ffc53d", x: 295, y: 200, w: 160, h: 5 },
      { id: uid(), kind: "text", text: "WINNER", x: 375, y: 268, w: 300, h: 30, font: "Manrope", size: 17, color: "#9fb3a5", bold: true, align: "center" },
      { id: uid(), kind: "text", bind: "wName", text: "Winner Name", x: 375, y: 306, w: 630, h: 60, font: "Unbounded", size: 34, color: "#ffc53d", bold: true, align: "center" },
      { id: uid(), kind: "text", bind: "wGp", text: "A+", x: 375, y: 376, w: 300, h: 36, font: "Manrope", size: 22, color: "#f2f4ec", bold: true, align: "center" },
      { id: uid(), kind: "text", text: "RUNNER UP", x: 375, y: 486, w: 300, h: 26, font: "Manrope", size: 15, color: "#9fb3a5", bold: true, align: "center" },
      { id: uid(), kind: "text", bind: "rName", text: "Runner Name", x: 375, y: 520, w: 630, h: 46, font: "Unbounded", size: 25, color: "#f2f4ec", bold: false, align: "center" },
      { id: uid(), kind: "text", bind: "rGp", text: "A", x: 375, y: 576, w: 300, h: 30, font: "Manrope", size: 19, color: "#c9d4c9", bold: true, align: "center" },
      { id: uid(), kind: "text", text: "SECOND RUNNER UP", x: 375, y: 666, w: 340, h: 26, font: "Manrope", size: 15, color: "#9fb3a5", bold: true, align: "center" },
      { id: uid(), kind: "text", bind: "r2Name", text: "2nd Runner Name", x: 375, y: 700, w: 630, h: 44, font: "Unbounded", size: 23, color: "#f2f4ec", bold: false, align: "center" },
      { id: uid(), kind: "text", bind: "r2Gp", text: "B", x: 375, y: 754, w: 300, h: 30, font: "Manrope", size: 19, color: "#c9d4c9", bold: true, align: "center" },
      { id: uid(), kind: "text", text: "FESTIZE", x: 375, y: 910, w: 300, h: 34, font: "Bebas Neue", size: 30, color: "#5d7263", bold: false, align: "center" },
    ],
  };
}

export function defaultIdTemplate(): IdTemplate {
  return {
    preset: "75x105",
    wMm: 75,
    hMm: 105,
    w: 600,
    h: 840,
    orientation: "portrait",
    paper: "a4_p",
    marginMm: 10,
    gapMm: 4,
    cropMarks: true,
    teamPageBreak: false,
    showQrCode: true,
    bg: "#ffffff",
    els: [
      { id: uid(), kind: "shape", shape: "rect", color: "#0e7c6b", x: 0, y: 0, w: 600, h: 140 },
      { id: uid(), kind: "text", text: "EVENT BADGE", x: 30, y: 40, w: 540, h: 60, font: "Unbounded", size: 36, color: "#ffffff", bold: true, align: "center" },
      { id: uid(), kind: "image", bind: "dp", src: "", shape: "circle", x: 190, y: 170, w: 220, h: 220, zoom: 1 },
      { id: uid(), kind: "text", bind: "name", text: "Member Name", x: 30, y: 415, w: 540, h: 50, font: "Unbounded", size: 28, color: "#17211b", bold: true, align: "center" },
      { id: uid(), kind: "text", bind: "code", text: "#00@000", x: 30, y: 475, w: 540, h: 40, font: "Manrope", size: 22, color: "#d94f27", bold: true, align: "center" },
      { id: uid(), kind: "text", bind: "team", text: "Team Name", x: 30, y: 525, w: 540, h: 36, font: "Manrope", size: 20, color: "#40503f", align: "center" },
      { id: uid(), kind: "text", bind: "category", text: "Category", x: 30, y: 565, w: 540, h: 36, font: "Manrope", size: 18, color: "#777777", align: "center" },
      { id: uid(), kind: "qrcode", bind: "qrcode", x: 235, y: 615, w: 130, h: 130, color: "#000000" },
      { id: uid(), kind: "shape", shape: "rect", color: "#0e7c6b", x: 0, y: 810, w: 600, h: 30 },
    ],
  };
}

export function newFestData(): FestData {
  return {
    teams: [], categories: [], members: [], programs: [], accessUsers: [],
    grades: defaultGrades(), gradeScales: defaultGradeScales(), stages: [], statuses: {}, codeLetters: {}, lettersDone: {},
    judgementMarks: {}, judgementSaved: {}, monitorDone: {},
    posters: [defaultPoster()], idTemplate: defaultIdTemplate(), activities: [],
    publicReleased: {}, scheduleSlots: [], schedule: {}, publishOrder: {},
  };
}

/* -------- status pipeline -------- */
export const st = (d: FestData, pid: string): Status => d.statuses[pid]?.status || "NOT_STARTED";
export function setStatus(d: FestData, pid: string, s: Status) {
  const cur = st(d, pid);
  if (cur === s) return;
  d.statuses[pid] = { status: s, history: [...(d.statuses[pid]?.history || []), cur] };
  if (!d.publishOrder) d.publishOrder = {};
  // the first time a program reaches PUBLISHED it takes the next result number and keeps it
  if (s === "PUBLISHED" && d.publishOrder[pid] === undefined) {
    const used = Object.values(d.publishOrder);
    d.publishOrder[pid] = (used.length ? Math.max(...used) : 0) + 1;
  }
}
export function undoStatus(d: FestData, pid: string): Status | null {
  const rec = d.statuses[pid];
  if (!rec || rec.history.length === 0) { if (rec && rec.status !== "NOT_STARTED") { rec.status = "NOT_STARTED"; return "NOT_STARTED"; } return null; }
  const prev = rec.history[rec.history.length - 1];
  rec.history = rec.history.slice(0, -1);
  rec.status = prev;
  return prev;
}
export function log(d: FestData, user: string, action: string) {
  d.activities.unshift({ id: uid(), user, action, at: Date.now() });
  d.activities = d.activities.slice(0, 250);
}

/* -------- grades -------- */
export function gradeFor(mark: number, grades: Grade[]): Grade | undefined {
  return grades.find((g) => mark >= g.min && mark <= g.max);
}
export const pointLabel = (g?: Grade) => (g ? (g.point > 0 ? String(g.point) : "NO GRADE") : "—");
export const gpOf = (mark: number | undefined, grades: Grade[]) => (mark === undefined ? 0 : gradeFor(mark, grades)?.point || 0);

/** Evaluation plan limits (when exploring platform in preview mode) */
export const EVALUATION_LIMITS = {
  teams: 2,
  categories: 3,
  members: 20,
  programs: 5,
  accessUsers: 5,
} as const;

export function checkLimit(isEval: boolean | undefined, currentCount: number, maxAllowed: number, entityLabel: string): string | null {
  if (!isEval) return null;
  if (currentCount >= maxAllowed) {
    return `Evaluation plan limit reached: maximum ${maxAllowed} ${entityLabel} allowed in Explore/Demo mode.`;
  }
  return null;
}

/**
 * Pick the grade table a program should be judged against.
 * Priority: the program's chosen scale → the first available scale → the legacy flat `grades` list.
 */
export function scaleFor(d: FestData, p?: Program): Grade[] {
  if (p?.gradeScaleId) {
    const s = d.gradeScales?.find((x) => x.id === p.gradeScaleId);
    if (s) return s.grades;
  }
  if (d.gradeScales?.length) return d.gradeScales[0].grades;
  return d.grades || [];
}
export const scaleNameOf = (d: FestData, p?: Program) =>
  d.gradeScales?.find((x) => x.id === p?.gradeScaleId)?.name || d.gradeScales?.[0]?.name || "Standard";

/* -------- program results -------- */
export function entryLabel(d: FestData, e: Entry, p?: Program): string {
  const team = d.teams.find((t) => t.id === e.teamId);
  const first = d.members.find((mm) => mm.id === e.memberIds[0]);
  // a group is shown by one of its members plus the team it belongs to
  if ((p && p.kind === "GROUP") || e.memberIds.length > 1) {
    if (first) return `${first.name}${team ? " · " + team.name : ""}`;
    return team ? team.name : "Group";
  }
  return first ? first.name : "?";
}
/** 1-based number of a result, in the order the programs were published */
export function resultNo(d: FestData, pid: string): number | null {
  const n = d.publishOrder?.[pid];
  return typeof n === "number" ? n : null;
}
export interface ResultRow { e: Entry; label: string; color: string; mark?: number; grade?: Grade; gp: number; letter?: string; members: Member[]; }
export function programResults(d: FestData, p: Program): ResultRow[] {
  const marks = d.judgementMarks[p.id] || {};
  const letters = d.codeLetters[p.id] || {};
  const scale = scaleFor(d, p);
  return p.entries
    .map((e) => {
      const mark = marks[e.id];
      const grade = mark === undefined ? undefined : gradeFor(mark, scale);
      return {
        e, label: entryLabel(d, e, p), color: e.color, mark, grade,
        gp: grade ? grade.point : 0, letter: letters[e.id],
        members: e.memberIds.map((id) => d.members.find((m) => m.id === id)).filter(Boolean) as Member[],
      };
    })
    .sort((a, b) => (b.mark ?? -1) - (a.mark ?? -1));
}
export function teamScores(d: FestData, onlyPublic = false) {
  const map: Record<string, { gp: number; gold: number; silver: number; bronze: number; count: number }> = {};
  for (const t of d.teams) map[t.id] = { gp: 0, gold: 0, silver: 0, bronze: 0, count: 0 };
  for (const p of d.programs) {
    if (st(d, p.id) !== "PUBLISHED") continue;
    if (onlyPublic && !d.publicReleased[p.id]) continue;
    programResults(d, p).forEach((r, i) => {
      const s = map[r.e.teamId];
      if (!s) return;
      s.gp += r.gp; s.count++;
      if (i === 0) s.gold++; else if (i === 1) s.silver++; else if (i === 2) s.bronze++;
    });
  }
  return map;
}
/** per-team, per-category total grade points (from published programs) */
export function teamCategoryScores(d: FestData, onlyPublic = false) {
  const map: Record<string, Record<string, number>> = {};
  for (const t of d.teams) { map[t.id] = {}; for (const c of d.categories) map[t.id][c.id] = 0; }
  for (const p of d.programs) {
    if (st(d, p.id) !== "PUBLISHED") continue;
    if (onlyPublic && !d.publicReleased[p.id]) continue;
    for (const r of programResults(d, p)) {
      if (map[r.e.teamId] && r.e.teamId) map[r.e.teamId][p.categoryId] = (map[r.e.teamId][p.categoryId] || 0) + r.gp;
    }
  }
  return map;
}
export function memberCountOfTeam(d: FestData, teamId: string) {
  return d.members.filter((m) => m.teamId === teamId).length;
}

/* ============================= store ============================= */
/**
 * ONE APP, FOREVER.
 * These keys are permanent. They must never be renamed or version-bumped again —
 * that is what keeps every future update the *same* app, so a fest created today is
 * still there after any number of releases.
 */
const DB_KEY = "festize.db.v1";
const SES_KEY = "festize.session.v1";
const THEME_KEY = "festize.theme";
const RELEASE_KEY = "festize.release";

/**
 * The published release starts from a completely clean slate: no fests, no members,
 * no results, no templates, no sessions. This runs ONCE — the first time this release
 * is opened on a device — and then never again, so updates do not erase real fest data.
 * Keep this string as it is for every future update.
 */
const RELEASE_ID = "festize-public-1";

function cleanSlateOnce() {
  try {
    if (localStorage.getItem(RELEASE_KEY) === RELEASE_ID) return;
    // remove every key this app has ever written, then stamp the release
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith("festize.")) localStorage.removeItem(k);
    }
    try { sessionStorage.clear(); } catch { /* ignore */ }
    localStorage.setItem(RELEASE_KEY, RELEASE_ID);
  } catch { /* storage unavailable — nothing to clean */ }
}
cleanSlateOnce();
/** live channel so every open session sees a change the instant it happens */
const bc: BroadcastChannel | null = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("festize.sync") : null;

/** bring any saved DB up to the current shape */
function migrate(db: DB): DB {
  const usedCodes = new Set((db.fests || []).map((f) => (f.code ? normalizeFestCode(f.code) : "")).filter(Boolean));
  for (const f of db.fests || []) {
    const d = f.data as Partial<FestData>;
    if (!d.publicReleased) d.publicReleased = {};
    if (!d.scheduleSlots) d.scheduleSlots = [];
    if (!d.schedule) d.schedule = {};
    if (!d.publishOrder) d.publishOrder = {};
    if (!d.gradeScales) {
      const scale: GradeScale = { id: uid(), name: "Standard", grades: (d.grades && d.grades.length ? d.grades : defaultGrades()) };
      d.gradeScales = [scale, ...defaultGradeScales().slice(1)];
    }
    for (const s of d.stages || []) if (typeof (s as Partial<Stage>).details !== "string") (s as Stage).details = "";
    for (const s of d.scheduleSlots) if (typeof s.endTime !== "string") s.endTime = s.time;
    // every fest needs a join code: {NAME}{DATE}-XXXX
    if (typeof f.createdAt !== "number") f.createdAt = Date.now();
    if (!f.code) {
      let code = makeFestCode(f.name || "FEST", f.createdAt);
      let guard = 0;
      while (usedCodes.has(normalizeFestCode(code)) && guard < 60) {
        code = makeFestCode(f.name || "FEST", f.createdAt);
        guard++;
      }
      f.code = code;
      usedCodes.add(normalizeFestCode(code));
    }
  }
  return db;
}
function loadDb(): DB {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch { /* ignore */ }
  return { fests: [] };
}
function loadSession(): Session | null {
  try { const raw = localStorage.getItem(SES_KEY); if (raw) return JSON.parse(raw); } catch { /* ignore */ }
  return null;
}

interface StoreCtx {
  db: DB;
  session: Session | null;
  theme: string;
  setTheme: (t: string) => void;
  updateDb: (fn: (db: DB) => void) => void;
  updateFest: (fid: string, fn: (d: FestData) => void) => void;
  login: (s: Session) => void;
  logout: () => void;
  fest: Fest | null;
  data: FestData | null;
  /** Cloud is on when Firebase config has been filled in. Home uses this to prompt "logging in…". */
  cloudReady: boolean;
  /** Pull a fest we don't have locally (fresh device) by its name, so login works from anywhere. */
  fetchFestByName: (name: string) => Promise<Fest | null>;
  /** Pull a fest directly by ID — fallback so any device can join that fest. */
  fetchFestById: (id: string) => Promise<Fest | null>;
  /** Pull a fest by its join code — used by the "have a fest?" screen on any device. */
  fetchFestByCode: (code: string) => Promise<Fest | null>;
  /** One-shot pull of every fest (admin console refresh). */
  fetchAllFests: () => Promise<Fest[]>;
  /** Ids deleted elsewhere, so this device can prune stale local copies. */
  fetchDeletedFestIds: () => Promise<string[]>;
}
const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<DB>(loadDb);
  const [session, setSession] = useState<Session | null>(loadSession);
  const [theme, setThemeState] = useState<string>(() => localStorage.getItem(THEME_KEY) || "dark");

  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem(THEME_KEY, theme); }, [theme]);

  /** write straight to storage + notify every other tab / user session on this device */
  const persist = useCallback((next: DB) => {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(next));
      bc?.postMessage("sync");
    } catch {
      // Data must never vanish silently — make a failed save loud and obvious.
      // eslint-disable-next-line no-alert
      window.alert(
        "Festize could not save to this device's storage — it may be full.\n\n" +
        "Your latest change is only in this window. Free up space (or remove an old fest) and repeat the change so it is stored permanently.",
      );
    }
    return next;
  }, []);

  // pull other sessions' changes in — storage events fire in other tabs,
  // BroadcastChannel covers same-tab-different-window and is instant
  useEffect(() => {
    const pull = () => setDb(loadDb());
    const h = (e: StorageEvent) => { if (e.key === DB_KEY && e.newValue) pull(); };
    window.addEventListener("storage", h);
    const onMsg = () => pull();
    bc?.addEventListener("message", onMsg);
    // safety net: re-read when the tab regains focus, so nothing is ever stale
    window.addEventListener("focus", pull);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) pull(); });
    return () => {
      window.removeEventListener("storage", h);
      bc?.removeEventListener("message", onMsg);
      window.removeEventListener("focus", pull);
    };
  }, []);

  // Cloud subscription: mirror every fest coming from Firestore into local state (and disk).
  useEffect(() => {
    if (!cloudEnabled()) return;
    initCloud();
    const off = subscribeAllFests((remote) => {
      const fresh = loadDb();
      const idx = fresh.fests.findIndex((f) => f.id === remote.id);
      // Only accept the remote copy when it is different — avoids echo loops.
      const local = idx >= 0 ? fresh.fests[idx] : null;
      if (local && JSON.stringify(local) === JSON.stringify(remote)) return;
      const next: DB = { ...fresh, fests: idx >= 0
        ? fresh.fests.map((f, i) => (i === idx ? remote : f))
        : [...fresh.fests, remote] };
      persist(next);
      setDb(next);
    });
    return () => off();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (session) localStorage.setItem(SES_KEY, JSON.stringify(session));
    else localStorage.removeItem(SES_KEY);
  }, [session]);

  // Both writers read the freshest copy from disk first, so a change made by
  // another logged-in user is merged in rather than overwritten. The work is done
  // outside setDb so it can never be run twice by StrictMode.
  const updateDb = useCallback((fn: (db: DB) => void) => {
    const before = loadDb();
    const next = loadDb();
    fn(next);
    persist(next);
    setDb(next);
    // cloud sync: push every fest whose bytes actually changed, and delete removed fests
    for (const f of next.fests) {
      const prev = before.fests.find((x) => x.id === f.id);
      if (!prev || JSON.stringify(prev) !== JSON.stringify(f)) {
        pushFest(f, session?.name || "system");
        pushSharedFest(f); // zero-config shared cloud (skips evaluation fests internally)
      }
    }
    for (const f of before.fests) {
      if (!next.fests.some((x) => x.id === f.id)) {
        deleteCloudFest(f);
        void deleteSharedFest(f);
      }
    }
  }, [persist, session]);
  const updateFest = useCallback((fid: string, fn: (d: FestData) => void) => {
    const fresh = loadDb();
    const next: DB = {
      ...fresh,
      fests: fresh.fests.map((f) => {
        if (f.id !== fid) return f;
        const d = structuredClone(f.data);
        fn(d);
        return { ...f, data: d };
      }),
    };
    persist(next);
    setDb(next);
    const target = next.fests.find((f) => f.id === fid);
    if (target) {
      pushFest(target, session?.name || "system");
      pushSharedFest(target); // zero-config shared cloud (skips evaluation fests internally)
    }
  }, [persist, session]);
  const login = useCallback((s: Session) => setSession(s), []);
  const logout = useCallback(() => setSession(null), []);
  const setTheme = useCallback((t: string) => setThemeState(t), []);

  const fest = session ? db.fests.find((f) => f.id === session.festId) || null : null;
  const data = fest ? fest.data : null;

  return (
    <Ctx.Provider value={{ db, session, theme, setTheme, updateDb, updateFest, login, logout, fest, data, cloudReady: cloudEnabled(), fetchFestByName, fetchFestById, fetchFestByCode, fetchAllFests, fetchDeletedFestIds }}>
      {children}
    </Ctx.Provider>
  );
}
export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error("store missing");
  return c;
}
