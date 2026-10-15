import { useEffect, useState } from "react";
import { ArrowRight, Check, ChevronRight, CornerUpLeft, Eye, Lock } from "lucide-react";
import { Button, Empty, PageHead, SearchInput, StatusBadge, useViewPref, ViewToggle } from "../ui";
import { entryGrade, getCategoryName, getGrade, programReadyForJudgement, STATUSES, type Program } from "../types";
import { activeJudgesFor, isolatedViewForJudge, scoringMethodFor } from "../lib/fast";
import { canManage, entryDisplay, rankedEntries, type SectionProps } from "./common";

function ControlRow({ program, data, onNext, onUndo, canUpdate }: { program: Program; data: SectionProps["fest"]["data"]; onNext: () => void; onUndo: () => void; canUpdate: boolean }) {
  // Publishing is locked until the Monitor section confirms the result.
  const reviewNote = program.status === 4 ? (program.monitorConfirmed ? <span className="control-note ok"><Check size={12} /> Monitor confirmed · ready to publish</span> : <span className="control-note wait"><Lock size={12} /> Waiting for monitor confirmation before publishing</span>) : null;
  return <div className="control-row"><div className="control-main"><span className="control-category">{getCategoryName(data, program.categoryId)} / {program.venue}</span><h3>{program.name}</h3><p>{program.entries.length} {program.format === "Group" ? "groups" : "candidates"} · {program.format}</p>{reviewNote}</div><div className="control-actions"><StatusBadge status={program.status} />{canUpdate && <><Button onClick={onNext} disabled={program.status >= 5} className="next-control">Go to next <ArrowRight size={15} /></Button><button className="undo-control" onClick={onUndo} disabled={program.status < 0}><CornerUpLeft size={14} /> Undo</button></>}</div></div>;
}

export function ControlSection({ fest, user, onChange, notify, stageOnly = false }: SectionProps & { stageOnly?: boolean }) {
  const data = fest.data; const [query, setQuery] = useState(""); const [statusFilter, setStatusFilter] = useState("");
  const [view, setView] = useViewPref(`control-${stageOnly ? "stage" : "program"}:${fest.id}:${user.id}`);
  const canUpdate = canManage(user) || (stageOnly && (user.role === "MONITOR" || user.role === "STAGE MANAGER"));
  const statusOf = (program: Program) => program.status < 0 ? "unstarted" : String(program.status);
  const statusOptions: [string, string][] = stageOnly
    ? [["", "All states"], ["unstarted", "Not started"], ["0", "Reporting"], ["1", "Started"]]
    : [["", "All states"], ["unstarted", "Not started"], ["0", "Reporting"], ["1", "Started"], ["2", "Finished"], ["3", "Judgements"], ["4", "Finalysed"], ["5", "Published"]];
  const programs = data.programs.filter(program => (!stageOnly || program.status < 2) && (!statusFilter || statusOf(program) === statusFilter) && `${program.name} ${getCategoryName(data, program.categoryId)}`.toLowerCase().includes(query.toLowerCase()));
  const counts = [{ name: "Not started", count: data.programs.filter(program => program.status < 0).length }, ...STATUSES.map((name, index) => ({ name, count: data.programs.filter(program => program.status === index).length }))];
  const next = (program: Program) => {
    if (!canUpdate || program.status >= 5) return;
    if (!program.entries.length) return notify("Add candidates before moving this program forward.");
    const newStatus = program.status + 1;
    if (newStatus >= 1 && !program.entries.every(entry => entry.codeLetter?.trim())) return notify("Add a code letter for every candidate before starting.");
    if (newStatus >= 2 && !program.judgeIds.length) return notify("Assign at least one judge to this program before finishing it.");
    if (newStatus >= 3 && !programReadyForJudgement(program)) return notify("All assigned judges must save a mark for every code letter first.");
    if (newStatus === 5 && program.status < 4) return notify("Finalise this program before publishing.");
    if (newStatus === 5 && !program.monitorConfirmed) return notify("Confirm this result in the Monitor section before publishing.");
    onChange(current => ({ ...current, programs: current.programs.map(item => item.id === program.id ? { ...item, status: newStatus, resultNumber: newStatus === 5 ? Math.max(0, ...current.programs.map(value => value.resultNumber || 0)) + 1 : item.resultNumber } : item) }), `${program.name} moved to ${STATUSES[newStatus]}`);
    notify(`${program.name} · ${STATUSES[newStatus]}`);
  };
  const undo = (program: Program) => {
    if (!canUpdate || program.status < 0) return;
    const target = program.status - 1;
    onChange(current => ({ ...current, programs: current.programs.map(item => item.id === program.id ? { ...item, status: target, resultNumber: program.status === 5 ? undefined : item.resultNumber, monitorConfirmed: target < 3 ? false : item.monitorConfirmed, monitorConfirmedAt: target < 3 ? undefined : item.monitorConfirmedAt } : item), publicProgramIds: program.status === 5 ? current.publicProgramIds.filter(programId => programId !== program.id) : current.publicProgramIds }), `${program.name} returned to ${target < 0 ? "Not started" : STATUSES[target]}`);
    notify(`Undid the last stage for ${program.name}`);
  };
  return <><PageHead eyebrow={stageOnly ? "LIVE / STAGE FLOW" : "LIVE / PROGRAM FLOW"} title={stageOnly ? "Stage Control" : "Program Control"} description={stageOnly ? "What is coming up, reporting, or happening on stage." : "Move each program forward, one completed step at a time."} /><div className="control-stats">{counts.map(item => <div key={item.name}><strong>{String(item.count).padStart(2, "0")}</strong><span>{item.name}</span></div>)}</div><div className="section-toolbar"><SearchInput value={query} onChange={setQuery} placeholder="Search programs" /><ViewToggle mode={view} onChange={setView} /><select aria-label="Filter by state" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><span className="toolbar-count">{programs.length} visible</span></div>{programs.length ? view === "box"
    ? <div className="card-grid">{programs.map(program => <div className="mini-card" key={program.id}>
        <div className="mini-card-head"><div className="mini-card-title"><strong>{program.name}</strong><small>{getCategoryName(data, program.categoryId)} / {program.venue}</small></div><StatusBadge status={program.status} /></div>
        <div className="mini-card-meta"><span>{program.entries.length} {program.format === "Group" ? "groups" : "candidates"}</span><span>{program.format}</span></div>
        {canUpdate && <div className="mini-card-actions"><Button className="mini-btn" onClick={() => next(program)} disabled={program.status >= 5}>Go to next <ArrowRight size={13} /></Button><button className="undo-control" onClick={() => undo(program)} disabled={program.status < 0}><CornerUpLeft size={13} /> Undo</button></div>}
      </div>)}</div>
    : <div className="control-list">{programs.map(program => <ControlRow key={program.id} program={program} data={data} canUpdate={canUpdate} onNext={() => next(program)} onUndo={() => undo(program)} />)}</div>
    : <Empty title={stageOnly ? "The stage is clear" : "No programs here yet"} description={stageOnly ? "Programs disappear from stage control when they finish." : "Create a program to begin moving your fest forward."} />}</>;
}

export function CodeLetterSection({ fest, onChange, notify }: SectionProps) {
  const data = fest.data; const [query, setQuery] = useState(""); const [activeId, setActiveId] = useState<string | null>(null); const [codes, setCodes] = useState<Record<string, string>>({});
  const active = data.programs.find(program => program.id === activeId);
  const waiting = data.programs.filter(program => program.status === 0 && (!query || `${program.name} ${getCategoryName(data, program.categoryId)}`.toLowerCase().includes(query.toLowerCase())));
  const open = (program: Program) => { setCodes(Object.fromEntries(program.entries.map(entry => [entry.id, entry.codeLetter || ""]))); setActiveId(program.id); };
  const save = () => {
    if (!active || !active.entries.length) return notify("Add candidates before assigning code letters.");
    const values = active.entries.map(entry => codes[entry.id]?.trim().toUpperCase());
    if (values.some(value => !value)) return notify("Give every candidate a code letter before confirming.");
    if (new Set(values).size !== values.length) return notify("Use a different code letter for every candidate.");
    onChange(next => ({ ...next, programs: next.programs.map(program => program.id === active.id ? { ...program, entries: program.entries.map(entry => ({ ...entry, codeLetter: codes[entry.id]?.trim().toUpperCase() })), status: 1 } : program) }), `Code letters completed for ${active.name}; program started`);
    setActiveId(null); notify(`${active.name} started automatically after code letter entry`);
  };
  if (active) return <><PageHead back={() => setActiveId(null)} eyebrow="LIVE / CODE LETTERS" title={active.name} description="Give every candidate a unique code letter. A group receives one letter." /><div className="sheet-container"><div className="sheet-header"><span>CANDIDATE</span><span>CODE LETTER</span></div>{active.entries.map(entry => <div key={entry.id} className="code-row"><div><strong>{entryDisplay(active, entry, data)}</strong><small>{getCategoryName(data, active.categoryId)}</small></div><input aria-label={`Code letter for ${entryDisplay(active, entry, data)}`} value={codes[entry.id] || ""} onChange={event => setCodes({ ...codes, [entry.id]: event.target.value.toUpperCase() })} placeholder="Enter code letter" /></div>)}<div className="sheet-footer"><Button onClick={save}>Confirm all code letters <ArrowRight size={16} /></Button></div></div></>;
  return <><PageHead eyebrow="LIVE / ANONYMITY" title="Code Letter Entry" description="Assign anonymous codes when candidates report in." /><div className="section-toolbar"><SearchInput value={query} onChange={setQuery} placeholder="Search reporting programs" /><span className="toolbar-count">{waiting.length} awaiting entry</span></div>{waiting.length ? <div className="click-list">{waiting.map(program => <button key={program.id} onClick={() => open(program)}><div><span className="eyebrow">{getCategoryName(data, program.categoryId)}</span><h3>{program.name}</h3><p>{program.entries.length} candidates waiting for code letters</p></div><ChevronRight size={20} /></button>)}</div> : <Empty title="All code letters are caught up" description="Programs will appear here when they reach Reporting." />}</>;
}

/**
 * FAST — Multi-Judge Scoring UI.
 * - Any panel size (2, 3, 5, 7+ judges): roster comes from program.judgeIds.
 * - Judges see ONLY their own inputs + per-code submission COUNTS.
 *   Other judges' raw marks are never rendered (isolation).
 * - Final formula is automatic: <5 judges -> Dynamic Average,
 *   5+ judges -> Olympic Trimmed Mean (drops highest + lowest).
 * - Saving your sheet removes the program from YOUR queue instantly.
 */
export function JudgementSection({ fest, user, onChange, notify }: SectionProps) {
  const data = fest.data; const [query, setQuery] = useState(""); const [activeId, setActiveId] = useState<string | null>(null); const [marks, setMarks] = useState<Record<string, string>>({});
  const judgeId = user.role === "MAIN" ? "main" : user.id;
  const isJudge = user.role === "JUDGE";

  // Main user: a spectating area only. No marks, no counts, no scoring —
  // just the name and category of each program that is with the judges.
  if (user.role === "MAIN") {
    const beingJudged = data.programs.filter(program => program.status === 2 && `${program.name} ${getCategoryName(data, program.categoryId)}`.toLowerCase().includes(query.toLowerCase()));
    return <><PageHead eyebrow="EVALUATION / SPECTATING" title="Judgement" description="A watch-only view of the programs currently with the judges. Marks are entered privately on each judge's own device." />
      <div className="spectate-banner"><Eye size={15} /><strong>Spectating</strong><span>Watch only · program names and categories under judgement</span></div>
      <div className="section-toolbar"><SearchInput value={query} onChange={setQuery} placeholder="Search programs" /><span className="toolbar-count">{beingJudged.length} under judgement</span></div>
      {beingJudged.length
        ? <div className="spectate-list">{beingJudged.map(program => <div key={program.id} className="spectate-row"><div><span className="eyebrow">{getCategoryName(data, program.categoryId)}</span><h3>{program.name}</h3></div><span className="spectate-live"><span className="fast-pulse" /> With the judges</span></div>)}</div>
        : <Empty title="Nothing is being judged right now" description="Programs appear here once they finish on stage and move to the judges." />}
    </>;
  }
  const assigned = data.programs.filter(program => user.role === "MAIN" || program.judgeIds.includes(user.id));
  const waiting = assigned.filter(program => program.status === 2 && program.entries.length && program.entries.some(entry => typeof entry.marks[judgeId] !== "number") && `${program.name} ${getCategoryName(data, program.categoryId)}`.toLowerCase().includes(query.toLowerCase()));
  const active = assigned.find(program => program.id === activeId);
  const scaleFor = (program: Program) => data.scales.find(scale => scale.id === program.scaleId);
  const methodLabel = (program: Program) => {
    const panel = activeJudgesFor(program);
    const method = scoringMethodFor(panel.length, program.scoringMethod);
    return method === "trimmed"
      ? `Olympic Trimmed Mean · ${panel.length} judges (drops highest + lowest)`
      : `Dynamic Average · ${panel.length} judge${panel.length === 1 ? "" : "s"}`;
  };
  const open = (program: Program) => { setMarks(Object.fromEntries(program.entries.map(entry => [entry.id, typeof entry.marks[judgeId] === "number" ? String(entry.marks[judgeId]) : ""]))); setActiveId(program.id); };
  const save = () => {
    if (!active) return;
    const values = active.entries.map(entry => marks[entry.id]?.trim());
    if (values.some(value => value === "" || value === undefined || !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 100)) return notify("Enter a mark from 0 to 100 for every code letter.");
    const updatedEntries = active.entries.map(entry => ({ ...entry, marks: { ...entry.marks, [judgeId]: Number(marks[entry.id]) } }));
    const ready = programReadyForJudgement({ ...active, entries: updatedEntries });
    onChange(next => ({ ...next, programs: next.programs.map(program => program.id === active.id ? { ...program, entries: updatedEntries, status: ready ? 3 : program.status } : program) }), `${user.name} saved judgement for ${active.name}`);
    setActiveId(null); notify(ready ? "Judgement saved. Program moved to Judgements." : "Your marks are saved. Waiting for the other judges.");
  };
  if (active) {
    const panel = activeJudgesFor(active);
    const view = isolatedViewForJudge(active, judgeId);
    return <><PageHead back={() => setActiveId(null)} eyebrow="EVALUATION / SCORING" title={active.name} description={`Enter marks for each anonymous code. Grading follows ${scaleFor(active)?.name || "the selected scale"}.`} />
      <div className="fast-method"><Lock size={13} /> Confidential sheet · {methodLabel(active)} · you have done {Object.values(view.own).filter(v => typeof v === "number").length}/{active.entries.length}</div>
      <div className="judgement-note">Only code letters are shown to keep evaluation impartial. Mark is out of 100. Other judges' marks stay hidden — counts only.</div>
      <div className="sheet-container judgement-sheet"><div className="sheet-header judgement-columns"><span>CODE LETTER</span><span>MARK / 100</span><span>GRADE</span><span>POINTS</span></div>{active.entries.map(entry => { const value = marks[entry.id] || ""; const grade = value !== "" ? getGrade(Number(value), scaleFor(active)) : null; const count = view.submittedCounts[entry.id] ?? 0; return <div key={entry.id} className="judge-row"><div className="code-identity">{entry.codeLetter || "No code"}<small className="fast-submitted">{count}/{panel.length} in</small></div><div><input aria-label={`Mark for code ${entry.codeLetter}`} type="number" min="0" max="100" step="0.1" value={value} onChange={event => { const next = event.target.value; if (next === "" || (Number(next) >= 0 && Number(next) <= 100)) setMarks({ ...marks, [entry.id]: next }); }} placeholder="0–100" /><small>Mark is out of 100</small></div><strong>{grade?.name || "—"}</strong><strong>{grade?.points ?? "No grade"}</strong></div>; })}<div className="sheet-footer"><Button onClick={save}>Save judgement <ArrowRight size={16} /></Button></div></div></>;
  }
  return <><PageHead eyebrow="EVALUATION / JUDGES" title="Judgement" description={isJudge ? "Only programs assigned to you appear here when they are finished. Your sheet is confidential." : "Review the judging queue and score finished programs."} /><div className="section-toolbar"><SearchInput value={query} onChange={setQuery} placeholder="Search assigned programs" /><span className="toolbar-count">{waiting.length} ready to score</span></div>{waiting.length ? <div className="click-list">{waiting.map(program => { const panel = activeJudgesFor(program); const mine = program.entries.filter(e => typeof e.marks[judgeId] === "number").length; return <button key={program.id} onClick={() => open(program)}><div><span className="eyebrow">{getCategoryName(data, program.categoryId)} · {scaleFor(program)?.name}</span><h3>{program.name}</h3><p>{program.entries.length} anonymous code letters · {panel.length} judges · {methodLabel(program)} · you: {mine}/{program.entries.length}</p></div><ChevronRight size={20} /></button>; })}</div> : <Empty title="Nothing to judge right now" description="Assigned programs appear here after they have finished on stage." />}
  </>;
}

export function MonitorSection({ fest, user, onChange, notify, mediaOnly = false }: SectionProps & { mediaOnly?: boolean }) {
  const data = fest.data; const [query, setQuery] = useState(""); const [activeId, setActiveId] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState(""); const [catFilter, setCatFilter] = useState("");
  const [view, setView] = useViewPref(`monitor-${mediaOnly ? "media" : "monitor"}:${fest.id}:${user.id}`);
  /** The result that was just confirmed, briefly highlighted at its new place. */
  const [movedId, setMovedId] = useState<string | null>(null);
  useEffect(() => {
    if (!movedId) return;
    const timer = setTimeout(() => setMovedId(null), 2600);
    return () => clearTimeout(timer);
  }, [movedId]);
  const stateOf = (program: Program) => program.status === 5 ? "published" : program.monitorConfirmed ? "confirmed" : "pending";
  const programs = data.programs.filter(program => program.status >= 3 && (!mediaOnly || program.monitorConfirmed) && (!stateFilter || stateOf(program) === stateFilter) && (!catFilter || program.categoryId === catFilter) && `${program.name} ${getCategoryName(data, program.categoryId)}`.toLowerCase().includes(query.toLowerCase()));
  // Unconfirmed results stay on top; confirmed ones sink below all of them,
  // with the most recently confirmed at the very bottom.
  const pending = programs.filter(program => !program.monitorConfirmed);
  const confirmed = programs.filter(program => program.monitorConfirmed).sort((a, b) => (a.monitorConfirmedAt ?? "").localeCompare(b.monitorConfirmedAt ?? ""));
  const active = data.programs.find(program => program.id === activeId);
  const confirm = () => {
    if (!active) return;
    const at = new Date().toISOString();
    onChange(next => ({ ...next, programs: next.programs.map(program => program.id === active.id ? { ...program, monitorConfirmed: true, monitorConfirmedAt: at } : program) }), `${active.name} confirmed in Monitor`);
    setMovedId(active.id); setActiveId(null);
    notify(`${active.name} confirmed and moved to the bottom. It can now be published in Program Control.`);
  };
  const renderRow = (program: Program) => <button key={program.id} className={program.id === movedId ? "just-moved" : ""} ref={program.id === movedId ? element => element?.scrollIntoView({ block: "nearest", behavior: "smooth" }) : undefined} onClick={() => setActiveId(program.id)}><div><span className="eyebrow">{getCategoryName(data, program.categoryId)} · {program.status === 5 ? "Published" : program.monitorConfirmed ? "Confirmed" : "Awaiting confirmation"}</span><h3>{program.name}</h3><p>{program.entries.length} candidates · {data.scales.find(scale => scale.id === program.scaleId)?.name}</p></div><span className="click-end">{program.monitorConfirmed && <span className="review-tick" title="Confirmed"><Check size={16} /></span>}<ChevronRight size={20} /></span></button>;
  const renderCard = (program: Program) => <button key={program.id} className={`mini-card card-button ${program.id === movedId ? "just-moved" : ""}`} onClick={() => setActiveId(program.id)}><div className="mini-card-head"><div className="mini-card-title"><strong>{program.name}</strong><small>{getCategoryName(data, program.categoryId)} · {program.status === 5 ? "Published" : program.monitorConfirmed ? "Confirmed" : "Awaiting confirmation"}</small></div>{program.monitorConfirmed && <span className="review-tick" title="Confirmed"><Check size={15} /></span>}</div><div className="mini-card-meta"><span>{program.entries.length} candidates</span><span>{data.scales.find(scale => scale.id === program.scaleId)?.name || "No scale"}</span></div></button>;
  if (active) return <><PageHead back={() => setActiveId(null)} eyebrow={mediaOnly ? "MEDIA / APPROVED" : "RESULT REVIEW"} title={active.name} description={`${getCategoryName(data, active.categoryId)} · ${active.entries.length} candidates. Scores are shown as grade points, never raw marks.`} /><div className="table-wrap"><table className="data-table"><thead><tr><th>RANK</th><th>CANDIDATE</th><th>CODE LETTER</th><th>GRADE</th><th>GRADE POINTS</th></tr></thead><tbody>{rankedEntries(active, data).map((entry, index) => <tr key={entry.id}><td>{String(index + 1).padStart(2, "0")}</td><td><strong>{entryDisplay(active, entry, data)}</strong></td><td>{entry.codeLetter || "—"}</td><td>{entryGrade(entry, active, data)?.name || "—"}</td><td>{entryGrade(entry, active, data)?.points ?? "No grade"}</td></tr>)}</tbody></table></div>{!mediaOnly && (user.role === "MAIN" || user.role === "MONITOR") && <div className="bottom-action"><Button onClick={confirm}>{active.monitorConfirmed ? "Confirmed · confirm again" : "Confirm"} <Check size={17} /></Button><p>Confirming moves this result below all others and unlocks publishing in Program Control. It does not publish by itself.</p></div>}</>;
  return <><PageHead eyebrow={mediaOnly ? "RESULTS / MEDIA" : "RESULTS / REVIEW"} title={mediaOnly ? "Media" : "Monitor"} description={mediaOnly ? "Results confirmed by the monitor, ready for your creative team." : "Check scored results before they reach the public. A result can only be published after it is confirmed here."} /><div className="section-toolbar"><SearchInput value={query} onChange={setQuery} placeholder="Search results" /><ViewToggle mode={view} onChange={setView} />{mediaOnly
      ? <select aria-label="Filter by category" value={catFilter} onChange={event => setCatFilter(event.target.value)}><option value="">All categories</option>{data.categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
      : <select aria-label="Filter by state" value={stateFilter} onChange={event => setStateFilter(event.target.value)}><option value="">All states</option><option value="pending">Awaiting confirmation</option><option value="confirmed">Confirmed</option><option value="published">Published</option></select>}<span className="toolbar-count">{mediaOnly ? `${confirmed.length} results` : `${pending.length} awaiting · ${confirmed.length} confirmed`}</span></div>{programs.length ? view === "box"
    ? <div className="card-grid">{[...pending, ...confirmed].map(renderCard)}</div>
    : <div className="click-list">
      {!mediaOnly && pending.length > 0 && <div className="monitor-group-label">Awaiting confirmation · {pending.length}</div>}
      {!mediaOnly && pending.map(renderRow)}
      {!mediaOnly && confirmed.length > 0 && <div className="monitor-group-label done"><Check size={12} /> Confirmed · {confirmed.length}</div>}
      {confirmed.map(renderRow)}
    </div> : <Empty title={mediaOnly ? "No approved results yet" : "No results to review"} description={mediaOnly ? "Confirmed monitor results appear here." : "Judged programs arrive here for review."} />}</>;
}