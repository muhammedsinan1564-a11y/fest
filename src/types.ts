import type { ScreenDesign, ScreenKey } from "./lib/screenDesign";

export type Role = "MAIN" | "JUDGE" | "MEDIA" | "TEAM MANAGER" | "MONITOR" | "STAGE MANAGER" | "MEMBER" | "PUBLIC RESULT" | "QUIZ MASTER";

export type Section =
  | "Dashboard" | "Access Control" | "Teams" | "Members" | "Categories" | "Programs"
  | "Program Control" | "Stages" | "Stage Control" | "Schedule" | "Judgement"
  | "Team Marks" | "Grade Points" | "ID Card Setup" | "Printouts" | "Code Letter Entry"
  | "Results" | "Public Team Scores" | "Random Picker"
  | "Poster Templates" | "Top Candidates" | "Monitor" | "Media" | "Bell" | "Settings" | "Stopwatch"
  | "Highlights" | "Prediction" | "Quiz" | "Quiz Builder" | "Quiz Points" | "Quiz Answers" | "Publish Result";

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
  stageManagerIds?: string[];
  scoringMethod?: "average" | "trimmed";
  /** Extra marks configured on the program and added to the 1st/2nd/3rd holders once judging is confirmed. */
  placeBonus?: { first: number; second: number; third: number };
  placeBonusApplied?: boolean;
  entries: ProgramEntry[];
  status: number;
  resultNumber?: number;
  monitorConfirmed?: boolean;
  monitorConfirmedAt?: string;
  createdBy?: string;
}

export interface Stage { id: string; name: string; details: string; image?: string; createdBy?: string }
export interface ScheduleSlot { id: string; date: string; start: string; end: string }
export interface ScheduleCell {
  id: string; slotId: string; stageId: string; programId: string;
  delayMinutes?: number;
}

export type HighlightPlace = "winner" | "runner" | "secondRunner";

export interface HighlightsData {
  liveUrl?: string;
  programUrls: Record<string, string>;
  programWinnerUrls: Record<string, Partial<Record<HighlightPlace, string>>>;
}

export interface PredictionData {
  active: boolean;
  startedAt?: string;
  closesAt?: string;
  responses: Record<string, string>;
}

export interface QuizQuestion {
  id: string;
  question: string;
  answerType: "options" | "text";
  options: string[];
  correctAnswer?: string;
  published: boolean;
  createdAt: string;
  timerMinutes?: number;
  timerSeconds?: number;
  closesAt?: string;
  resultPublished?: boolean;
  resultPublishedAt?: string;
}

export interface QuizAnswer {
  id: string;
  quizId: string;
  memberId: string;
  answer: string;
  correct: boolean;
  reviewed?: boolean;
  submittedAt: string;
}

export function quizPointsFor(memberId: string, data: { quizzes: QuizQuestion[]; quizAnswers: QuizAnswer[] }): number {
  const publishedIds = new Set(data.quizzes.filter(quiz => quiz.resultPublished).map(quiz => quiz.id));
  return data.quizAnswers.filter(answer => answer.memberId === memberId && answer.correct && publishedIds.has(answer.quizId)).length;
}

export type ElementKind = "text" | "image" | "name" | "team" | "category" | "number" | "photo" | "qr"
  | "winner" | "runner" | "secondRunner" | "winnerGrade" | "runnerGrade" | "secondRunnerGrade"
  | "program" | "festival" | "mark" | "winnerPoints" | "runnerPoints" | "secondRunnerPoints"
  | "placeName" | "placeGrade" | "placePoints"
  | "teamMarkName" | "teamMarkPoints" | "teamRankName" | "teamRankPoints"
  | "shape";

export type ShapeType =
  | "circle" | "ellipse" | "square" | "rect" | "roundedRect"
  | "triangle" | "rightTriangle" | "star5" | "star8" | "starburst"
  | "pentagon" | "hexagon" | "octagon" | "diamond" | "trapezoid" | "parallelogram"
  | "heart" | "crescent" | "cross" | "shield" | "badge" | "ribbon" | "wreath"
  | "mapPin" | "compass" | "sun" | "cloud" | "lightning" | "wave" | "flag"
  | "arrowRight" | "arrowLeft" | "arrowUp" | "arrowDown" | "doubleArrow" | "curvedArrow"
  | "chevronRight" | "quote" | "dividerLine" | "doubleLine" | "dottedLine";

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
  place?: number;
  teamId?: string;
  teamRank?: number;
  shapeType?: ShapeType;
  strokeColor?: string;
  strokeWidth?: number;
  rotation?: number;
  opacity?: number;
  layerName?: string;
  hidden?: boolean;
  locked?: boolean;
  fontWeight?: number;
  minFontSize?: number;
  lineHeight?: number;
  letterSpacing?: number;
  fontStyle?: "Normal" | "Italic" | "Bold" | "Bold Italic";
  verticalAlign?: "Top" | "Middle" | "Bottom";
  fitMode?: "Width" | "Height" | "Auto";
  textTransform?: "None" | "Title case" | "UPPERCASE" | "lowercase";
  minLines?: number;
  insideWidth?: number;
  prefillColor?: string;
  prefix?: string;
  suffix?: string;
  shadowColor?: string;
  shadowBlur?: number;
  shadowX?: number;
  shadowY?: number;
}

export interface SampleWinner {
  name: string;
  team: string;
}

export interface SampleResultData {
  programName: string;
  category: string;
  resultNumber: number;
  winners: SampleWinner[];
}

export interface PosterTemplate {
  id: string;
  name: string;
  templateType?: "result" | "teamMark";
  background?: string;
  backgroundColor?: string;
  backgroundWidth?: number;
  backgroundHeight?: number;
  width?: number;
  height?: number;
  resolution?: number;
  unit?: string;
  elements: DesignElement[];
  fromResult?: number | null;
  toResult?: number | null;
  sampleResult?: SampleResultData;
  createdBy?: string;
}

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
  festLogo?: string;
  /** Uploaded images (PNG/JPG) that head each role's screen — scoped to this fest only. */
  screenImages?: { publicResults?: string; member?: string; teamManager?: string; judge?: string; dashboard?: string };
  /** Editable dashboard canvases (multiple draggable images + animations) per role screen. */
  screenDesigns?: Partial<Record<ScreenKey, ScreenDesign>>;
  publicResultCredentials?: { username: string; password: string };
  highlights: HighlightsData;
  memberProgramLimits?: { stage: number; offStage: number; byCategory?: Record<string, { stage: number; offStage: number }> };
  prediction: PredictionData;
  quizzes: QuizQuestion[];
  quizAnswers: QuizAnswer[];
  activity: { id: string; text: string; at: string; userId: string }[];
  settings: { font: string; headingFont: string; accent: string; theme?: string; dark: boolean; bellTone: string; bellDuration: number; bellUnit: "seconds" | "minutes"; bellWarning: number; bellWarningUnit: "seconds" | "minutes"; customTones: { name: string; data: string }[] };
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
    highlights: { programUrls: {}, programWinnerUrls: {} },
    prediction: { active: false, responses: {} },
    quizzes: [], quizAnswers: [],
    cardDesign: {
      width: 75, height: 105, orientation: "Portrait", paper: "A4 portrait", margin: 8, gap: 4, cropMarks: false, newTeamPage: false,
      elements: [
        { id: id(), kind: "number", x: 7, y: 12, width: 85, height: 12, fontSize: 28, fontFamily: "Arial", color: "#1e2430", align: "center", shape: "square", zoom: 1 },
        { id: id(), kind: "name", x: 7, y: 68, width: 85, height: 10, fontSize: 17, fontFamily: "Arial", color: "#1e2430", align: "center", shape: "square", zoom: 1 },
        { id: id(), kind: "team", x: 7, y: 80, width: 85, height: 7, fontSize: 11, fontFamily: "Arial", color: "#5f6470", align: "center", shape: "square", zoom: 1 },
      ],
    },
    settings: { font: "IBM Plex Mono", headingFont: "Fraunces", accent: "theme", dark: true, bellTone: "School bell", bellDuration: 5, bellUnit: "seconds", bellWarning: 1, bellWarningUnit: "minutes", customTones: [] },
  };
}

export function hydrateFestData(data: Partial<FestData> | undefined): FestData {
  const base = emptyData();
  const source: Partial<FestData> = data || {};
  return {
    ...base,
    ...source,
    highlights: { ...base.highlights, ...(source.highlights || {}), programUrls: { ...(source.highlights?.programUrls || {}) }, programWinnerUrls: { ...(source.highlights?.programWinnerUrls || {}) } },
    prediction: { ...base.prediction, ...(source.prediction || {}), responses: { ...(source.prediction?.responses || {}) } },
    quizzes: source.quizzes || [],
    quizAnswers: source.quizAnswers || [],
    settings: { ...base.settings, ...(source.settings || {}) },
  };
}

export function getGrade(mark: number | null, scale?: GradeScale): GradeRange | null {
  if (mark === null || !Number.isFinite(mark)) return null;
  const clamped = Math.min(100, mark);
  return (scale || standardScale).ranges.find(range => clamped >= range.min && clamped <= range.max) || null;
}

export function entryMark(entry: ProgramEntry, program: Program): number | null {
  return entryFinal(entry, program).mark;
}

/** Raw judge mark (average or Olympic trimmed mean), before any podium bonus. */
export function rawEntryFinal(entry: ProgramEntry, program: Program): {
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

/** Place bonus mark for an entry based on the program's raw judge ranking (1st/2nd/3rd). */
export function entryPlaceBonus(entry: ProgramEntry, program: Program): number {
  const bonus = program.placeBonus;
  if (!bonus || (!bonus.first && !bonus.second && !bonus.third)) return 0;
  const ranked = program.entries
    .map(item => ({ id: item.id, raw: rawEntryFinal(item, program).mark }))
    .filter((row): row is { id: string; raw: number } => row.raw !== null)
    .sort((a, b) => b.raw - a.raw);
  const mine = ranked.find(row => row.id === entry.id);
  if (!mine) return 0;
  // Standard competition rank: ties for a place receive that place's bonus.
  const rank = 1 + ranked.filter(other => other.raw > mine.raw).length;
  if (rank === 1) return bonus.first || 0;
  if (rank === 2) return bonus.second || 0;
  if (rank === 3) return bonus.third || 0;
  return 0;
}

/** Final mark of the program: raw judge mark plus any 1st/2nd/3rd place mark configured on the program. */
export function entryFinal(entry: ProgramEntry, program: Program): {
  mark: number | null; rawMark: number | null; bonus: number; method: "average" | "trimmed"; counted: number; panel: number; dropped: number[];
} {
  const raw = rawEntryFinal(entry, program);
  if (raw.mark === null) return { ...raw, rawMark: null, bonus: 0 };
  const bonus = entryPlaceBonus(entry, program);
  const mark = Math.round((raw.mark + bonus) * 10) / 10;
  return { ...raw, mark, rawMark: raw.mark, bonus };
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
    { id: "public-demo", name: "PUBLICRESULT", password: "PUBLIC123", role: "PUBLIC RESULT" },
    { id: "quiz-demo", name: "QUIZMASTER", password: "QUIZ123", role: "QUIZ MASTER" },
  ];
  data.publicResultCredentials = { username: "PUBLICRESULT", password: "PUBLIC123" };
  const makeEntry = (memberId: string, codeLetter?: string, mark?: number): ProgramEntry => ({ id: id(), memberIds: [memberId], teamId: data.members.find(m => m.id === memberId)?.teamId || "north", codeLetter, marks: typeof mark === "number" ? { "judge-demo": mark } : {} });
  data.programs = [
    { id: "solo-song", name: "Solo Song", description: "A solo vocal performance.", categoryId: "junior", maxPerTeam: 2, groupSize: 1, format: "Individual", venue: "Stage", scaleId: "scale-standard", judgeIds: ["judge-demo"], entries: [makeEntry("member-1", "AL", 94), makeEntry("member-2", "BR", 86), makeEntry("member-3", "CT", 75)], status: 5, resultNumber: 1, monitorConfirmed: true },
    { id: "poetry", name: "Poetry Recital", description: "Original verse and spoken word.", categoryId: "senior", maxPerTeam: 2, groupSize: 1, format: "Individual", venue: "Off stage", scaleId: "scale-simple", judgeIds: ["judge-demo"], entries: [makeEntry("member-7", "DX"), makeEntry("member-8", "FY")], status: 2 },
    { id: "group-dance", name: "Group Dance", description: "A collaborative stage performance.", categoryId: "open", maxPerTeam: 4, groupSize: 4, format: "Group", venue: "Stage", scaleId: "scale-standard", judgeIds: ["judge-demo"], entries: [{ id: id(), memberIds: ["member-1", "member-3", "member-5"], teamId: "north", marks: {} }, { id: id(), memberIds: ["member-2", "member-4", "member-6"], teamId: "south", marks: {} }], status: 0 },
    { id: "art-on-canvas", name: "Art on Canvas", description: "An open-theme visual arts event.", categoryId: "open", maxPerTeam: 2, groupSize: 1, format: "Individual", venue: "Off stage", scaleId: "scale-standard", judgeIds: [], entries: [], status: -1 },
  ];
  data.stages = [
    { id: "stage-1", name: "The Main Stage", details: "Open-air amphitheater" },
    { id: "stage-2", name: "Gallery Hall", details: "Indoor exhibition and literary hall" },
  ];
  return {
    id: "demo-fest",
    name: "Festize Demo 2026",
    code: "FESTIZE2026DEMO",
    date: "2026-11-15",
    ownerId: "demo-owner",
    mainUsers: [{ id: "main-demo", name: "MAIN101", password: "MAIN123", role: "MAIN" }],
    data,
    demo: true,
  };
}

/* ------------------------------------------------------------------------ */
/* Compatibility re-exports for the existing sections/lib modules.           */
/* (Names that clash with the domain model above — Team, Category,           */
/*  ProgramEntry, QuizQuestion — intentionally come from this file only.)   */
/* ------------------------------------------------------------------------ */

export type { SectionProps, RankedEntry, TeamStanding, MemberStanding } from "./sections/common";

export type { ExportableDesignDoc, ExportableLayer } from "./lib/exporter";
export type { EmblemStyle, FestivalBrandKit } from "./lib/brand";
export type { GradeCode, PointsMatrix } from "./lib/fast";
export type { ShapeKind } from "./lib/shapes";
export type { ThemeId, WorkspaceTheme } from "./lib/theme";
export type { UiFontSettings } from "./lib/settingsFonts";
export type { StudioFont, FontPairing, FontCategory } from "./lib/fonts";
export type { ContrastReport, RGB, WcagLevel } from "./lib/contrast";
