import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, MotionConfig, type Variants } from "framer-motion";
import { ArrowRight, Check, ChevronLeft, ChevronRight, Download, Eye, FileDown, ImagePlus, Sparkles } from "lucide-react";
import { printLogoSrc } from "../lib/brand";
import { askToDownload, Button, DownloadPreview, Empty, Field, Modal, PageHead, PrintLogo, SearchInput, StatusBadge } from "../ui";
import {
  entryGrade,
  entryMark,
  getCategoryName,
  getMemberName,
  getTeamName,
  quizPointsFor,
  templateCoversResult,
  type FestData,
  type Member,
  type Program,
  type ProgramEntry,
  type ScheduleSlot,
} from "../types";
import { cellEndMs, cellStartMs } from "../lib/fast";
import { DesignCanvas, fitBox } from "./designer";
import { readTheme, SITE_THEMES, useSiteTheme, waveThemeChange } from "../lib/theme";
import { downloadBlob, downloadNodePng, fileSlug } from "../lib/exporter";
import { memberPrograms, rankedEntries, readImage, type SectionProps } from "./common";
import { MemberPredictionCard } from "./Prediction";
import { ScreenCanvas, ScreenEditor } from "./ScreenEditor";
import { SCREEN_KEYS, type ScreenDesign, type ScreenKey } from "../lib/screenDesign";
import { SETTINGS_FONTS } from "../lib/settingsFonts";
import { fontStack, loadFonts } from "../lib/fonts";

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

/** Case-insensitive, multi-word search: every typed word must appear somewhere. */
function matches(query: string, ...fields: Array<string | number | null | undefined>) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const haystack = fields.filter((field) => field !== null && field !== undefined).join(" ").toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

const pad = (value: number) => String(Math.max(0, value)).padStart(2, "0");

function safeDate(value: string | number) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Display name for an entry; never throws on empty or deleted members. */
function candidateLabel(data: FestData, program: Program, entry: ProgramEntry) {
  if (!entry.memberIds.length) return "Unknown member";
  return program.format === "Group"
    ? entry.memberIds.map((memberId) => getMemberName(data, memberId)).join(" + ")
    : getMemberName(data, entry.memberIds[0]);
}

/** Only marked entries can hold a place. */
function placings(program: Program, data: FestData) {
  return rankedEntries(program, data).filter((entry) => entryMark(entry, program) !== null);
}

/** Grade points a team earned across the given programs. */
function gradePointsFor(teamId: string, programs: Program[], data: FestData) {
  return programs.reduce(
    (sum, program) =>
      sum +
      program.entries
        .filter((entry) => entry.teamId === teamId)
        .reduce((points, entry) => points + (entryGrade(entry, program, data)?.points ?? 0), 0),
    0
  );
}

function useViewportWidth() {
  const [width, setWidth] = useState(() => (typeof window === "undefined" ? 1024 : window.innerWidth));
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return width;
}

const LIST: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.045, delayChildren: 0.03 } } };
const ITEM: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 380, damping: 32 } },
};
const SPRING = { type: "spring", stiffness: 420, damping: 34 } as const;

/** Accent choices in dark & light mode (or "theme" to use the selected palette's own accent). */
const ACCENT_HEX: Record<string, { dark: string; light: string }> = {
  gold: { dark: "#f59e0b", light: "#b45309" },
  mint: { dark: "#34d399", light: "#059669" },
  peach: { dark: "#f0a37b", light: "#c2410c" },
  lilac: { dark: "#c084fc", light: "#7c3aed" },
  blue: { dark: "#38bdf8", light: "#0284c7" },
  rose: { dark: "#fb7185", light: "#e11d48" },
};

/** Honours the visitor's reduced-motion setting for everything inside. */
function Calm({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

type ScreenImageKey = ScreenKey;

const SCREEN_IMAGE_FIELDS = SCREEN_KEYS;

function screenDesign(data: import("../types").FestData, key: ScreenKey) {
  return data.screenDesigns?.[key];
}

interface ScheduledTime {
  slot: ScheduleSlot;
  delay: number;
  start: number;
  end: number;
  stage: string;
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

export function DashboardSection({ fest, user, navigate, onChange, notify }: SectionProps) {
  const data = fest.data;
  const member = user.memberId ? data.members.find((item) => item.id === user.memberId) : undefined;
  const manager = user.role === "TEAM MANAGER";
  const isMember = user.role === "MEMBER";
  // Per-category program limits (main user only): stage & off-stage bars for every category.
  const [limitStage, setLimitStage] = useState(String(data.memberProgramLimits?.stage ?? ""));
  const [limitOff, setLimitOff] = useState(String(data.memberProgramLimits?.offStage ?? ""));
  const [limitCats, setLimitCats] = useState<Record<string, { stage: number; offStage: number }>>(
    () => ({ ...(data.memberProgramLimits?.byCategory ?? {}) })
  );
  const setCategoryLimit = (categoryId: string, key: "stage" | "offStage", raw: string) => {
    const value = Math.max(0, Math.floor(Number(raw) || 0));
    setLimitCats((previous) => {
      const existing = previous[categoryId] ?? { stage: 0, offStage: 0 };
      return { ...previous, [categoryId]: { ...existing, [key]: value } };
    });
  };
  const saveProgramLimits = () => {
    const stage = Math.max(0, Math.floor(Number(limitStage) || 0));
    const offStage = Math.max(0, Math.floor(Number(limitOff) || 0));
    const byCategory = Object.fromEntries(
      data.categories.map((category) => [
        category.id,
        {
          stage: Math.max(0, Math.floor(limitCats[category.id]?.stage || 0)),
          offStage: Math.max(0, Math.floor(limitCats[category.id]?.offStage || 0)),
        },
      ])
    );
    onChange(
      (next) => ({ ...next, memberProgramLimits: { stage, offStage, byCategory } }),
      "Set the number of programs each member may enter"
    );
    notify("Program limits saved — each category now has its own stage and off-stage bars.");
  };

  // A member whose record is missing sees nothing — never the whole fest.
  const ownPrograms = isMember
    ? member
      ? memberPrograms(member, data)
      : []
    : manager
    ? user.teamId
      ? data.programs.filter((program) => program.entries.some((entry) => entry.teamId === user.teamId))
      : []
    : user.role === "JUDGE"
    ? data.programs.filter((program) => program.judgeIds.includes(user.id))
    : data.programs;
  const visibleMembers = manager ? data.members.filter((item) => item.teamId === user.teamId) : data.members;
  const quizPoints = member ? quizPointsFor(member.id, data) : 0;
  const bannerKey: ScreenImageKey =
    user.role === "MEMBER"
      ? "member"
      : user.role === "TEAM MANAGER"
      ? "teamManager"
      : user.role === "JUDGE"
      ? "judge"
      : user.role === "PUBLIC RESULT"
      ? "publicResults"
      : "dashboard";
  const bannerSrc = data.screenImages?.[bannerKey];
  const bannerDesign = screenDesign(data, bannerKey);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // Earliest scheduled time per program (delays included), computed once.
  const schedule = new Map<string, ScheduledTime>();
  for (const cell of data.schedule) {
    const slot = data.slots.find((item) => item.id === cell.slotId);
    if (!slot) continue;
    const start = cellStartMs(cell, data.slots);
    const end = cellEndMs(cell, data.slots);
    if (!start || !end) continue;
    const existing = schedule.get(cell.programId);
    if (existing && existing.start <= start) continue;
    schedule.set(cell.programId, {
      slot,
      delay: cell.delayMinutes ?? 0,
      start,
      end,
      stage: data.stages.find((item) => item.id === cell.stageId)?.name || "",
    });
  }
  const fmtClock = (ms: number) => safeDate(ms)?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) ?? "—";
  const fmtDayShort = (date: string) =>
    safeDate(`${date}T12:00:00`)?.toLocaleDateString(undefined, { month: "short", day: "numeric" }) ?? date;
  const memberRows = [...ownPrograms].sort(
    (a, b) => (schedule.get(a.id)?.start ?? Number.POSITIVE_INFINITY) - (schedule.get(b.id)?.start ?? Number.POSITIVE_INFINITY)
  );
  const firstName = member?.name.trim().split(/\s+/)[0] || user.name;

  if (isMember)
    return (
      <Calm>
        <ScreenCanvas design={bannerDesign} fallback={bannerSrc} label="Member" />
      <PageHead eyebrow="YOUR FEST / OVERVIEW" title={`Hello, ${firstName}.`} description="Your place in this fest, all in one view." />
        <motion.div className="member-dashboard" variants={LIST} initial="hidden" animate="show">
          <motion.div className="member-profile-block" variants={ITEM}>
            <span className="eyebrow">PARTICIPANT PROFILE</span>
            <div className="profile-avatar">
              {member?.photo ? <img src={member.photo} alt="" /> : (member?.name || user.name).charAt(0).toUpperCase()}
            </div>
            <h2>{member?.name || user.name}</h2>
            <p>{member ? `${getTeamName(data, member.teamId)} · ${getCategoryName(data, member.categoryId)}` : "Participant"}</p>
            <div className="detail-list">
              <div><span>Member code</span><strong>{member?.code || "—"}</strong></div>
              <div><span>Mobile</span><strong>{member?.mobile || "Not provided"}</strong></div>
              <div><span>Place</span><strong>{member?.place || "Not provided"}</strong></div>
              <div><span>Team</span><strong>{member ? getTeamName(data, member.teamId) : "—"}</strong></div>
              <div><span>Category</span><strong>{member ? getCategoryName(data, member.categoryId) : "—"}</strong></div>
            </div>
          </motion.div>
          <motion.div className="member-stats" variants={LIST}>
            <motion.div variants={ITEM}><span>Total programs</span><strong>{ownPrograms.length}</strong><p>You've joined the lineup.</p></motion.div>
            <motion.div variants={ITEM}><span>Finished programs</span><strong>{ownPrograms.filter((program) => program.status >= 2).length}</strong><p>Moments already made.</p></motion.div>
            <motion.div variants={ITEM}><span>Not started</span><strong>{ownPrograms.filter((program) => program.status < 0).length}</strong><p>Still to come.</p></motion.div>
            <motion.div variants={ITEM} className="quiz-stat"><span>Quiz points</span><strong>{quizPoints}</strong><p>One point per right answer.</p></motion.div>
          </motion.div>
        </motion.div>
        <MemberPredictionCard fest={fest} user={user} onChange={onChange} notify={notify} />
        <div className="summary-section">
          <div className="section-minihead"><span className="eyebrow">YOUR LINEUP</span><h2>Your programs</h2></div>
          {memberRows.length ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>PROGRAM</th><th>CATEGORY</th><th>TIME · FROM SCHEDULE</th><th>STATE</th></tr></thead>
                <tbody>
                  {memberRows.map((program) => {
                    const when = schedule.get(program.id);
                    return (
                      <tr key={program.id}>
                        <td><strong>{program.name}</strong></td>
                        <td>{getCategoryName(data, program.categoryId)}</td>
                        <td>
                          {when ? (
                            <div className="member-time">
                              <strong>{fmtDayShort(when.slot.date)} · {fmtClock(when.start)} – {fmtClock(when.end)}</strong>
                              {when.stage && <small>{when.stage}</small>}
                              {when.delay > 0 && <span className="delay-badge">Delayed +{when.delay}m · was {when.slot.start} – {when.slot.end}</span>}
                            </div>
                          ) : (
                            <span className="muted">Not scheduled yet</span>
                          )}
                        </td>
                        <td><StatusBadge status={program.status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="No programs yet" description={member ? "Your programs appear here once you're entered." : "We couldn't find your member record. Ask your team manager to check it."} />
          )}
        </div>
      </Calm>
    );

  const metrics = [
    { label: "PARTICIPANTS", value: visibleMembers.length, note: "people in the picture" },
    { label: "PROGRAMS", value: ownPrograms.length, note: "moments in the making" },
    { label: "HAPPENING NOW", value: ownPrograms.filter((program) => program.status >= 0 && program.status < 3).length, note: "moving through the flow" },
    { label: "PUBLISHED", value: ownPrograms.filter((program) => program.status === 5).length, note: "moments worth sharing" },
  ];

  return (
    <Calm>
      <ScreenCanvas design={bannerDesign} fallback={bannerSrc} label="Dashboard" />
      <motion.div className="dashboard-heading" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <div>
          <span className="eyebrow">{fest.name.toUpperCase()} / LIVE WORKSPACE</span>
          <h1>{greeting},<br /><em>{user.name.toLowerCase()}.</em></h1>
          <p>{manager ? "Your team has a place in every great moment." : user.role === "JUDGE" ? "Every score has a story. Let's make it count." : "Everything happening at your fest, beautifully in sync."}</p>
        </div>
        <div className="dashboard-date">
          <span>YOUR FEST, IN MOTION</span>
          <strong>{new Date().toLocaleDateString(undefined, { day: "2-digit", month: "long", year: "numeric" })}</strong>
        </div>
      </motion.div>
      {fest.demo && user.role === "MAIN" && (
        <div className="explore-note"><Sparkles size={18} /><span>Explore mode</span><p>Try the full flow with up to 2 teams, 3 categories, 20 members, 5 programs and 5 staff users.</p></div>
      )}
      <motion.div className="dashboard-metrics" variants={LIST} initial="hidden" animate="show">
        {metrics.map((metric) => (
          <motion.div key={metric.label} variants={ITEM} whileHover={{ y: -3 }}>
            <span>{metric.label}</span><strong>{pad(metric.value)}</strong><small>{metric.note}</small>
          </motion.div>
        ))}
      </motion.div>
      {user.role === "MAIN" && (
        <motion.section
          className="panel limits-panel"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="panel-head">
            <div>
              <h2 className="panel-title">Number of programs a member may enter</h2>
              <p className="panel-sub">
                Required before programs can be created. Each category gets its own stage and off-stage bars.
              </p>
            </div>
            <Button onClick={saveProgramLimits} icon={<Check size={16} />}>
              Save limits
            </Button>
          </div>
          <div className="panel-body">
            <div className="limits-row">
              <Field label="Default · stage programs">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={99}
                  value={limitStage}
                  onChange={(event) => setLimitStage(event.target.value)}
                  placeholder="e.g. 3"
                />
              </Field>
              <Field label="Default · off-stage programs">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={99}
                  value={limitOff}
                  onChange={(event) => setLimitOff(event.target.value)}
                  placeholder="e.g. 2"
                />
              </Field>
            </div>
            {data.categories.length ? (
              <div className="limits-categories">
                {data.categories.map((category) => (
                  <div className="limits-cat-row" key={category.id}>
                    <strong>{category.name}</strong>
                    <Field label="Stage">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={99}
                        value={limitCats[category.id]?.stage ?? ""}
                        onChange={(event) => setCategoryLimit(category.id, "stage", event.target.value)}
                        placeholder="default"
                      />
                    </Field>
                    <Field label="Off stage">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={99}
                        value={limitCats[category.id]?.offStage ?? ""}
                        onChange={(event) => setCategoryLimit(category.id, "offStage", event.target.value)}
                        placeholder="default"
                      />
                    </Field>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted small-text">Add categories first so each one can have its own limits.</p>
            )}
          </div>
        </motion.section>
      )}

      <div className={`dashboard-lower ${user.role === "MAIN" ? "" : "no-side"}`}>
        <div className="dashboard-flow">
          <div className="section-minihead">
            <div><span className="eyebrow">A LIVE PULSE</span><h2>Program flow</h2></div>
            <button type="button" onClick={() => navigate(user.role === "JUDGE" ? "Judgement" : manager ? "Programs" : "Program Control")}>View all <ArrowRight size={16} /></button>
          </div>
          {ownPrograms.length ? (
            <motion.div variants={LIST} initial="hidden" animate="show">
              {ownPrograms.slice(0, 5).map((program) => (
                <motion.div className="flow-line" key={program.id} variants={ITEM}>
                  <div><strong>{program.name}</strong><span>{getCategoryName(data, program.categoryId)} · {program.venue}</span></div>
                  <StatusBadge status={program.status} />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <p className="muted">Programs will appear here as your fest takes shape.</p>
          )}
        </div>
        {user.role === "MAIN" && (
          <motion.div className="dashboard-side prediction-side" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.35 }}>
            <span className="eyebrow">MEMBER PREDICTION</span>
            <h2>Who will<br />win the fest?</h2>
            <p>Open a timed prediction, then watch every member choice by name and category.</p>
            <button type="button" onClick={() => navigate("Prediction")}>Open prediction <ArrowRight size={18} /></button>
          </motion.div>
        )}
      </div>
      {data.activity.length > 0 && user.role === "MAIN" && (
        <div className="recent-activity">
          <div className="section-minihead"><span className="eyebrow">RECENT ACTIVITY</span><h2>What just happened</h2></div>
          {data.activity.slice(0, 3).map((event) => (
            <div key={event.id}><span>{event.text}</span><small>{safeDate(event.at)?.toLocaleString() ?? ""}</small></div>
          ))}
        </div>
      )}
    </Calm>
  );
}

/* ------------------------------------------------------------------ */
/* Results                                                             */
/* ------------------------------------------------------------------ */

export function ResultsSection({ fest, user, notify }: SectionProps) {
  const data = fest.data;
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [templateIndex, setTemplateIndex] = useState(0);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [venueFilter, setVenueFilter] = useState<"" | Program["venue"]>("");
  const [formatFilter, setFormatFilter] = useState<"" | Program["format"]>("");
  const exportRef = useRef<HTMLDivElement>(null);
  const viewport = useViewportWidth();

  // Members see every published result, not only their own programs.
  const programs = data.programs
    .filter((program) => program.status === 5)
    .filter((program) => (!categoryFilter || program.categoryId === categoryFilter))
    .filter((program) => (!venueFilter || program.venue === venueFilter))
    .filter((program) => (!formatFilter || program.format === formatFilter))
    .filter((program) => matches(query, program.name, getCategoryName(data, program.categoryId), program.resultNumber ? `#${program.resultNumber}` : ""))
    .sort((a, b) => (a.resultNumber || 0) - (b.resultNumber || 0));
  const active = activeId ? data.programs.find((program) => program.id === activeId) : undefined;
  // Only templates whose result range covers this result are offered.
  const templates = active ? data.posters.filter((item) => templateCoversResult(item, active.resultNumber)) : [];
  const template = templates.length ? templates[templateIndex % templates.length] : undefined;
  // The preview fits the screen (true template proportions); the PNG is rendered at 1080 px wide.
  const maxWidth = Math.round(Math.max(220, Math.min(390, viewport - 110)));
  const maxHeight = Math.round((maxWidth * 505) / 390);
  const stage = template
    ? fitBox(Math.max(1, template.width ?? template.backgroundWidth ?? 390), Math.max(1, template.height ?? template.backgroundHeight ?? 505), maxWidth, maxHeight)
    : { width: maxWidth, height: maxHeight };

  const close = () => {
    setActiveId(null);
    setTemplateIndex(0);
    setDownloadOpen(false);
  };

  if (active) {
    const ranked = rankedEntries(active, data);
    const winner = placings(active, data)[0];
    const winnerName = winner ? candidateLabel(data, active, winner) : "Winner";
    const startPosterDownload = () => {
      if (askToDownload(`the result poster for "${active.name}" as a PNG image`)) setDownloadOpen(true);
    };
    const confirmPosterDownload = async () => {
      const node = exportRef.current;
      if (!node) throw new Error("The poster preview is not ready yet. Please try again.");
      const suffix = active.resultNumber ? `-result-${active.resultNumber}` : "-result";
      await downloadNodePng(node, `${fileSlug(active.name)}${suffix}.png`, 1080, printLogoSrc(data.festLogo));
      notify("Poster downloaded as PNG");
    };
    const fallback = (ref?: typeof exportRef) => (
      <div ref={ref} className="result-fallback" style={{ width: stage.width, minHeight: stage.height }}>
        <span>PUBLISHED RESULT</span>
        <strong>#{active.resultNumber ?? "—"} {active.name}</strong>
        <p>{getCategoryName(data, active.categoryId)}</p>
        <div>01 / {winnerName}</div>
      </div>
    );
    const step = (delta: number) => setTemplateIndex((index) => (index + delta + templates.length) % templates.length);

    return (
      <Calm>
        <PageHead
          back={close}
          eyebrow={`PUBLISHED RESULT / #${active.resultNumber ?? "—"}`}
          title={active.name}
          description={`${getCategoryName(data, active.categoryId)} · Published result`}
          action={<Button variant="secondary" onClick={startPosterDownload}><Download size={17} /> Download poster</Button>}
        />
        {downloadOpen && (
          <DownloadPreview
            title="Poster preview"
            subtitle={template ? `${active.name} · ${template.name}` : active.name}
            format="PNG · 1080 px"
            onClose={() => setDownloadOpen(false)}
            onConfirm={confirmPosterDownload}
          >
            {template ? (
              <DesignCanvas canvasRef={exportRef} elements={template.elements} background={template.background} backgroundColor={template.backgroundColor} data={data} festName={fest.name} program={active} surface="poster" width={stage.width} height={stage.height} />
            ) : (
              fallback(exportRef)
            )}
          </DownloadPreview>
        )}
        {template ? (
          <div className="result-poster-layout">
            <button type="button" aria-label="Previous poster template" className="carousel-arrow" disabled={templates.length < 2} onClick={() => step(-1)}><ChevronLeft size={25} /></button>
            <div className="result-poster">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={template.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }}>
                  <DesignCanvas elements={template.elements} background={template.background} backgroundColor={template.backgroundColor} data={data} festName={fest.name} program={active} surface="poster" width={stage.width} height={stage.height} />
                </motion.div>
              </AnimatePresence>
            </div>
            <button type="button" aria-label="Next poster template" className="carousel-arrow" disabled={templates.length < 2} onClick={() => step(1)}><ChevronRight size={25} /></button>
          </div>
        ) : (
          <div className="result-poster-layout single">{fallback()}</div>
        )}
        <div className="poster-counter">
          {template
            ? `TEMPLATE ${(templateIndex % templates.length) + 1} / ${templates.length} · ${template.name}`
            : data.posters.length
            ? "No template covers this result number. Adjust a template's result range."
            : "Create poster templates to add your design here."}
        </div>
        <div className="summary-section">
          <div className="section-minihead"><span className="eyebrow">OFFICIAL PLACEMENTS</span><h2>Result details</h2></div>
          {ranked.length ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>PLACE</th><th>CANDIDATE</th><th>TEAM</th><th>GRADE</th></tr></thead>
                <tbody>
                  {ranked.map((entry, index) => {
                    const marked = entryMark(entry, active) !== null;
                    return (
                      <tr key={entry.id} className={!marked ? "row-muted" : index < 3 ? `row-place-${index + 1}` : ""}>
                        <td className="mono">{marked ? pad(index + 1) : "—"}</td>
                        <td><strong>{candidateLabel(data, active, entry)}</strong></td>
                        <td>{getTeamName(data, entry.teamId)}</td>
                        <td>{entryGrade(entry, active, data)?.name || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="No entries" description="This program has no registered entries." />
          )}
        </div>
      </Calm>
    );
  }

  return (
    <Calm>
      {user.role === "PUBLIC RESULT" && (
        <ScreenCanvas
          design={screenDesign(data, "publicResults")}
          fallback={data.screenImages?.publicResults}
          label="Public results"
        />
      )}
      <PageHead eyebrow="RESULTS / PUBLIC" title="Results" description="The moments that made it all worthwhile, ready to share." />
      <div className="section-toolbar">
        <SearchInput value={query} onChange={setQuery} placeholder="Search name, category or #number" />
        <span className="toolbar-count">{programs.length} published</span>
        <select aria-label="Filter by category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
          <option value="">All categories</option>
          {data.categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select aria-label="Filter by venue" value={venueFilter} onChange={(event) => setVenueFilter(event.target.value as "" | Program["venue"])}>
          <option value="">Stage + off stage</option>
          <option value="Stage">Stage</option>
          <option value="Off stage">Off stage</option>
        </select>
        <select aria-label="Filter by format" value={formatFilter} onChange={(event) => setFormatFilter(event.target.value as "" | Program["format"])}>
          <option value="">Individual + group</option>
          <option value="Individual">Individual</option>
          <option value="Group">Group</option>
        </select>
        <span className="toolbar-count">{programs.length} published</span>
      </div>
      {programs.length ? (
        <motion.div className="click-list results-list" variants={LIST} initial="hidden" animate="show" key={query.trim() ? "search" : "all"}>
          {programs.map((program) => {
            const winner = placings(program, data)[0];
            return (
              <motion.button
                type="button"
                key={program.id}
                variants={ITEM}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => {
                  setActiveId(program.id);
                  setTemplateIndex(0);
                }}
              >
                <span className="result-index">#{pad(program.resultNumber || 0)}</span>
                <div>
                  <span className="eyebrow">{getCategoryName(data, program.categoryId)}</span>
                  <h3>{program.name}</h3>
                  <p>{program.entries.length} candidates · {winner ? `Winner: ${candidateLabel(data, program, winner)}` : "Published"}</p>
                </div>
                <ChevronRight size={20} />
              </motion.button>
            );
          })}
        </motion.div>
      ) : (
        <Empty
          title={query.trim() ? "No results match that search" : "No published results yet"}
          description={query.trim() ? "Try a program name, a category or a result number like #3." : "Programs appear here once they reach Published in Program Control."}
        />
      )}
    </Calm>
  );
}

/* ------------------------------------------------------------------ */
/* Public team scores                                                  */
/* ------------------------------------------------------------------ */

export function PublicScoresSection({ fest, user, onChange, notify }: SectionProps) {
  const data = fest.data;
  const [query, setQuery] = useState("");
  const [showPublic, setShowPublic] = useState(false);
  const [selected, setSelected] = useState<string[]>(data.publicProgramIds);
  const [teamId, setTeamId] = useState<string | null>(null);
  const main = user.role === "MAIN";

  const published = data.programs.filter((program) => program.status === 5);
  // The public board counts exactly what the main user released — nothing else.
  const publicPrograms = published.filter((program) => data.publicProgramIds.includes(program.id));
  const quizFor = (id: string) => data.members.filter((member) => member.teamId === id).reduce((sum, member) => sum + quizPointsFor(member.id, data), 0);
  const board = data.teams
    .map((team) => ({ team, points: gradePointsFor(team.id, publicPrograms, data) + quizFor(team.id) }))
    .sort((a, b) => b.points - a.points || a.team.name.localeCompare(b.team.name))
    // Competition ranking: equal points share a rank (1, 2, 2, 4).
    .map((row, _index, rows) => ({ ...row, rank: rows.findIndex((other) => other.points === row.points) + 1 }));
  // Rank is fixed before searching, so filtering never renumbers the table.
  const visible = board.filter((row) => matches(query, row.team.name));
  const team = teamId ? data.teams.find((item) => item.id === teamId) : undefined;

  const savePublic = () => {
    onChange(
      (next) => ({ ...next, publicProgramIds: selected.filter((programId) => next.programs.some((program) => program.id === programId && program.status === 5)) }),
      "Updated public team score programs"
    );
    setShowPublic(false);
    notify("Public team scores updated");
  };

  if (team && main) {
    const rows = publicPrograms.flatMap((program) =>
      program.entries.filter((entry) => entry.teamId === team.id).map((entry) => ({ program, entry, points: entryGrade(entry, program, data)?.points ?? 0 }))
    );
    const quiz = quizFor(team.id);
    const total = rows.reduce((sum, row) => sum + row.points, 0) + quiz;
    return (
      <Calm>
        <PageHead back={() => setTeamId(null)} eyebrow="PUBLIC SCORE / BREAKDOWN" title={team.name} description={`Exactly where these ${total} published points came from.`} />
        {rows.length || quiz ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>PROGRAM</th><th>CANDIDATE</th><th>CATEGORY</th><th>GRADE POINTS</th></tr></thead>
              <tbody>
                {rows.map(({ program, entry, points }) => (
                  <tr key={`${program.id}-${entry.id}`}>
                    <td><strong>{program.name}</strong></td>
                    <td>{program.format === "Group" ? `${entry.memberIds.length ? getMemberName(data, entry.memberIds[0]) : "Unknown member"} + group` : candidateLabel(data, program, entry)}</td>
                    <td>{getCategoryName(data, program.categoryId)}</td>
                    <td className="mono">{points}</td>
                  </tr>
                ))}
                {quiz > 0 && (
                  <tr><td><strong>Quiz</strong></td><td>Team members</td><td>—</td><td className="mono">{quiz}</td></tr>
                )}
              </tbody>
              <tfoot><tr><td colSpan={3}>TOTAL</td><td className="mono"><strong>{total}</strong></td></tr></tfoot>
            </table>
          </div>
        ) : (
          <Empty title="No public points yet" description="Mark published programs as public to count them here." />
        )}
      </Calm>
    );
  }

  return (
    <Calm>
      <PageHead
        eyebrow="RESULTS / SCOREBOARD"
        title="Public Team Scores"
        description="A shared scoreboard, published only when the main user chooses."
        action={main ? <Button onClick={() => { setSelected(data.publicProgramIds); setShowPublic(true); }}><Eye size={17} /> Public</Button> : undefined}
      />
      <div className="section-toolbar">
        <SearchInput value={query} onChange={setQuery} placeholder="Search teams" />
        <span className="toolbar-count">{publicPrograms.length} programs contributing</span>
      </div>
      {visible.length ? (
        <div className="scoreboard">
          {visible.map((row) => (
            <motion.button
              type="button"
              layout
              transition={SPRING}
              key={row.team.id}
              disabled={!main}
              whileHover={main ? { x: 4 } : undefined}
              onClick={() => setTeamId(row.team.id)}
              className={row.rank <= 3 ? `podium-${row.rank}` : ""}
            >
              <span className="score-rank">{pad(row.rank)}</span>
              <span className="score-team">{row.team.name}<small>{main ? "View point sources" : "Team score"}</small></span>
              <motion.strong key={row.points} initial={{ scale: 1.5, color: "var(--fz-accent)" }} animate={{ scale: 1, color: "var(--fz-text)" }}>{row.points}</motion.strong>
              <span className="score-unit">PTS</span>
              {main && <ChevronRight size={17} />}
            </motion.button>
          ))}
        </div>
      ) : (
        <Empty
          title={query.trim() && data.teams.length ? "No team matches that search" : "No teams on the board"}
          description={query.trim() && data.teams.length ? "Check the spelling or clear the search." : "Create teams and publish programs to see their points here."}
        />
      )}
      {showPublic && (
        <Modal title="Make scores public" subtitle="Select published programs whose grade points should count toward the public team scoreboard." onClose={() => setShowPublic(false)}>
          <div className="form-stack">
            <div className="member-options">
              {published.map((program) => (
                <label key={program.id} className="member-option">
                  <input
                    type="checkbox"
                    checked={selected.includes(program.id)}
                    onChange={() => setSelected((previous) => (previous.includes(program.id) ? previous.filter((value) => value !== program.id) : [...previous, program.id]))}
                  />
                  <span><strong>{program.name}</strong><small>{getCategoryName(data, program.categoryId)} · {program.entries.length} candidates</small></span>
                </label>
              ))}
              {!published.length && <p className="muted">Publish a program in Program Control first.</p>}
            </div>
            <div className="form-actions">
              <Button variant="secondary" onClick={() => setShowPublic(false)}>Cancel</Button>
              <Button onClick={savePublic}>Confirm <ArrowRight size={16} /></Button>
            </div>
          </div>
        </Modal>
      )}
    </Calm>
  );
}

/* ------------------------------------------------------------------ */
/* Team marks                                                          */
/* ------------------------------------------------------------------ */

export function TeamMarksSection({ fest }: SectionProps) {
  const data = fest.data;
  const [query, setQuery] = useState("");

  const table = useMemo(() => {
    const published = data.programs.filter((program) => program.status === 5);
    const podiums = published.map((program) => placings(program, data).slice(0, 3).map((entry) => entry.teamId));
    const knownCategory = new Set(data.categories.map((category) => category.id));
    // Programs whose category was deleted still count — in an "Other" column.
    const orphaned = published.filter((program) => !knownCategory.has(program.categoryId));
    const rows = data.teams
      .map((team) => {
        const byCategory = data.categories.map((category) =>
          gradePointsFor(team.id, published.filter((program) => program.categoryId === category.id), data)
        );
        const other = gradePointsFor(team.id, orphaned, data);
        return {
          team,
          placements: [0, 1, 2].map((place) => podiums.filter((podium) => podium[place] === team.id).length),
          byCategory,
          other,
          total: byCategory.reduce((sum, points) => sum + points, 0) + other,
        };
      })
      .sort((a, b) => b.total - a.total || b.placements[0] - a.placements[0] || a.team.name.localeCompare(b.team.name));
    return { rows, showOther: orphaned.length > 0 };
  }, [data]);

  const rows = table.rows.filter((row) => matches(query, row.team.name));

  return (
    <Calm>
      <PageHead eyebrow="RESULTS / TEAMS" title="Team Marks" description="Placements and total grade points, all in one place." />
      <div className="section-toolbar">
        <SearchInput value={query} onChange={setQuery} placeholder="Search teams" />
        <span className="toolbar-count">{data.programs.filter((program) => program.status === 5).length} published programs</span>
      </div>
      {rows.length ? (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>TEAM</th><th>FIRST</th><th>SECOND</th><th>THIRD</th><th>TOTAL GRADE POINTS</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <motion.tr layout transition={SPRING} key={row.team.id}>
                    <td><strong>{row.team.name}</strong></td>
                    {row.placements.map((count, place) => <td key={place} className="mono">{count}</td>)}
                    <td className="mono"><strong>{row.total}</strong></td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small-text table-note">Totals use published programs only.</p>
          <div className="summary-section">
            <div className="section-minihead"><span className="eyebrow">CATEGORY BREAKDOWN</span><h2>Points by category</h2></div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>TEAM</th>
                    {data.categories.map((category) => <th key={category.id}>{category.name.toUpperCase()}</th>)}
                    {table.showOther && <th>OTHER</th>}
                    <th>TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.team.id}>
                      <td><strong>{row.team.name}</strong></td>
                      {row.byCategory.map((points, index) => <td key={data.categories[index].id} className="mono">{points}</td>)}
                      {table.showOther && <td className="mono">{row.other}</td>}
                      <td className="mono"><strong>{row.total}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <Empty
          title={query.trim() && data.teams.length ? "No team matches that search" : "No teams yet"}
          description={query.trim() && data.teams.length ? "Check the spelling or clear the search." : "Add teams to start tracking marks."}
        />
      )}
    </Calm>
  );
}

/* ------------------------------------------------------------------ */
/* Top candidates                                                      */
/* ------------------------------------------------------------------ */

export function TopCandidatesSection({ fest }: SectionProps) {
  const data = fest.data;
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [includeGroups, setIncludeGroups] = useState(false);
  const [venueFilter, setVenueFilter] = useState<"" | Program["venue"]>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /** One pass over the programs: counting programs + points per member for the current filters. */
  const stats = useMemo(() => {
    const map = new Map<string, { programs: Program[]; points: number }>();
    for (const program of data.programs) {
      if (program.status !== 5 || (!includeGroups && program.format !== "Individual") || (venueFilter && program.venue !== venueFilter)) continue;
      for (const entry of program.entries) {
        const points = entryGrade(entry, program, data)?.points ?? 0;
        for (const memberId of entry.memberIds) {
          const record = map.get(memberId) ?? { programs: [], points: 0 };
          if (!record.programs.includes(program)) {
            record.programs.push(program);
            record.points += points;
          }
          map.set(memberId, record);
        }
      }
    }
    return map;
  }, [data, includeGroups, venueFilter]);

  const enteredVenue = useMemo(() => {
    if (!venueFilter) return null;
    const ids = new Set<string>();
    data.programs.filter((program) => program.venue === venueFilter).forEach((program) => program.entries.forEach((entry) => entry.memberIds.forEach((memberId) => ids.add(memberId))));
    return ids;
  }, [data, venueFilter]);

  const pointsFor = (member: Member) => stats.get(member.id)?.points ?? 0;
  // Ranks honour category/venue filters but are fixed before the name search.
  const ranked = data.members
    .filter((member) => (!categoryId || member.categoryId === categoryId) && (!enteredVenue || enteredVenue.has(member.id)))
    .sort((a, b) => pointsFor(b) - pointsFor(a) || a.name.localeCompare(b.name));
  const rankOf = new Map(ranked.map((member) => [member.id, 1 + ranked.filter((other) => pointsFor(other) > pointsFor(member)).length]));
  const candidates = ranked.filter((member) => matches(query, member.name, member.code, getTeamName(data, member.teamId), getCategoryName(data, member.categoryId)));
  const selected = selectedId ? data.members.find((member) => member.id === selectedId) : undefined;

  if (selected) {
    const counted = stats.get(selected.id)?.programs ?? [];
    return (
      <Calm>
        <PageHead
          back={() => setSelectedId(null)}
          eyebrow="RESULTS / CANDIDATE"
          title={selected.name}
          description={`${getCategoryName(data, selected.categoryId)} · ${getTeamName(data, selected.teamId)} · ${pointsFor(selected)} total grade points${venueFilter ? ` from ${venueFilter.toLowerCase()} programs` : ""}`}
        />
        {counted.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>PROGRAM</th><th>FORMAT</th><th>GRADE</th><th>GRADE POINTS</th></tr></thead>
              <tbody>
                {counted.map((program) => {
                  const entry = program.entries.find((item) => item.memberIds.includes(selected.id));
                  const grade = entry ? entryGrade(entry, program, data) : null;
                  return (
                    <tr key={program.id}>
                      <td><strong>{program.name}</strong></td>
                      <td>{program.format}</td>
                      <td>{grade?.name || "—"}</td>
                      <td className="mono">{entry ? grade?.points ?? "No grade" : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No counted programs" description="No published programs count for this candidate with the current filters." />
        )}
      </Calm>
    );
  }

  return (
    <Calm>
      <PageHead eyebrow="RESULTS / PEOPLE" title="Top Candidates" description="Celebrate every participant's accumulated grade points." />
      <div className="section-toolbar">
        <SearchInput value={query} onChange={setQuery} placeholder="Search name, code or team" />
        <select aria-label="Filter category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          <option value="">All categories</option>
          {data.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        <label className="checkbox-line compact"><input type="checkbox" checked={includeGroups} onChange={(event) => setIncludeGroups(event.target.checked)} /> Include group</label>
        <div className="filter-chip-group" role="group" aria-label="Filter by venue">
          {([["", "All"], ["Stage", "Stage"], ["Off stage", "Off stage"]] as const).map(([value, label]) => (
            <button key={label} type="button" className={venueFilter === value ? "active" : ""} aria-pressed={venueFilter === value} onClick={() => setVenueFilter(value)}>{label}</button>
          ))}
        </div>
      </div>
      {candidates.length ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>RANK</th><th>MEMBER</th><th>CATEGORY</th><th>TEAM</th><th>{venueFilter ? `TOTAL GRADE POINTS · ${venueFilter.toUpperCase()}` : "TOTAL GRADE POINTS"}</th></tr></thead>
            <tbody>
              {candidates.map((member) => {
                const points = pointsFor(member);
                const rank = rankOf.get(member.id) ?? 0;
                return (
                  <motion.tr layout transition={SPRING} key={member.id} className={points > 0 && rank <= 3 ? `row-place-${rank}` : ""}>
                    <td className="mono">{pad(rank)}</td>
                    <td><button type="button" className="table-link" onClick={() => setSelectedId(member.id)}>{member.name}</button></td>
                    <td>{getCategoryName(data, member.categoryId)}</td>
                    <td>{getTeamName(data, member.teamId)}</td>
                    <td><motion.strong key={points} className="mono" initial={{ scale: 1.5, color: "var(--fz-accent)" }} animate={{ scale: 1, color: "var(--fz-text)" }}>{points}</motion.strong></td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title={data.members.length ? "No candidates match these filters" : "No members yet"}
          description={data.members.length ? "Try another category, venue or search." : "Register members to see their grade points here."}
        />
      )}
    </Calm>
  );
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export function SettingsSection({ fest, user, onChange, notify }: SectionProps) {
  const data = fest.data;
  const settings = data.settings;
  const [siteTheme, setSiteTheme] = useSiteTheme();
  const [editorKey, setEditorKey] = useState<ScreenKey | null>(null);
  const activeTheme = settings.theme ?? siteTheme;
  // Only the main user and the media desk can retheme the fest.
  const canTheme = user.role === "MAIN" || user.role === "MEDIA";
  const update = (patch: Partial<typeof settings>) => {
    onChange((current) => ({ ...current, settings: { ...current.settings, ...patch } }), "Updated workspace settings");
    notify("Settings updated");
  };
  const [screenDesigns, setScreenDesigns] = useState<Partial<Record<ScreenKey, ScreenDesign>>>(() => ({ ...(fest.data.screenDesigns ?? {}) }));
  const saveScreenDesign = (key: ScreenKey, design: ScreenDesign) => {
    setScreenDesigns((previous) => ({ ...previous, [key]: design }));
    onChange(
      (current) => ({ ...current, screenDesigns: { ...current.screenDesigns, [key]: design } }),
      `Edited the ${key} screen design`
    );
    notify("Screen design saved for this fest");
  };
  const [screenImages, setScreenImages] = useState<Partial<Record<ScreenImageKey, string>>>(() => ({
    ...(fest.data.screenImages ?? {}),
  }));
  const uploadScreen = async (key: ScreenImageKey, file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return notify("Choose an image file (PNG or JPG).");
    if (file.size > 1_500_000) return notify("That image is over 1.5 MB. Please use a smaller file.");
    try {
      const source = await readImage(file);
      setScreenImages((previous) => ({ ...previous, [key]: source }));
      onChange(
        (current) => ({ ...current, screenImages: { ...current.screenImages, [key]: source } }),
        `Updated the ${key} screen image`
      );
      notify("Screen image updated");
    } catch {
      notify("That image could not be read. Please try another file.");
    }
  };
  const removeScreen = (key: ScreenImageKey) => {
    setScreenImages((previous) => ({ ...previous, [key]: undefined }));
    onChange(
      (current) => ({ ...current, screenImages: { ...current.screenImages, [key]: undefined } }),
      `Removed the ${key} screen image`
    );
    notify("Screen image removed");
  };
  const [backupOpen, setBackupOpen] = useState(false);
  const exportBackup = () => {
    if (askToDownload("a full backup of this fest's data (JSON)")) setBackupOpen(true);
  };
  // The fest logo is stored on the fest data so it travels with every export.
  const changeFestLogo = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return notify("Choose an image file for the logo.");
    if (file.size > 1_500_000) return notify("That logo is over 1.5 MB. Please use a smaller image.");
    try {
      const source = await readImage(file);
      onChange((current) => ({ ...current, festLogo: source }), "Updated the fest print logo");
      notify("Fest logo added — it now prints at the top-right corner");
    } catch {
      notify("That image could not be read. Please try another file.");
    }
  };
  const clearFestLogo = () => {
    onChange((current) => ({ ...current, festLogo: undefined }), "Removed the fest print logo");
    notify("Print logo removed");
  };
  const confirmBackup = async () => {
    downloadBlob(new Blob([JSON.stringify(fest, null, 2)], { type: "application/json" }), `festize-${fileSlug(fest.code)}-backup.json`);
    notify("Fest data exported");
  };
  // A saved font outside the curated list still shows correctly in the selector.
  const fontOptions = (current: string) => (SETTINGS_FONTS.includes(current as (typeof SETTINGS_FONTS)[number]) ? [...SETTINGS_FONTS] : [current, ...SETTINGS_FONTS]);
  const backupRows: [string, number][] = [
    ["Teams", data.teams.length],
    ["Categories", data.categories.length],
    ["Members", data.members.length],
    ["Programs", data.programs.length],
    ["Staff users", data.users.length],
    ["Stages", data.stages.length],
    ["Schedule placements", data.schedule.length],
    ["Poster templates", data.posters.length],
    ["Activity records", data.activity.length],
  ];
  const backupModal = backupOpen && (
    <DownloadPreview title="Backup preview" subtitle={`${fest.name} · ${fest.code}`} format="JSON" onClose={() => setBackupOpen(false)} onConfirm={confirmBackup}>
      <div className="excel-sheet backup-preview">
        <PrintLogo logo={data.festLogo} />
        <div className="excel-title"><span>DATA BACKUP</span><h2>{fest.name}</h2><p>Everything in this fest, in one file. It includes saved passwords, so keep it private.</p></div>
        <div className="table-wrap">
          <table className="excel-table">
            <thead><tr><th>RECORD</th><th>COUNT</th></tr></thead>
            <tbody>{backupRows.map(([label, count]) => <tr key={label}><td>{label}</td><td>{count}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </DownloadPreview>
  );

  return (
    <Calm>
      <PageHead eyebrow="WORKSPACE / PREFERENCES" title="Settings" description="Make this workspace feel like your fest." />
      <motion.div className="settings-layout" variants={LIST} initial="hidden" animate="show">
        <motion.section variants={ITEM}>
          <span className="eyebrow">01 / THEME</span>
          <h2>Colours, fonts &amp; screens.</h2>
          <p>
            Headings and other texts use separate fonts. Everything here applies to this fest only.
          </p>
          <div className="settings-form">
            <Field label="Fest palette" hint="Heads this fest only — other fests keep their own look.">
              <div className="theme-options theme-options-grid">
                {SITE_THEMES.map((item) => {
                  const swatch = settings.dark ? item.swatch : item.lightSwatch;
                  const title = settings.dark ? item.name : item.lightName;
                  const desc = settings.dark ? item.tagline : item.lightTagline;
                  return (
                    <motion.button
                      type="button"
                      key={item.id}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.97 }}
                      className={activeTheme === item.id ? "active" : ""}
                      aria-pressed={activeTheme === item.id}
                      disabled={!canTheme}
                      onClick={(event) =>
                        waveThemeChange(
                          event.currentTarget,
                          () => {
                            document.documentElement.dataset.theme = item.id;
                            update({ theme: item.id, accent: "theme" });
                          },
                          swatch[0]
                        )
                      }
                    >
                      <span style={{ background: `linear-gradient(135deg, ${swatch[0]} 0 50%, ${swatch[2]} 50%)` }} />
                      <span className="theme-option-text">
                        <strong>{title}</strong>
                        <small>{desc}</small>
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </Field>
            <div className="theme-reset-row">
              <p className="muted small-text">
                {settings.theme ? `This fest is locked to the ${settings.theme} palette.` : "Following your device palette."}
              </p>
              {settings.theme ? (
                <button type="button" className="subtle-link" onClick={() => { document.documentElement.dataset.theme = readTheme(); update({ theme: undefined }); notify("Fest palette cleared"); }}>
                  Use my device theme
                </button>
              ) : (
                <button type="button" className="subtle-link" onClick={() => setSiteTheme(activeTheme)}>
                  Set as my device theme
                </button>
              )}
            </div>

            {!canTheme && <p className="muted small-text">Read-only — ask a main user or the media desk to change the theme.</p>}
            <Field label="Accent colour" hint="Buttons, highlights, charts and live markers.">
              <div className="accent-swatches" role="group" aria-label="Accent colour">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.9 }}
                  className={`accent-swatch auto ${!settings.accent || settings.accent === "theme" ? "active" : ""}`}
                  aria-pressed={!settings.accent || settings.accent === "theme"}
                  title="Theme default accent"
                  disabled={!canTheme}
                  onClick={() => update({ accent: "theme" })}
                >
                  {(!settings.accent || settings.accent === "theme") && <Check size={13} />}
                </motion.button>
                {Object.entries(ACCENT_HEX).map(([name, pair]) => {
                  const hex = settings.dark ? pair.dark : pair.light;
                  return (
                    <motion.button
                      type="button"
                      key={name}
                      whileTap={{ scale: 0.9 }}
                      className={`accent-swatch ${settings.accent === name ? "active" : ""}`}
                      aria-pressed={settings.accent === name}
                      title={name}
                      disabled={!canTheme}
                      style={{ background: hex, color: settings.dark ? "#16130f" : "#ffffff" }}
                      onClick={() => update({ accent: name })}
                    >
                      {settings.accent === name && <Check size={13} />}
                    </motion.button>
                  );
                })}
              </div>
            </Field>

            <div className="font-pair">
              <Field label="Headings font" hint={`${SETTINGS_FONTS.length} families`}>
                <select
                  disabled={!canTheme}
                  value={settings.headingFont}
                  onChange={(event) => {
                    loadFonts([event.target.value]);
                    update({ headingFont: event.target.value });
                  }}
                >
                  {fontOptions(settings.headingFont).map((font) => <option key={font} value={font}>{font}</option>)}
                </select>
              </Field>
              <Field label="Other texts font" hint={`${SETTINGS_FONTS.length} families`}>
                <select
                  disabled={!canTheme}
                  value={settings.font}
                  onChange={(event) => {
                    loadFonts([event.target.value]);
                    update({ font: event.target.value });
                  }}
                >
                  {fontOptions(settings.font).map((font) => <option key={font} value={font}>{font}</option>)}
                </select>
              </Field>
            </div>

            <div className="theme-specimen" aria-label="Live type preview">
              <span className="eyebrow">LIVE PREVIEW</span>
              <div className="specimen-row">
                <b className="specimen-aa" style={{ fontFamily: fontStack(settings.headingFont) }}>Aa</b>
                <div>
                  <strong style={{ fontFamily: fontStack(settings.headingFont) }}>
                    {settings.headingFont} · headings
                  </strong>
                  <p style={{ fontFamily: fontStack(settings.font) }}>
                    {settings.font} — the quick brown fox jumps over the lazy dog while the
                    championship table ticks 01 · 248 pts · 96.5/100.
                  </p>
                </div>
              </div>
            </div>

            <label className="checkbox-line">
              <input
                type="checkbox"
                disabled={!canTheme}
                checked={settings.dark}
                onChange={(event) => update({ dark: event.target.checked })}
              />
              Premium dark workspace for this fest
            </label>
          </div>
        </motion.section>
        <motion.section variants={ITEM}>
          <span className="eyebrow">02 / SCREEN IMAGES</span>
          <h2>Role screens.</h2>
          <p>
            Upload an image or PNG that heads the public results, member, team manager and judge screens —
            and every user&apos;s dashboard. Applies to this fest only.
          </p>
          <div className="screen-image-list">
            {SCREEN_IMAGE_FIELDS.map((field) => {
              const src = screenImages[field.key];
              return (
                <div className="screen-image-row" key={field.key}>
                  <div className="screen-image-thumb">
                    {src ? <img src={src} alt={`${field.label} preview`} /> : <ImagePlus size={18} />}
                  </div>
                  <div>
                    <button
                      type="button"
                      className="screen-name-link"
                      onClick={() => setEditorKey(field.key)}
                      title={`Edit the ${field.label} dashboard`}
                    >
                      <strong>{field.label}</strong>
                      <small className="muted">
                        {screenDesigns[field.key]?.layers.length
                          ? `${screenDesigns[field.key]?.layers.length} images · `
                          : ""}
                        Click to edit dashboard →
                      </small>
                    </button>
                  </div>
                  <div className="button-row">
                    <label className="upload-inline">
                      <ImagePlus size={15} /> {src ? "Change" : "Upload"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/*"
                        hidden
                        onChange={(event) => {
                          const input = event.currentTarget;
                          void uploadScreen(field.key, input.files?.[0]).finally(() => {
                            input.value = "";
                          });
                        }}
                      />
                    </label>
                    {src && (
                      <button type="button" className="subtle-link" onClick={() => removeScreen(field.key)}>
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.section>

        <motion.section variants={ITEM}>
          <span className="eyebrow">03 / YOUR FEST</span>
          <h2>Workspace details.</h2>
          <div className="detail-list">
            <div><span>Fest</span><strong>{fest.name}</strong></div>
            <div><span>Fest code</span><strong>{fest.code}</strong></div>
            <div><span>Teams / categories</span><strong>{data.teams.length} / {data.categories.length}</strong></div>
            <div><span>Print logo</span><strong>{data.festLogo ? "Fest logo added" : "Festize mark (default)"}</strong></div>
          </div>
          <div className="fest-logo-uploader">
            <span className="eyebrow">PRINT LOGO</span>
            <p className="muted small-text">Shown at the top-right corner of everything you print — sheets, reporting lists and ID card pages.</p>
            <div className="fest-logo-row">
              <div className="fest-logo-preview"><img src={printLogoSrc(data.festLogo)} alt="Current print logo" /></div>
              <div className="button-row">
                <label className="upload-inline">
                  <ImagePlus size={16} /> {data.festLogo ? "Change logo" : "Add fest logo"}
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(event) => {
                      const input = event.currentTarget;
                      void changeFestLogo(input.files?.[0]).finally(() => { input.value = ""; });
                    }}
                  />
                </label>
                {data.festLogo && <button type="button" className="subtle-link" onClick={clearFestLogo}>Remove logo</button>}
              </div>
            </div>
          </div>
          <Button variant="secondary" onClick={exportBackup}><FileDown size={16} /> Export data backup</Button>
        </motion.section>
        <motion.section variants={ITEM}>
          <span className="eyebrow">04 / ACTIVITY</span>
          <h2>Recent changes.</h2>
          <p>Actions from this fest are recorded here, even when different staff members contribute.</p>
          <div className="settings-activity">
            {data.activity.slice(0, 8).map((event) => (
              <div key={event.id}><span>{event.text}</span><small>{safeDate(event.at)?.toLocaleString() ?? ""}</small></div>
            ))}
            {!data.activity.length && <p className="muted">Activity will appear as your team works.</p>}
          </div>
        </motion.section>
      </motion.div>
      {backupModal}
      <ScreenEditor
        open={editorKey !== null}
        screenKey={editorKey}
        label={editorKey ? SCREEN_KEYS.find((item) => item.key === editorKey)?.label ?? "Screen" : ""}
        data={data}
        onSave={saveScreenDesign}
        onClose={() => setEditorKey(null)}
      />
    </Calm>
  );
}
