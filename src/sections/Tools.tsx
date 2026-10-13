import { useEffect, useRef, useState } from "react";
import { ArrowRight, Bell, Check, Clock3, Play, Plus, RotateCcw, Square, Upload } from "lucide-react";
import { Button, Empty, Field, PageHead } from "../ui";
import { getCategoryName, getMemberName, id, type ScheduleCell, type ScheduleSlot } from "../types";
import { canManage, readImage, type SectionProps } from "./common";

export function ScheduleSection({ fest, user, onChange, notify }: SectionProps) {
  const data = fest.data; const canEdit = canManage(user);
  const [slots, setSlots] = useState<ScheduleSlot[]>(data.slots);
  const [cells, setCells] = useState<ScheduleCell[]>(data.schedule);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10)); const [start, setStart] = useState("09:00"); const [end, setEnd] = useState("10:00");
  useEffect(() => { setSlots(data.slots); setCells(data.schedule); }, [data.slots, data.schedule]);
  const addSlot = () => {
    if (!date || !start || !end || start >= end) return notify("Choose a valid date, starting time and ending time.");
    if (slots.some(slot => slot.date === date && slot.start === start && slot.end === end)) return notify("That time slot already exists.");
    setSlots([...slots, { id: id(), date, start, end }].sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`)));
    notify("Time slot added. Save the timetable when you are ready.");
  };
  const overlaps = (first?: ScheduleSlot, second?: ScheduleSlot) => Boolean(first && second && first.date === second.date && first.start < second.end && second.start < first.end);
  const setCell = (stageId: string, slotId: string, programId: string) => {
    const other = cells.filter(cell => !(cell.stageId === stageId && cell.slotId === slotId));
    if (!programId) { setCells(other); return; }
    if (other.some(cell => cell.programId === programId)) return notify("That program is already placed in another slot.");
    const slot = slots.find(item => item.id === slotId);
    const members = new Set(data.programs.find(program => program.id === programId)?.entries.flatMap(entry => entry.memberIds) || []);
    for (const cell of other) {
      if (!overlaps(slot, slots.find(item => item.id === cell.slotId))) continue;
      const clash = data.programs.find(program => program.id === cell.programId)?.entries.flatMap(entry => entry.memberIds).find(memberId => members.has(memberId));
      if (clash) return notify(`${getMemberName(data, clash)} is already performing at this time.`);
    }
    setCells([...other, { id: id(), stageId, slotId, programId }]);
  };
  const placedElsewhere = (stageId: string, slotId: string, programId: string) => cells.some(cell => cell.programId === programId && !(cell.stageId === stageId && cell.slotId === slotId));
  const save = () => {
    if (cells.some(cell => cells.filter(item => item.programId === cell.programId).length > 1)) return notify("A program can only occupy one schedule slot.");
    for (let a = 0; a < cells.length; a++) for (let b = a + 1; b < cells.length; b++) {
      const left = slots.find(slot => slot.id === cells[a].slotId); const right = slots.find(slot => slot.id === cells[b].slotId);
      if (!overlaps(left, right)) continue;
      if (cells[a].stageId === cells[b].stageId) return notify("A stage cannot host two overlapping programs.");
      const first = data.programs.find(program => program.id === cells[a].programId); const second = data.programs.find(program => program.id === cells[b].programId);
      const firstMembers = new Set(first?.entries.flatMap(entry => entry.memberIds) || []);
      const shared = second?.entries.flatMap(entry => entry.memberIds).find(memberId => firstMembers.has(memberId));
      if (shared) return notify(`${getMemberName(data, shared)} is entered in two programs at the same time.`);
    }
    onChange(next => ({ ...next, slots, schedule: cells }), "Updated the fest schedule"); notify("Schedule saved");
  };
  const removeSlot = (slotId: string) => { if (!window.confirm("Remove this time slot and its scheduled programs?")) return; setSlots(slots.filter(slot => slot.id !== slotId)); setCells(cells.filter(cell => cell.slotId !== slotId)); };
  return <><PageHead eyebrow="LIVE / TIMETABLE" title="Schedule" description="One clear view of where and when every program happens." action={canEdit ? <Button onClick={save}><Check size={17} /> Save schedule</Button> : undefined} />{canEdit && <div className="schedule-builder"><div className="schedule-field"><span>Date</span><input aria-label="Schedule date" type="date" value={date} onChange={event => setDate(event.target.value)} /></div><div className="schedule-field"><span>Starting time</span><input aria-label="Starting time" type="time" value={start} onChange={event => setStart(event.target.value)} /></div><div className="schedule-field"><span>Ending time</span><input aria-label="Ending time" type="time" value={end} onChange={event => setEnd(event.target.value)} /></div><Button variant="secondary" onClick={addSlot}><Plus size={16} /> Add time</Button></div>}{data.stages.length && slots.length ? <div className="timetable-scroll"><table className="timetable"><thead><tr><th className="stage-heading">STAGE / TIME</th>{slots.map(slot => <th key={slot.id}><span>{new Date(`${slot.date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span><strong>{slot.start} – {slot.end}</strong>{canEdit && <button aria-label={`Remove ${slot.start} time slot`} onClick={() => removeSlot(slot.id)}>×</button>}</th>)}</tr></thead><tbody>{data.stages.map(stage => <tr key={stage.id}><th className="stage-name">{stage.name}<small>{stage.details}</small></th>{slots.map(slot => { const cell = cells.find(item => item.stageId === stage.id && item.slotId === slot.id); const program = data.programs.find(item => item.id === cell?.programId); return <td key={slot.id}>{canEdit ? <select aria-label={`${stage.name} at ${slot.start}`} value={cell?.programId || ""} onChange={event => setCell(stage.id, slot.id, event.target.value)}><option value="">Select program</option>{data.programs.filter(item => !placedElsewhere(stage.id, slot.id, item.id)).map(item => <option key={item.id} value={item.id}>{item.name} · {getCategoryName(data, item.categoryId)}</option>)}</select> : program ? <div className="scheduled-program"><strong>{program.name}</strong><span>{getCategoryName(data, program.categoryId)}</span></div> : <span className="empty-cell">—</span>}</td>; })}</tr>)}</tbody></table></div> : <Empty title="Your timetable is waiting" description="Add a stage and at least one time slot to start arranging programs." />}</>;
}

export function RandomSection({ letter = false }: { letter?: boolean }) {
  const [input, setInput] = useState(""); const [result, setResult] = useState<string | null>(null); const [used, setUsed] = useState<string[]>([]);
  const draw = () => {
    if (letter) {
      const target = input.trim().toUpperCase();
      if (!/^[A-Z]$/.test(target)) return setResult("Enter a letter from A to Z");
      const alphabet = Array.from({ length: target.charCodeAt(0) - 64 }, (_, index) => String.fromCharCode(65 + index));
      const available = alphabet.filter(value => !used.includes(value));
      if (!available.length) return setResult("All letters drawn. Reset to start again.");
      const choice = available[Math.floor(Math.random() * available.length)]; setUsed([...used, choice]); setResult(choice);
    } else {
      const max = Number(input);
      if (!Number.isInteger(max) || max < 1 || max > 100) return setResult("Enter a number from 1 to 100");
      setResult(String(Math.floor(Math.random() * max) + 1));
    }
  };
  return <><PageHead eyebrow="TOOLS / FAIR DRAW" title={letter ? "Random Letter" : "Random Picker"} description={letter ? "Draw a letter from A up to your chosen letter. No repeats until every letter has had a turn." : "Leave the choice to chance. Pick a number between 1 and your limit, up to 100."} /><div className="random-layout"><div className="random-input"><Field label={letter ? "Last letter in the draw" : "Maximum number (1–100)"}><input autoFocus value={input} maxLength={letter ? 1 : 3} type={letter ? "text" : "number"} min={letter ? undefined : 1} max={letter ? undefined : 100} onChange={event => { setInput(letter ? event.target.value.toUpperCase() : event.target.value); if (letter) { setUsed([]); setResult(null); } }} onKeyDown={event => { if (event.key === "Enter") draw(); }} placeholder={letter ? "e.g. M" : "e.g. 50"} /></Field><div className="button-row"><Button onClick={draw}>Draw {letter ? "letter" : "number"} <ArrowRight size={17} /></Button>{letter && <Button variant="secondary" onClick={() => { setUsed([]); setResult(null); }}><RotateCcw size={16} /> Reset</Button>}</div>{letter && <p className="muted small-text">{used.length} letter{used.length === 1 ? "" : "s"} drawn this round</p>}</div><div className="random-output" aria-live="polite"><span>THE DRAW</span><strong key={result || "blank"}>{result && result.length <= 3 ? result : "?"}</strong>{result && result.length > 3 && <p>{result}</p>}<small>{letter ? "ONE LETTER. NO REPEATS." : "ONE MOMENT OF CHANCE."}</small></div></div></>;
}

const TONES = [
  { name: "School bell", url: "https://www.myinstants.com/media/sounds/school-bell-1-0.mp3", page: "https://www.myinstants.com/en/instant/school-bell-1-0-67529/" },
  { name: "BELL11", url: "https://www.myinstants.com/media/sounds/bell11.mp3", page: "https://www.myinstants.com/en/instant/bell11-78376/" },
  { name: "Hector bell", url: "https://www.myinstants.com/media/sounds/hector-bell.mp3", page: "https://www.myinstants.com/en/instant/hector-bell-43024/" },
  { name: "Service bell", url: "https://www.myinstants.com/media/sounds/service-bell-2.mp3", page: "https://www.myinstants.com/en/instant/service-bell-2/" },
  { name: "Boxing bell", url: "https://www.myinstants.com/media/sounds/boxing-bell.mp3", page: "https://www.myinstants.com/en/instant/boxing-bell/" },
];

export function BellSection({ fest, user, onChange, notify }: SectionProps) {
  const settings = fest.data.settings; const main = canManage(user);
  const audioRef = useRef<HTMLAudioElement | null>(null); const repeatRef = useRef<ReturnType<typeof setInterval> | null>(null); const timerRef = useRef<ReturnType<typeof setInterval> | null>(null); const contextRef = useRef<AudioContext | null>(null);
  const [ringing, setRinging] = useState(false); const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const selected = TONES.find(tone => tone.name === settings.bellTone);
  const custom = settings.customTones.find(tone => tone.name === settings.bellTone);
  const stop = () => { audioRef.current?.pause(); if (audioRef.current) audioRef.current.currentTime = 0; if (repeatRef.current) clearInterval(repeatRef.current); if (timerRef.current) clearInterval(timerRef.current); repeatRef.current = null; timerRef.current = null; setRinging(false); };
  useEffect(() => () => { audioRef.current?.pause(); if (repeatRef.current) clearInterval(repeatRef.current); if (timerRef.current) clearInterval(timerRef.current); }, []);
  const syntheticRing = () => {
    try {
      const context = contextRef.current || new AudioContext(); contextRef.current = context;
      const index = Math.max(0, TONES.findIndex(tone => tone.name === settings.bellTone));
      [0, .09, .18].forEach((delay, note) => {
        const oscillator = context.createOscillator(); const gain = context.createGain();
        oscillator.type = index % 2 ? "triangle" : "sine";
        oscillator.frequency.setValueAtTime((620 + index * 90) * (note === 1 ? 1.48 : 1), context.currentTime + delay);
        gain.gain.setValueAtTime(.0001, context.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(.13, context.currentTime + delay + .02);
        gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + delay + .65);
        oscillator.connect(gain).connect(context.destination); oscillator.start(context.currentTime + delay); oscillator.stop(context.currentTime + delay + .7);
      });
    } catch { notify("Audio is unavailable on this device."); }
  };
  const ring = (loop = false) => {
    stop(); setRinging(loop);
    const source = custom?.data || selected?.url;
    if (!source) { syntheticRing(); if (loop) repeatRef.current = setInterval(syntheticRing, 420); return; }
    const audio = new Audio(source); audio.loop = loop; audioRef.current = audio;
    audio.onerror = () => { if (!loop) syntheticRing(); else if (!repeatRef.current) repeatRef.current = setInterval(syntheticRing, 420); };
    void audio.play().catch(() => { syntheticRing(); if (loop && !repeatRef.current) repeatRef.current = setInterval(syntheticRing, 420); });
  };
  const startTimer = () => {
    stop(); const amount = Math.max(1, settings.bellDuration * (settings.bellUnit === "minutes" ? 60 : 1)); setSecondsLeft(amount);
    const deadline = Date.now() + amount * 1000;
    const warningAt = settings.bellWarning * (settings.bellWarningUnit === "minutes" ? 60 : 1);
    let warned = false;
    timerRef.current = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000)); setSecondsLeft(left);
      if (left > 0 && left <= warningAt && !warned) {
        warned = true;
        const source = custom?.data || selected?.url;
        if (source) void new Audio(source).play().catch(syntheticRing); else syntheticRing();
        notify("Bell warning cue");
      }
      if (!left) { ring(); notify("Bell timer complete"); }
    }, 250);
    notify("Bell timer started");
  };
  const updateSettings = (patch: Partial<typeof settings>) => onChange(data => ({ ...data, settings: { ...data.settings, ...patch } }));
  const importTone = async (file?: File) => {
    if (!file) return; if (!file.type.startsWith("audio/")) return notify("Choose an audio file.");
    const dataUrl = await readImage(file); const name = file.name.replace(/\.[^.]+$/, "");
    updateSettings({ customTones: [...settings.customTones, { name, data: dataUrl }], bellTone: name }); notify("Sound tone imported");
  };
  return <><PageHead eyebrow="TOOLS / SOUND CUE" title="Bell" description={main ? "Choose the cue, set the timing, and keep your event in rhythm." : "Ring the selected bell whenever your stage needs a cue."} /><div className="bell-layout"><div className="bell-stage"><button className={`big-bell ${ringing ? "is-ringing" : ""}`} aria-label="Ring bell" onClick={() => ring()}><Bell size={73} strokeWidth={1.3} /></button><span className="eyebrow">{settings.bellTone.toUpperCase()}</span><h2>{secondsLeft !== null && secondsLeft > 0 ? `${Math.floor(secondsLeft / 60).toString().padStart(2, "0")}:${(secondsLeft % 60).toString().padStart(2, "0")}` : ringing ? "Ringing now" : "Ready when you are"}</h2><div className="bell-actions"><button onClick={() => ring()}><Play size={16} /> Ring once</button><button onClick={() => ring(true)}><RotateCcw size={16} /> Continuous</button><button onClick={stop}><Square size={15} /> Stop</button><button onClick={() => { stop(); setSecondsLeft(null); if (main) startTimer(); else notify("Bell is ready"); }}><Clock3 size={16} /> {main ? "Timer" : "Reset"}</button></div></div>{main && <div className="bell-settings"><span className="eyebrow">BELL SETUP</span><h3>Find your sound.</h3><Field label="Selected sound effect"><select value={settings.bellTone} onChange={event => { stop(); updateSettings({ bellTone: event.target.value }); }}>{TONES.map(tone => <option key={tone.name}>{tone.name}</option>)}{settings.customTones.map(tone => <option key={tone.name}>{tone.name}</option>)}</select></Field><div className="tone-links">{TONES.map(tone => <a href={tone.page} key={tone.name} target="_blank" rel="noreferrer">{tone.name} ↗</a>)}</div><label className="upload-inline"><Upload size={16} /> Import sound tone<input type="file" accept="audio/*" hidden onChange={event => void importTone(event.target.files?.[0])} /></label><div className="bell-setting-pair"><Field label="Time duration"><input type="number" min="1" value={settings.bellDuration} onChange={event => updateSettings({ bellDuration: Math.max(1, Number(event.target.value)) })} /></Field><Field label="Format"><select value={settings.bellUnit} onChange={event => updateSettings({ bellUnit: event.target.value as "minutes" | "seconds" })}><option value="seconds">Seconds</option><option value="minutes">Minutes</option></select></Field></div><div className="bell-setting-pair"><Field label="Warning at"><input type="number" min="0" value={settings.bellWarning} onChange={event => updateSettings({ bellWarning: Math.max(0, Number(event.target.value)) })} /></Field><Field label="Format"><select value={settings.bellWarningUnit} onChange={event => updateSettings({ bellWarningUnit: event.target.value as "minutes" | "seconds" })}><option value="seconds">Seconds</option><option value="minutes">Minutes</option></select></Field></div></div>}</div></>;
}