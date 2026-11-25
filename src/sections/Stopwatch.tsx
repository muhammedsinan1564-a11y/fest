import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { Flag, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { Button, Field, PageHead } from "../ui";
import type { SectionProps } from "./common";

interface Lap { split: number; total: number }
interface SavedWatch { accumulated: number; startedAt: number | null; laps: Lap[] }

const MAX_WATCH_MS = 24 * 60 * 60 * 1000;
const MAX_MINUTES = 999;
const MAX_SECONDS = 59;
const EMPTY_WATCH: SavedWatch = { accumulated: 0, startedAt: null, laps: [] };

/** mm:ss.cs, with hours when needed. Always finite and non-negative. */
function formatMs(value: number, ceilSeconds = false) {
  const safe = Number.isFinite(value) ? Math.max(0, value) : 0;
  const totalSeconds = ceilSeconds ? Math.ceil(safe / 1000) : Math.floor(safe / 1000);
  const cs = Math.floor((safe % 1000) / 10);
  const s = totalSeconds % 60;
  const m = Math.floor(totalSeconds / 60) % 60;
  const h = Math.floor(totalSeconds / 3600);
  const tail = ceilSeconds ? "" : `.${String(cs).padStart(2, "0")}`;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}${tail}`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}${tail}`;
}

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.min(value, MAX_WATCH_MS) : fallback;
}

/** Validates and normalises anything read from localStorage into a safe SavedWatch. */
function parseSavedWatch(raw: string | null): SavedWatch {
  if (!raw) return { ...EMPTY_WATCH, laps: [] };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { ...EMPTY_WATCH, laps: [] };
    const item = parsed as Partial<SavedWatch> & { laps?: unknown };
    const accumulated = finiteNumber(item.accumulated);
    const rawLaps: unknown[] = Array.isArray(item.laps) ? (item.laps as unknown[]) : [];
    const laps: Lap[] = [];
    let previousTotal = 0;
    for (const entry of rawLaps) {
      if (!entry || typeof entry !== "object") continue;
      const lap = entry as Partial<Lap>;
      const total = finiteNumber(lap.total);
      const split = finiteNumber(lap.split, Math.max(0, total - previousTotal));
      if (total <= 0) continue;
      laps.push({ split, total });
      previousTotal = total;
    }
    // A start timestamp in the future is corrupt data; treat the watch as paused.
    const startedAt =
      typeof item.startedAt === "number" && Number.isFinite(item.startedAt) && item.startedAt > 0 && item.startedAt <= Date.now() + 1000
        ? item.startedAt
        : null;
    return { accumulated, startedAt, laps };
  } catch {
    return { ...EMPTY_WATCH, laps: [] };
  }
}

function loadWatch(key: string): SavedWatch {
  try {
    return parseSavedWatch(localStorage.getItem(key));
  } catch {
    return { ...EMPTY_WATCH, laps: [] };
  }
}

function saveWatch(key: string, watch: SavedWatch): void {
  try {
    localStorage.setItem(key, JSON.stringify(watch));
  } catch {
    /* private mode, quota exceeded or storage disabled — timers still work in-memory */
  }
}

/* ------------------------------------------------------------------ */
/* Audio                                                               */
/* ------------------------------------------------------------------ */

/** One shared, lazily-created AudioContext; failures are swallowed silently. */
function getAudioContext(): AudioContext | null {
  try {
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    const holder = window as unknown as { __festizeAudio?: AudioContext };
    if (!holder.__festizeAudio || holder.__festizeAudio.state === "closed") {
      holder.__festizeAudio = new Ctor();
    }
    const ctx = holder.__festizeAudio;
    // Browsers suspend the context until a user gesture; resume() returns a promise that may reject.
    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => undefined);
    }
    return ctx;
  } catch {
    return null;
  }
}

function beep(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    [0, 0.18, 0.36].forEach((delay, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = index === 2 ? 1320 : 990;
      const at = now + delay;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.15, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.18);
    });
  } catch {
    /* autoplay policy or audio hardware unavailable */
  }
}

/** Strictly parses a non-negative whole number from a timer input. */
function parseTimerPart(raw: string, max: number): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value) || value < 0) return null;
  return Math.min(max, value);
}

function durationFromInputs(minutes: string, seconds: string): number | null {
  const m = parseTimerPart(minutes, MAX_MINUTES);
  const s = parseTimerPart(seconds, MAX_SECONDS);
  if (m === null || s === null) return null;
  return Math.min(MAX_WATCH_MS, (m * 60 + s) * 1000);
}

const PRESET_MINUTES = [1, 3, 5, 10];

export function StopwatchSection({ fest, user, notify }: SectionProps) {
  const [mode, setMode] = useState<"stopwatch" | "countdown">("stopwatch");
  const storageKey = `festize-stopwatch:${fest.id}:${user.id}`;

  // ---- Stopwatch (persisted, so it survives switching sections) ----
  const [saved, setSaved] = useState<SavedWatch>(() => loadWatch(storageKey));
  const [display, setDisplay] = useState(() => {
    const watch = loadWatch(storageKey);
    return watch.startedAt !== null ? watch.accumulated + Math.max(0, Date.now() - watch.startedAt) : watch.accumulated;
  });
  const running = saved.startedAt !== null;

  // Reload when switching to a different fest or user.
  useEffect(() => {
    const watch = loadWatch(storageKey);
    setSaved(watch);
    setDisplay(watch.startedAt !== null ? watch.accumulated + Math.max(0, Date.now() - watch.startedAt) : watch.accumulated);
  }, [storageKey]);

  useEffect(() => {
    saveWatch(storageKey, saved);
  }, [saved, storageKey]);

  useEffect(() => {
    if (saved.startedAt === null) {
      setDisplay(saved.accumulated);
      return;
    }
    const update = () => setDisplay(saved.accumulated + Math.max(0, Date.now() - saved.startedAt!));
    update();
    const timer = window.setInterval(update, 31);
    return () => window.clearInterval(timer);
  }, [saved.startedAt, saved.accumulated]);

  const toggleWatch = () => {
    if (saved.startedAt !== null) {
      const elapsed = saved.accumulated + Math.max(0, Date.now() - saved.startedAt);
      setSaved((prev) => ({ ...prev, accumulated: elapsed, startedAt: null }));
    } else {
      setSaved((prev) => ({ ...prev, startedAt: Date.now() }));
    }
  };

  const lap = () => {
    const total = saved.startedAt !== null ? saved.accumulated + Math.max(0, Date.now() - saved.startedAt) : saved.accumulated;
    if (total <= 0) return;
    setSaved((prev) => {
      const previousTotal = prev.laps[prev.laps.length - 1]?.total ?? 0;
      const split = Math.max(0, total - previousTotal);
      if (split <= 0) return prev;
      return { ...prev, laps: [...prev.laps, { split, total }] };
    });
  };

  const resetWatch = () => {
    setSaved({ accumulated: 0, startedAt: null, laps: [] });
    setDisplay(0);
  };

  // ---- Countdown ----
  const [cdMin, setCdMin] = useState("3");
  const [cdSec, setCdSec] = useState("0");
  const [cdTotal, setCdTotal] = useState(180000);
  const [cdLeft, setCdLeft] = useState(180000);
  const [cdEndAt, setCdEndAt] = useState<number | null>(null);
  const [cdDone, setCdDone] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const cdRunning = cdEndAt !== null;
  const finishedRef = useRef(false);

  useEffect(() => {
    if (cdEndAt === null) return;
    const update = () => {
      const left = Math.max(0, cdEndAt - Date.now());
      setCdLeft(left);
      if (left <= 0 && !finishedRef.current) {
        finishedRef.current = true;
        setCdEndAt(null);
        setCdDone(true);
        if (soundOn) beep();
        notify("Countdown finished — time is up.");
      }
    };
    finishedRef.current = false;
    update();
    const timer = window.setInterval(update, 100);
    return () => window.clearInterval(timer);
  }, [cdEndAt, notify, soundOn]);

  const applyDuration = (ms: number) => {
    const safe = Math.max(0, Math.min(MAX_WATCH_MS, Number.isFinite(ms) ? ms : 0));
    setCdTotal(safe);
    setCdLeft(safe);
    setCdEndAt(null);
    setCdDone(false);
    finishedRef.current = false;
  };

  const editDuration = (min: string, sec: string) => {
    setCdMin(min);
    setCdSec(sec);
    if (cdEndAt === null) {
      const duration = durationFromInputs(min, sec);
      // While typing an invalid value, keep the last valid duration on screen.
      if (duration !== null) applyDuration(duration);
    }
  };

  const toggleCountdown = () => {
    if (cdEndAt !== null) {
      setCdLeft(Math.max(0, cdEndAt - Date.now()));
      setCdEndAt(null);
      return;
    }
    const configured = durationFromInputs(cdMin, cdSec);
    if (configured === null) return notify("Enter whole, non-negative minutes (0–999) and seconds (0–59).");
    if (configured <= 0) return notify("Set a countdown of at least one second.");
    if (cdDone || cdLeft <= 0 || cdLeft >= cdTotal) applyDuration(configured);
    else setCdLeft(Math.min(configured, cdLeft));
    setCdTotal(configured);
    setCdDone(false);
    finishedRef.current = false;
    // Prime the AudioContext inside the user gesture so the bell can play at zero.
    if (soundOn) getAudioContext();
    setCdEndAt(Date.now() + (cdDone || cdLeft <= 0 || cdLeft >= cdTotal ? configured : Math.min(configured, cdLeft)));
  };

  const resetCountdown = () => {
    const configured = durationFromInputs(cdMin, cdSec);
    if (configured === null) return notify("Enter whole, non-negative minutes (0–999) and seconds (0–59).");
    applyDuration(configured);
  };

  const splits = saved.laps.map((item) => item.split);
  const bestSplit = splits.length > 1 ? Math.min(...splits) : null;
  const worstSplit = splits.length > 1 && bestSplit !== Math.max(...splits) ? Math.max(...splits) : null;
  const progress = cdTotal > 0 ? Math.max(0, Math.min(100, (cdLeft / cdTotal) * 100)) : 0;
  const cdInvalid = durationFromInputs(cdMin, cdSec) === null;

  return (
    <MotionConfig reducedMotion="user">
      <PageHead
        eyebrow="TOOLS / TIMING"
        title="Stopwatch"
        description={
          user.role === "JUDGE"
            ? "Time every performance to the split second. It keeps running while you score."
            : "Keep every stage on time. It keeps running while you check results."
        }
      />
      <div className="sub-tabs" role="tablist" aria-label="Timing tool">
        {(["stopwatch", "countdown"] as const).map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={mode === item}
            className={mode === item ? "active" : ""}
            onClick={() => setMode(item)}
          >
            {mode === item && (
              <motion.span layoutId="stopwatch-tab-pill" className="sub-tab-pill" transition={{ type: "spring", stiffness: 450, damping: 36 }} />
            )}
            <span>{item === "stopwatch" ? "Stopwatch" : "Countdown"}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {mode === "stopwatch" ? (
          <motion.div
            key="mode-stopwatch"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="stopwatch-view"
          >
            <div className="stopwatch-stage">
              <span className="eyebrow">{running ? "RUNNING" : display > 0 ? "PAUSED" : "READY"}</span>
              <motion.div className="stopwatch-readout" role="timer" aria-live="off">
                {formatMs(display)}
              </motion.div>
              <div className="stopwatch-controls">
                <Button onClick={toggleWatch} icon={running ? <Pause size={16} /> : <Play size={16} />}>
                  {running ? "Pause" : display > 0 ? "Resume" : "Start"}
                </Button>
                <Button variant="secondary" onClick={lap} disabled={!running} icon={<Flag size={15} />}>
                  Lap
                </Button>
                <Button variant="secondary" onClick={resetWatch} disabled={display <= 0 && !saved.laps.length} icon={<RotateCcw size={15} />}>
                  Reset
                </Button>
              </div>
              <p className="muted small-text">Your stopwatch keeps running while you check other sections on this device.</p>
            </div>

            <AnimatePresence initial={false}>
              {saved.laps.length > 0 && (
                <motion.div
                  className="summary-section"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                >
                  <div className="section-minihead">
                    <div>
                      <span className="eyebrow">SPLITS</span>
                      <h2>Laps</h2>
                    </div>
                    <span className="toolbar-count">{saved.laps.length} laps</span>
                  </div>
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>LAP</th>
                          <th>SPLIT</th>
                          <th>TOTAL</th>
                        </tr>
                      </thead>
                      <tbody>
                        <AnimatePresence initial={false}>
                          {[...saved.laps].reverse().map((item, index) => {
                            const number = saved.laps.length - index;
                            return (
                              <motion.tr key={`${number}-${item.total}`} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                                <td className="mono">
                                  {String(number).padStart(2, "0")}
                                  {item.split === bestSplit && <span className="lap-tag best"> · fastest</span>}
                                  {item.split === worstSplit && <span className="lap-tag worst"> · slowest</span>}
                                </td>
                                <td className="mono">{formatMs(item.split)}</td>
                                <td className="mono">{formatMs(item.total)}</td>
                              </motion.tr>
                            );
                          })}
                        </AnimatePresence>
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div
            key="mode-countdown"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="stopwatch-view"
          >
            <div className={`stopwatch-stage ${cdDone ? "is-done" : ""}`}>
              <span className="eyebrow">{cdDone ? "TIME UP" : cdRunning ? "COUNTING DOWN" : "SET A LIMIT"}</span>
              <div className={`stopwatch-readout ${cdDone ? "is-done" : ""}`} role="timer" aria-live="off">
                {formatMs(cdLeft, true)}
              </div>
              <div className="countdown-progress" aria-hidden="true">
                <motion.span animate={{ width: `${progress}%` }} transition={{ duration: 0.15 }} />
              </div>
              <div className="stopwatch-controls">
                <Button onClick={toggleCountdown} disabled={!cdRunning && cdLeft <= 0 && cdDone} icon={cdRunning ? <Pause size={16} /> : <Play size={16} />}>
                  {cdRunning ? "Pause" : cdLeft < cdTotal && cdLeft > 0 ? "Resume" : "Start"}
                </Button>
                <Button variant="secondary" onClick={resetCountdown} icon={<RotateCcw size={15} />}>
                  Reset
                </Button>
                <Button
                  variant={soundOn ? "secondary" : "ghost"}
                  onClick={() => {
                    setSoundOn((on) => !on);
                    if (!soundOn) getAudioContext();
                  }}
                  aria-pressed={soundOn}
                  icon={soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
                >
                  {soundOn ? "Bell on" : "Bell off"}
                </Button>
              </div>

              <div className="countdown-set">
                <Field label="Minutes" hint="0–999">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={MAX_MINUTES}
                    step={1}
                    value={cdMin}
                    aria-invalid={cdInvalid}
                    onChange={(event) => editDuration(event.target.value, cdSec)}
                    placeholder="3"
                  />
                </Field>
                <Field label="Seconds" hint="0–59">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={MAX_SECONDS}
                    step={1}
                    value={cdSec}
                    aria-invalid={cdInvalid}
                    onChange={(event) => editDuration(cdMin, event.target.value)}
                    placeholder="0"
                  />
                </Field>
                <div className="countdown-presets" role="group" aria-label="Quick durations">
                  {PRESET_MINUTES.map((minutes) => (
                    <button
                      key={minutes}
                      type="button"
                      className={cdTotal === minutes * 60000 ? "active" : ""}
                      onClick={() => {
                        setCdMin(String(minutes));
                        setCdSec("0");
                        applyDuration(minutes * 60000);
                      }}
                    >
                      {minutes} min
                    </button>
                  ))}
                </div>
              </div>
              {cdInvalid && (
                <p className="warn-text" role="alert">
                  Enter whole, non-negative minutes (0–999) and seconds (0–59). Decimals and symbols are ignored.
                </p>
              )}
              <p className="muted small-text">Editing the time resets the countdown. A bell rings when it reaches zero.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
