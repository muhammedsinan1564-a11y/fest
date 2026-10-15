import { useEffect, useState } from "react";
import { Flag, Pause, Play, RotateCcw } from "lucide-react";
import { Button, Field, PageHead } from "../ui";
import type { SectionProps } from "./common";

interface Lap { split: number; total: number }
interface SavedWatch { accumulated: number; startedAt: number | null; laps: Lap[] }

/** mm:ss.cs, with hours when needed. */
function formatMs(ms: number, ceilSeconds = false) {
  const safe = Math.max(0, ms);
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

function beep() {
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor();
    [0, 0.18, 0.36].forEach((delay, index) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.frequency.value = index === 2 ? 1320 : 990;
      const at = ctx.currentTime + delay;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.15, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at); osc.stop(at + 0.18);
    });
  } catch { /* audio unavailable */ }
}

export function StopwatchSection({ fest, user, notify }: SectionProps) {
  const [mode, setMode] = useState<"stopwatch" | "countdown">("stopwatch");
  const storageKey = `festize-stopwatch:${fest.id}:${user.id}`;

  // ---- Stopwatch (persisted, so it survives switching sections) ----
  const [saved, setSaved] = useState<SavedWatch>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(storageKey) || "null") as SavedWatch | null;
      if (raw && typeof raw.accumulated === "number") return { accumulated: raw.accumulated, startedAt: raw.startedAt ?? null, laps: raw.laps || [] };
    } catch { /* ignore */ }
    return { accumulated: 0, startedAt: null, laps: [] };
  });
  const [display, setDisplay] = useState(0);
  const running = saved.startedAt !== null;
  const elapsedNow = () => (saved.startedAt !== null ? saved.accumulated + (Date.now() - saved.startedAt) : saved.accumulated);

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(saved)); } catch { /* ignore */ }
  }, [saved, storageKey]);

  useEffect(() => {
    if (saved.startedAt === null) { setDisplay(saved.accumulated); return; }
    const startedAt = saved.startedAt;
    const update = () => setDisplay(saved.accumulated + (Date.now() - startedAt));
    update();
    const timer = setInterval(update, 31);
    return () => clearInterval(timer);
  }, [saved.startedAt, saved.accumulated]);

  const toggleWatch = () => {
    if (saved.startedAt !== null) setSaved(prev => ({ ...prev, accumulated: elapsedNow(), startedAt: null }));
    else setSaved(prev => ({ ...prev, startedAt: Date.now() }));
  };
  const lap = () => {
    const total = elapsedNow();
    if (total <= 0) return;
    setSaved(prev => ({ ...prev, laps: [...prev.laps, { split: total - (prev.laps[prev.laps.length - 1]?.total ?? 0), total }] }));
  };
  const resetWatch = () => { setSaved({ accumulated: 0, startedAt: null, laps: [] }); setDisplay(0); };

  // ---- Countdown ----
  const [cdMin, setCdMin] = useState("3"); const [cdSec, setCdSec] = useState("0");
  const [cdTotal, setCdTotal] = useState(180000);
  const [cdLeft, setCdLeft] = useState(180000);
  const [cdEndAt, setCdEndAt] = useState<number | null>(null);
  const [cdDone, setCdDone] = useState(false);
  const cdRunning = cdEndAt !== null;

  useEffect(() => {
    if (cdEndAt === null) return;
    const update = () => {
      const left = Math.max(0, cdEndAt - Date.now());
      setCdLeft(left);
      if (left <= 0) { setCdEndAt(null); setCdDone(true); beep(); notify("Countdown finished — time is up."); }
    };
    update();
    const timer = setInterval(update, 100);
    return () => clearInterval(timer);
  }, [cdEndAt, notify]);

  const applyDuration = (ms: number) => { setCdTotal(ms); setCdLeft(ms); setCdEndAt(null); setCdDone(false); };
  const editDuration = (min: string, sec: string) => {
    setCdMin(min); setCdSec(sec);
    if (cdEndAt === null) applyDuration((parseInt(min) || 0) * 60000 + (parseInt(sec) || 0) * 1000);
  };
  const toggleCountdown = () => {
    if (cdEndAt !== null) { setCdLeft(Math.max(0, cdEndAt - Date.now())); setCdEndAt(null); }
    else if (cdLeft > 0) { setCdDone(false); setCdEndAt(Date.now() + cdLeft); }
  };

  const splits = saved.laps.map(item => item.split);
  const bestSplit = splits.length > 1 ? Math.min(...splits) : null;
  const worstSplit = splits.length > 1 ? Math.max(...splits) : null;

  return <>
    <PageHead eyebrow="TOOLS / TIMING" title="Stopwatch" description={user.role === "JUDGE" ? "Time every performance to the split second. It keeps running while you score." : "Keep every stage on time. It keeps running while you check results."} />
    <div className="sub-tabs">
      <button className={mode === "stopwatch" ? "active" : ""} onClick={() => setMode("stopwatch")}>Stopwatch</button>
      <button className={mode === "countdown" ? "active" : ""} onClick={() => setMode("countdown")}>Countdown</button>
    </div>

    {mode === "stopwatch" ? <>
      <div className="stopwatch-stage">
        <span className="eyebrow">{running ? "RUNNING" : display > 0 ? "PAUSED" : "READY"}</span>
        <div className="stopwatch-readout" role="timer">{formatMs(display)}</div>
        <div className="stopwatch-controls">
          <Button onClick={toggleWatch}>{running ? <Pause size={16} /> : <Play size={16} />}{running ? "Pause" : display > 0 ? "Resume" : "Start"}</Button>
          <Button variant="secondary" onClick={lap} disabled={display <= 0}><Flag size={15} /> Lap</Button>
          <Button variant="secondary" onClick={resetWatch} disabled={display <= 0 && !saved.laps.length}><RotateCcw size={15} /> Reset</Button>
        </div>
        <p className="muted small-text">Your stopwatch keeps running while you check other sections on this device.</p>
      </div>
      {saved.laps.length > 0 && <div className="summary-section"><div className="section-minihead"><span className="eyebrow">SPLITS</span><h2>Laps</h2></div><div className="table-wrap"><table className="data-table"><thead><tr><th>LAP</th><th>SPLIT</th><th>TOTAL</th></tr></thead><tbody>{[...saved.laps].reverse().map((item, index) => { const number = saved.laps.length - index; return <tr key={number}><td>{String(number).padStart(2, "0")}{item.split === bestSplit ? " · fastest" : item.split === worstSplit ? " · slowest" : ""}</td><td>{formatMs(item.split)}</td><td>{formatMs(item.total)}</td></tr>; })}</tbody></table></div></div>}
    </> : <>
      <div className="stopwatch-stage">
        <span className="eyebrow">{cdDone ? "TIME UP" : cdRunning ? "COUNTING DOWN" : "SET A LIMIT"}</span>
        <div className={`stopwatch-readout ${cdDone ? "is-done" : ""}`} role="timer">{formatMs(cdLeft, true)}</div>
        <div className="countdown-progress" aria-hidden="true"><span style={{ width: `${cdTotal > 0 ? Math.max(0, Math.min(100, (cdLeft / cdTotal) * 100)) : 0}%` }} /></div>
        <div className="stopwatch-controls">
          <Button onClick={toggleCountdown} disabled={!cdRunning && cdLeft <= 0}>{cdRunning ? <Pause size={16} /> : <Play size={16} />}{cdRunning ? "Pause" : cdLeft < cdTotal && cdLeft > 0 ? "Resume" : "Start"}</Button>
          <Button variant="secondary" onClick={() => applyDuration((parseInt(cdMin) || 0) * 60000 + (parseInt(cdSec) || 0) * 1000)}><RotateCcw size={15} /> Reset</Button>
        </div>
        <div className="countdown-set">
          <Field label="Minutes"><input type="number" min="0" max="999" value={cdMin} onChange={event => editDuration(event.target.value, cdSec)} /></Field>
          <Field label="Seconds"><input type="number" min="0" max="59" value={cdSec} onChange={event => editDuration(cdMin, event.target.value)} /></Field>
          <div className="countdown-presets">{[1, 3, 5, 10].map(minutes => <button key={minutes} type="button" onClick={() => { setCdMin(String(minutes)); setCdSec("0"); applyDuration(minutes * 60000); }}>{minutes} min</button>)}</div>
        </div>
        <p className="muted small-text">Editing the time resets the countdown. A bell rings when it reaches zero.</p>
      </div>
    </>}
  </>;
}
