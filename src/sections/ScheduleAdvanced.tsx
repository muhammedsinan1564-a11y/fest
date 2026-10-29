/**
 * FAST — Advanced Schedule Section (frontend).
 * ------------------------------------------------------------------
 * Interactive Multi-Stage / Multi-Day Grid + Gantt timeline.
 * - Live Now (pulsing) / Upcoming / Completed colour coding.
 * - Concurrent tracking: counts simultaneous placements across stages.
 * - Conflict detection: participant + judge + stage double-bookings.
 * - Bookmarks (per-user, local) + 15-minute reminder logic.
 * - Realtime: edits save to the fest snapshot, which Supabase Realtime
 *   (`watchFest`) pushes to every device instantly — delays included.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { AlarmClock, Bookmark, BookmarkCheck, CalendarDays, Check, Layers, Plus, Radio, Star } from "lucide-react";
import { Button, Empty, PageHead, SearchInput } from "../ui";
import { getCategoryName, getMemberName, id, type ScheduleCell, type ScheduleSlot } from "../types";
import { cloudEnabled } from "../lib/persistence";
import {
  cellEndMs, cellStartMs, concurrentCells, detectScheduleConflicts, dueReminders,
  liveStateForCell, loadBookmarks, slotEndMs, slotStartMs, toggleBookmark,
} from "../lib/fast";
import { canManage, stageManagerSees, type SectionProps } from "./common";

const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const fmtDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

export function ScheduleAdvanced({ fest, user, onChange, notify }: SectionProps) {
  const data = fest.data;
  const canEdit = canManage(user);
  /** Stage managers only see programs assigned to them; unassigned stays open to all. */
  const assignablePrograms = data.programs.filter(program => stageManagerSees(program, user));
  const [slots, setSlots] = useState<ScheduleSlot[]>(data.slots);
  const [cells, setCells] = useState<ScheduleCell[]>(data.schedule);
  const [now, setNow] = useState(() => Date.now());
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"grid" | "timeline">("grid");
  const [bookedOnly, setBookedOnly] = useState(false);
  const [marks, setMarks] = useState<string[]>(() => loadBookmarks(fest.id, user.id));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const firedRef = useRef(new Set<string>());

  // Live clock — re-evaluates Live/Upcoming/Completed + reminders every 30s.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  // Follow realtime updates from other devices.
  useEffect(() => { setSlots(data.slots); setCells(data.schedule); }, [data.slots, data.schedule]);

  const days = useMemo(() => [...new Set(slots.map(s => s.date))].sort(), [slots]);
  const [dayTab, setDayTab] = useState<string>(days[0] ?? "");
  useEffect(() => { if (!days.includes(dayTab) && days.length) setDayTab(days[0]); }, [days, dayTab]);
  const daySlots = useMemo(
    () => slots.filter(s => s.date === dayTab).sort((a, b) => a.start.localeCompare(b.start)),
    [slots, dayTab],
  );

  // Draft-aware conflict scan (instant feedback before saving).
  const conflicts = useMemo(
    () => detectScheduleConflicts({ ...data, slots, schedule: cells }),
    [data, slots, cells],
  );
  const liveCells = useMemo(() => concurrentCells(cells, slots, now), [cells, slots, now]);
  const reminders = useMemo(
    () => dueReminders(cells, slots, data.programs, data.stages, now, 15),
    [cells, slots, data.programs, data.stages, now],
  );

  // Fire a browser notification once per upcoming placement (bookmarked first).
  useEffect(() => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    for (const r of reminders) {
      const key = `${r.cellId}:${r.startsAt}`;
      if (firedRef.current.has(key)) continue;
      firedRef.current.add(key);
      try {
        new Notification(`${r.programName} starts in ${r.minutesAway} min`, {
          body: `${r.stageName} · ${new Date(r.startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
        });
      } catch { /* notifications blocked */ }
    }
  }, [reminders]);

  const enableAlerts = async () => {
    if (!("Notification" in window)) return notify("This browser does not support notifications.");
    const p = await Notification.requestPermission();
    notify(p === "granted" ? "Reminders on — we'll ping you 15 minutes before." : "Notifications blocked in browser settings.");
  };

  // ---- editing (MAIN only) ----
  const overlaps = (a?: ScheduleSlot, b?: ScheduleSlot) =>
    Boolean(a && b && a.date === b.date && a.start < b.end && b.start < a.end);

  const addSlot = () => {
    if (!date || !start || !end || start >= end) return notify("Choose a valid date, start and end time.");
    if (slots.some(s => s.date === date && s.start === start && s.end === end)) return notify("That time slot already exists.");
    setSlots([...slots, { id: id(), date, start, end }].sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`)));
    setDayTab(date);
    notify("Time slot added. Save the timetable when ready.");
  };

  const setCell = (stageId: string, slotId: string, programId: string) => {
    const other = cells.filter(c => !(c.stageId === stageId && c.slotId === slotId));
    if (!programId) { setCells(other); return; }
    if (other.some(c => c.programId === programId)) return notify("A program can only occupy one slot.");
    const slot = slots.find(s => s.id === slotId);
    const target = data.programs.find(p => p.id === programId);
    const members = new Set(target?.entries.flatMap(e => e.memberIds) ?? []);
    const judges = new Set(target?.judgeIds ?? []);
    for (const c of other) {
      if (!overlaps(slot, slots.find(s => s.id === c.slotId))) continue;
      const otherProg = data.programs.find(p => p.id === c.programId);
      const clashMember = otherProg?.entries.flatMap(e => e.memberIds).find(m => members.has(m));
      if (clashMember) return notify(`${getMemberName(data, clashMember)} is already performing at this time.`);
      const clashJudge = otherProg?.judgeIds.find(j => judges.has(j));
      if (clashJudge) {
        const name = clashJudge === "main" ? "Main user" : data.users.find(u => u.id === clashJudge)?.name ?? "Judge";
        return notify(`${name} is already judging at this time.`);
      }
    }
    setCells([...other, { id: id(), stageId, slotId, programId }]);
  };

  const bumpDelay = (cellId: string, minutes: number) => {
    setCells(prev => prev.map(c => {
      if (c.id !== cellId) return c;
      const next = Math.max(0, (c.delayMinutes ?? 0) + minutes);
      return next === 0 ? { ...c, delayMinutes: undefined } : { ...c, delayMinutes: next };
    }));
  };

  const save = () => {
    if (cells.some(c => cells.filter(x => x.programId === c.programId).length > 1))
      return notify("A program can only occupy one schedule slot.");
    const live = detectScheduleConflicts({ ...data, slots, schedule: cells });
    if (live.length) return notify(`Resolve ${live.length} conflict${live.length > 1 ? "s" : ""} before saving.`);
    onChange(next => ({ ...next, slots, schedule: cells }), "Updated the fest schedule");
    notify(cloudEnabled ? "Schedule saved — pushed live to every device." : "Schedule saved.");
  };

  const removeSlot = (slotId: string) => {
    if (!window.confirm("Remove this time slot and its scheduled programs?")) return;
    setSlots(slots.filter(s => s.id !== slotId));
    setCells(cells.filter(c => c.slotId !== slotId));
  };

  const flipBookmark = (programId: string) => setMarks(toggleBookmark(fest.id, user.id, programId));

  // Gantt geometry for the active day.
  const dayWindow = useMemo(() => {
    if (!daySlots.length) return { min: 0, max: 1 };
    return { min: Math.min(...daySlots.map(toMinSafe)), max: Math.max(...daySlots.map(toMinSafe)) };
    function toMinSafe(s: ScheduleSlot) { return toMin(s.start); }
  }, [daySlots]);
  const dayEnd = useMemo(() => daySlots.length ? Math.max(...daySlots.map(s => toMin(s.end))) : 1, [daySlots]);
  const ganttPos = (startMs: number, endMs: number) => {
    const span = Math.max(1, (dayEnd - dayWindow.min) * 60_000);
    const dayBase = new Date(`${dayTab}T00:00:00`).getTime();
    return {
      left: `${Math.max(0, ((startMs - dayBase) / 60_000 - dayWindow.min) / ((dayEnd - dayWindow.min) || 1)) * 100}%`,
      width: `${Math.max(3, ((endMs - startMs) / span) * 100)}%`,
    };
  };

  const visibleStages = data.stages.filter(s =>
    !query || `${s.name} ${s.details}`.toLowerCase().includes(query.toLowerCase()),
  );

  return <>
    <PageHead
      eyebrow="LIVE / TIMETABLE"
      title="Schedule"
      description="Multi-stage, multi-day grid. Delays and reschedules sync to every device instantly."
      action={canEdit ? <Button onClick={save}><Check size={17} /> Save schedule</Button> : undefined}
    />

    {/* Status strip: realtime + concurrency + reminders */}
    <div className="fast-strip">
      <span className={`fast-live-dot ${cloudEnabled ? "on" : ""}`} title={cloudEnabled ? "Realtime sync on" : "Local preview"}>
        <Radio size={13} /> {cloudEnabled ? "SYNCED LIVE" : "LOCAL PREVIEW"}
      </span>
      <span className="fast-strip-item"><Layers size={13} /> {liveCells.length} live now across {new Set(liveCells.map(c => c.stageId)).size} stage{new Set(liveCells.map(c => c.stageId)).size === 1 ? "" : "s"}</span>
      <span className="fast-strip-item"><AlarmClock size={13} /> {reminders.length} starting within 15 min</span>
      <span className="fast-strip-item"><Star size={13} /> {marks.length} bookmarked</span>
      <button className="fast-strip-btn" onClick={enableAlerts}>Enable alerts</button>
    </div>

    {/* Conflict alerts */}
    {conflicts.length > 0 && <div className="fast-conflicts" role="alert">
      <strong>{conflicts.length} scheduling conflict{conflicts.length > 1 ? "s" : ""} — resolve before saving</strong>
      <ul>{conflicts.slice(0, 6).map((c, i) => <li key={i}><span className={`fast-conflict-kind kind-${c.kind}`}>{c.kind}</span>{c.message}</li>)}</ul>
      {conflicts.length > 6 && <small>+{conflicts.length - 6} more</small>}
    </div>}

    {/* Reminders */}
    {reminders.length > 0 && <div className="fast-reminders">
      <AlarmClock size={15} />
      <div>{reminders.slice(0, 4).map(r =>
        <span key={r.cellId}><strong>{r.programName}</strong> · {r.stageName} · in {r.minutesAway} min</span>,
      )}</div>
    </div>}

    {canEdit && <div className="schedule-builder">
      <div className="schedule-field"><span>Date</span><input aria-label="Schedule date" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
      <div className="schedule-field"><span>Starting time</span><input aria-label="Starting time" type="time" value={start} onChange={e => setStart(e.target.value)} /></div>
      <div className="schedule-field"><span>Ending time</span><input aria-label="Ending time" type="time" value={end} onChange={e => setEnd(e.target.value)} /></div>
      <Button variant="secondary" onClick={addSlot}><Plus size={16} /> Add time</Button>
    </div>}

    <div className="section-toolbar">
      <SearchInput value={query} onChange={setQuery} placeholder="Search stages" />
      <div className="sub-tabs fast-view-tabs">
        <button className={view === "grid" ? "active" : ""} onClick={() => setView("grid")}>Grid</button>
        <button className={view === "timeline" ? "active" : ""} onClick={() => setView("timeline")}>Timeline</button>
      </div>
      <label className="checkbox-line compact"><input type="checkbox" checked={bookedOnly} onChange={e => setBookedOnly(e.target.checked)} /> Bookmarked only</label>
      <span className="toolbar-count">{daySlots.length} slots · {cells.length} placed</span>
    </div>

    {days.length > 1 && <div className="fast-days" role="tablist" aria-label="Festival days">
      {days.map(d => <button key={d} role="tab" aria-selected={dayTab === d} className={dayTab === d ? "active" : ""} onClick={() => setDayTab(d)}><CalendarDays size={14} /> {fmtDay(d)}</button>)}
    </div>}

    {!data.stages.length || !daySlots.length
      ? <Empty title="Your timetable is waiting" description="Add a stage and at least one time slot to start arranging programs." />
      : view === "grid"
        ? <div className="timetable-scroll"><table className="timetable fast-grid">
          <thead><tr><th className="stage-heading">STAGE / TIME</th>{daySlots.map(slot =>
            <th key={slot.id}><span>{fmtDay(slot.date)}</span><strong>{slot.start} – {slot.end}</strong>
              {canEdit && <button aria-label={`Remove ${slot.start} time slot`} onClick={() => removeSlot(slot.id)}>×</button>}</th>)}
          </tr></thead>
          <tbody>{visibleStages.map(stage => <tr key={stage.id}>
            <th className="stage-name">{stage.name}<small>{stage.details}</small></th>
            {daySlots.map(slot => {
              const cell = cells.find(c => c.stageId === stage.id && c.slotId === slot.id);
              const program = data.programs.find(p => p.id === cell?.programId);
              if (bookedOnly && program && !marks.includes(program.id)) {
                return <td key={slot.id}><span className="empty-cell">—</span></td>;
              }
              const state = cell ? liveStateForCell(cell, slots, data.programs, now) : null;
              const concurrent = state === "live" ? liveCells.length : 0;
              return <td key={slot.id} className={state ? `fast-state-${state}` : ""}>
                {canEdit ? <>
                  <select aria-label={`${stage.name} at ${slot.start}`} value={cell?.programId || ""} onChange={e => setCell(stage.id, slot.id, e.target.value)}>
                    <option value="">Select program</option>
                    {assignablePrograms.filter(p => !cells.some(c => c.programId === p.id && !(c.stageId === stage.id && c.slotId === slot.id))).map(p =>
                      <option key={p.id} value={p.id}>{p.name} · {getCategoryName(data, p.categoryId)}</option>)}
                  </select>
                  {cell && program && <div className="fast-cell-meta">
                    <LiveBadge state={state!} />
                    {concurrent > 1 && <span className="fast-concurrent">+{concurrent - 1} elsewhere</span>}
                    {(cell.delayMinutes ?? 0) > 0 && <span className="fast-delay">+{cell.delayMinutes}m late</span>}
                    <div className="fast-cell-btns">
                      <button title="Bookmark" aria-label={`Bookmark ${program.name}`} onClick={() => flipBookmark(program.id)}>
                        {marks.includes(program.id) ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                      </button>
                      <button title="Delay 5 min" aria-label={`Delay ${program.name} by 5 minutes`} onClick={() => bumpDelay(cell.id, 5)}>+5m</button>
                      {(cell.delayMinutes ?? 0) > 0 && <button aria-label={`Clear delay for ${program.name}`} onClick={() => bumpDelay(cell.id, -(cell.delayMinutes ?? 0))}>clear</button>}
                    </div>
                  </div>}
                </> : program && cell ? <div className="scheduled-program">
                    <strong>{program.name}</strong>
                    <span>{slot.start} – {slot.end}{(cell.delayMinutes ?? 0) > 0 ? ` (+${cell.delayMinutes}m)` : ""}</span>
                    <LiveBadge state={state!} />
                    <button className="fast-bookmark" aria-label={`Bookmark ${program.name}`} onClick={() => flipBookmark(program.id)}>
                      {marks.includes(program.id) ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                    </button>
                  </div> : <span className="empty-cell">—</span>}
              </td>;
            })}
          </tr>)}
          </tbody>
        </table></div>
        : <div className="fast-gantt">
          {visibleStages.map(stage => {
            const stageCells = cells.filter(c => c.stageId === stage.id && slots.find(s => s.id === c.slotId)?.date === dayTab);
            return <div className="fast-gantt-row" key={stage.id}>
              <div className="fast-gantt-label"><strong>{stage.name}</strong><small>{stageCells.length} event{stageCells.length === 1 ? "" : "s"}</small></div>
              <div className="fast-gantt-track">
                <NowLine dayTab={dayTab} now={now} />
                {stageCells.map(cell => {
                  const program = data.programs.find(p => p.id === cell.programId);
                  if (!program || (bookedOnly && !marks.includes(program.id))) return null;
                  const state = liveStateForCell(cell, slots, data.programs, now);
                  return <div key={cell.id} className={`fast-gantt-bar state-${state}`} style={ganttPos(cellStartMs(cell, slots), cellEndMs(cell, slots))} title={`${program.name} · ${state}`}>
                    <span className="fast-gantt-name">{program.name}</span>
                    <LiveBadge state={state} mini />
                  </div>;
                })}
              </div>
            </div>;
          })}
          <div className="fast-gantt-axis">
            <span>{daySlots.length ? slotStartMs(daySlots[0]) ? new Date(cellStartMs({ id: "", slotId: daySlots[0].id, stageId: "", programId: "" }, slots)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "" : ""}</span>
            <span className="fast-now-legend">— now</span>
            <span>{daySlots.length ? new Date(slotEndMs(daySlots[daySlots.length - 1])).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</span>
          </div>
        </div>}
  </>;
}

export function LiveBadge({ state, mini = false }: { state: "live" | "upcoming" | "completed"; mini?: boolean }) {
  if (state === "live") return <span className="fast-badge fast-live"><span className="fast-pulse" />Live Now</span>;
  if (state === "completed") return <span className="fast-badge fast-done">{mini ? "Done" : "Completed"}</span>;
  return <span className="fast-badge fast-next">{mini ? "Next" : "Upcoming"}</span>;
}

function NowLine({ dayTab, now }: { dayTab: string; now: number }) {
  const dayBase = new Date(`${dayTab}T00:00:00`).getTime();
  const dayEndMs = new Date(`${dayTab}T23:59:59`).getTime();
  if (now < dayBase || now > dayEndMs) return null;
  const pct = ((now - dayBase) / (dayEndMs - dayBase)) * 100;
  return <div className="fast-now-line" style={{ left: `${pct}%` }} title="Now" />;
}
