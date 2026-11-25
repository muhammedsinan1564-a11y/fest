import { useState, type FormEvent } from "react";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { ArrowRight, Plus, Scale, ShieldCheck, UserRoundPlus, UsersRound } from "lucide-react";
import {
  AddButton,
  Button,
  Empty,
  Field,
  Modal,
  PageHead,
  RowActions,
  SearchInput,
  StatusBadge,
  useViewPref,
  ViewToggle,
} from "../ui";
import { entryLabel, getCategoryName, getMemberName, getTeamName, id, type Member, type Program } from "../types";
import { canAdd, confirmDelete, limitMessage, type SectionProps } from "./common";

type Draft = Pick<Program, "name" | "description" | "categoryId" | "maxPerTeam" | "groupSize" | "format" | "venue" | "scaleId"> & {
  /** Marks configured here are added to the 1st/2nd/3rd holders once judging is confirmed. */
  placeBonus: { first: number; second: number; third: number };
};
const blankDraft = (categoryId = "", scaleId = ""): Draft => ({
  name: "",
  description: "",
  categoryId,
  maxPerTeam: 2,
  groupSize: 2,
  format: "Individual",
  venue: "Stage",
  scaleId,
  placeBonus: { first: 0, second: 0, third: 0 },
});

const GROUP_ACCENTS = ["#d58b69", "#94a682", "#9c86b2", "#d2af69"];

/** Multi-word, case-insensitive search. */
function matches(query: string, ...fields: string[]) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const haystack = fields.join(" ").toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

export function ProgramsSection({ fest, user, onChange, notify, navigate }: SectionProps) {
  const data = fest.data;
  const manager = user.role === "TEAM MANAGER";
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [venueFilter, setVenueFilter] = useState("");
  const [formatFilter, setFormatFilter] = useState("");
  const [view, setView] = useViewPref(`programs:${fest.id}:${user.id}`);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Program | null>(null);
  const [draft, setDraft] = useState<Draft>(() => blankDraft(data.categories[0]?.id, data.scales[0]?.id));
  const [detailId, setDetailId] = useState<string | null>(null);
  const [memberProgramId, setMemberProgramId] = useState<string | null>(null);
  const [judgeProgramId, setJudgeProgramId] = useState<string | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const [selectedJudges, setSelectedJudges] = useState<string[]>([]);
  const [managerProgramId, setManagerProgramId] = useState<string | null>(null);
  const [selectedManagers, setSelectedManagers] = useState<string[]>([]);

  const categoryOf = (categoryId: string) => data.categories.find((category) => category.id === categoryId);
  const scaleName = (scaleId: string) => data.scales.find((scale) => scale.id === scaleId)?.name || "No grade scale";
  const memberById = (memberId: string) => data.members.find((member) => member.id === memberId);
  const staffById = (staffId: string) => data.users.find((staff) => staff.id === staffId);

  const programs = data.programs.filter((program) => {
    const allowedForManager =
      !manager ||
      (Boolean(user.teamId) &&
        (program.entries.some((entry) => entry.teamId === user.teamId) ||
          data.members.some(
            (member) =>
              member.teamId === user.teamId &&
              (categoryOf(program.categoryId)?.type === "GENERAL" || member.categoryId === program.categoryId)
          )));
    return (
      allowedForManager &&
      (!categoryFilter || program.categoryId === categoryFilter) &&
      (!venueFilter || program.venue === venueFilter) &&
      (!formatFilter || program.format === formatFilter) &&
      matches(query, program.name, getCategoryName(data, program.categoryId), program.venue, program.format)
    );
  });

  const memberProgram = memberProgramId ? data.programs.find((program) => program.id === memberProgramId) : undefined;
  const judgeProgram = judgeProgramId ? data.programs.find((program) => program.id === judgeProgramId) : undefined;
  const managerProgram = managerProgramId ? data.programs.find((program) => program.id === managerProgramId) : undefined;
  const detailProgram = detailId ? data.programs.find((program) => program.id === detailId) : undefined;

  /** How many programs of one venue a member is already in. */
  const programCount = (memberId: string, venue: Program["venue"]) =>
    data.programs.filter((program) => program.venue === venue && program.entries.some((entry) => entry.memberIds.includes(memberId))).length;

  /** Allowed programs for a member in one venue of a category (falls back to the fest-wide limit). */
  const venueLimit = (categoryId: string, venue: Program["venue"]) => {
    const limits = data.memberProgramLimits;
    if (!limits) return null;
    const perCategory = limits.byCategory?.[categoryId];
    const raw = perCategory
      ? venue === "Stage"
        ? perCategory.stage
        : perCategory.offStage
      : venue === "Stage"
        ? limits.stage
        : limits.offStage;
    return typeof raw === "number" && raw > 0 ? raw : null;
  };

  /** True once a member has used their allowed programs for that venue in this category. */
  const limitReached = (member: Member, categoryId: string, venue: Program["venue"]) => {
    const allowed = venueLimit(categoryId, venue);
    return allowed !== null && programCount(member.id, venue) >= allowed;
  };

  /** How many people from one team are already entered in a program. */
  const teamCount = (program: Program, teamId: string) =>
    program.entries.filter((entry) => entry.teamId === teamId).reduce((count, entry) => count + entry.memberIds.length, 0);

  /** How many candidate entries (or, for a team manager, their own team's members) to show on a card. */
  const entrySummary = (program: Program) => {
    if (!manager) {
      return `${program.entries.length} ${program.format === "Group" ? (program.entries.length === 1 ? "group" : "groups") : program.entries.length === 1 ? "candidate" : "candidates"}`;
    }
    const mine = program.entries.filter((entry) => entry.teamId === user.teamId);
    const people = mine.reduce((total, entry) => total + entry.memberIds.length, 0);
    return program.format === "Group"
      ? `${mine.length} ${mine.length === 1 ? "group" : "groups"} (${people})`
      : `${people} ${people === 1 ? "member" : "members"}`;
  };

  const startForm = (program?: Program) => {
    if (!program && !data.memberProgramLimits) {
      notify("Set the number of programs a member may enter first — opening that setup on your dashboard.");
      navigate("Dashboard");
      return;
    }
    if (!program && (!data.categories.length || !data.scales.length)) {
      return notify(!data.categories.length ? "Add a category before creating a program." : "Add a grade scale before creating a program.");
    }
    setEditing(program || null);
    setDraft(
      program
        ? {
            name: program.name,
            description: program.description,
            categoryId: program.categoryId,
            maxPerTeam: program.maxPerTeam,
            groupSize: program.groupSize,
            format: program.format,
            venue: program.venue,
            scaleId: program.scaleId,
            placeBonus: program.placeBonus ?? { first: 0, second: 0, third: 0 },
          }
        : blankDraft(data.categories[0]?.id, data.scales[0]?.id)
    );
    setFormOpen(true);
  };

  const saveProgram = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim() || !draft.categoryId || !draft.scaleId) return notify("Fill in every required program detail.");
    if (!categoryOf(draft.categoryId)) return notify("Choose a valid category.");
    if (!data.scales.some((scale) => scale.id === draft.scaleId)) return notify("Choose a valid grade scale.");
    if (
      !Number.isInteger(draft.maxPerTeam) ||
      draft.maxPerTeam < 1 ||
      (draft.format === "Group" && (!Number.isInteger(draft.groupSize) || draft.groupSize < 2 || draft.groupSize > draft.maxPerTeam))
    ) {
      return notify("Set a valid team limit. A group needs at least 2 members and must fit within the per-team limit.");
    }
    if (editing && (editing.format !== draft.format || editing.categoryId !== draft.categoryId) && editing.entries.length) {
      return notify("Remove existing candidates before changing the program's format or category.");
    }
    if (editing && editing.entries.length) {
      const largestTeam = Math.max(0, ...data.teams.map((team) => teamCount(editing, team.id)));
      if (draft.maxPerTeam < largestTeam) {
        return notify(`At least one team already has ${largestTeam} members entered. Raise the team limit or remove candidates first.`);
      }
      if (draft.format === "Group") {
        const largestGroup = Math.max(0, ...editing.entries.map((entry) => entry.memberIds.length));
        if (draft.groupSize < largestGroup) {
          return notify(`An existing group already has ${largestGroup} members. Remove it or raise the group size.`);
        }
      }
    }
    if (!editing && !canAdd(fest, "programs")) return notify(limitMessage("programs"));

    // Preserve every existing operational field (stage managers, scoring method, confirmation timestamp) on edit.
    const program: Program = {
      ...(editing ?? { judgeIds: [], entries: [], status: -1, createdBy: user.id }),
      id: editing?.id || id(),
      name: draft.name.trim(),
      description: draft.description.trim(),
      categoryId: draft.categoryId,
      maxPerTeam: draft.maxPerTeam,
      groupSize: draft.format === "Individual" ? 1 : draft.groupSize,
      format: draft.format,
      venue: draft.venue,
      scaleId: draft.scaleId,
      placeBonus: draft.placeBonus,
    };
    onChange(
      (next) => ({
        ...next,
        programs: editing ? next.programs.map((item) => (item.id === editing.id ? program : item)) : [...next.programs, program],
      }),
      `${editing ? "Updated" : "Added"} program ${program.name}`
    );
    setFormOpen(false);
    notify(editing ? "Program updated" : "Program created");
  };

  const removeProgram = (program: Program) => {
    if (!confirmDelete(`${program.name} and its entries`)) return;
    onChange(
      (next) => ({
        ...next,
        programs: next.programs.filter((item) => item.id !== program.id),
        schedule: next.schedule.filter((cell) => cell.programId !== program.id),
        publicProgramIds: next.publicProgramIds.filter((programId) => programId !== program.id),
      }),
      `Deleted program ${program.name}`
    );
    notify("Program deleted");
  };

  const startMembers = (program: Program) => {
    if (!data.memberProgramLimits) {
      notify("No per-member stage/off-stage limit is set yet. Entries won't be capped per member.");
    }
    setMemberProgramId(program.id);
    setSelection([]);
  };

  const startManagers = (program: Program) => {
    setManagerProgramId(program.id);
    setSelectedManagers((program.stageManagerIds || []).filter((staffId) => data.users.some((u) => u.id === staffId && u.role === "STAGE MANAGER")));
  };

  const startJudges = (program: Program) => {
    setJudgeProgramId(program.id);
    setSelectedJudges(program.judgeIds.filter((staffId) => data.users.some((u) => u.id === staffId && u.role === "JUDGE")));
  };

  const eligibleMembers = (program: Program) => {
    const category = categoryOf(program.categoryId);
    return data.members.filter(
      (member) =>
        (!manager || member.teamId === user.teamId) &&
        Boolean(member.teamId) &&
        (category?.type === "GENERAL" || member.categoryId === program.categoryId)
    );
  };

  const joinedIds = memberProgram ? memberProgram.entries.flatMap((entry) => entry.memberIds) : [];
  // Keep only selected IDs that still exist and haven't been entered in the meantime.
  const validSelection = selection.filter((memberId) => Boolean(memberById(memberId)) && !joinedIds.includes(memberId));
  const chosenTeam = validSelection.length ? memberById(validSelection[0])?.teamId : undefined;

  const toggleMember = (member: Member) => {
    if (!memberProgram) return;
    if (validSelection.includes(member.id)) {
      return setSelection(validSelection.filter((value) => value !== member.id));
    }
    if (joinedIds.includes(member.id)) return notify("This member is already entered in this program.");
    if (limitReached(member, memberProgram.categoryId, memberProgram.venue)) {
      const allowed = venueLimit(memberProgram.categoryId, memberProgram.venue);
      return notify(`${member.name} has already reached the ${memberProgram.venue.toLowerCase()} limit (${allowed}).`);
    }
    if (memberProgram.format === "Group" && chosenTeam && member.teamId !== chosenTeam) {
      return notify("Every member in a group must belong to the same team.");
    }
    if (memberProgram.format === "Group" && validSelection.length >= memberProgram.groupSize) {
      return notify(`A group in this program takes at most ${memberProgram.groupSize} members.`);
    }
    const selectedOnTeam =
      memberProgram.format === "Group"
        ? validSelection.filter((memberId) => memberById(memberId)?.teamId === member.teamId).length
        : 0;
    if (teamCount(memberProgram, member.teamId) + selectedOnTeam >= memberProgram.maxPerTeam) {
      return notify(`${getTeamName(data, member.teamId)} has reached its limit of ${memberProgram.maxPerTeam} members here.`);
    }
    setSelection(memberProgram.format === "Individual" ? [member.id] : [...validSelection, member.id]);
  };

  const addEntry = () => {
    if (!memberProgram || !validSelection.length) return notify("Select a member first.");
    const picked = validSelection.map((memberId) => memberById(memberId)).filter((member): member is Member => Boolean(member));
    if (picked.length !== validSelection.length) return notify("One of the selected members is no longer available.");
    if (memberProgram.format === "Group" && picked.length < 2) {
      return notify("Select at least two members from the same team to form a group.");
    }
    if (memberProgram.format === "Group" && picked.length > memberProgram.groupSize) {
      return notify(`A group can have at most ${memberProgram.groupSize} members.`);
    }
    const teamId = picked[0].teamId;
    if (!teamId || picked.some((member) => member.teamId !== teamId)) {
      return notify("All members in a group must belong to the same team.");
    }
    if (picked.some((member) => joinedIds.includes(member.id))) {
      return notify("One of the selected members is already entered.");
    }
    const capped = picked.find((member) => limitReached(member, memberProgram.categoryId, memberProgram.venue));
    if (capped) {
      return notify(`${capped.name} has reached their ${memberProgram.venue.toLowerCase()} program limit.`);
    }
    if (teamCount(memberProgram, teamId) + picked.length > memberProgram.maxPerTeam) {
      return notify(`${getTeamName(data, teamId)} only allows ${memberProgram.maxPerTeam} members in this program.`);
    }
    onChange(
      (next) => ({
        ...next,
        programs: next.programs.map((program) =>
          program.id === memberProgram.id
            ? {
                ...program,
                entries: [...program.entries, { id: id(), teamId, memberIds: picked.map((m) => m.id), marks: {}, createdBy: user.id }],
              }
            : program
        ),
      }),
      `Added ${memberProgram.format === "Group" ? "group" : "candidate"} to ${memberProgram.name}`
    );
    setSelection([]);
    notify(memberProgram.format === "Group" ? "Group added" : "Candidate added");
  };

  const removeEntry = (program: Program, entryId: string) => {
    if (!confirmDelete("this program candidate")) return;
    onChange(
      (next) => ({
        ...next,
        programs: next.programs.map((item) =>
          item.id === program.id ? { ...item, entries: item.entries.filter((entry) => entry.id !== entryId) } : item
        ),
      }),
      `Removed candidate from ${program.name}`
    );
    notify("Candidate removed");
  };

  const saveManagers = () => {
    if (!managerProgram) return;
    onChange(
      (next) => ({
        ...next,
        programs: next.programs.map((program) =>
          program.id === managerProgram.id ? { ...program, stageManagerIds: selectedManagers } : program
        ),
      }),
      `Updated stage managers for ${managerProgram.name}`
    );
    setManagerProgramId(null);
    notify(
      selectedManagers.length
        ? "Stage managers assigned — only they will see this program in stage views."
        : "Stage managers cleared — every stage manager can see this program."
    );
  };

  const saveJudges = () => {
    if (!judgeProgram) return;
    onChange(
      (next) => ({
        ...next,
        programs: next.programs.map((program) =>
          program.id === judgeProgram.id ? { ...program, judgeIds: selectedJudges } : program
        ),
      }),
      `Updated judges for ${judgeProgram.name}`
    );
    setJudgeProgramId(null);
    notify(
      selectedJudges.length
        ? "Judges assigned. Only assigned judges will see this program."
        : "Judge panel cleared."
    );
  };

  const judges = data.users.filter((staff) => staff.role === "JUDGE");
  const stageManagers = data.users.filter((staff) => staff.role === "STAGE MANAGER");
  const visibleEntries = (program: Program) =>
    manager ? program.entries.filter((entry) => entry.teamId === user.teamId) : program.entries;

  return (
    <MotionConfig reducedMotion="user">
      <PageHead
        eyebrow={manager ? "YOUR TEAM / ENTRIES" : "SETUP / 04"}
        title="Programs"
        description={manager ? "Choose the moments your team will take part in." : "Build your lineup, assign judges and bring in candidates."}
        action={!manager ? <AddButton onClick={() => startForm()}>Add program</AddButton> : undefined}
      />

      <div className="section-toolbar">
        <SearchInput value={query} onChange={setQuery} placeholder="Search programs" />
        <ViewToggle mode={view} onChange={setView} />
        <select aria-label="Filter by category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
          <option value="">All categories</option>
          {data.categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select aria-label="Filter by stage type" value={venueFilter} onChange={(event) => setVenueFilter(event.target.value)}>
          <option value="">Stage + off stage</option>
          <option value="Stage">Stage</option>
          <option value="Off stage">Off stage</option>
        </select>
        <select aria-label="Filter by format" value={formatFilter} onChange={(event) => setFormatFilter(event.target.value)}>
          <option value="">Individual + group</option>
          <option value="Individual">Individual</option>
          <option value="Group">Group</option>
        </select>
        <span className="toolbar-count">
          {programs.length} {programs.length === 1 ? "program" : "programs"}
        </span>
      </div>

      {programs.length ? (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            {view === "box" ? (
              <div className="card-grid">
                <AnimatePresence initial={false}>
                  {programs.map((program, index) => (
                    <motion.div
                      className="mini-card"
                      key={program.id}
                      layout
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ duration: 0.18 }}
                    >
                      <div className="mini-card-head">
                        <div className="mini-card-title">
                          <strong>{program.name}</strong>
                          <small>
                            {String(index + 1).padStart(2, "0")} · {getCategoryName(data, program.categoryId)}
                          </small>
                        </div>
                        <StatusBadge status={program.status} />
                      </div>
                      <div className="mini-card-meta">
                        <span>{program.venue}</span>
                        <span>{program.format}</span>
                        <span>{scaleName(program.scaleId)}</span>
                      </div>
                      <div className="mini-card-meta">
                        <span>
                          <UsersRound size={13} /> {entrySummary(program)}
                        </span>
                        {!manager && (
                          <span>
                            <Scale size={13} /> {program.judgeIds.length} {program.judgeIds.length === 1 ? "judge" : "judges"}
                          </span>
                        )}
                      </div>
                      <div className="mini-card-actions">
                        <div className="mini-btn-row">
                          <button type="button" className="outline-small" onClick={() => startMembers(program)}>
                            <Plus size={14} /> Members
                          </button>
                          {!manager && (
                            <>
                              <button type="button" className="outline-small" onClick={() => startManagers(program)}>
                                <ShieldCheck size={14} /> Stage mgrs
                              </button>
                              <button type="button" className="outline-small" onClick={() => startJudges(program)}>
                                <UserRoundPlus size={14} /> Judges
                              </button>
                            </>
                          )}
                        </div>
                        <RowActions
                          onView={() => setDetailId(program.id)}
                          onEdit={!manager ? () => startForm(program) : undefined}
                          onDelete={!manager ? () => removeProgram(program) : undefined}
                        />
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className="program-list">
                <AnimatePresence initial={false}>
                  {programs.map((program, index) => (
                    <motion.div
                      className="program-line"
                      key={program.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.18 }}
                    >
                      <div className="program-line-number">{String(index + 1).padStart(2, "0")}</div>
                      <div className="program-line-info">
                        <div className="program-title-row">
                          <h3>{program.name}</h3>
                          <StatusBadge status={program.status} />
                        </div>
                        <p>
                          {getCategoryName(data, program.categoryId)} <span>·</span> {program.venue} <span>·</span> {program.format}{" "}
                          <span>·</span> {scaleName(program.scaleId)}
                        </p>
                        <div className="program-meta">
                          <span>
                            <UsersRound size={14} /> {entrySummary(program)}
                          </span>
                          {!manager && (
                            <span>
                              <Scale size={14} /> {program.judgeIds.length} {program.judgeIds.length === 1 ? "judge" : "judges"}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="program-line-actions">
                        <button type="button" className="outline-small" onClick={() => startMembers(program)}>
                          <Plus size={15} /> Members
                        </button>
                        {!manager && (
                          <>
                            <button type="button" className="outline-small" onClick={() => startManagers(program)}>
                              <ShieldCheck size={15} /> Stage managers
                            </button>
                            <button type="button" className="outline-small" onClick={() => startJudges(program)}>
                              <UserRoundPlus size={15} /> Judges
                            </button>
                          </>
                        )}
                        <RowActions
                          onView={() => setDetailId(program.id)}
                          onEdit={!manager ? () => startForm(program) : undefined}
                          onDelete={!manager ? () => removeProgram(program) : undefined}
                        />
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      ) : (
        <Empty
          title={data.programs.length ? "No matching programs" : "The lineup starts here"}
          description={data.programs.length ? "Try a different search or filter." : "Add a program to set the stage for your fest."}
          action={!manager && !data.programs.length ? <AddButton onClick={() => startForm()}>Add program</AddButton> : undefined}
        />
      )}

      {/* ---- Create / edit program ---- */}
      <AnimatePresence>
        {formOpen && (
          <Modal
            key="program-form"
            title={editing ? "Edit program" : "Create a program"}
            subtitle="Set the rules for candidates and choose how marks become grade points."
            onClose={() => setFormOpen(false)}
            wide
          >
            <form className="form-stack" onSubmit={saveProgram}>
              <div className="form-grid">
                <Field label="Program name">
                  <input
                    autoFocus
                    required
                    value={draft.name}
                    onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                    placeholder="e.g. Solo Song"
                  />
                </Field>
                <Field label="Category">
                  <select required value={draft.categoryId} onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })}>
                    <option value="">Select category</option>
                    {data.categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                        {category.type === "GENERAL" ? " (General)" : ""}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Performance type">
                  <select value={draft.venue} onChange={(event) => setDraft({ ...draft, venue: event.target.value as Program["venue"] })}>
                    <option value="Stage">Stage</option>
                    <option value="Off stage">Off stage</option>
                  </select>
                </Field>
                <Field label="Entry format">
                  <select
                    value={draft.format}
                    onChange={(event) => {
                      const nextFormat = event.target.value as Program["format"];
                      setDraft({
                        ...draft,
                        format: nextFormat,
                        maxPerTeam: nextFormat === "Group" ? Math.max(2, draft.maxPerTeam) : draft.maxPerTeam,
                        groupSize: nextFormat === "Group" ? Math.max(2, Math.min(draft.groupSize, Math.max(2, draft.maxPerTeam))) : 1,
                      });
                    }}
                  >
                    <option value="Individual">Individual</option>
                    <option value="Group">Group</option>
                  </select>
                </Field>
                <Field label="Max members per team" hint="Total members one team can enter in this program.">
                  <input
                    required
                    type="number"
                    min={draft.format === "Group" ? 2 : 1}
                    value={draft.maxPerTeam}
                    onChange={(event) => setDraft({ ...draft, maxPerTeam: Math.max(1, Math.floor(Number(event.target.value) || 0)) })}
                  />
                </Field>
                {draft.format === "Group" && (
                  <Field label="Members in a group" hint="Between 2 and the per-team limit.">
                    <input
                      required
                      type="number"
                      min={2}
                      max={Math.max(2, draft.maxPerTeam)}
                      value={draft.groupSize}
                      onChange={(event) => setDraft({ ...draft, groupSize: Math.max(2, Math.floor(Number(event.target.value) || 0)) })}
                    />
                  </Field>
                )}
                <Field label="Grade point scale">
                  <select required value={draft.scaleId} onChange={(event) => setDraft({ ...draft, scaleId: event.target.value })}>
                    <option value="">Select scale</option>
                    {data.scales.map((scale) => (
                      <option key={scale.id} value={scale.id}>
                        {scale.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="place-bonus-grid">
                  <Field label="First · winner marks" hint="Added to 1st place once judging is confirmed">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={draft.placeBonus.first}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          placeBonus: {
                            ...draft.placeBonus,
                            first: Math.max(0, Math.floor(Number(event.target.value) || 0)),
                          },
                        })
                      }
                    />
                  </Field>
                  <Field label="Second · runner marks" hint="Added to 2nd place once judging is confirmed">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={draft.placeBonus.second}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          placeBonus: {
                            ...draft.placeBonus,
                            second: Math.max(0, Math.floor(Number(event.target.value) || 0)),
                          },
                        })
                      }
                    />
                  </Field>
                  <Field label="Third · 2nd runner marks" hint="Added to 3rd place once judging is confirmed">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={draft.placeBonus.third}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          placeBonus: {
                            ...draft.placeBonus,
                            third: Math.max(0, Math.floor(Number(event.target.value) || 0)),
                          },
                        })
                      }
                    />
                  </Field>
                </div>
              </div>
              <Field label="Description (optional)">
                <textarea
                  rows={3}
                  value={draft.description}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                  placeholder="A short description of this program"
                />
              </Field>
              <div className="form-actions">
                <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Confirm <ArrowRight size={16} />
                </Button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>

      {/* ---- Candidates modal ---- */}
      <AnimatePresence>
        {memberProgram && (
          <Modal
            key={`members-${memberProgram.id}`}
            title={`Candidates · ${memberProgram.name}`}
            subtitle={`${getCategoryName(data, memberProgram.categoryId)} / ${memberProgram.format} / max ${memberProgram.maxPerTeam} members per team · ${
              data.memberProgramLimits
                ? `limit ${data.memberProgramLimits.stage} stage & ${data.memberProgramLimits.offStage} off-stage per member`
                : "no per-member limit set"
            }`}
            onClose={() => setMemberProgramId(null)}
            wide
          >
            {(() => {
              const entered = visibleEntries(memberProgram);
              const eligible = eligibleMembers(memberProgram);
              const allowedInVenue = venueLimit(memberProgram.categoryId, memberProgram.venue);
              const canSubmit = memberProgram.format === "Group" ? validSelection.length >= 2 : validSelection.length === 1;
              return (
                <div className="entry-manager">
                  <div className="entry-existing">
                    <h4>
                      Entered candidates <span>{entered.length}</span>
                    </h4>
                    {entered.length ? (
                      <div className="entry-chip-list">
                        <AnimatePresence initial={false}>
                          {entered.map((entry, index) => (
                            <motion.div
                              className="entry-chip"
                              key={entry.id}
                              layout
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 8 }}
                              transition={{ duration: 0.16 }}
                              style={{
                                borderLeftColor:
                                  memberProgram.format === "Group" ? GROUP_ACCENTS[index % GROUP_ACCENTS.length] : "var(--fz-border)",
                              }}
                            >
                              <div>
                                <strong>{entryLabel(data, entry, memberProgram)}</strong>
                                {memberProgram.format === "Group" && (
                                  <small>{entry.memberIds.map((memberId) => getMemberName(data, memberId)).join(" · ")}</small>
                                )}
                              </div>
                              <button type="button" onClick={() => removeEntry(memberProgram, entry.id)}>
                                Remove
                              </button>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    ) : (
                      <p className="muted">Nobody has entered this program yet.</p>
                    )}
                  </div>

                  <div className="entry-pick">
                    <h4>
                      Add {memberProgram.format === "Group" ? "a group" : "a member"}{" "}
                      <span>
                        {validSelection.length}
                        {memberProgram.format === "Group" ? ` / ${memberProgram.groupSize}` : ""} selected
                      </span>
                    </h4>
                    <p className="muted small-text">
                      {memberProgram.format === "Group"
                        ? "Pick 2 or more members from the same team. One group is one candidate and gets one code letter."
                        : "Members already entered or at their limit are unavailable."}
                    </p>
                    <div className="member-options">
                      {eligible.map((member) => {
                        const used = joinedIds.includes(member.id);
                        const atLimit = !used && limitReached(member, memberProgram.categoryId, memberProgram.venue);
                        const wrongTeam = memberProgram.format === "Group" && Boolean(chosenTeam) && chosenTeam !== member.teamId;
                        const picked = validSelection.includes(member.id);
                        const groupFull = memberProgram.format === "Group" && !picked && validSelection.length >= memberProgram.groupSize;
                        const full =
                          !picked &&
                          teamCount(memberProgram, member.teamId) + (chosenTeam === member.teamId ? validSelection.length : 0) >=
                            memberProgram.maxPerTeam;
                        const disabled = used || atLimit || wrongTeam || groupFull || full;
                        const reason = used
                          ? "Already entered"
                          : atLimit
                          ? `${memberProgram.venue} limit reached (${allowedInVenue})`
                          : full
                          ? "Team limit reached"
                          : wrongTeam
                          ? "Different team"
                          : groupFull
                          ? "Group is full"
                          : "";
                        return (
                          <label key={member.id} className={`member-option ${picked ? "is-picked" : ""} ${disabled ? "disabled" : ""}`}>
                            <input
                              type="checkbox"
                              checked={picked || used}
                              disabled={disabled}
                              onChange={() => toggleMember(member)}
                            />
                            <span>
                              <strong>{member.name}</strong>
                              <small>
                                {getTeamName(data, member.teamId)} · {getCategoryName(data, member.categoryId)}
                                {reason ? ` · ${reason}` : ""}
                              </small>
                            </span>
                          </label>
                        );
                      })}
                      {!eligible.length && <p className="muted">Add eligible members in the Members section first.</p>}
                    </div>
                    <Button disabled={!canSubmit} className="w-full" onClick={addEntry}>
                      <Plus size={16} /> Add {memberProgram.format === "Group" ? "group" : "candidate"}
                    </Button>
                  </div>
                </div>
              );
            })()}
          </Modal>
        )}
      </AnimatePresence>

      {/* ---- Assign judges ---- */}
      <AnimatePresence>
        {judgeProgram && (
          <Modal
            key={`judges-${judgeProgram.id}`}
            title={`Assign judges · ${judgeProgram.name}`}
            subtitle={`Judges only see programs assigned to them. Grading uses ${scaleName(judgeProgram.scaleId)}.`}
            onClose={() => setJudgeProgramId(null)}
          >
            <div className="form-stack">
              <div className="member-options judge-options">
                {judges.map((judge) => {
                  const picked = selectedJudges.includes(judge.id);
                  return (
                    <label className={`member-option ${picked ? "is-picked" : ""}`} key={judge.id}>
                      <input
                        type="checkbox"
                        checked={picked}
                        onChange={() =>
                          setSelectedJudges((previous) =>
                            previous.includes(judge.id) ? previous.filter((value) => value !== judge.id) : [...previous, judge.id]
                          )
                        }
                      />
                      <span>
                        <strong>{judge.name}</strong>
                        <small>{data.programs.filter((program) => program.judgeIds.includes(judge.id)).length} assigned programs</small>
                      </span>
                    </label>
                  );
                })}
                {!judges.length && (
                  <p className="muted">Add judges in Access Control first. Main users can still evaluate unassigned programs.</p>
                )}
              </div>
              <div className="form-actions">
                <Button variant="secondary" onClick={() => setJudgeProgramId(null)}>
                  Cancel
                </Button>
                <Button onClick={saveJudges}>
                  Save assignments <ArrowRight size={16} />
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ---- Assign stage managers ---- */}
      <AnimatePresence>
        {managerProgram && (
          <Modal
            key={`managers-${managerProgram.id}`}
            title={`Assign stage managers · ${managerProgram.name}`}
            subtitle="Once assigned, only these stage managers see this program in stage views. Assign two or more to share the load."
            onClose={() => setManagerProgramId(null)}
          >
            <div className="form-stack">
              <div className="member-options judge-options">
                {stageManagers.map((staff) => {
                  const picked = selectedManagers.includes(staff.id);
                  return (
                    <label className={`member-option ${picked ? "is-picked" : ""}`} key={staff.id}>
                      <input
                        type="checkbox"
                        checked={picked}
                        onChange={() =>
                          setSelectedManagers((previous) =>
                            previous.includes(staff.id) ? previous.filter((value) => value !== staff.id) : [...previous, staff.id]
                          )
                        }
                      />
                      <span>
                        <strong>{staff.name}</strong>
                        <small>{data.programs.filter((program) => (program.stageManagerIds || []).includes(staff.id)).length} assigned programs</small>
                      </span>
                    </label>
                  );
                })}
                {!stageManagers.length && (
                  <p className="muted">
                    Add stage managers in Access Control first. Programs without assignments stay visible to every stage manager.
                  </p>
                )}
              </div>
              <div className="form-actions">
                <Button variant="secondary" onClick={() => setManagerProgramId(null)}>
                  Cancel
                </Button>
                <Button onClick={saveManagers}>
                  Save assignments <ArrowRight size={16} />
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ---- Program details ---- */}
      <AnimatePresence>
        {detailProgram && (
          <Modal
            key={`detail-${detailProgram.id}`}
            title={detailProgram.name}
            subtitle={`${getCategoryName(data, detailProgram.categoryId)} · ${detailProgram.format} · ${detailProgram.venue}`}
            onClose={() => setDetailId(null)}
            wide
          >
            {detailProgram.description && <p className="muted program-detail-desc">{detailProgram.description}</p>}
            <div className="detail-list">
              <div>
                <span>Grade scale</span>
                <strong>{scaleName(detailProgram.scaleId)}</strong>
              </div>
              <div>
                <span>Max members per team</span>
                <strong>{detailProgram.maxPerTeam}</strong>
              </div>
              {detailProgram.format === "Group" && (
                <div>
                  <span>Group size</span>
                  <strong>Up to {detailProgram.groupSize} members</strong>
                </div>
              )}
              <div>
                <span>Assigned judges</span>
                <strong>
                  {detailProgram.judgeIds
                    .map((judgeId) => staffById(judgeId)?.name)
                    .filter(Boolean)
                    .join(", ") || "Main user"}
                </strong>
              </div>
              <div>
                <span>Stage managers</span>
                <strong>
                  {(detailProgram.stageManagerIds || [])
                    .map((staffId) => staffById(staffId)?.name)
                    .filter(Boolean)
                    .join(", ") || "All stage managers"}
                </strong>
              </div>
            </div>
            <h4 className="modal-subhead">Candidates ({visibleEntries(detailProgram).length})</h4>
            {visibleEntries(detailProgram).length ? (
              <div className="simple-list-stack">
                {visibleEntries(detailProgram).map((entry) => (
                  <div className="simple-list-row" key={entry.id}>
                    <span>{entryLabel(data, entry, detailProgram)}</span>
                    <span className="mono">{entry.codeLetter || "No code letter"}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">No candidates yet.</p>
            )}
          </Modal>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
