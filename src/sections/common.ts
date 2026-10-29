import { entryGrade, entryMark, getCategoryName, getMemberName, getTeamName, type Fest, type FestData, type Member, type Program, type ProgramEntry, type Section, type UserRecord } from "../types";

export interface SectionProps {
  fest: Fest;
  user: UserRecord;
  onChange: (updater: (data: FestData) => FestData, activity?: string) => void;
  onProvision: (user: UserRecord, action?: "create" | "update" | "revoke") => Promise<void>;
  notify: (message: string) => void;
  navigate: (section: Section) => void;
}

export const canManage = (user: UserRecord) => user.role === "MAIN";
export const isTeamManager = (user: UserRecord) => user.role === "TEAM MANAGER";
export function confirmDelete(label: string) { return window.confirm(`Delete ${label}? This cannot be undone.`); }
export function canAdd(fest: Fest, kind: "teams" | "categories" | "members" | "programs" | "users") {
  if (!fest.demo) return true;
  const limits = { teams: 2, categories: 3, members: 20, programs: 5, users: 5 };
  if (kind === "users") {
    // Shared access accounts (public result, quiz master) are part of the role
    // setup, so they must not use up the Explore staff quota.
    const staffCount = fest.data.users.filter(user => user.role !== "PUBLIC RESULT" && user.role !== "QUIZ MASTER").length;
    return staffCount < limits.users;
  }
  return fest.data[kind].length < limits[kind];
}
export function limitMessage(kind: string) { return `Explore limit reached for ${kind}. Create a fest for more space.`; }

/**
 * Programs stay open to every stage manager unless stage managers are assigned.
 * Once assigned, only those stage managers see the program in stage views.
 */
export function stageManagerSees(program: Program, user: UserRecord) {
  if (user.role !== "STAGE MANAGER") return true;
  const assigned = program.stageManagerIds || [];
  return assigned.length === 0 || assigned.includes(user.id);
}

export function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file);
  });
}

export function rankedEntries(program: Program, data: FestData) {
  return [...program.entries].sort((a, b) => (entryGrade(b, program, data)?.points ?? -1) - (entryGrade(a, program, data)?.points ?? -1) || (entryMark(b, program) ?? -1) - (entryMark(a, program) ?? -1));
}

export function entryDisplay(program: Program, entry: ProgramEntry, data: FestData) {
  if (program.format === "Group") return `${getMemberName(data, entry.memberIds[0])} + ${Math.max(entry.memberIds.length - 1, 0)} / ${getTeamName(data, entry.teamId)}`;
  return `${getMemberName(data, entry.memberIds[0])} / ${getTeamName(data, entry.teamId)}`;
}

export function memberPrograms(member: Member, data: FestData) {
  return data.programs.filter(program => program.entries.some(entry => entry.memberIds.includes(member.id)));
}

export function memberPoints(member: Member, data: FestData, includeGroups = false) {
  return data.programs.filter(program => program.status === 5 && (includeGroups || program.format === "Individual")).reduce((sum, program) => {
    const entry = program.entries.find(item => item.memberIds.includes(member.id));
    return sum + (entry ? entryGrade(entry, program, data)?.points || 0 : 0);
  }, 0);
}

export function teamPoints(teamId: string, data: FestData, publicOnly = false) {
  return data.programs.filter(program => program.status === 5 && (!publicOnly || data.publicProgramIds.includes(program.id))).reduce((sum, program) => {
    return sum + program.entries.filter(entry => entry.teamId === teamId).reduce((subtotal, entry) => subtotal + (entryGrade(entry, program, data)?.points || 0), 0);
  }, 0);
}

export function reportRows(program: Program, data: FestData, teamId?: string) {
  const entries = teamId ? program.entries.filter(entry => entry.teamId === teamId) : program.entries;
  if (program.format === "Group") return entries.flatMap(entry => entry.memberIds.map((memberId, index) => ({ key: `${entry.id}-${memberId}`, name: getMemberName(data, memberId), team: getTeamName(data, entry.teamId), group: index === 0 ? `${getMemberName(data, entry.memberIds[0])} / ${getTeamName(data, entry.teamId)}` : "", code: "" })));
  return entries.map(entry => ({ key: entry.id, name: getMemberName(data, entry.memberIds[0]), team: getTeamName(data, entry.teamId), group: "", code: data.members.find(member => member.id === entry.memberIds[0])?.code || "" }));
}

export function categoryAndProgram(program: Program, data: FestData) { return `${getCategoryName(data, program.categoryId)} / ${program.name}`; }

// Every download goes through the shared exporter (font-safe, mobile-safe).
export { downloadNodePdf } from "../lib/exporter";