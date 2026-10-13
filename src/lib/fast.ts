/**
 * FAST — Fest Management System core engine.
 * ============================================================
 * This module holds the PURE business logic for:
 *   1. Advanced Schedule (live status, conflicts, bookmarks, reminders)
 *   2. Multi-Judge Scoring Engine (N judges, average + Olympic trimmed mean)
 *
 * Design rules:
 * - No UI here. No admin forms. Only deterministic functions.
 * - Every function is unit-testable and safe to reuse on a Node.js
 *   backend, a Supabase Edge Function, or the browser.
 * - Judge isolation is enforced by NEVER returning other judges'
 *   raw marks to a judge client — only counts and their own input.
 */

import type { FestData, Program, ProgramEntry, ScheduleCell, ScheduleSlot } from "../types";

// ---------------------------------------------------------------------------
// 1. SCHEDULE — time helpers
// ---------------------------------------------------------------------------

/** "2026-10-10" + "10:30" -> epoch ms (local time). */
export function slotStartMs(slot: ScheduleSlot): number {
  return new Date(`${slot.date}T${slot.start}:00`).getTime();
}

export function slotEndMs(slot: ScheduleSlot): number {
  return new Date(`${slot.date}T${slot.end}:00`).getTime();
}

/** Extra delay (minutes) applied to one placement, e.g. stage running late. */
export function cellStartMs(cell: ScheduleCell, slots: ScheduleSlot[]): number {
  const slot = slots.find(s => s.id === cell.slotId);
  if (!slot) return 0;
  return slotStartMs(slot) + (cell.delayMinutes ?? 0) * 60_000;
}

export function cellEndMs(cell: ScheduleCell, slots: ScheduleSlot[]): number {
  const slot = slots.find(s => s.id === cell.slotId);
  if (!slot) return 0;
  return slotEndMs(slot) + (cell.delayMinutes ?? 0) * 60_000;
}

export type LiveState = "live" | "upcoming" | "completed";

/**
 * Visual status for a scheduled placement.
 * - live: now is inside [start, end)  -> pulsing "Live Now"
 * - upcoming: now is before start
 * - completed: now is past end OR the program workflow finished (status >= 2)
 */
export function liveStateForCell(
  cell: ScheduleCell,
  slots: ScheduleSlot[],
  programs: Program[],
  now = Date.now(),
): LiveState {
  const program = programs.find(p => p.id === cell.programId);
  if (program && program.status >= 2) return "completed";
  const start = cellStartMs(cell, slots);
  const end = cellEndMs(cell, slots);
  if (!start || !end) return "upcoming";
  if (now >= start && now < end) return "live";
  if (now >= end) return "completed";
  return "upcoming";
}

/** All placements happening at the same instant (concurrent tracking). */
export function concurrentCells(
  cells: ScheduleCell[],
  slots: ScheduleSlot[],
  at = Date.now(),
): ScheduleCell[] {
  return cells.filter(cell => {
    const start = cellStartMs(cell, slots);
    const end = cellEndMs(cell, slots);
    return start > 0 && at >= start && at < end;
  });
}

function intervalsOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

// ---------------------------------------------------------------------------
// 2. SCHEDULE — conflict detection
// ---------------------------------------------------------------------------

export interface ScheduleConflict {
  kind: "participant" | "judge" | "stage";
  /** Human-readable explanation, e.g. "Aarav Menon in Solo Song + Group Dance". */
  message: string;
  memberId?: string;
  judgeId?: string;
  programAId: string;
  programBId: string;
  stageAId: string;
  stageBId: string;
  date: string;
}

/**
 * Detects every double-booking across the whole grid:
 *  - same participant in two overlapping placements (any stage)
 *  - same judge in two overlapping placements (any stage)
 *  - two overlapping placements on the SAME stage
 *
 * Runs in O(C^2) where C = placements. Fine for fest scale (<500 cells).
 * The UI calls this on every edit AND on load, so conflicts surface instantly.
 */
export function detectScheduleConflicts(data: FestData): ScheduleConflict[] {
  const { schedule, slots, programs } = data;
  const conflicts: ScheduleConflict[] = [];
  const memberName = (id: string) => data.members.find(m => m.id === id)?.name ?? "Participant";
  const judgeName = (id: string) =>
    id === "main" ? "Main user" : data.users.find(u => u.id === id)?.name ?? "Judge";
  const programName = (id: string) => programs.find(p => p.id === id)?.name ?? "Program";

  for (let a = 0; a < schedule.length; a++) {
    for (let b = a + 1; b < schedule.length; b++) {
      const left = schedule[a];
      const right = schedule[b];
      if (left.programId === right.programId) continue; // same program, ignore
      const slotA = slots.find(s => s.id === left.slotId);
      const slotB = slots.find(s => s.id === right.slotId);
      if (!slotA || !slotB || slotA.date !== slotB.date) continue;
      const aStart = cellStartMs(left, slots);
      const aEnd = cellEndMs(left, slots);
      const bStart = cellStartMs(right, slots);
      const bEnd = cellEndMs(right, slots);
      if (!intervalsOverlap(aStart, aEnd, bStart, bEnd)) continue;

      const progA = programs.find(p => p.id === left.programId);
      const progB = programs.find(p => p.id === right.programId);
      if (!progA || !progB) continue;

      // 2a. Same stage, overlapping time -> impossible.
      if (left.stageId === right.stageId) {
        conflicts.push({
          kind: "stage",
          message: `Stage clash: "${programName(left.programId)}" overlaps "${programName(right.programId)}" on the same stage.`,
          programAId: left.programId, programBId: right.programId,
          stageAId: left.stageId, stageBId: right.stageId, date: slotA.date,
        });
      }

      // 2b. Participant in two places at once (works across different stages).
      const membersA = new Set(progA.entries.flatMap(e => e.memberIds));
      const clashMember = progB.entries.flatMap(e => e.memberIds).find(id => membersA.has(id));
      if (clashMember) {
        conflicts.push({
          kind: "participant",
          message: `${memberName(clashMember)} is in "${programName(left.programId)}" and "${programName(right.programId)}" at the same time.`,
          memberId: clashMember,
          programAId: left.programId, programBId: right.programId,
          stageAId: left.stageId, stageBId: right.stageId, date: slotA.date,
        });
      }

      // 2c. Judge in two places at once (works across different stages).
      const judgesA = new Set(progA.judgeIds);
      const clashJudge = progB.judgeIds.find(id => judgesA.has(id));
      if (clashJudge) {
        conflicts.push({
          kind: "judge",
          message: `${judgeName(clashJudge)} is judging "${programName(left.programId)}" and "${programName(right.programId)}" at the same time.`,
          judgeId: clashJudge,
          programAId: left.programId, programBId: right.programId,
          stageAId: left.stageId, stageBId: right.stageId, date: slotA.date,
        });
      }
    }
  }
  return conflicts;
}

// ---------------------------------------------------------------------------
// 3. SCORING — N-judge engine
// ---------------------------------------------------------------------------

export type ScoringMethod = "average" | "trimmed";

/**
 * Which formula applies to a program.
 * - Fewer than 5 active judges -> dynamic average (fair for small panels).
 * - 5 or more active judges   -> Olympic trimmed mean (drops bias outliers).
 * An explicit override on the program always wins when present.
 */
export function scoringMethodFor(activeJudgeCount: number, override?: ScoringMethod): ScoringMethod {
  if (override === "average" || override === "trimmed") return override;
  return activeJudgeCount >= 5 ? "trimmed" : "average";
}

function validMarks(marks: Record<string, number>, activeJudges: string[]): number[] {
  return activeJudges
    .map(id => marks[id])
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 100);
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Implementation 1 — Dynamic Average.
 * Final = sum(all active judges' scores) / number of active judges.
 * Works for 1, 2, 3, 4, 5, ... N judges. Missing submissions are ignored
 * (never counted as zero) so a late judge can't tank a candidate.
 */
export function dynamicAverage(marks: Record<string, number>, activeJudges: string[]): number | null {
  const values = validMarks(marks, activeJudges);
  if (!values.length) return null;
  return round1(values.reduce((a, b) => a + b, 0) / values.length);
}

/**
 * Implementation 2 — Olympic Trimmed Mean.
 * Drops the single highest and single lowest score, then averages the rest.
 * - Needs at least 3 scores; with <3 it falls back to the dynamic average.
 * - With exactly 3 scores it averages the middle one after trimming (still
 *   bias-resistant). With 5+ it is the classic Olympic behaviour.
 */
export function olympicTrimmedMean(marks: Record<string, number>, activeJudges: string[]): number | null {
  const values = validMarks(marks, activeJudges).sort((a, b) => a - b);
  if (!values.length) return null;
  if (values.length < 3) return dynamicAverage(marks, activeJudges);
  const trimmed = values.slice(1, -1);
  return round1(trimmed.reduce((a, b) => a + b, 0) / trimmed.length);
}

export interface FinalScore {
  /** Rounded final mark out of 100, or null when nobody has scored yet. */
  mark: number | null;
  method: ScoringMethod;
  /** How many judges' scores went into the final (after trimming). */
  counted: number;
  /** How many active judges exist on the panel (before trimming). */
  panel: number;
  /** Scores that were dropped by the trimmed mean (empty for average). */
  dropped: number[];
}

/**
 * Single entry point the whole app uses. Given one candidate's marks plus the
 * program's active judge roster, returns the final score + audit metadata.
 */
export function finalScoreForEntry(
  entry: ProgramEntry,
  activeJudges: string[],
  override?: ScoringMethod,
): FinalScore {
  const values = validMarks(entry.marks, activeJudges).sort((a, b) => a - b);
  const method = scoringMethodFor(activeJudges.length, override);
  if (!values.length) return { mark: null, method, counted: 0, panel: activeJudges.length, dropped: [] };
  if (method === "trimmed" && values.length >= 3) {
    const dropped = [values[0], values[values.length - 1]];
    const rest = values.slice(1, -1);
    return {
      mark: round1(rest.reduce((a, b) => a + b, 0) / rest.length),
      method, counted: rest.length, panel: activeJudges.length, dropped,
    };
  }
  return {
    mark: round1(values.reduce((a, b) => a + b, 0) / values.length),
    method, counted: values.length, panel: activeJudges.length, dropped: [],
  };
}

/** Active roster for a program: assigned judges, or every submitted judge id. */
export function activeJudgesFor(program: Program, entry?: ProgramEntry): string[] {
  if (program.judgeIds.length) return program.judgeIds;
  const seen = new Set<string>(["main"]);
  if (entry) Object.keys(entry.marks).forEach(id => seen.add(id));
  else program.entries.forEach(e => Object.keys(e.marks).forEach(id => seen.add(id)));
  return [...seen];
}

// ---------------------------------------------------------------------------
// 4. SCORING — judge isolation (security model)
// ---------------------------------------------------------------------------

export interface IsolatedJudgeView {
  /** What THIS judge submitted per entry (their own numbers only). */
  own: Record<string, number | undefined>;
  /** How many judges have submitted per entry — no values attached. */
  submittedCounts: Record<string, number>;
  /** Whether this judge has finished every entry. */
  allDone: boolean;
}

/**
 * Builds the ONLY payload a judge client may receive.
 * Raw marks from other judges are never included, so confidential
 * submissions stay confidential even if the client is inspected.
 * MAIN / MONITOR roles use the full view elsewhere — this is for judges.
 */
export function isolatedViewForJudge(program: Program, judgeId: string): IsolatedJudgeView {
  const own: Record<string, number | undefined> = {};
  const submittedCounts: Record<string, number> = {};
  let allDone = program.entries.length > 0;
  for (const entry of program.entries) {
    const mine = entry.marks[judgeId];
    own[entry.id] = typeof mine === "number" ? mine : undefined;
    submittedCounts[entry.id] = Object.values(entry.marks).filter(
      v => typeof v === "number" && Number.isFinite(v),
    ).length;
    if (typeof mine !== "number") allDone = false;
  }
  return { own, submittedCounts, allDone };
}

/** 0-100 guard shared by client validation and the API. */
export function isValidMark(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

// ---------------------------------------------------------------------------
// 5. PERSONALISATION — bookmarks + 15-minute reminders
// ---------------------------------------------------------------------------

export interface Bookmark { userId: string; programId: string; createdAt: string }

const bookmarkKey = (festId: string, userId: string) => `festize-bookmarks:${festId}:${userId}`;

export function loadBookmarks(festId: string, userId: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(bookmarkKey(festId, userId)) || "[]") as string[];
  } catch { return []; }
}

export function toggleBookmark(festId: string, userId: string, programId: string): string[] {
  const current = loadBookmarks(festId, userId);
  const next = current.includes(programId) ? current.filter(id => id !== programId) : [...current, programId];
  try { localStorage.setItem(bookmarkKey(festId, userId), JSON.stringify(next)); } catch { /* ignore */ }
  return next;
}

export interface Reminder {
  cellId: string;
  programId: string;
  programName: string;
  stageName: string;
  startsAt: number;
  minutesAway: number;
}

/**
 * Everything starting within the next `windowMinutes` (default 15).
 * The UI calls this on a 30s tick: anything returned gets a browser
 * Notification (if granted) plus an in-app banner. Pure push/SMS fan-out
 * happens server-side — see supabase/fast_schema.sql for the queue table.
 */
export function dueReminders(
  cells: ScheduleCell[],
  slots: ScheduleSlot[],
  programs: Program[],
  stages: { id: string; name: string }[],
  now = Date.now(),
  windowMinutes = 15,
): Reminder[] {
  const out: Reminder[] = [];
  for (const cell of cells) {
    const start = cellStartMs(cell, slots);
    if (!start) continue;
    const minutesAway = (start - now) / 60_000;
    if (minutesAway < 0 || minutesAway > windowMinutes) continue;
    const program = programs.find(p => p.id === cell.programId);
    if (!program || program.status >= 2) continue;
    out.push({
      cellId: cell.id,
      programId: cell.programId,
      programName: program.name,
      stageName: stages.find(s => s.id === cell.stageId)?.name ?? "Stage",
      startsAt: start,
      minutesAway: Math.ceil(minutesAway),
    });
  }
  return out.sort((a, b) => a.startsAt - b.startsAt);
}

// ---------------------------------------------------------------------------
// 6. REALTIME — architecture contract (Supabase Realtime / WebSocket)
// ---------------------------------------------------------------------------
/**
 * Realtime flow (already wired in this app via `watchFest`):
 *
 *   editor device --PUT fest_snapshots--> Postgres --postgres_changes--> channel
 *        `fest:{festId}` --> every subscribed device re-renders the grid.
 *
 * - Delays: one `delayMinutes` patch on a ScheduleCell re-times that cell
 *   everywhere within ~1s, with no full reload.
 * - Reschedules: moving a cell to another slotId/stageId is the same patch.
 * - Presence (optional): subscribe with `{ presence: { key: userId } }` to
 *   show "3 crew viewing" on the grid.
 *
 * For a dedicated WebSocket server the same payload shape applies:
 *   { type: "schedule.patch", festId, cellId, slotId, stageId, delayMinutes,
 *     actorId, at } — broadcast to room `fest:{festId}`.
 */
export const REALTIME_CHANNEL_FOR = (festId: string) => `fest-${festId}`;
