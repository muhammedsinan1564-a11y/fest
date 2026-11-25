import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { ArrowRight, Bell, Check, Clock3, Dices, Play, Plus, RotateCcw, Square, Upload } from "lucide-react";
import { Button, Empty, Field, PageHead } from "../ui";
import { getCategoryName, getMemberName, id, type ScheduleCell, type ScheduleSlot } from "../types";
import { canManage, readImage, type SectionProps } from "./common";

/* ------------------------------------------------------------------ */
/* Shared safe time/date helpers                                       */
/* ------------------------------------------------------------------ */

const MAX_TIMER_SECONDS = 24 * 60 * 60;

function toMin(time: string | undefined): number | null {
  if (!time) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function validDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  return Number.isFinite(new Date(`${date}T12:00:00`).getTime());
}

function fmtDay(date: string): string {
  const value = new Date(`${date}T12:00:00`);
  return Number.isNaN(value.getTime())
    ? date || "Undated"
    : value.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Positive whole number clamped to a range; 0 when the input is empty/invalid. */
function clampInt(raw: string, min: number, max: number): number {
  const trimmed = raw.trim();
  if (!trimmed || !/^\d+$/.test(trimmed)) return min;
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function safeSettingNumber(value: unknown, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, Math.floor(value)))
    : min;
}

/* ------------------------------------------------------------------ */
/* Basic schedule                                                      */
/* ------------------------------------------------------------------ */

export function ScheduleSection({ fest, user, onChange, notify }: SectionProps) {
  const data = fest.data;
  const canEdit = canManage(user);
  const [slots, setSlots] = useState<ScheduleSlot[]>(data.slots ?? []);
  const [cells, setCells] = useState<ScheduleCell[]>(data.schedule ?? []);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  useEffect(() => {
    setSlots(data.slots ?? []);
    setCells(data.schedule ?? []);
  }, [data.slots, data.schedule]);

  const addSlot = () => {
    const a = toMin(start);
    const b = toMin(end);
    if (!validDate(date) || a === null || b === null || b <= a) {
      return notify("Choose a valid date, starting time and ending time.");
    }
    if (slots.some((slot) => slot.date === date && slot.start === start && slot.end === end)) {
      return notify("That time slot already exists.");
    }
    setSlots(
      [...slots, { id: id(), date, start, end }].sort((left, right) =>
        `${left.date}${left.start}`.localeCompare(`${right.date}${right.start}`)
      )
    );
    notify("Time slot added. Save the timetable when you are ready.");
  };

  const overlaps = (first?: ScheduleSlot, second?: ScheduleSlot) => {
    if (!first || !second || first.date !== second.date) return false;
    const aStart = toMin(first.start);
    const aEnd = toMin(first.end);
    const bStart = toMin(second.start);
    const bEnd = toMin(second.end);
    if (aStart === null || aEnd === null || bStart === null || bEnd === null) return false;
    return aStart < bEnd && bStart < aEnd;
  };

  const setCell = (stageId: string, slotId: string, programId: string) => {
    if (!canEdit) return;
    const other = cells.filter((cell) => !(cell.stageId === stageId && cell.slotId === slotId));
    if (!programId) {
      setCells(other);
      return;
    }
    const stage = data.stages.find((item) => item.id === stageId);
    const slot = slots.find((item) => item.id === slotId);
    const program = data.programs.find((item) => item.id === programId);
    if (!stage || !slot || !program) return notify("That stage, time slot or program is no longer available.");
    if (other.some((cell) => cell.programId === programId)) {
      return notify("That program is already placed in another slot.");
    }
    const members = new Set(program.entries.flatMap((entry) => entry.memberIds));
    for (const cell of other) {
      if (!overlaps(slot, slots.find((item) => item.id === cell.slotId))) continue;
      const neighbour = data.programs.find((item) => item.id === cell.programId);
      const clash = neighbour?.entries.flatMap((entry) => entry.memberIds).find((memberId) => members.has(memberId));
      if (clash) return notify(`${getMemberName(data, clash)} is already performing at this time.`);
    }
    setCells([...other, { id: id(), stageId, slotId, programId }]);
  };

  const placedElsewhere = (stageId: string, slotId: string, programId: string) =>
    cells.some(
      (cell) => cell.programId === programId && !(cell.stageId === stageId && cell.slotId === slotId)
    );

  const save = () => {
    if (cells.some((cell) => cells.filter((item) => item.programId === cell.programId).length > 1)) {
      return notify("A program can only occupy one schedule slot.");
    }
    // Reject any placement pointing at a missing slot outright.
    if (cells.some((cell) => !slots.some((slot) => slot.id === cell.slotId))) {
      return notify("Some placements point to a time slot that no longer exists.");
    }
    for (let a = 0; a < cells.length; a++) {
      for (let b = a + 1; b < cells.length; b++) {
        const left = slots.find((slot) => slot.id === cells[a].slotId);
        const right = slots.find((slot) => slot.id === cells[b].slotId);
        if (!overlaps(left, right)) continue;
        if (cells[a].stageId === cells[b].stageId) {
          return notify("A stage cannot host two overlapping programs.");
        }
        const first = data.programs.find((program) => program.id === cells[a].programId);
        const second = data.programs.find((program) => program.id === cells[b].programId);
        const firstMembers = new Set(first?.entries.flatMap((entry) => entry.memberIds) ?? []);
        const shared = second?.entries.flatMap((entry) => entry.memberIds).find((memberId) => firstMembers.has(memberId));
        if (shared) return notify(`${getMemberName(data, shared)} is entered in two programs at the same time.`);
      }
    }
    onChange((next) => ({ ...next, slots, schedule: cells }), "Updated the fest schedule");
    notify("Schedule saved");
  };

  const removeSlot = (slotId: string) => {
    if (!window.confirm("Remove this time slot and its scheduled programs?")) return;
    setSlots(slots.filter((slot) => slot.id !== slotId));
    setCells(cells.filter((cell) => cell.slotId !== slotId));
  };

  const hasGrid = data.stages.length > 0 && slots.length > 0;

  return (
    <MotionConfig reducedMotion="user">
      <PageHead
        eyebrow="LIVE / TIMETABLE"
        title="Schedule"
        description="One clear view of where and when every program happens."
        action={canEdit ? <Button onClick={save} icon={<Check size={17} />}>Save schedule</Button> : undefined}
      />
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
      <AnimatePresence mode="wait" initial={false}>
        {hasGrid ? (
          <motion.div
            key="timetable"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="timetable-scroll"
          >
            <table className="timetable">
              <thead>
                <tr>
                  <th className="stage-heading">STAGE / TIME</th>
                  {slots.map((slot) => (
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
                {data.stages.map((stage) => (
                  <tr key={stage.id}>
                    <th className="stage-name">
                      {stage.name}
                      <small>{stage.details}</small>
                    </th>
                    {slots.map((slot) => {
                      const cell = cells.find((item) => item.stageId === stage.id && item.slotId === slot.id);
                      const program = cell ? data.programs.find((item) => item.id === cell.programId) : undefined;
                      return (
                        <td key={slot.id} data-slot={`${slot.start} – ${slot.end}`}>
                          {canEdit ? (
                            <select
                              aria-label={`${stage.name} at ${slot.start}`}
                              value={cell?.programId || ""}
                              onChange={(event) => setCell(stage.id, slot.id, event.target.value)}
                            >
                              <option value="">Select program</option>
                              {data.programs
                                .filter((item) => !placedElsewhere(stage.id, slot.id, item.id))
                                .map((item) => (
                                  <option key={item.id} value={item.id}>
                                    {item.name} · {getCategoryName(data, item.categoryId)}
                                  </option>
                                ))}
                            </select>
                          ) : program ? (
                            <div className="scheduled-program">
                              <strong>{program.name}</strong>
                              <span>{getCategoryName(data, program.categoryId)}</span>
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
          </motion.div>
        ) : (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Empty
              title="Your timetable is waiting"
              description="Add a stage and at least one time slot to start arranging programs."
            />
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}

/* ------------------------------------------------------------------ */
/* Random draw                                                         */
/* ------------------------------------------------------------------ */

export function RandomSection({ letter = false }: { letter?: boolean }) {
  const [isLetter, setIsLetter] = useState(letter);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [used, setUsed] = useState<string[]>([]);
  const [shaking, setShaking] = useState(false);

  // Keep in sync if a parent changes the initial prop...
  useEffect(() => setIsLetter(letter), [letter]);

  // ...and clear all draw state whenever the mode changes, so a letter pool
  // never leaks into number mode (or vice versa).
  useEffect(() => {
    setInput("");
    setResult(null);
    setUsed([]);
    setShaking(false);
  }, [isLetter]);

  const draw = () => {
    setShaking(true);
    window.setTimeout(() => setShaking(false), 360);
    if (isLetter) {
      const target = input.trim().toUpperCase();
      if (!/^[A-Z]$/.test(target)) return setResult("Enter a letter from A to Z");
      const count = target.charCodeAt(0) - 64;
      const alphabet = Array.from({ length: count }, (_, index) => String.fromCharCode(65 + index));
      const available = alphabet.filter((value) => !used.includes(value));
      if (!available.length) return setResult("All letters drawn. Reset to start again.");
      const choice = available[Math.floor(Math.random() * available.length)];
      setUsed((previous) => [...previous, choice]);
      setResult(choice);
    } else {
      const max = Number(input.trim());
      if (!Number.isInteger(max) || max < 1 || max > 100) return setResult("Enter a number from 1 to 100");
      setResult(String(Math.floor(Math.random() * max) + 1));
    }
  };

  const reset = () => {
    setUsed([]);
    setResult(null);
    setInput("");
  };

  const isError = Boolean(result && result.length > 3);

  return (
    <MotionConfig reducedMotion="user">
      <PageHead
        eyebrow="TOOLS / FAIR DRAW"
        title={isLetter ? "Random Letter" : "Random Picker"}
        description={
          isLetter
            ? "Draw a letter from A up to your chosen letter. No repeats until every letter has had a turn."
            : "Leave the choice to chance. Pick a number between 1 and your limit, up to 100."
        }
      />
      <div className="sub-tabs random-mode-tabs" role="tablist" aria-label="Draw mode">
        {([
          [false, "Number draw"],
          [true, "Letter draw"],
        ] as const).map(([value, label]) => (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={isLetter === value}
            className={isLetter === value ? "active" : ""}
            onClick={() => setIsLetter(value)}
          >
            {isLetter === value && (
              <motion.span layoutId="random-mode-pill" className="sub-tab-pill" />
            )}
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="random-layout">
        <div className="random-input">
          <Field label={isLetter ? "Last letter in the draw" : "Maximum number (1–100)"}>
            <input
              autoFocus
              value={input}
              maxLength={isLetter ? 1 : 3}
              type={isLetter ? "text" : "number"}
              inputMode={isLetter ? "text" : "numeric"}
              min={isLetter ? undefined : 1}
              max={isLetter ? undefined : 100}
              step={isLetter ? undefined : 1}
              onChange={(event) => {
                const next = isLetter ? event.target.value.toUpperCase() : event.target.value;
                setInput(next);
                // A new pool invalidates the old drawn letters and result.
                setUsed([]);
                setResult(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") draw();
              }}
              placeholder={isLetter ? "e.g. M" : "e.g. 50"}
              aria-label={isLetter ? "Last letter in the draw" : "Maximum number"}
            />
          </Field>
          <div className="button-row">
            <Button onClick={draw} icon={<Dices size={16} />}>
              Draw {isLetter ? "letter" : "number"} <ArrowRight size={17} />
            </Button>
            <Button variant="secondary" onClick={reset} icon={<RotateCcw size={16} />}>
              Reset
            </Button>
          </div>
          {isLetter && (
            <div className="random-used">
              <p className="muted small-text">
                {used.length} letter{used.length === 1 ? "" : "s"} drawn this round
              </p>
              {used.length > 0 && (
                <div className="random-used-chips" aria-label="Drawn letters">
                  <AnimatePresence initial={false}>
                    {used.map((value, index) => (
                      <motion.span
                        key={`${value}-${index}`}
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.6 }}
                      >
                        {value}
                      </motion.span>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          )}
        </div>

        <motion.div
          className={`random-output ${isError ? "is-error" : ""}`}
          aria-live="polite"
          animate={shaking ? { scale: [1, 1.035, 1] } : { scale: 1 }}
          transition={{ duration: 0.32 }}
        >
          <span>THE DRAW</span>
          <AnimatePresence mode="wait" initial={false}>
            <motion.strong
              key={result || "blank"}
              initial={{ opacity: 0, y: 16, rotateX: -60 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.24 }}
            >
              {result && result.length <= 3 ? result : "?"}
            </motion.strong>
          </AnimatePresence>
          {result && result.length > 3 && <p>{result}</p>}
          <small>{isLetter ? "ONE LETTER. NO REPEATS." : "ONE MOMENT OF CHANCE."}</small>
        </motion.div>
      </div>
    </MotionConfig>
  );
}

/* ------------------------------------------------------------------ */
/* Stage bell                                                          */
/* ------------------------------------------------------------------ */

const TONES = [
  { name: "School bell", url: "https://www.myinstants.com/media/sounds/school-bell-1-0.mp3", page: "https://www.myinstants.com/en/instant/school-bell-1-0-67529/" },
  { name: "BELL11", url: "https://www.myinstants.com/media/sounds/bell11.mp3", page: "https://www.myinstants.com/en/instant/bell11-78376/" },
  { name: "Hector bell", url: "https://www.myinstants.com/media/sounds/hector-bell.mp3", page: "https://www.myinstants.com/en/instant/hector-bell-43024/" },
  { name: "Service bell", url: "https://www.myinstants.com/media/sounds/service-bell-2.mp3", page: "https://www.myinstants.com/en/instant/service-bell-2/" },
  { name: "Boxing bell", url: "https://www.myinstants.com/media/sounds/boxing-bell.mp3", page: "https://www.myinstants.com/en/instant/boxing-bell/" },
];

const MAX_TONE_BYTES = 3_000_000;

/** Builds (or reuses) one AudioContext; never throws when audio is blocked. */
function getAudioContext(existing: AudioContext | null): AudioContext | null {
  try {
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (existing && existing.state !== "closed") {
      if (existing.state === "suspended") void existing.resume().catch(() => undefined);
      return existing;
    }
    const ctx = new Ctor();
    if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
    return ctx;
  } catch {
    return null;
  }
}

/** Fully releases one HTMLAudioElement so no decode/playback continues in the background. */
function releaseAudioElement(element: HTMLAudioElement | null): void {
  if (!element) return;
  try {
    element.pause();
    element.onended = null;
    element.onerror = null;
    element.src = "";
    element.load();
  } catch {
    /* element already torn down */
  }
}

export function BellSection({ fest, user, onChange, notify }: SectionProps) {
  const settings = fest.data.settings;
  const main = canManage(user);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const warningAudioRef = useRef<HTMLAudioElement | null>(null);
  const repeatRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const mountedRef = useRef(true);
  const [ringing, setRinging] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const selected = TONES.find((tone) => tone.name === settings.bellTone);
  const custom = (settings.customTones ?? []).find((tone) => tone.name === settings.bellTone);
  const toneSource = custom?.data || selected?.url;

  /** Clears every interval and audio source, with no state writes (safe on unmount). */
  const releaseAll = useCallback(() => {
    if (repeatRef.current) window.clearInterval(repeatRef.current);
    if (timerRef.current) window.clearInterval(timerRef.current);
    repeatRef.current = null;
    timerRef.current = null;
    releaseAudioElement(audioRef.current);
    releaseAudioElement(warningAudioRef.current);
    audioRef.current = null;
    warningAudioRef.current = null;
  }, []);

  const stop = () => {
    releaseAll();
    if (mountedRef.current) setRinging(false);
  };

  // Unmount: stop everything and close the shared AudioContext.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (repeatRef.current) window.clearInterval(repeatRef.current);
      if (timerRef.current) window.clearInterval(timerRef.current);
      repeatRef.current = null;
      timerRef.current = null;
      releaseAudioElement(audioRef.current);
      releaseAudioElement(warningAudioRef.current);
      audioRef.current = null;
      warningAudioRef.current = null;
      const ctx = contextRef.current;
      contextRef.current = null;
      if (ctx && ctx.state !== "closed") void ctx.close().catch(() => undefined);
    };
  }, []);

  // Switching tones must not leave the previous sound looping underneath.
  useEffect(() => {
    releaseAll();
    if (mountedRef.current) setRinging(false);
  }, [settings.bellTone, releaseAll]);

  const syntheticRing = () => {
    if (!mountedRef.current) return;
    const context = getAudioContext(contextRef.current);
    if (!context) return;
    contextRef.current = context;
    try {
      const index = Math.max(0, TONES.findIndex((tone) => tone.name === settings.bellTone));
      const now = context.currentTime;
      [0, 0.09, 0.18].forEach((delay, note) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const at = now + delay;
        oscillator.type = index % 2 ? "triangle" : "sine";
        oscillator.frequency.setValueAtTime((620 + index * 90) * (note === 1 ? 1.48 : 1), at);
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(0.13, at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.65);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(at);
        oscillator.stop(at + 0.7);
      });
    } catch {
      if (mountedRef.current) notify("Audio is unavailable on this device.");
    }
  };

  const ring = (loop = false) => {
    stop();
    if (mountedRef.current) setRinging(loop);
    if (!toneSource) {
      syntheticRing();
      if (loop && mountedRef.current) repeatRef.current = window.setInterval(syntheticRing, 420);
      return;
    }
    let fallbackStarted = false;
    const fallback = () => {
      if (fallbackStarted || !mountedRef.current) return;
      fallbackStarted = true;
      syntheticRing();
      if (loop && !repeatRef.current) {
        repeatRef.current = window.setInterval(syntheticRing, 420);
      }
    };
    try {
      const audio = new Audio(toneSource);
      audio.loop = loop;
      audioRef.current = audio;
      audio.onerror = () => fallback();
      void audio.play().catch(() => fallback());
    } catch {
      fallback();
    }
  };

  const startTimer = () => {
    stop();
    const duration = Math.max(
      1,
      Math.min(
        MAX_TIMER_SECONDS,
        safeSettingNumber(settings.bellDuration, 1, MAX_TIMER_SECONDS) *
          (settings.bellUnit === "minutes" ? 60 : 1)
      )
    );
    const warningAt = Math.max(
      0,
      Math.min(
        MAX_TIMER_SECONDS,
        safeSettingNumber(settings.bellWarning, 0, MAX_TIMER_SECONDS) *
          (settings.bellWarningUnit === "minutes" ? 60 : 1)
      )
    );
    setSecondsLeft(duration);
    const deadline = Date.now() + duration * 1000;
    let warned = false;
    let finished = false;
    timerRef.current = window.setInterval(() => {
      if (!mountedRef.current) return;
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left > 0 && warningAt > 0 && left <= warningAt && !warned) {
        warned = true;
        if (toneSource) {
          try {
            releaseAudioElement(warningAudioRef.current);
            const warning = new Audio(toneSource);
            warningAudioRef.current = warning;
            void warning.play().catch(() => syntheticRing());
          } catch {
            syntheticRing();
          }
        } else {
          syntheticRing();
        }
        notify("Bell warning cue");
      }
      if (left <= 0 && !finished) {
        finished = true;
        if (timerRef.current) window.clearInterval(timerRef.current);
        timerRef.current = null;
        ring();
        notify("Bell timer complete");
      }
    }, 250);
    notify("Bell timer started");
  };

  const updateSettings = (patch: Partial<typeof settings>) =>
    onChange((data) => ({ ...data, settings: { ...data.settings, ...patch } }));

  const importTone = async (file?: File) => {
    if (!file) return;
    const isAudio = file.type.startsWith("audio/") || /\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(file.name);
    if (!isAudio) return notify("Choose an audio file (MP3, WAV, OGG or M4A).");
    if (file.size > MAX_TONE_BYTES) return notify("That sound is over 3 MB. Please use a shorter clip.");
    if (!file.size) return notify("That file is empty. Choose another sound.");
    try {
      const dataUrl = await readImage(file);
      if (!dataUrl.startsWith("data:")) return notify("That file could not be read as audio.");
      if (!mountedRef.current) return;
      const baseName = file.name.replace(/\.[^.]+$/, "").trim().slice(0, 40) || "Custom tone";
      // Avoid duplicate option values, which would make the selector ambiguous.
      const existing = fest.data.settings.customTones ?? [];
      let name = baseName;
      let suffix = 2;
      while (existing.some((tone) => tone.name === name) || TONES.some((tone) => tone.name === name)) {
        name = `${baseName} (${suffix++})`;
      }
      onChange((data) => {
        const tones = data.settings.customTones ?? [];
        return {
          ...data,
          settings: {
            ...data.settings,
            customTones: [...tones, { name, data: dataUrl }],
            bellTone: name,
          },
        };
      }, "Imported a custom bell tone");
      notify("Sound tone imported");
    } catch {
      if (mountedRef.current) notify("That file could not be read. Please try another sound.");
    }
  };

  const resetView = () => {
    stop();
    setSecondsLeft(null);
    if (main) startTimer();
    else notify("Bell is ready");
  };

  const minutesLeft = secondsLeft === null ? 0 : Math.floor(secondsLeft / 60);
  const secsLeft = secondsLeft === null ? 0 : secondsLeft % 60;
  const bigLabel =
    secondsLeft !== null && secondsLeft > 0
      ? `${String(minutesLeft).padStart(2, "0")}:${String(secsLeft).padStart(2, "0")}`
      : ringing
      ? "Ringing now"
      : "Ready when you are";

  return (
    <MotionConfig reducedMotion="user">
      <PageHead
        eyebrow="TOOLS / SOUND CUE"
        title="Bell"
        description={
          main
            ? "Choose the cue, set the timing, and keep your event in rhythm."
            : "Ring the selected bell whenever your stage needs a cue."
        }
      />
      <div className="bell-layout">
        <div className="bell-stage">
          <motion.button
            type="button"
            className={`big-bell ${ringing ? "is-ringing" : ""}`}
            aria-label="Ring bell"
            onClick={() => ring()}
            whileTap={{ scale: 0.94 }}
            animate={ringing ? { rotate: [0, -6, 6, -4, 4, 0] } : { rotate: 0 }}
            transition={{ duration: 0.6, repeat: ringing ? Infinity : 0 }}
          >
            <Bell size={73} strokeWidth={1.3} />
          </motion.button>
          <span className="eyebrow">{settings.bellTone.toUpperCase()}</span>
          <AnimatePresence mode="wait" initial={false}>
            <motion.h2
              key={bigLabel}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
              {bigLabel}
            </motion.h2>
          </AnimatePresence>
          <div className="bell-actions">
            <button type="button" onClick={() => ring()}><Play size={16} /> Ring once</button>
            <button type="button" onClick={() => ring(true)}><RotateCcw size={16} /> Continuous</button>
            <button type="button" onClick={stop}><Square size={15} /> Stop</button>
            <button type="button" onClick={resetView}>
              <Clock3 size={16} /> {main ? "Timer" : "Reset"}
            </button>
          </div>
          {secondsLeft !== null && secondsLeft > 0 && (
            <motion.div
              className="bell-countdown"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              role="timer"
            >
              <Clock3 size={14} /> {secondsLeft}s remaining
            </motion.div>
          )}
        </div>

        {main && (
          <div className="bell-settings">
            <span className="eyebrow">BELL SETUP</span>
            <h3>Find your sound.</h3>
            <Field label="Selected sound effect">
              <select
                value={settings.bellTone}
                onChange={(event) => {
                  stop();
                  updateSettings({ bellTone: event.target.value });
                }}
              >
                {TONES.map((tone) => <option key={tone.name} value={tone.name}>{tone.name}</option>)}
                {(settings.customTones ?? []).map((tone) => (
                  <option key={tone.name} value={tone.name}>{tone.name}</option>
                ))}
              </select>
            </Field>
            <div className="tone-links">
              {TONES.map((tone) => (
                <a href={tone.page} key={tone.name} target="_blank" rel="noopener noreferrer">
                  {tone.name} ↗
                </a>
              ))}
            </div>
            <label className="upload-inline">
              <Upload size={16} /> Import sound tone
              <input
                type="file"
                accept="audio/*,.mp3,.wav,.ogg,.m4a"
                hidden
                onChange={(event) => {
                  const input = event.currentTarget;
                  void importTone(input.files?.[0]).finally(() => {
                    input.value = "";
                  });
                }}
              />
            </label>
            <p className="muted small-text">MP3, WAV or OGG, up to 3 MB. Imported tones are saved with this fest.</p>
            <div className="bell-setting-pair">
              <Field label="Time duration" hint="1–999">
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={999}
                  step={1}
                  value={settings.bellDuration}
                  onChange={(event) => updateSettings({ bellDuration: clampInt(event.target.value, 1, 999) })}
                />
              </Field>
              <Field label="Format">
                <select
                  value={settings.bellUnit}
                  onChange={(event) => updateSettings({ bellUnit: event.target.value as "minutes" | "seconds" })}
                >
                  <option value="seconds">Seconds</option>
                  <option value="minutes">Minutes</option>
                </select>
              </Field>
            </div>
            <div className="bell-setting-pair">
              <Field label="Warning at" hint="Seconds or minutes before the end">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={999}
                  step={1}
                  value={settings.bellWarning}
                  onChange={(event) => updateSettings({ bellWarning: clampInt(event.target.value, 0, 999) })}
                />
              </Field>
              <Field label="Format">
                <select
                  value={settings.bellWarningUnit}
                  onChange={(event) => updateSettings({ bellWarningUnit: event.target.value as "minutes" | "seconds" })}
                >
                  <option value="seconds">Seconds</option>
                  <option value="minutes">Minutes</option>
                </select>
              </Field>
            </div>
          </div>
        )}
      </div>
    </MotionConfig>
  );
}
