import {
  entryMark,
  getGrade,
  quizPointsFor,

  type Fest,
  type FestData,
  type Member,
  type Program,
  type ProgramEntry,
  type Section,
  type Team,
  type UserRecord,
} from "../types";

/** Props every workspace section receives. */
export interface SectionProps {
  fest: Fest;
  user: UserRecord;
  onChange: (updater: (data: FestData) => FestData, activity?: string) => void;
  onProvision: (user: UserRecord, action?: "create" | "update" | "revoke") => Promise<void>;
  notify: (message: string) => void;
  navigate: (section: Section) => void;
}

export const uid = (prefix = "id") =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return 540;
  return h * 60 + m;
}

export function minutesToTime(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(totalMinutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatDurationMs(ms: number): string {
  const totalTenths = Math.floor(Math.max(0, ms) / 100);
  const tenths = totalTenths % 10;
  const totalSeconds = Math.floor(totalTenths / 10);
  const secs = totalSeconds % 60;
  const mins = Math.floor(totalSeconds / 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${tenths}`;
}

/** Extra championship points for a podium finish. */
export const RANK_BONUS: Record<number, number> = { 1: 5, 2: 3, 3: 1 };

export interface RankedEntry {
  entry: ProgramEntry;
  mark: number | null;
  rank: number | null;
  gradeName: string;
  points: number;
}

/** Scores one program: final mark, podium rank, grade and championship points. */
export function rankProgram(data: FestData, program: Program): RankedEntry[] {
  const scale = data.scales.find((s) => s.id === program.scaleId);
  const scored = program.entries.map((entry) => {
    const mark = entryMark(entry, program);
    return { entry, mark, grade: getGrade(mark, scale) };
  });

  const rankById = new Map<string, number>();
  scored
    .filter((s) => s.mark !== null)
    .sort((a, b) => (b.mark as number) - (a.mark as number))
    .forEach((s, index) => {
      if (index < 3) rankById.set(s.entry.id, index + 1);
    });

  return scored.map((s) => {
    const rank = rankById.get(s.entry.id) ?? null;
    return {
      entry: s.entry,
      mark: s.mark,
      rank,
      gradeName: s.grade?.name ?? "—",
      points: (s.grade?.points ?? 0) + (rank ? RANK_BONUS[rank] ?? 0 : 0),
    };
  });
}

export interface TeamStanding {
  team: Team;
  points: number;
  golds: number;
  silvers: number;
  bronzes: number;
  entries: number;
  rank: number;
}

/** Championship standings; only finalised or published programs count. */
export function teamStandings(data: FestData): TeamStanding[] {
  const map = new Map<string, Omit<TeamStanding, "rank">>();
  for (const team of data.teams) {
    map.set(team.id, { team, points: 0, golds: 0, silvers: 0, bronzes: 0, entries: 0 });
  }

  for (const program of data.programs) {
    const counted = program.status >= 4;
    for (const ranked of rankProgram(data, program)) {
      const record = map.get(ranked.entry.teamId);
      if (!record) continue;
      record.entries += 1;
      if (!counted) continue;
      record.points += ranked.points;
      if (ranked.rank === 1) record.golds += 1;
      else if (ranked.rank === 2) record.silvers += 1;
      else if (ranked.rank === 3) record.bronzes += 1;
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.points - a.points || b.golds - a.golds || b.silvers - a.silvers)
    .map((record, index) => ({ ...record, rank: index + 1 }));
}

export interface MemberStanding {
  member: Member;
  points: number;
  wins: number;
  events: number;
}

/** Entries ordered by final mark, best first (unmarked entries last). */
export function rankedEntries(program: Program, _data: FestData): ProgramEntry[] {
  return [...program.entries].sort((a, b) => {
    const markA = entryMark(a, program);
    const markB = entryMark(b, program);
    if (markA === null && markB === null) return 0;
    if (markA === null) return 1;
    if (markB === null) return -1;
    return markB - markA;
  });
}

/**
 * Total championship points a team has earned from finalised programs
 * (grade points + podium bonuses), plus their members' quiz points when asked.
 */
export function teamPoints(teamId: string, data: FestData, includeQuiz = false): number {
  let total = 0;
  for (const program of data.programs) {
    if (program.status < 4) continue;
    for (const ranked of rankProgram(data, program)) {
      if (ranked.entry.teamId === teamId) total += ranked.points;
    }
  }
  if (includeQuiz) {
    for (const member of data.members) {
      if (member.teamId === teamId) total += quizPointsFor(member.id, data);
    }
  }
  return total;
}

/** Read an uploaded file into a data URL (used for photos, logos and templates). */
export function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Confirm a destructive action; returns true when the user agrees. */
export function confirmDelete(name: string): boolean {
  if (typeof window === "undefined") return true;
  return window.confirm(`Delete ${name}? This cannot be undone.`);
}

/** Individual championship leaders across finalised solo programs. */
export function memberStandings(data: FestData): MemberStanding[] {
  const map = new Map<string, MemberStanding>();
  for (const member of data.members) {
    map.set(member.id, { member, points: 0, wins: 0, events: 0 });
  }

  for (const program of data.programs) {
    if (program.format !== "Individual" || program.status < 4) continue;
    for (const ranked of rankProgram(data, program)) {
      for (const memberId of ranked.entry.memberIds) {
        const record = map.get(memberId);
        if (!record) continue;
        record.events += 1;
        record.points += ranked.points;
        if (ranked.rank === 1) record.wins += 1;
      }
    }
  }

  return Array.from(map.values())
    .filter((record) => record.events > 0)
    .sort((a, b) => b.points - a.points || b.wins - a.wins);
}

/** Every program this member is entered in (solo or as part of a group). */
export function memberPrograms(member: Member, data: FestData): Program[] {
  return data.programs.filter((program) =>
    program.entries.some((entry) => entry.memberIds.includes(member.id))
  );
}

/** Only the main user moves programs through the live workflow. */
export function canManage(user: UserRecord): boolean {
  return user.role === "MAIN";
}

/** Stage managers see programs assigned to them; unassigned programs stay visible to the stage team. */
export function stageManagerSees(program: Program, user: UserRecord): boolean {
  if (user.role !== "STAGE MANAGER") return true;
  const assigned = program.stageManagerIds ?? [];
  return assigned.length === 0 || assigned.includes(user.id);
}

/** How a candidate appears on staff screens: the member's name, or the names of a group. */
export function entryDisplay(_program: Program, entry: ProgramEntry, data: FestData): string {
  const names = entry.memberIds.map(
    (memberId) => data.members.find((member) => member.id === memberId)?.name ?? "Unknown member"
  );
  return names.length ? names.join(" + ") : "Unknown member";
}

export { downloadNodePdf } from "../lib/exporter";

/** One reporting row per candidate in a program, ordered by member name. */
export function reportRows(
  program: Program,
  data: FestData
): { key: string; name: string; team: string; code: string }[] {
  return program.entries
    .map((entry) => {
      const member = entry.memberIds.length ? data.members.find((m) => m.id === entry.memberIds[0]) : undefined;
      return {
        key: entry.id,
        name: member?.name ?? "Unknown member",
        team: data.teams.find((t) => t.id === entry.teamId)?.name ?? "Unassigned",
        code: entry.codeLetter ?? "",
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Explore-mode caps — match the Explore mode banner on the dashboard. */
const DEMO_LIMITS = {
  teams: 2,
  categories: 3,
  members: 20,
  programs: 5,
  users: 5,
  stages: 3,
  scales: 4,
} as const;

export function isTeamManager(user: UserRecord): boolean {
  return user.role === "TEAM MANAGER";
}

export type LimitedCollection = keyof typeof DEMO_LIMITS;

export function canAdd(fest: Fest, kind: LimitedCollection): boolean {
  if (!fest.demo) return true;
  return fest.data[kind].length < DEMO_LIMITS[kind];
}

export function limitMessage(kind: LimitedCollection): string {
  const label = kind === "users" ? "staff users" : kind;
  return `Explore mode allows up to ${DEMO_LIMITS[kind]} ${label}. Create your own fest for unlimited ${label}.`;
}
