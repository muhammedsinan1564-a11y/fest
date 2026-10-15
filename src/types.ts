export type Role = "MAIN" | "JUDGE" | "MEDIA" | "TEAM MANAGER" | "MONITOR" | "STAGE MANAGER" | "MEMBER";

export type Section =
  | "Dashboard" | "Access Control" | "Teams" | "Members" | "Categories" | "Programs"
  | "Program Control" | "Stages" | "Stage Control" | "Schedule" | "Judgement"
  | "Team Marks" | "Grade Points" | "ID Card Setup" | "Printouts" | "Code Letter Entry"
  | "Results" | "Public Team Scores" | "Random Picker" | "Random Letter"
  | "Poster Templates" | "Top Candidates" | "Monitor" | "Media" | "Bell" | "Settings" | "Stopwatch";

export interface UserRecord {
  id: string;
  name: string;
  password: string;
  role: Role;
  teamId?: string;
  memberId?: string;
  createdBy?: string;
}

export interface Team { id: string; name: string; createdBy?: string }
export interface Category { id: string; name: string; type: "REGULAR" | "GENERAL"; createdBy?: string }
export interface Member {
  id: string;
  name: string;
  categoryId: string;
  teamId: string;
  code: string;
  mobile?: string;
  place?: string;
  photo?: string;
  photoZoom?: number;
  createdBy?: string;
}

export interface GradeRange { id: string; name: string; min: number; max: number; points: number | null }
export interface GradeScale { id: string; name: string; ranges: GradeRange[]; createdBy?: string }

export interface ProgramEntry {
  id: string;
  memberIds: string[];
  teamId: string;
  codeLetter?: string;
  marks: Record<string, number>;
  createdBy?: string;
}

export interface Program {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  maxPerTeam: number;
  groupSize: number;
  format: "Individual" | "Group";
  venue: "Stage" | "Off stage";
  scaleId: string;
  judgeIds: string[];
  /** Explicit scoring override. When absent: <5 judges -> average, 5+ -> Olympic trimmed mean. */
  scoringMethod?: "average" | "trimmed";
  entries: ProgramEntry[];
  status: number;
  resultNumber?: number;
  /** Set by the Monitor section. A program cannot be published until this is true. */
  monitorConfirmed?: boolean;
  /** When the monitor confirmed it; confirmed results are listed oldest → newest at the bottom. */
  monitorConfirmedAt?: string;
  createdBy?: string;
}

export interface Stage { id: string; name: string; details: string; image?: string; createdBy?: string }
export interface ScheduleSlot { id: string; date: string; start: string; end: string }
export interface ScheduleCell {
  id: string; slotId: string; stageId: string; programId: string;
  /** Minutes this placement is delayed (stage running late). Shifts start+end. */
  delayMinutes?: number;
}

export type ElementKind = "text" | "image" | "name" | "team" | "category" | "number" | "photo" | "qr"
  | "winner" | "runner" | "secondRunner" | "program" | "festival" | "mark" | "winnerPoints" | "runnerPoints" | "secondRunnerPoints";

export interface DesignElement {
  id: string;
  kind: ElementKind;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  align: "left" | "center" | "right";
  shape: "square" | "round" | "circle" | "heart";
  zoom: number;
  text?: string;
  image?: string;
}

export interface PosterTemplate { id: string; name: string; background?: string; elements: DesignElement[]; fromResult?: number | null; toResult?: number | null; createdBy?: string }

/** A template with no range set is available for every published result. */
export function templateCoversResult(template: PosterTemplate, resultNumber?: number) {
  const from = template.fromResult ?? null; const to = template.toResult ?? null;
  if (from === null && to === null) return true;
  if (!resultNumber) return false;
  return resultNumber >= (from ?? 1) && resultNumber <= (to ?? Number.MAX_SAFE_INTEGER);
}
export interface CardDesign {
  background?: string;
  elements: DesignElement[];
  width: number;
  height: number;
  orientation: "Portrait" | "Landscape";
  paper?: string;
  margin: number;
  gap: number;
  cropMarks: boolean;
  newTeamPage: boolean;
}

export interface FestData {
  users: UserRecord[];
  teams: Team[];
  categories: Category[];
  members: Member[];
  programs: Program[];
  scales: GradeScale[];
  stages: Stage[];
  slots: ScheduleSlot[];
  schedule: ScheduleCell[];
  posters: PosterTemplate[];
  cardDesign: CardDesign;
  publicProgramIds: string[];
  activity: { id: string; text: string; at: string; userId: string }[];
  settings: { font: string; headingFont: string; accent: string; dark: boolean; bellTone: string; bellDuration: number; bellUnit: "seconds" | "minutes"; bellWarning: number; bellWarningUnit: "seconds" | "minutes"; customTones: { name: string; data: string }[] };
}

export interface Fest {
  id: string;
  name: string;
  code: string;
  date: string;
  ownerId: string;
  mainUsers: UserRecord[];
  data: FestData;
  demo?: boolean;
}

export const STATUSES = ["Reporting", "Started", "Finished", "Judgements", "Finalysed", "Published"];
export const id = () => typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
function secureInt(max: number) {
  const values = new Uint32Array(1);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(values);
  else values[0] = Math.floor(Math.random() * 2 ** 32);
  return values[0] % max;
}
export const randomPassword = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#";
  return Array.from({ length: 12 }, () => alphabet[secureInt(alphabet.length)]).join("");
};
export const memberCode = () => `#${10 + secureInt(90)}@${100 + secureInt(900)}`;
export const username = () => `MAIN${100 + secureInt(900)}`;
export const makeFestCode = (name: string, date: string) => `${name.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 12)}${date.replace(/-/g, "")}${1000 + secureInt(9000)}`;

export const standardScale: GradeScale = {
  id: "scale-standard", name: "Standard 10-point", ranges: [
    { id: "a-plus", name: "A+", min: 91, max: 100, points: 10 },
    { id: "a", name: "A", min: 81, max: 90.99, points: 9 },
    { id: "b", name: "B", min: 71, max: 80.99, points: 8 },
    { id: "c", name: "C", min: 55, max: 70.99, points: 7 },
    { id: "d", name: "D", min: 40, max: 54.99, points: 6 },
    { id: "f", name: "F", min: 0, max: 39.99, points: null },
  ],
};

export const simpleScale: GradeScale = {
  id: "scale-simple", name: "Simple 5-point", ranges: [
    { id: "s-a", name: "A", min: 80, max: 100, points: 5 },
    { id: "s-b", name: "B", min: 65, max: 79.99, points: 4 },
    { id: "s-c", name: "C", min: 50, max: 64.99, points: 3 },
    { id: "s-d", name: "D", min: 40, max: 49.99, points: 2 },
    { id: "s-f", name: "F", min: 0, max: 39.99, points: null },
  ],
};

export function emptyData(): FestData {
  return {
    users: [], teams: [], categories: [], members: [], programs: [], scales: [structuredClone(standardScale), structuredClone(simpleScale)],
    stages: [], slots: [], schedule: [], posters: [], publicProgramIds: [], activity: [],
    cardDesign: {
      width: 75, height: 105, orientation: "Portrait", paper: "A4 portrait", margin: 8, gap: 4, cropMarks: false, newTeamPage: false,
      elements: [
        { id: id(), kind: "number", x: 7, y: 12, width: 85, height: 12, fontSize: 28, fontFamily: "Arial", color: "#1e2430", align: "center", shape: "square", zoom: 1 },
        { id: id(), kind: "name", x: 7, y: 68, width: 85, height: 10, fontSize: 17, fontFamily: "Arial", color: "#1e2430", align: "center", shape: "square", zoom: 1 },
        { id: id(), kind: "team", x: 7, y: 80, width: 85, height: 7, fontSize: 11, fontFamily: "Arial", color: "#5f6470", align: "center", shape: "square", zoom: 1 },
      ],
    },
    settings: { font: "IBM Plex Mono", headingFont: "Fraunces", accent: "gold", dark: true, bellTone: "School bell", bellDuration: 5, bellUnit: "seconds", bellWarning: 1, bellWarningUnit: "minutes", customTones: [] },
  };
}

export function getGrade(mark: number | null, scale?: GradeScale): GradeRange | null {
  if (mark === null || !Number.isFinite(mark)) return null;
  return (scale || standardScale).ranges.find(range => mark >= range.min && mark <= range.max) || null;
}

/**
 * FAST scoring: final mark for one candidate.
 * - <5 judges (or explicit "average") -> dynamic average of active judges.
 * - 5+ judges (or explicit "trimmed") -> Olympic trimmed mean (drop high+low).
 * Missing submissions are ignored, never counted as zero.
 */
export function entryMark(entry: ProgramEntry, program: Program): number | null {
  return entryFinal(entry, program).mark;
}

export function entryFinal(entry: ProgramEntry, program: Program): {
  mark: number | null; method: "average" | "trimmed"; counted: number; panel: number; dropped: number[];
} {
  const judges = program.judgeIds.length ? program.judgeIds : Object.keys(entry.marks);
  const values = judges
    .map(judgeId => entry.marks[judgeId])
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 100)
    .sort((a, b) => a - b);
  const method: "average" | "trimmed" = program.scoringMethod ?? (judges.length >= 5 ? "trimmed" : "average");
  if (!values.length) return { mark: null, method, counted: 0, panel: judges.length, dropped: [] };
  if (method === "trimmed" && values.length >= 3) {
    const rest = values.slice(1, -1);
    return {
      mark: Math.round((rest.reduce((a, b) => a + b, 0) / rest.length) * 10) / 10,
      method, counted: rest.length, panel: judges.length, dropped: [values[0], values[values.length - 1]],
    };
  }
  return {
    mark: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10,
    method, counted: values.length, panel: judges.length, dropped: [],
  };
}

export function entryGrade(entry: ProgramEntry, program: Program, data: FestData) {
  return getGrade(entryMark(entry, program), data.scales.find(scale => scale.id === program.scaleId));
}

export function programReadyForJudgement(program: Program): boolean {
  const judges = program.judgeIds.length ? program.judgeIds : ["main"];
  return program.entries.length > 0 && program.entries.every(entry => judges.every(judgeId => typeof entry.marks[judgeId] === "number"));
}

export function getMemberName(data: FestData, memberId: string) { return data.members.find(m => m.id === memberId)?.name || "Unknown member"; }
export function getTeamName(data: FestData, teamId: string) { return data.teams.find(t => t.id === teamId)?.name || "Unassigned"; }
export function getCategoryName(data: FestData, categoryId: string) { return data.categories.find(c => c.id === categoryId)?.name || "Unassigned"; }
export function entryLabel(data: FestData, entry: ProgramEntry, program: Program) {
  const names = entry.memberIds.map(memberId => getMemberName(data, memberId));
  return program.format === "Group" ? `${names[0] || "Group"} + ${Math.max(names.length - 1, 0)} / ${getTeamName(data, entry.teamId)}` : `${names[0] || "Member"} / ${getTeamName(data, entry.teamId)}`;
}

export function createDemoFest(): Fest {
  const data = emptyData();
  const teams = [{ id: "north", name: "North House" }, { id: "south", name: "South House" }];
  const categories: Category[] = [
    { id: "junior", name: "Junior", type: "REGULAR" },
    { id: "senior", name: "Senior", type: "REGULAR" },
    { id: "open", name: "Open", type: "GENERAL" },
  ];
  const names = ["Aarav Menon", "Maya Joseph", "Riya Nair", "Dev Patel", "Anika Rao", "Ishan Thomas", "Zoya Khan", "Neil Varma", "Tara Mathew", "Kabir Shah", "Sana Ali", "Arjun Das"];
  data.teams = teams;
  data.categories = categories;
  data.members = names.map((name, index) => ({ id: `member-${index + 1}`, name, teamId: index % 2 ? "south" : "north", categoryId: index < 6 ? "junior" : "senior", code: `#${34 + index}@${123 + index * 13}`, place: index % 2 ? "West campus" : "East campus" }));
  data.users = [
    { id: "judge-demo", name: "JUDGE21", password: "JUDGE123", role: "JUDGE" },
    { id: "manager-demo", name: "MANAGER07", password: "TEAM123", role: "TEAM MANAGER", teamId: "north" },
    { id: "monitor-demo", name: "MONITOR04", password: "MONITOR123", role: "MONITOR" },
    { id: "media-demo", name: "MEDIA08", password: "MEDIA123", role: "MEDIA" },
  ];
  const makeEntry = (memberId: string, codeLetter?: string, mark?: number): ProgramEntry => ({ id: id(), memberIds: [memberId], teamId: data.members.find(m => m.id === memberId)?.teamId || "north", codeLetter, marks: typeof mark === "number" ? { "judge-demo": mark } : {} });
  data.programs = [
    { id: "solo-song", name: "Solo Song", description: "A solo vocal performance.", categoryId: "junior", maxPerTeam: 2, groupSize: 1, format: "Individual", venue: "Stage", scaleId: "scale-standard", judgeIds: ["judge-demo"], entries: [makeEntry("member-1", "AL", 94), makeEntry("member-2", "BR", 86), makeEntry("member-3", "CT", 75)], status: 5, resultNumber: 1, monitorConfirmed: true },
    { id: "poetry", name: "Poetry Recital", description: "Original verse and spoken word.", categoryId: "senior", maxPerTeam: 2, groupSize: 1, format: "Individual", venue: "Off stage", scaleId: "scale-simple", judgeIds: ["judge-demo"], entries: [makeEntry("member-7", "DX"), makeEntry("member-8", "FY")], status: 2 },
    { id: "group-dance", name: "Group Dance", description: "A collaborative stage performance.", categoryId: "open", maxPerTeam: 4, groupSize: 4, format: "Group", venue: "Stage", scaleId: "scale-standard", judgeIds: ["judge-demo"], entries: [{ id: id(), memberIds: ["member-1", "member-3", "member-5"], teamId: "north", marks: {} }, { id: id(), memberIds: ["member-2", "member-4", "member-6"], teamId: "south", marks: {} }], status: 0 },
    { id: "art-on-canvas", name: "Art on Canvas", description: "An open-theme visual arts event.", categoryId: "open", maxPerTeam: 2, groupSize: 1, format: "Individual", venue: "Off stage", scaleId: "scale-standard", judgeIds: [], entries: [], status: -1 },
  ];
  data.stages = [
    { id: "stage-1", name: "The Main Stage", details: "Open-air amphitheatre · North lawn" },
    { id: "stage-2", name: "Studio Hall", details: "Indoor performance space · Block B" },
  ];
  data.publicProgramIds = ["solo-song"];
  data.slots = [{ id: "slot-1", date: new Date().toISOString().slice(0, 10), start: "10:00", end: "11:00" }, { id: "slot-2", date: new Date().toISOString().slice(0, 10), start: "11:30", end: "12:30" }];
  data.schedule = [{ id: id(), slotId: "slot-1", stageId: "stage-1", programId: "solo-song" }, { id: id(), slotId: "slot-2", stageId: "stage-1", programId: "group-dance" }];
  data.posters = [{ id: "poster-demo", name: "Editorial winner", elements: [
    { id: id(), kind: "text", text: "THE WINNERS", x: 8, y: 10, width: 84, height: 9, fontSize: 16, fontFamily: "IBM Plex Mono", color: "#ffb596", align: "left", shape: "square", zoom: 1 },
    { id: id(), kind: "program", x: 8, y: 28, width: 84, height: 13, fontSize: 29, fontFamily: "DM Sans", color: "#ffffff", align: "left", shape: "square", zoom: 1 },
    { id: id(), kind: "winner", x: 8, y: 56, width: 84, height: 12, fontSize: 23, fontFamily: "DM Sans", color: "#ffffff", align: "left", shape: "square", zoom: 1 },
    { id: id(), kind: "runner", x: 8, y: 73, width: 84, height: 8, fontSize: 14, fontFamily: "IBM Plex Mono", color: "#e9ccce", align: "left", shape: "square", zoom: 1 },
    { id: id(), kind: "number", x: 80, y: 8, width: 13, height: 7, fontSize: 17, fontFamily: "DM Sans", color: "#ffffff", align: "right", shape: "square", zoom: 1 },
  ] }];
  data.activity = [{ id: id(), text: "Solo Song result published", at: new Date().toISOString(), userId: "main-demo" }];
  return { id: "demo-fest", name: "Aurora Arts Festival", code: "AURORA2026041972", date: new Date().toISOString().slice(0, 10), ownerId: "demo-owner", mainUsers: [{ id: "main-demo", name: "MAIN69", password: "DEMO999", role: "MAIN" }], data, demo: true };
}