import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, ChevronRight, CornerUpLeft, Dices, Eye, Lock, Save } from "lucide-react";
import { Button, Empty, PageHead, SearchInput, StatusBadge, useViewPref, ViewToggle } from "../ui";
import {
  entryFinal,
  entryGrade,
  getCategoryName,
  getGrade,
  programReadyForJudgement,
  STATUSES,
  type FestData,
  type GradeScale,
  type Program,
} from "../types";
import { activeJudgesFor, isolatedViewForJudge, scoringMethodFor } from "../lib/fast";
import { canManage, entryDisplay, rankedEntries, stageManagerSees, type SectionProps } from "./common";

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

/** Unambiguous letters only: no I or O, so a code can't be misread as 1 or 0. */
const CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
/** Single letters plus every pair made of two different letters. */
const CODE_CAPACITY = CODE_LETTERS.length + CODE_LETTERS.length * (CODE_LETTERS.length - 1);

function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

/** Unique code letters: single letters first, then pairs of two different letters. */
function drawCodes(count: number): string[] {
  const singles = shuffle([...CODE_LETTERS]);
  if (count <= singles.length) return singles.slice(0, count);
  const pairs: string[] = [];
  for (const first of CODE_LETTERS) {
    for (const second of CODE_LETTERS) {
      if (first !== second) pairs.push(first + second);
    }
  }
  return [...singles, ...shuffle(pairs).slice(0, count - singles.length)];
}

/** Letters only, upper case, at most two: "a b" becomes "AB", "   " becomes "". */
export function cleanCode(raw: string): string {
  return raw.replace(/[^a-z]/gi, "").toUpperCase().slice(0, 2);
}

interface CodeProblem {
  error: string;
  invalid: string[];
}

/** The first problem with a set of code letters, or null when every candidate has a valid, unique code. */
function checkCodes(rows: { id: string; name: string }[], codes: Record<string, string>): CodeProblem | null {
  const seen = new Map<string, string>();
  for (const row of rows) {
    const code = cleanCode(codes[row.id] ?? "");
    if (!code) {
      return { error: `${row.name} needs a code letter. Spaces and symbols are not allowed.`, invalid: [row.id] };
    }
    if (code.length === 2 && code[0] === code[1]) {
      return { error: `"${code}" repeats one letter. Use two different letters.`, invalid: [row.id] };
    }
    const holder = seen.get(code);
    if (holder) {
      return { error: `Code "${code}" is used twice. Every candidate needs their own.`, invalid: [holder, row.id] };
    }
    seen.set(code, row.id);
  }
  return null;
}

/** A mark from 0 to 100 with at most two decimals, rounded to one (the precision grades use). */
export function parseMark(raw: string): number | null {
  const text = raw.trim();
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(text)) return null;
  const value = Number(text);
  if (value < 0 || value > 100) return null;
  return Math.round(value * 10) / 10;
}

/** Lets a judge type freely while blocking anything outside 0–100. */
function acceptsMarkInput(raw: string): boolean {
  if (raw === "") return true;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

function matchesText(query: string, ...fields: string[]): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const haystack = fields.join(" ").toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

function formatTime(iso?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Why a program cannot move to its next step yet, or null when it can. */
function nextBlocker(program: Program): string | null {
  if (program.status >= 5) return "Already published";
  const target = program.status + 1;
  if (!program.entries.length) return "Add candidates first";
  if (target >= 1 && !program.entries.every((entry) => cleanCode(entry.codeLetter ?? "").length > 0)) {
    return "Code letters are missing";
  }
  if (target >= 2 && !program.judgeIds.length) return "Assign a judge panel first";
  if (target >= 3 && !programReadyForJudgement(program)) return "Waiting for every judge's marks";
  if (target === 5 && program.status < 4) return "Finalise before publishing";
  if (target === 5 && !program.monitorConfirmed) return "Waiting for monitor confirmation";
  return null;
}

function nextLabel(program: Program): string {
  if (program.status >= 5) return "Published";
  if (program.status === 4) return "Publish result";
  return `Move to ${STATUSES[program.status + 1]}`;
}

const nextResultNumber = (programs: Program[]) =>
  Math.max(0, ...programs.map((program) => program.resultNumber ?? 0)) + 1;

/** Status badge that pops whenever its status changes (re-keyed by the parent). */
function StatusPop({ status }: { status: number }) {
  return (
    <motion.span
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 520, damping: 22 }}
      style={{ display: "inline-flex" }}
    >
      <StatusBadge status={status} />
    </motion.span>
  );
}

/* ------------------------------------------------------------------ */
/* Program control                                                     */
/* ------------------------------------------------------------------ */

function ControlRow({
  program,
  data,
  canUpdate,
  onAdvance,
  onUndo,
}: {
  program: Program;
  data: FestData;
  canUpdate: boolean;
  onAdvance: () => void;
  onUndo: () => void;
}) {
  const blocker = nextBlocker(program);
  // Publishing is locked until the Monitor section confirms the result.
  const note =
    program.status === 4 ? (
      program.monitorConfirmed ? (
        <span className="control-note ok"><Check size={12} /> Monitor confirmed · ready to publish</span>
      ) : (
        <span className="control-note wait"><Lock size={12} /> Waiting for monitor confirmation</span>
      )
    ) : blocker && canUpdate && program.status < 5 ? (
      <span className="control-note wait"><Lock size={12} /> {blocker}</span>
    ) : null;
  return (
    <div className="control-row">
      <div className="control-main">
        <span className="control-category">
          {getCategoryName(data, program.categoryId)} / {program.venue}
        </span>
        <h3>{program.name}</h3>
        <p>
          {program.entries.length} {program.format === "Group" ? "groups" : "candidates"} · {program.format}
          {program.resultNumber ? ` · Result #${program.resultNumber}` : ""}
        </p>
        {note}
      </div>
      <div className="control-actions">
        <StatusPop key={program.status} status={program.status} />
        {canUpdate && (
          <>
            <Button
              className="next-control"
              onClick={onAdvance}
              disabled={Boolean(blocker)}
              title={blocker ?? undefined}
              icon={<ArrowRight size={15} />}
            >
              {nextLabel(program)}
            </Button>
            <button
              type="button"
              className="undo-control"
              onClick={onUndo}
              disabled={program.status < 0}
              aria-label={`Undo the last step for ${program.name}`}
            >
              <CornerUpLeft size={14} /> Undo
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function ControlSection({
  fest,
  user,
  onChange,
  notify,
  stageOnly = false,
}: SectionProps & { stageOnly?: boolean }) {
  const data = fest.data;
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [venueFilter, setVenueFilter] = useState("");
  const [formatFilter, setFormatFilter] = useState("");
  const [view, setView] = useViewPref(`control-${stageOnly ? "stage" : "program"}:${fest.id}:${user.id}`);
  const canUpdate = canManage(user) || (stageOnly && (user.role === "MONITOR" || user.role === "STAGE MANAGER"));
  const statusOf = (program: Program) => (program.status < 0 ? "unstarted" : String(program.status));
  const statusOptions: [string, string][] = stageOnly
    ? [["", "All states"], ["unstarted", "Not started"], ["0", "Reporting"], ["1", "Started"]]
    : [
        ["", "All states"],
        ["unstarted", "Not started"],
        ["0", "Reporting"],
        ["1", "Started"],
        ["2", "Finished"],
        ["3", "Judgements"],
        ["4", "Finalysed"],
        ["5", "Published"],
      ];
  const programs = data.programs.filter(
    (program) =>
      (!stageOnly || program.status < 2) &&
      stageManagerSees(program, user) &&
      (!statusFilter || statusOf(program) === statusFilter) &&
      (!categoryFilter || program.categoryId === categoryFilter) &&
      (!venueFilter || program.venue === venueFilter) &&
      (!formatFilter || program.format === formatFilter) &&
      matchesText(query, program.name, getCategoryName(data, program.categoryId))
  );
  const counts = [
    { name: "Not started", count: data.programs.filter((program) => program.status < 0).length },
    ...STATUSES.map((name, index) => ({
      name,
      count: data.programs.filter((program) => program.status === index).length,
    })),
  ];

  const advance = (program: Program) => {
    if (!canUpdate) return;
    const blocker = nextBlocker(program);
    if (blocker) return notify(blocker);
    const target = program.status + 1;
    onChange(
      (current) => ({
        ...current,
        programs: current.programs.map((item) =>
          item.id === program.id
            ? {
                ...item,
                status: target,
                resultNumber: target === 5 ? nextResultNumber(current.programs) : item.resultNumber,
              }
            : item
        ),
      }),
      `${program.name} moved to ${STATUSES[target]}`
    );
    notify(`${program.name} · ${STATUSES[target]}`);
  };

  const undo = (program: Program) => {
    if (!canUpdate || program.status < 0) return;
    if (program.status === 5 && !window.confirm(`Unpublish "${program.name}"? It will leave the public board.`)) return;
    const target = program.status - 1;
    onChange(
      (current) => ({
        ...current,
        programs: current.programs.map((item) =>
          item.id === program.id
            ? {
                ...item,
                status: target,
                resultNumber: program.status === 5 ? undefined : item.resultNumber,
                monitorConfirmed: target < 3 ? false : item.monitorConfirmed,
                monitorConfirmedAt: target < 3 ? undefined : item.monitorConfirmedAt,
              }
            : item
        ),
        publicProgramIds:
          program.status === 5
            ? current.publicProgramIds.filter((programId) => programId !== program.id)
            : current.publicProgramIds,
      }),
      `${program.name} returned to ${target < 0 ? "Not started" : STATUSES[target]}`
    );
    notify(`Undid the last step for ${program.name}`);
  };

  const rows = programs.map((program) => (
    <motion.div
      key={program.id}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2 }}
    >
      <ControlRow
        program={program}
        data={data}
        canUpdate={canUpdate}
        onAdvance={() => advance(program)}
        onUndo={() => undo(program)}
      />
    </motion.div>
  ));

  const cards = programs.map((program) => {
    const blocker = nextBlocker(program);
    return (
      <motion.div
        key={program.id}
        layout
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.18 }}
        className="mini-card"
        data-program-id={program.id}
      >
        <div className="mini-card-head">
          <div className="mini-card-title">
            <strong>{program.name}</strong>
            <small>
              {getCategoryName(data, program.categoryId)} / {program.venue}
            </small>
          </div>
          <StatusPop key={program.status} status={program.status} />
        </div>
        <div className="mini-card-meta">
          <span>
            {program.entries.length} {program.format === "Group" ? "groups" : "candidates"}
          </span>
          <span>{program.format}</span>
        </div>
        {canUpdate && (
          <div className="mini-card-actions">
            <Button
              size="sm"
              className="mini-btn"
              onClick={() => advance(program)}
              disabled={Boolean(blocker)}
              title={blocker ?? undefined}
            >
              {nextLabel(program)}
            </Button>
            <button
              type="button"
              className="undo-control"
              onClick={() => undo(program)}
              disabled={program.status < 0}
            >
              <CornerUpLeft size={13} /> Undo
            </button>
          </div>
        )}
      </motion.div>
    );
  });

  return (
    <>
      <PageHead
        eyebrow={stageOnly ? "LIVE / STAGE FLOW" : "LIVE / PROGRAM FLOW"}
        title={stageOnly ? "Stage Control" : "Program Control"}
        description={
          stageOnly
            ? "What is coming up, reporting, or happening on stage."
            : "Move each program forward, one completed step at a time."
        }
      />
      <div className="control-stats">
        {counts.map((item) => (
          <div key={item.name}>
            <strong>{String(item.count).padStart(2, "0")}</strong>
            <span>{item.name}</span>
          </div>
        ))}
      </div>
      <div className="section-toolbar">
        <SearchInput value={query} onChange={setQuery} placeholder="Search programs" />
        <ViewToggle mode={view} onChange={setView} />
        <select aria-label="Filter by state" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          {statusOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select aria-label="Filter by category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
          <option value="">All categories</option>
          {data.categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select aria-label="Filter by venue" value={venueFilter} onChange={(event) => setVenueFilter(event.target.value)}>
          <option value="">Stage + off stage</option>
          <option value="Stage">Stage</option>
          <option value="Off stage">Off stage</option>
        </select>
        <select aria-label="Filter by format" value={formatFilter} onChange={(event) => setFormatFilter(event.target.value)}>
          <option value="">Individual + group</option>
          <option value="Individual">Individual</option>
          <option value="Group">Group</option>
        </select>
        <span className="toolbar-count">{programs.length} visible</span>
      </div>
      {programs.length ? (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
          >
            {view === "box" ? (
              <div className="card-grid">
                <AnimatePresence initial={false}>{cards}</AnimatePresence>
              </div>
            ) : (
              <div className="control-list">
                <AnimatePresence initial={false}>{rows}</AnimatePresence>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      ) : (
        <Empty
          title={stageOnly ? "The stage is clear" : "No programs here yet"}
          description={
            stageOnly
              ? "Programs disappear from stage control when they finish."
              : "Create a program to begin moving your fest forward."
          }
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Code letters                                                        */
/* ------------------------------------------------------------------ */

export function CodeLetterSection({ fest, user, onChange, notify }: SectionProps) {
  const data = fest.data;
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [spinKey, setSpinKey] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const active = activeId ? data.programs.find((program) => program.id === activeId) : undefined;

  useEffect(() => {
    if (!spinning) return;
    const timer = window.setTimeout(() => setSpinning(false), 420);
    return () => window.clearTimeout(timer);
  }, [spinning]);

  const waiting = data.programs.filter(
    (program) =>
      program.status === 0 &&
      stageManagerSees(program, user) &&
      matchesText(query, program.name, getCategoryName(data, program.categoryId))
  );

  const open = (program: Program) => {
    setCodes(Object.fromEntries(program.entries.map((entry): [string, string] => [entry.id, entry.codeLetter ?? ""])));
    setActiveId(program.id);
  };

  /** Gives every candidate a different letter, shuffled. */
  const spinAll = () => {
    if (!active || !active.entries.length) return notify("Add candidates before drawing code letters.");
    const drawn = drawCodes(active.entries.length);
    if (drawn.length < active.entries.length) {
      return notify(`A program can hold at most ${CODE_CAPACITY} unique code letters.`);
    }
    setCodes(Object.fromEntries(active.entries.map((entry, index): [string, string] => [entry.id, drawn[index]])));
    setSpinning(true);
    setSpinKey((key) => key + 1);
    notify(`Drew ${drawn.length} unique code ${drawn.length === 1 ? "letter" : "letters"}.`);
  };

  /** Spins one candidate's letter, avoiding codes already used by the others. */
  const spinOne = (entryId: string) => {
    if (!active) return;
    const taken = new Set(active.entries.filter((entry) => entry.id !== entryId).map((entry) => cleanCode(codes[entry.id] ?? "")));
    const free = drawCodes(CODE_CAPACITY).find((code) => !taken.has(code));
    if (!free) return notify("No unused code letters are left for this program.");
    setCodes((current) => ({ ...current, [entryId]: free }));
  };

  const save = () => {
    if (!active) return;
    if (!active.entries.length) return notify("Add candidates before assigning code letters.");
    const rows = active.entries.map((entry) => ({ id: entry.id, name: entryDisplay(active, entry, data) }));
    const problem = checkCodes(rows, codes);
    if (problem) return notify(problem.error);
    const finalCodes: Record<string, string> = Object.fromEntries(
      active.entries.map((entry): [string, string] => [entry.id, cleanCode(codes[entry.id] ?? "")])
    );
    onChange(
      (current) => ({
        ...current,
        programs: current.programs.map((program) =>
          program.id !== active.id
            ? program
            : {
                ...program,
                entries: program.entries.map((entry) => ({ ...entry, codeLetter: finalCodes[entry.id] })),
                status: program.status === 0 ? 1 : program.status,
              }
        ),
      }),
      `Code letters saved for ${active.name}`
    );
    setActiveId(null);
    notify(`${active.name} is now Started`);
  };

  if (active) {
    const rows = active.entries.map((entry) => ({ id: entry.id, name: entryDisplay(active, entry, data) }));
    const problem = checkCodes(rows, codes);
    const invalid = new Set(problem?.invalid ?? []);
    const filled = rows.filter((row) => cleanCode(codes[row.id] ?? "")).length;
    const percent = rows.length ? (filled / rows.length) * 100 : 0;
    return (
      <>
        <PageHead
          back={() => setActiveId(null)}
          eyebrow="LIVE / CODE LETTERS"
          title={active.name}
          description="Give every candidate their own letter. Judges only ever see these codes."
          action={
            <div className="button-row">
              <Button variant="secondary" onClick={spinAll} icon={<Dices size={16} />}>
                Spin all
              </Button>
              <Button onClick={save} icon={<Save size={16} />}>
                Save
              </Button>
            </div>
          }
        />
        <div className="judge-progress" aria-live="polite">
          <span className="fast-submitted">
            {filled}/{rows.length} code letters set
          </span>
          <div className="judge-progress-bar">
            <motion.span animate={{ width: `${percent}%` }} transition={{ duration: 0.3 }} />
          </div>
        </div>
        <div className={`sheet-container ${spinning ? "is-spinning" : ""}`}>
          <div className="sheet-header">
            <span>CANDIDATE</span>
            <span>CODE LETTER</span>
          </div>
          {rows.map((row) => {
            const value = cleanCode(codes[row.id] ?? "");
            return (
              <div key={row.id} className="code-row">
                <div>
                  <strong>{row.name}</strong>
                  <small>{getCategoryName(data, active.categoryId)}</small>
                </div>
                <div className="code-field">
                  <motion.span
                    key={`${value || "empty"}:${spinKey}`}
                    className="code-tile"
                    initial={{ rotateX: -90, opacity: 0 }}
                    animate={{ rotateX: 0, opacity: 1 }}
                    transition={{ duration: 0.25 }}
                    aria-hidden="true"
                  >
                    {value || "–"}
                  </motion.span>
                  <input
                    aria-label={`Code letter for ${row.name}`}
                    aria-invalid={invalid.has(row.id)}
                    value={codes[row.id] ?? ""}
                    maxLength={2}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="A or AB"
                    onChange={(event) => {
                      const next = cleanCode(event.target.value);
                      setCodes((current) => ({ ...current, [row.id]: next }));
                    }}
                  />
                  <button
                    type="button"
                    className="code-spin"
                    title="Spin this letter"
                    aria-label={`Spin code letter for ${row.name}`}
                    onClick={() => spinOne(row.id)}
                  >
                    <Dices size={15} />
                  </button>
                </div>
              </div>
            );
          })}
          {problem && (
            <p className="code-error" role="alert">
              {problem.error}
            </p>
          )}
          <div className="sheet-footer">
            <Button variant="secondary" onClick={() => setActiveId(null)}>
              Cancel
            </Button>
            <Button onClick={save} icon={<Save size={16} />}>
              Save and start
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHead
        eyebrow="LIVE / ANONYMITY"
        title="Code Letter Entry"
        description="Open a program, spin the code letters, then save to send it on to judging."
      />
      <div className="section-toolbar">
        <SearchInput value={query} onChange={setQuery} placeholder="Search reporting programs" />
        <span className="toolbar-count">{waiting.length} awaiting entry</span>
      </div>
      {waiting.length ? (
        <div className="click-list">
          <AnimatePresence initial={false}>
            {waiting.map((program) => (
              <motion.button
                key={program.id}
                layout
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                whileHover={{ y: -2 }}
                onClick={() => open(program)}
              >
                <div>
                  <span className="eyebrow">{getCategoryName(data, program.categoryId)}</span>
                  <h3>{program.name}</h3>
                  <p>{program.entries.length} candidates waiting for code letters</p>
                </div>
                <ChevronRight size={20} />
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <Empty title="All code letters are caught up" description="Programs will appear here when they reach Reporting." />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Judgement                                                           */
/* ------------------------------------------------------------------ */

/**
 * FAST — Multi-Judge Scoring UI.
 * - Any panel size: the roster comes from program.judgeIds.
 * - Judges see only anonymous codes, their own marks, and how many judges have
 *   submitted. Other judges' raw marks are never rendered.
 * - Formula: fewer than 5 judges use the dynamic average; 5 or more use the
 *   Olympic trimmed mean.
 */
export function JudgementSection({ fest, user, onChange, notify }: SectionProps) {
  const data = fest.data;
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const judgeId = user.role === "MAIN" ? "main" : user.id;
  const assigned = data.programs.filter((program) => program.judgeIds.includes(user.id));
  const active = activeId ? assigned.find((program) => program.id === activeId) : undefined;
  const scaleFor = (program: Program): GradeScale | undefined =>
    data.scales.find((scale) => scale.id === program.scaleId) ?? data.scales[0];
  const methodLabel = (program: Program) => {
    const panel = activeJudgesFor(program);
    return scoringMethodFor(panel.length, program.scoringMethod) === "trimmed"
      ? `Olympic trimmed mean · ${panel.length} judges`
      : `Dynamic average · ${panel.length} judge${panel.length === 1 ? "" : "s"}`;
  };
  const markedBy = (program: Program) => program.entries.filter((entry) => typeof entry.marks[judgeId] === "number").length;

  // Main user: watch-only. No marks, counts or scores.
  if (user.role === "MAIN") {
    const beingJudged = data.programs.filter(
      (program) =>
        program.status === 2 && matchesText(query, program.name, getCategoryName(data, program.categoryId))
    );
    return (
      <>
        <PageHead
          eyebrow="EVALUATION / SPECTATING"
          title="Judgement"
          description="A watch-only view of the programs currently with the judges. Marks are entered privately on each judge's own device."
        />
        <div className="spectate-banner">
          <Eye size={15} />
          <strong>Spectating</strong>
          <span>Watch only · program names and categories under judgement</span>
        </div>
        <div className="section-toolbar">
          <SearchInput value={query} onChange={setQuery} placeholder="Search programs" />
          <span className="toolbar-count">{beingJudged.length} under judgement</span>
        </div>
        {beingJudged.length ? (
          <div className="spectate-list">
            <AnimatePresence initial={false}>
              {beingJudged.map((program) => (
                <motion.div
                  key={program.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="spectate-row"
                >
                  <div>
                    <span className="eyebrow">{getCategoryName(data, program.categoryId)}</span>
                    <h3>{program.name}</h3>
                  </div>
                  <span className="spectate-live">
                    <span className="fast-pulse" /> With the judges
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <Empty
            title="Nothing is being judged right now"
            description="Programs appear here once they finish on stage and move to the judges."
          />
        )}
      </>
    );
  }

  const queue = assigned.filter(
    (program) =>
      program.status === 2 &&
      program.entries.length > 0 &&
      matchesText(query, program.name, getCategoryName(data, program.categoryId))
  );
  const toScore = queue.filter((program) => markedBy(program) < program.entries.length);
  const saved = queue.filter((program) => markedBy(program) === program.entries.length);

  const open = (program: Program) => {
    setMarks(
      Object.fromEntries(
        program.entries.map((entry): [string, string] => [
          entry.id,
          typeof entry.marks[judgeId] === "number" ? String(entry.marks[judgeId]) : "",
        ])
      )
    );
    setActiveId(program.id);
  };

  const save = () => {
    if (!active) return;
    const parsed = active.entries.map((entry) => ({ entry, mark: parseMark(marks[entry.id] ?? "") }));
    const missing = parsed.filter((row) => row.mark === null).length;
    if (missing) {
      return notify(`Enter a mark from 0 to 100 for ${missing} code${missing === 1 ? "" : "s"} (up to two decimals).`);
    }
    const updatedEntries = parsed.map(({ entry, mark }) => ({
      ...entry,
      marks: { ...entry.marks, [judgeId]: mark as number },
    }));
    const ready = programReadyForJudgement({ ...active, entries: updatedEntries });
    const hasBonus = Boolean(active.placeBonus && (active.placeBonus.first || active.placeBonus.second || active.placeBonus.third));

    onChange(
      (current) => ({
        ...current,
        programs: current.programs.map((program) =>
          program.id !== active.id
            ? program
            : {
                ...program,
                entries: updatedEntries,
                status: ready && program.status === 2 ? 3 : program.status,
              }
        ),
      }),
      `${user.name} saved marks for ${active.name}`
    );
    setActiveId(null);
    notify(
      ready
        ? hasBonus
          ? "All judges are in. Place bonus marks are included in the program mark — moved to Judgements."
          : "All judges are in. Program moved to Judgements."
        : hasBonus
        ? "Your marks are saved (podium bonus marks are active for the program mark). Waiting for other judges."
        : "Your marks are saved. Waiting for the other judges."
    );
  };

  if (active) {
    const view = isolatedViewForJudge(active, judgeId);
    const panel = activeJudgesFor(active);
    const scale = scaleFor(active);
    const rows = active.entries.map((entry) => ({ entry, raw: marks[entry.id] ?? "", mark: parseMark(marks[entry.id] ?? "") }));
    const entered = rows.filter((row) => row.mark !== null).length;
    return (
      <>
        <PageHead
          back={() => setActiveId(null)}
          eyebrow="EVALUATION / SCORING"
          title={active.name}
          description={`Marks are private. Grades follow ${scale?.name ?? "the program's scale"}.`}
        />
        <div className="fast-method">
          <Lock size={13} /> Confidential sheet · {methodLabel(active)}
        </div>
        <div className="judge-progress" aria-live="polite">
          <span className="fast-submitted">
            You have marked {entered}/{active.entries.length}
          </span>
          <div className="judge-progress-bar">
            <motion.span
              animate={{ width: `${active.entries.length ? (entered / active.entries.length) * 100 : 0}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
        <p className="judgement-note">
          Only anonymous code letters appear here. Marks are out of 100, with up to two decimals (saved to one).
          Other judges' marks stay hidden; you only see how many have submitted.
        </p>
        <div className="sheet-container">
          <div className="sheet-header judgement-columns">
            <span>CODE</span>
            <span>MARK / 100</span>
            <span>GRADE</span>
            <span>POINTS</span>
          </div>
          {rows.map(({ entry, raw, mark }) => {
            const invalid = raw !== "" && mark === null;
            const grade = mark !== null ? getGrade(mark, scale) : null;
            const submitted = view.submittedCounts[entry.id] ?? 0;
            return (
              <div key={entry.id} className="judge-row judgement-columns">
                <div className="code-identity">
                  {entry.codeLetter || "—"}
                  <small className="fast-submitted">
                    {submitted}/{panel.length} submitted
                  </small>
                </div>
                <div>
                  <input
                    aria-label={`Mark for code ${entry.codeLetter ?? "unknown"}`}
                    aria-invalid={invalid}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={100}
                    step={0.1}
                    value={raw}
                    placeholder="0–100"
                    onChange={(event) => {
                      const next = event.target.value;
                      if (acceptsMarkInput(next)) setMarks((current) => ({ ...current, [entry.id]: next }));
                    }}
                    onBlur={() => {
                      if (mark !== null) setMarks((current) => ({ ...current, [entry.id]: String(mark) }));
                    }}
                  />
                  <small>{invalid ? "Use up to two decimals" : "Out of 100"}</small>
                </div>
                <strong>{grade?.name ?? "—"}</strong>
                <strong>{grade?.points ?? "—"}</strong>
              </div>
            );
          })}
          <div className="sheet-footer">
            <Button variant="secondary" onClick={() => setActiveId(null)}>
              Back
            </Button>
            <Button onClick={save}>
              Save my marks <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHead
        eyebrow="EVALUATION / JUDGES"
        title="Judgement"
        description="Only programs assigned to you appear here once they have finished. Your sheet is confidential."
      />
      <div className="section-toolbar">
        <SearchInput value={query} onChange={setQuery} placeholder="Search assigned programs" />
        <span className="toolbar-count">
          {toScore.length} to score · {saved.length} saved
        </span>
      </div>
      {queue.length ? (
        <>
          {toScore.length > 0 && (
            <>
              <div className="monitor-group-label">To score · {toScore.length}</div>
              <div className="click-list">
                <AnimatePresence initial={false}>
                  {toScore.map((program) => (
                    <JudgeQueueItem key={program.id} program={program} data={data} marked={markedBy(program)} scale={scaleFor(program)?.name} method={methodLabel(program)} onOpen={() => open(program)} />
                  ))}
                </AnimatePresence>
              </div>
            </>
          )}
          {saved.length > 0 && (
            <>
              <div className="monitor-group-label done">
                <Check size={12} /> Your marks are in · waiting for other judges · {saved.length}
              </div>
              <div className="click-list">
                <AnimatePresence initial={false}>
                  {saved.map((program) => (
                    <JudgeQueueItem key={program.id} program={program} data={data} marked={markedBy(program)} scale={scaleFor(program)?.name} method={methodLabel(program)} onOpen={() => open(program)} />
                  ))}
                </AnimatePresence>
              </div>
            </>
          )}
        </>
      ) : (
        <Empty title="Nothing to judge right now" description="Assigned programs appear here after they have finished on stage." />
      )}
    </>
  );
}

function JudgeQueueItem({
  program,
  data,
  marked,
  scale,
  method,
  onOpen,
}: {
  program: Program;
  data: FestData;
  marked: number;
  scale?: string;
  method: string;
  onOpen: () => void;
}) {
  const total = program.entries.length;
  return (
    <motion.button
      layout
      type="button"
      className="judge-queue-item"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      whileHover={{ y: -2 }}
      onClick={onOpen}
    >
      <div>
        <span className="eyebrow">
          {getCategoryName(data, program.categoryId)}
          {scale ? ` · ${scale}` : ""}
        </span>
        <h3>{program.name}</h3>
        <p>
          {total} anonymous codes · {method}
        </p>
      </div>
      <div className="judge-queue-meta">
        <span className={`chip ${marked === total ? "on" : ""}`}>
          {marked}/{total} marked
        </span>
        <ChevronRight size={20} />
      </div>
    </motion.button>
  );
}

/* ------------------------------------------------------------------ */
/* Monitor / media                                                     */
/* ------------------------------------------------------------------ */

type MonitorItem = { key: string; program?: Program; label?: string; done?: boolean };

export function MonitorSection({ fest, user, onChange, notify, mediaOnly = false }: SectionProps & { mediaOnly?: boolean }) {
  const data = fest.data;
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [view, setView] = useViewPref(`monitor-${mediaOnly ? "media" : "monitor"}:${fest.id}:${user.id}`);
  /** The result just confirmed: briefly highlighted and scrolled into view. */
  const [movedId, setMovedId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!movedId) return;
    // Wait one frame so the list has laid out; skip quietly if the row is not on screen.
    const frame = window.requestAnimationFrame(() => {
      const nodes = Array.from(listRef.current?.querySelectorAll<HTMLElement>("[data-program-id]") ?? []);
      const target = nodes.find((node) => node.dataset.programId === movedId);
      if (target && typeof target.scrollIntoView === "function") {
        target.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    });
    const timer = window.setTimeout(() => setMovedId(null), 2600);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [movedId]);

  const stateOf = (program: Program) => (program.status === 5 ? "published" : program.monitorConfirmed ? "confirmed" : "pending");
  const statusText = (program: Program) =>
    program.status === 5 ? "Published" : program.monitorConfirmed ? "Confirmed" : "Awaiting confirmation";
  const programs = data.programs.filter(
    (program) =>
      program.status >= 3 &&
      (!mediaOnly || program.monitorConfirmed) &&
      (!stateFilter || stateOf(program) === stateFilter) &&
      (!catFilter || program.categoryId === catFilter) &&
      matchesText(query, program.name, getCategoryName(data, program.categoryId))
  );
  // Unconfirmed results stay on top; confirmed ones sink below, oldest first.
  const pending = programs.filter((program) => !program.monitorConfirmed);
  const confirmed = programs
    .filter((program) => program.monitorConfirmed)
    .sort((a, b) => (a.monitorConfirmedAt ?? "").localeCompare(b.monitorConfirmedAt ?? ""));
  const ordered = [...pending, ...confirmed];
  const active = activeId ? data.programs.find((program) => program.id === activeId) : undefined;
  const canConfirm = !mediaOnly && (user.role === "MAIN" || user.role === "MONITOR");

  const confirm = () => {
    if (!active || !canConfirm) return;
    const at = new Date().toISOString();
    onChange(
      (current) => ({
        ...current,
        programs: current.programs.map((program) =>
          program.id === active.id ? { ...program, monitorConfirmed: true, monitorConfirmedAt: at } : program
        ),
      }),
      `${active.name} confirmed in Monitor`
    );
    setMovedId(active.id);
    setActiveId(null);
    notify(`${active.name} confirmed. It can now be published in Program Control.`);
  };

  if (active) {
    const bannerTone = active.status === 5 ? "is-published" : active.monitorConfirmed ? "is-confirmed" : "is-pending";
    const bannerText =
      active.status === 5
        ? "Published to the public board."
        : active.monitorConfirmed
          ? `Confirmed${formatTime(active.monitorConfirmedAt) ? ` at ${formatTime(active.monitorConfirmedAt)}` : ""}. Ready for publishing in Program Control.`
          : "Not confirmed yet. Publishing stays locked until the monitor confirms this result.";
    return (
      <>
        <PageHead
          back={() => setActiveId(null)}
          eyebrow={mediaOnly ? "MEDIA / APPROVED" : "RESULT REVIEW"}
          title={active.name}
          description={`${getCategoryName(data, active.categoryId)} · ${active.entries.length} candidates. Shown as grade points, never raw marks.`}
        />
        <motion.div className={`result-banner ${bannerTone}`} role="status" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
          {active.monitorConfirmed ? <Check size={16} /> : <Lock size={16} />}
          <strong>{statusText(active)}</strong>
          <span>{bannerText}</span>
        </motion.div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>RANK</th>
                <th>CANDIDATE</th>
                <th>CODE LETTER</th>
                <th>GRADE</th>
                <th>GRADE POINTS</th>
              </tr>
            </thead>
            <tbody>
              {rankedEntries(active, data).map((entry, index) => {
                const grade = entryGrade(entry, active, data);
                const score = entryFinal(entry, active);
                return (
                  <tr key={entry.id}>
                    <td className="mono">{String(index + 1).padStart(2, "0")}</td>
                    <td>
                      <strong>{entryDisplay(active, entry, data)}</strong>
                      {score.bonus > 0 && (
                        <small className="muted" style={{ display: "block" }}>
                          Program mark {score.mark} ({score.rawMark} + {score.bonus} place bonus)
                        </small>
                      )}
                    </td>
                    <td className="mono">{entry.codeLetter || "—"}</td>
                    <td>{grade?.name || "—"}</td>
                    <td className="mono">{grade?.points ?? "No grade"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {canConfirm && (
          <div className="bottom-action">
            <Button onClick={confirm} icon={<Check size={17} />}>
              {active.monitorConfirmed ? "Confirmed · confirm again" : "Confirm result"}
            </Button>
            <p>Confirming moves this result below the others and unlocks publishing in Program Control. It does not publish by itself.</p>
          </div>
        )}
      </>
    );
  }

  const rowItems: MonitorItem[] = [];
  if (!mediaOnly && pending.length) rowItems.push({ key: "label-pending", label: `Awaiting confirmation · ${pending.length}` });
  pending.forEach((program) => rowItems.push({ key: program.id, program }));
  if (!mediaOnly && confirmed.length) rowItems.push({ key: "label-confirmed", label: `Confirmed · ${confirmed.length}`, done: true });
  confirmed.forEach((program) => rowItems.push({ key: program.id, program }));

  const renderRow = (program: Program) => (
    <motion.button
      key={program.id}
      layout
      type="button"
      data-program-id={program.id}
      className={program.id === movedId ? "just-moved" : undefined}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={() => setActiveId(program.id)}
    >
      <div>
        <span className="eyebrow">
          {getCategoryName(data, program.categoryId)} · {statusText(program)}
        </span>
        <h3>{program.name}</h3>
        <p>
          {program.entries.length} candidates · {data.scales.find((scale) => scale.id === program.scaleId)?.name ?? "No scale"}
        </p>
      </div>
      <span className="click-end">
        {program.monitorConfirmed && (
          <span className="review-tick" title="Confirmed">
            <Check size={16} />
          </span>
        )}
        <ChevronRight size={20} />
      </span>
    </motion.button>
  );

  const renderCard = (program: Program) => (
    <motion.button
      key={program.id}
      layout
      type="button"
      data-program-id={program.id}
      className={`mini-card card-button ${program.id === movedId ? "just-moved" : ""}`}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.18 }}
      onClick={() => setActiveId(program.id)}
    >
      <div className="mini-card-head">
        <div className="mini-card-title">
          <strong>{program.name}</strong>
          <small>
            {getCategoryName(data, program.categoryId)} · {statusText(program)}
          </small>
        </div>
        {program.monitorConfirmed && (
          <span className="review-tick" title="Confirmed">
            <Check size={15} />
          </span>
        )}
      </div>
      <div className="mini-card-meta">
        <span>{program.entries.length} candidates</span>
        <span>{data.scales.find((scale) => scale.id === program.scaleId)?.name ?? "No scale"}</span>
      </div>
    </motion.button>
  );

  return (
    <>
      <PageHead
        eyebrow={mediaOnly ? "RESULTS / MEDIA" : "RESULTS / REVIEW"}
        title={mediaOnly ? "Media" : "Monitor"}
        description={
          mediaOnly
            ? "Results confirmed by the monitor, ready for your creative team."
            : "Check scored results before they reach the public. A result can only be published after it is confirmed here."
        }
      />
      <div className="section-toolbar">
        <SearchInput value={query} onChange={setQuery} placeholder="Search results" />
        <ViewToggle mode={view} onChange={setView} />
        <select aria-label="Filter by category" value={catFilter} onChange={(event) => setCatFilter(event.target.value)}>
          <option value="">All categories</option>
          {data.categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        {!mediaOnly && (
          <select aria-label="Filter by state" value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}>
            <option value="">All states</option>
            <option value="pending">Awaiting confirmation</option>
            <option value="confirmed">Confirmed</option>
            <option value="published">Published</option>
          </select>
        )}
        <span className="toolbar-count">
          {mediaOnly ? `${confirmed.length} results` : `${pending.length} awaiting · ${confirmed.length} confirmed`}
        </span>
      </div>
      <div ref={listRef}>
        {ordered.length ? (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
            >
              {view === "box" ? (
                <div className="card-grid">
                  <AnimatePresence initial={false}>{ordered.map(renderCard)}</AnimatePresence>
                </div>
              ) : (
                <div className="click-list">
                  <AnimatePresence initial={false}>
                    {rowItems.map((item) =>
                      item.program ? (
                        renderRow(item.program)
                      ) : (
                        <motion.div
                          key={item.key}
                          layout
                          className={`monitor-group-label ${item.done ? "done" : ""}`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        >
                          {item.done && <Check size={12} />} {item.label}
                        </motion.div>
                      )
                    )}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        ) : (
          <Empty
            title={mediaOnly ? "No approved results yet" : "No results to review"}
            description={mediaOnly ? "Confirmed monitor results appear here." : "Judged programs arrive here for review."}
          />
        )}
      </div>
    </>
  );
}
