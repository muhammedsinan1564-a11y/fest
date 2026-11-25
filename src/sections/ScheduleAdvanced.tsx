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
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { AlarmClock, Bookmark, BookmarkCheck, CalendarDays, Check, Layers, Plus, Radio, Star } from "lucide-react";
import { Button, Empty, PageHead, SearchInput } from "../ui";
import { getCategoryName, getMemberName, id, type ScheduleCell, type ScheduleSlot } from "../types";
import { cloudEnabled } from "../lib/persistence";
import {
  cellEndMs,
  cellStartMs,
  concurrentCells,
  detectScheduleConflicts,
  dueReminders,
  liveStateForCell,
  loadBookmarks,
  toggleBookmark,
} from "../lib/fast";
import { canManage, stageManagerSees, type SectionProps } from "./common";

const MINUTES_PER_DAY = 24 * 60;
const MIN_SPAN_MIN = 30;

/** Parses "HH:MM" into minutes from midnight; returns null when malformed. */
function toMin(time: string | undefined): number | null {
  if (!time) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Parses an ISO "YYYY-MM-DD" into epoch ms at local midnight; null when invalid. */
function dayBaseMs(date: string | undefined): number | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const value = new Date(`${date}T00:00:00`).getTime();
  return Number.isFinite(value) ? value : null;
}

/** Human-friendly festival day label with a safe fallback for malformed dates. */
function fmtDay(date: string): string {
  const value = new Date(`${date}T12:00:00`);
  return Number.isNaN(value.getTime())
    ? date || "Undated"
    : value.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

/** Safe clock string for an epoch value (no "Invalid Date" ever leaks into the UI). */
function fmtClock(ms: number): string {
  const value = new Date(ms);
  return Number.isNaN(value.getTime())
    ? "—"
    : value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Valid date + HH:MM times, with positive duration and a <=24h span. */
function isValidSlot(date: string, start: string, end: string): boolean {
  if (!dayBaseMs(date)) return false;
  const a = toMin(start);
  const b = toMin(end);
  return a !== null && b !== null && b > a && b - a <= MINUTES_PER_DAY;
}

export function ScheduleAdvanced({ fest, user, onChange, notify }: SectionProps) {
  const data = fest.data;
  const canEdit = canManage(user);
  /** Stage managers only see programs assigned to them; unassigned stays open to all. */
  const assignablePrograms = data.programs.filter((program) => stageManagerSees(program, user));
  const [slots, setSlots] = useState<ScheduleSlot[]>(data.slots ?? []);
  const [cells, setCells] = useState<ScheduleCell[]>(data.schedule ?? []);
  const [now, setNow] = useState(() => Date.now());
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"grid" | "timeline">("grid");
  const [bookedOnly, setBookedOnly] = useState(false);
  const [marks, setMarks] = useState<string[]>(() => loadBookmarks(fest.id, user.id));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [alertsOn, setAlertsOn] = useState(() => typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted");
  const firedRef = useRef(new Set<string>());
  // Guards async permission prompts (and notifications) from writing after unmount.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Live clock — re-evaluates Live/Upcoming/Completed + reminders every 30s.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  // Follow realtime updates from other devices.
  useEffect(() => {
    setSlots(data.slots ?? []);
    setCells((current) => {
      const incoming = data.schedule ?? [];
      // Keep local unsaved edits if the snapshot hasn't actually changed.
      return incoming === current ? current : incoming;
    });
  }, [data.slots, data.schedule]);

  const days = useMemo(() => [...new Set(slots.map((slot) => slot.date).filter(Boolean))].sort(), [slots]);
  const [dayTab, setDayTab] = useState<string>(days[0] ?? "");
  useEffect(() => {
    if (!days.includes(dayTab) && days.length) setDayTab(days[0]);
  }, [days, dayTab]);
  const daySlots = useMemo(
    () => slots.filter((slot) => slot.date === dayTab).sort((a, b) => (a.start ?? "").localeCompare(b.start ?? "")),
    [slots, dayTab]
  );

  // Draft-aware conflict scan (instant feedback before saving).
  const conflicts = useMemo(
    () => detectScheduleConflicts({ ...data, slots, schedule: cells }),
    [data, slots, cells]
  );
  const liveCells = useMemo(() => concurrentCells(cells, slots, now), [cells, slots, now]);
  const reminders = useMemo(
    () => dueReminders(cells, slots, data.programs ?? [], data.stages ?? [], now, 15),
    [cells, slots, data.programs, data.stages, now]
  );
  // Bookmarked placements come first in the reminder bar.
  const orderedReminders = useMemo(
    () => [...reminders].sort((a, b) => a.startsAt - b.startsAt || a.minutesAway - b.minutesAway),
    [reminders]
  );

  // Fire a browser notification once per upcoming placement; catch every rejection.
  useEffect(() => {
    if (!mountedRef.current || !("Notification" in window) || Notification.permission !== "granted") return;
    for (const reminder of orderedReminders) {
      const key = `${reminder.cellId}:${reminder.startsAt}`;
      if (firedRef.current.has(key)) continue;
      firedRef.current.add(key);
      try {
        const instance = new Notification(`${reminder.programName} starts in ${reminder.minutesAway} min`, {
          body: `${reminder.stageName} · ${fmtClock(reminder.startsAt)}`,
          tag: key,
        });
        // Some browsers return a Notification whose close() may throw; keep it quiet.
        const closeTimer = window.setTimeout(() => {
          try {
            instance.close();
          } catch {
            /* already dismissed */
          }
        }, 30_000);
        void closeTimer;
      } catch {
        /* Notifications may be blocked despite a granted permission */
      }
    }
  }, [orderedReminders]);

  const enableAlerts = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return notify("This browser does not support notifications.");
    }
    if (Notification.permission === "granted") {
      setAlertsOn(true);
      return notify("Reminders are already on — we'll ping you 15 minutes before.");
    }
    if (Notification.permission === "denied") {
      return notify("Notifications are blocked in your browser settings.");
    }
    try {
      const permission = await Notification.requestPermission();
      if (!mountedRef.current) return;
      const granted = permission === "granted";
      setAlertsOn(granted);
      notify(
        granted
          ? "Reminders on — we'll ping you 15 minutes before."
          : "Notifications blocked in browser settings. In-app reminders still work."
      );
    } catch {
      if (mountedRef.current) notify("Could not request notification permission. In-app reminders still work.");
    }
  };

  // ---- editing (MAIN only) ----
  const overlaps = (a?: ScheduleSlot, b?: ScheduleSlot) => {
    if (!a || !b || a.date !== b.date) return false;
    const aStart = toMin(a.start);
    const aEnd = toMin(a.end);
    const bStart = toMin(b.start);
    const bEnd = toMin(b.end);
    if (aStart === null || aEnd === null || bStart === null || bEnd === null) return false;
    return aStart < bEnd && bStart < aEnd;
  };

  const addSlot = () => {
    if (!isValidSlot(date, start, end)) return notify("Choose a valid date and a start time before the end time.");
    if (slots.some((slot) => slot.date === date && slot.start === start && slot.end === end)) {
      return notify("That time slot already exists.");
    }
    setSlots(
      [...slots, { id: id(), date, start, end }].sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`))
    );
    setDayTab(date);
    notify("Time slot added. Save the timetable when ready.");
  };

  const setCell = (stageId: string, slotId: string, programId: string) => {
    const other = cells.filter((cell) => !(cell.stageId === stageId && cell.slotId === slotId));
    if (!programId) {
      setCells(other);
      return;
    }
    if (!canEdit) return;
    const stage = data.stages.find((item) => item.id === stageId);
    const slot = slots.find((item) => item.id === slotId);
    const target = data.programs.find((item) => item.id === programId);
    if (!stage || !slot || !target) return notify("That stage, time slot or program is no longer available.");
    if (other.some((cell) => cell.programId === programId)) return notify("A program can only occupy one slot.");

    const members = new Set(target.entries.flatMap((entry) => entry.memberIds));
    const judges = new Set(target.judgeIds);
    for (const cell of other) {
      if (!overlaps(slot, slots.find((item) => item.id === cell.slotId))) continue;
      const otherProgram = data.programs.find((item) => item.id === cell.programId);
      if (!otherProgram) continue;
      const clashMember = otherProgram.entries.flatMap((entry) => entry.memberIds).find((memberId) => members.has(memberId));
      if (clashMember) return notify(`${getMemberName(data, clashMember)} is already performing at this time.`);
      const clashJudge = otherProgram.judgeIds.find((judgeId) => judges.has(judgeId));
      if (clashJudge) {
        const name =
          clashJudge === "main" ? "Main user" : data.users.find((staff) => staff.id === clashJudge)?.name ?? "Judge";
        return notify(`${name} is already judging at this time.`);
      }
    }
    setCells([...other, { id: id(), stageId, slotId, programId }]);
  };

  const bumpDelay = (cellId: string, minutes: number) => {
    setCells((previous) =>
      previous.map((cell) => {
        if (cell.id !== cellId) return cell;
        const current = Number.isFinite(cell.delayMinutes) ? (cell.delayMinutes ?? 0) : 0;
        const next = Math.max(0, current + minutes);
        return next === 0 ? { ...cell, delayMinutes: undefined } : { ...cell, delayMinutes: next };
      })
    );
  };

  const save = () => {
    if (cells.some((cell) => cells.filter((other) => other.programId === cell.programId).length > 1)) {
      return notify("A program can only occupy one schedule slot.");
    }
    const live = detectScheduleConflicts({ ...data, slots, schedule: cells });
    if (live.length) return notify(`Resolve ${live.length} conflict${live.length === 1 ? "" : "s"} before saving.`);
    onChange((next) => ({ ...next, slots, schedule: cells }), "Updated the fest schedule");
    notify(cloudEnabled ? "Schedule saved — pushed live to every device." : "Schedule saved.");
  };

  const removeSlot = (slotId: string) => {
    if (!window.confirm("Remove this time slot and its scheduled programs?")) return;
    setSlots(slots.filter((slot) => slot.id !== slotId));
    setCells(cells.filter((cell) => cell.slotId !== slotId));
  };

  const flipBookmark = (programId: string) => setMarks(toggleBookmark(fest.id, user.id, programId));

  /* ---- Gantt geometry for the active day ---- */
  const dayWindow = useMemo(() => {
    let min = MINUTES_PER_DAY;
    let max = 0;
    for (const slot of daySlots) {
      const a = toMin(slot.start);
      const b = toMin(slot.end);
      if (a === null || b === null || b <= a) continue;
      min = Math.min(min, a);
      max = Math.max(max, b);
    }
    if (min >= max) return { min: 9 * 60, max: 17 * 60, empty: true };
    // Pad a little so bars never sit hard against the rails.
    const paddedMin = Math.max(0, min - 15);
    const paddedMax = Math.min(MINUTES_PER_DAY, max + 15);
    return { min: paddedMin, max: Math.max(paddedMin + MIN_SPAN_MIN, paddedMax), empty: false };
  }, [daySlots]);

  const windowSpanMin = Math.max(MIN_SPAN_MIN, dayWindow.max - dayWindow.min);
  const dayBase = dayBaseMs(dayTab);

  /** Percentage geometry with a safe fallback when a slot or date is missing. */
  const ganttPos = (startMs: number, endMs: number) => {
    const base = dayBase;
    if (base === null || !Number.isFinite(startMs) || !Number.isFinite(endMs)) {
      return { left: "0%", width: "8%" };
    }
    const startMin = (startMs - base) / 60_000;
    const durationMin = Math.max(1, (endMs - startMs) / 60_000);
    const left = Math.max(0, Math.min(100, ((startMin - dayWindow.min) / windowSpanMin) * 100));
    const width = Math.max(3, Math.min(100 - left, (durationMin / windowSpanMin) * 100));
    return { left: `${left}%`, width: `${width}%` };
  };

  const visibleStages = data.stages.filter((stage) =>
    !query.trim() || `${stage.name} ${stage.details ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())
  );
  const liveStageCount = new Set(liveCells.map((cell) => cell.stageId)).size;
  const axisStart = dayBase !== null ? fmtClock(dayBase + dayWindow.min * 60_000) : "—";
  const axisEnd = dayBase !== null ? fmtClock(dayBase + dayWindow.max * 60_000) : "—";

  return (
    <MotionConfig reducedMotion="user">
      <PageHead
        eyebrow="LIVE / TIMETABLE"
        title="Schedule"
        description="Multi-stage, multi-day grid. Delays and reschedules sync to every device instantly."
        action={canEdit ? <Button onClick={save} icon={<Check size={17} />}>Save schedule</Button> : undefined}
      />

      {/* Status strip: realtime + concurrency + reminders */}
      <div className="fast-strip">
        <span className={`fast-live-dot ${cloudEnabled ? "on" : ""}`} title={cloudEnabled ? "Realtime sync on" : "Local preview"}>
          <Radio size={13} /> {cloudEnabled ? "SYNCED LIVE" : "LOCAL PREVIEW"}
        </span>
        <span className="fast-strip-item">
          <Layers size={13} /> {liveCells.length} live now across {liveStageCount} stage{liveStageCount === 1 ? "" : "s"}
        </span>
        <span className="fast-strip-item"><AlarmClock size={13} /> {reminders.length} starting within 15 min</span>
        <span className="fast-strip-item"><Star size={13} /> {marks.length} bookmarked</span>
        <button type="button" className={`fast-strip-btn ${alertsOn ? "is-on" : ""}`} onClick={() => void enableAlerts()}>
          {alertsOn ? "Alerts on" : "Enable alerts"}
        </button>
      </div>

      {/* Conflict alerts */}
      <AnimatePresence initial={false}>
        {conflicts.length > 0 && (
          <motion.div
            className="fast-conflicts"
            role="alert"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <strong>
              {conflicts.length} scheduling conflict{conflicts.length === 1 ? "" : "s"} — resolve before saving
            </strong>
            <ul>
              {conflicts.slice(0, 6).map((conflict, index) => (
                <li key={`${conflict.kind}-${conflict.programAId}-${conflict.programBId}-${index}`}>
                  <span className={`fast-conflict-kind kind-${conflict.kind}`}>{conflict.kind}</span>
                  {conflict.message}
                </li>
              ))}
            </ul>
            {conflicts.length > 6 && <small>+{conflicts.length - 6} more</small>}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reminders */}
      <AnimatePresence initial={false}>
        {orderedReminders.length > 0 && (
          <motion.div
            className="fast-reminders"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <AlarmClock size={15} />
            <div>
              {orderedReminders.slice(0, 4).map((reminder) => (
                <span key={reminder.cellId}>
                  <strong>{reminder.programName}</strong> · {reminder.stageName} · in {reminder.minutesAway} min
                  {marks.includes(reminder.programId) && <BookmarkCheck size={12} />}
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {canEdit && (
        <div className="schedule-builder">
          <div className="schedule-field">
            <span>Date</span>
            <input aria-label="Schedule date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </div>
          <div className="schedule-field">
            <span>Starting time</span>
            <input aria-label="Starting time" type="time" value={start} onChange={(event) => setStart(event.target.value)} />
          </div>
          <div className="schedule-field">
            <span>Ending time</span>
            <input aria-label="Ending time" type="time" value={end} onChange={(event) => setEnd(event.target.value)} />
          </div>
          <Button variant="secondary" onClick={addSlot} icon={<Plus size={16} />}>
            Add time
          </Button>
        </div>
      )}

      <div className="section-toolbar">
        <SearchInput value={query} onChange={setQuery} placeholder="Search stages" />
        <div className="sub-tabs fast-view-tabs" role="tablist" aria-label="Schedule view">
          <button type="button" role="tab" aria-selected={view === "grid"} className={view === "grid" ? "active" : ""} onClick={() => setView("grid")}>
            {view === "grid" && <motion.span layoutId="fast-view-pill" className="sub-tab-pill" />}
            <span>Grid</span>
          </button>
          <button type="button" role="tab" aria-selected={view === "timeline"} className={view === "timeline" ? "active" : ""} onClick={() => setView("timeline")}>
            {view === "timeline" && <motion.span layoutId="fast-view-pill" className="sub-tab-pill" />}
            <span>Timeline</span>
          </button>
        </div>
        <label className="checkbox-line compact">
          <input type="checkbox" checked={bookedOnly} onChange={(event) => setBookedOnly(event.target.checked)} /> Bookmarked only
        </label>
        <span className="toolbar-count">{daySlots.length} slots · {cells.length} placed</span>
      </div>

      {days.length > 1 && (
        <div className="fast-days" role="tablist" aria-label="Festival days">
          {days.map((day) => (
            <button
              type="button"
              key={day}
              role="tab"
              aria-selected={dayTab === day}
              className={dayTab === day ? "active" : ""}
              onClick={() => setDayTab(day)}
            >
              <CalendarDays size={14} /> {fmtDay(day)}
            </button>
          ))}
        </div>
      )}

      <AnimatePresence mode="wait" initial={false}>
        {!data.stages.length || !daySlots.length ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Empty title="Your timetable is waiting" description="Add a stage and at least one time slot to start arranging programs." />
          </motion.div>
        ) : (
          <motion.div
            key={`${view}:${dayTab}:${bookedOnly}:${query.trim()}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            {view === "grid" ? (
              <div className="timetable-scroll">
                <table className="timetable fast-grid">
                  <thead>
                    <tr>
                      <th className="stage-heading">STAGE / TIME</th>
                      {daySlots.map((slot) => (
                        <th key={slot.id}>
                          <span>{fmtDay(slot.date)}</span>
                          <strong>{slot.start} – {slot.end}</strong>
                          {canEdit && (
                            <button type="button" aria-label={`Remove ${slot.start} time slot`} onClick={() => removeSlot(slot.id)}>
                              ×
                            </button>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleStages.map((stage) => (
                      <tr key={stage.id}>
                        <th className="stage-name">
                          {stage.name}
                          <small>{stage.details}</small>
                        </th>
                        {daySlots.map((slot) => {
                          const cell = cells.find((item) => item.stageId === stage.id && item.slotId === slot.id);
                          const program = cell ? data.programs.find((item) => item.id === cell.programId) : undefined;
                          if (bookedOnly && program && !marks.includes(program.id)) {
                            return <td key={slot.id} data-slot={`${slot.start} – ${slot.end}`}><span className="empty-cell">—</span></td>;
                          }
                          const state = cell ? liveStateForCell(cell, slots, data.programs ?? [], now) : null;
                          const concurrent = state === "live" ? liveCells.length : 0;
                          return (
                            <td key={slot.id} data-slot={`${slot.start} – ${slot.end}`} className={state ? `fast-state-${state}` : ""}>
                              {canEdit ? (
                                <>
                                  <select
                                    aria-label={`${stage.name} at ${slot.start}`}
                                    value={cell?.programId || ""}
                                    onChange={(event) => setCell(stage.id, slot.id, event.target.value)}
                                  >
                                    <option value="">Select program</option>
                                    {assignablePrograms
                                      .filter(
                                        (item) =>
                                          !cells.some(
                                            (placed) =>
                                              placed.programId === item.id &&
                                              !(placed.stageId === stage.id && placed.slotId === slot.id)
                                          )
                                      )
                                      .map((item) => (
                                        <option key={item.id} value={item.id}>
                                          {item.name} · {getCategoryName(data, item.categoryId)}
                                        </option>
                                      ))}
                                  </select>
                                  {cell && program && (
                                    <div className="fast-cell-meta">
                                      <LiveBadge state={state!} />
                                      {concurrent > 1 && <span className="fast-concurrent">+{concurrent - 1} elsewhere</span>}
                                      {(cell.delayMinutes ?? 0) > 0 && <span className="fast-delay">+{cell.delayMinutes}m late</span>}
                                      <div className="fast-cell-btns">
                                        <button
                                          type="button"
                                          title="Bookmark"
                                          aria-label={`Bookmark ${program.name}`}
                                          aria-pressed={marks.includes(program.id)}
                                          className={marks.includes(program.id) ? "bookmarked" : ""}
                                          onClick={() => flipBookmark(program.id)}
                                        >
                                          {marks.includes(program.id) ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                                        </button>
                                        <button type="button" title="Delay 5 min" aria-label={`Delay ${program.name} by 5 minutes`} onClick={() => bumpDelay(cell.id, 5)}>
                                          +5m
                                        </button>
                                        {(cell.delayMinutes ?? 0) > 0 && (
                                          <button type="button" aria-label={`Clear delay for ${program.name}`} onClick={() => bumpDelay(cell.id, -(cell.delayMinutes ?? 0))}>
                                            clear
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </>
                              ) : program && cell ? (
                                <div className="scheduled-program">
                                  <strong>{program.name}</strong>
                                  <span>
                                    {slot.start} – {slot.end}
                                    {(cell.delayMinutes ?? 0) > 0 ? ` (+${cell.delayMinutes}m)` : ""}
                                  </span>
                                  <LiveBadge state={state!} />
                                  <button
                                    type="button"
                                    className={`fast-bookmark ${marks.includes(program.id) ? "bookmarked" : ""}`}
                                    aria-pressed={marks.includes(program.id)}
                                    aria-label={`Bookmark ${program.name}`}
                                    onClick={() => flipBookmark(program.id)}
                                  >
                                    {marks.includes(program.id) ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                                  </button>
                                </div>
                              ) : (
                                <span className="empty-cell">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="fast-gantt">
                {visibleStages.map((stage) => {
                  const stageCells = cells.filter(
                    (cell) =>
                      cell.stageId === stage.id &&
                      slots.find((slot) => slot.id === cell.slotId)?.date === dayTab
                  );
                  return (
                    <div className="fast-gantt-row" key={stage.id}>
                      <div className="fast-gantt-label">
                        <strong>{stage.name}</strong>
                        <small>{stageCells.length} event{stageCells.length === 1 ? "" : "s"}</small>
                      </div>
                      <div className="fast-gantt-track">
                        <NowLine dayTab={dayTab} now={now} windowMin={dayWindow.min} windowMax={dayWindow.max} />
                        {stageCells.map((cell) => {
                          const program = data.programs.find((item) => item.id === cell.programId);
                          if (!program || (bookedOnly && !marks.includes(program.id))) return null;
                          const state = liveStateForCell(cell, slots, data.programs ?? [], now);
                          return (
                            <div
                              key={cell.id}
                              className={`fast-gantt-bar state-${state}`}
                              style={ganttPos(cellStartMs(cell, slots), cellEndMs(cell, slots))}
                              title={`${program.name} · ${state}`}
                            >
                              <span className="fast-gantt-name">{program.name}</span>
                              <LiveBadge state={state} mini />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                <div className="fast-gantt-axis">
                  <span>{axisStart}</span>
                  <span className="fast-now-legend">— now</span>
                  <span>{axisEnd}</span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}

export function LiveBadge({ state, mini = false }: { state: "live" | "upcoming" | "completed"; mini?: boolean }) {
  if (state === "live")
    return (
      <span className="fast-badge fast-live">
        <span className="fast-pulse" />Live Now
      </span>
    );
  if (state === "completed") return <span className="fast-badge fast-done">{mini ? "Done" : "Completed"}</span>;
  return <span className="fast-badge fast-next">{mini ? "Next" : "Upcoming"}</span>;
}

/** "Now" marker aligned to the visible Gantt window (not the full 24 h day). */
function NowLine({ dayTab, now, windowMin, windowMax }: { dayTab: string; now: number; windowMin: number; windowMax: number }) {
  const base = dayBaseMs(dayTab);
  if (base === null) return null;
  const span = Math.max(1, windowMax - windowMin);
  const minutesFromBase = (now - base) / 60_000;
  if (!Number.isFinite(minutesFromBase) || minutesFromBase < windowMin || minutesFromBase > windowMax) return null;
  const pct = Math.max(0, Math.min(100, ((minutesFromBase - windowMin) / span) * 100));
  return <div className="fast-now-line" style={{ left: `${pct}%` }} title="Now" />;
}
