import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useStore, log, uid } from "../lib/store";
import { Icon, Btn, PageHead, Tag } from "../lib/ui";
import type { Route } from "./Shell";

type P = { push: (r: Route) => void; params?: Record<string, string>; back?: () => void };

// AudioContext singleton
let audioCtx: AudioContext | null = null;
function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  return audioCtx;
}

interface RingEvent {
  id: string;
  type: string;
  count: number;
  time: string;
}

export interface CustomTone {
  id: string;
  name: string;
  dataUrl: string;
  duration?: number;
  fileName?: string;
}

export interface TonePreset {
  id: string;
  name: string;
  category: "Classic" | "Concert" | "Stage" | "Temple" | "Electronic" | "Custom";
  freq: number;
  timbre: "brass" | "metallic" | "temple" | "electric" | "chime" | "warm" | "silver" | "crystal" | "tubular" | "gong" | "strike";
  decay: number;
  desc: string;
}

// 14 rich built-in sound tone presets
export const BUILTIN_TONES: TonePreset[] = [
  { id: "concert-880", name: "Concert Bell (880 Hz · A5)", category: "Concert", freq: 880, timbre: "brass", decay: 3.2, desc: "Standard acoustic concert hall stage bell" },
  { id: "high-1046", name: "High Chime (1046 Hz · C6)", category: "Concert", freq: 1046, timbre: "chime", decay: 2.8, desc: "Bright crystal chime, pierces through noise" },
  { id: "brass-740", name: "Brass Stage (740 Hz · F#5)", category: "Stage", freq: 740, timbre: "brass", decay: 3.4, desc: "Classic youth fest & debate stage bell" },
  { id: "gong-587", name: "Deep Gong (587 Hz · D5)", category: "Temple", freq: 587, timbre: "gong", decay: 4.2, desc: "Resonant, authoritative deep bronze gong" },
  { id: "low-440", name: "Grand Bell (440 Hz · A4)", category: "Classic", freq: 440, timbre: "brass", decay: 4.5, desc: "Deep orchestral bell with rich warm bass" },
  { id: "silver-1175", name: "Silver Bell (1175 Hz · D6)", category: "Stage", freq: 1175, timbre: "silver", decay: 2.6, desc: "Clean, delicate silver hand-bell ring" },
  { id: "tubular-659", name: "Tubular Bell (659 Hz · E5)", category: "Concert", freq: 659, timbre: "tubular", decay: 3.8, desc: "Orchestral chime tube with rich harmonics" },
  { id: "crystal-1318", name: "Crystal Ting (1318 Hz · E6)", category: "Stage", freq: 1318, timbre: "crystal", decay: 2.2, desc: "Sharp, ultra-high attention-grabbing ting" },
  { id: "temple-523", name: "Temple Bronze (523 Hz · C5)", category: "Temple", freq: 523, timbre: "temple", decay: 5.0, desc: "Traditional Kerala temple brass bell resonance" },
  { id: "warm-784", name: "Warm Amber (784 Hz · G5)", category: "Classic", freq: 784, timbre: "warm", decay: 3.5, desc: "Mellow golden chime for gentle warning" },
  { id: "electric-800", name: "Electric School (800 Hz)", category: "Electronic", freq: 800, timbre: "electric", decay: 0.6, desc: "Sharp industrial/academic buzzer bell" },
  { id: "kalolsavam-830", name: "Kalolsavam Desk (830 Hz)", category: "Stage", freq: 830, timbre: "brass", decay: 3.0, desc: "Authentic Kerala state Kalolsavam judge bell" },
  { id: "strike-988", name: "Double Strike Bell (988 Hz · B5)", category: "Stage", freq: 988, timbre: "strike", decay: 2.5, desc: "Crisp attack with dual micro-intervals" },
  { id: "zen-392", name: "Zen Singing Bowl (392 Hz · G4)", category: "Temple", freq: 392, timbre: "temple", decay: 5.8, desc: "Sub-bass harmonic singing bowl with 6s sustain" },
];

const CUSTOM_TONES_KEY = "festize.bell.customTones.v1";

export function BellSection(_: P) {
  const { fest, session, data, updateFest } = useStore();
  const isMain = session?.role === "MAIN";

  // Visual state
  const [isRinging, setIsRinging] = useState(false);
  const [continuousActive, setContinuousActive] = useState(false);
  const [ringCount, setRingCount] = useState(0);
  const [lastRung, setLastRung] = useState<string | null>(null);
  const [history, setHistory] = useState<RingEvent[]>([]);

  // Selected tone (synced from fest data if available)
  const [selectedToneId, setSelectedToneId] = useState<string>(data?.bellToneId || "concert-880");
  const [customTones, setCustomTones] = useState<CustomTone[]>(() => {
    try {
      const stored = localStorage.getItem(CUSTOM_TONES_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Sound configuration & Main user specific controls
  const [repeatSpeed, setRepeatSpeed] = useState<number>(140); // ms strike interval in continuous
  const [bellDecay, setBellDecay] = useState<number>(3.0); // seconds sustain
  const [volume, setVolume] = useState<number>(90); // 0-100%
  const [timbre, setTimbre] = useState<string>("brass");
  const [pitch, setPitch] = useState<number>(880);

  // Main user countdown timer (large text inputs + smaller unit selectors)
  const [timerVal, setTimerVal] = useState<string>("5");
  const [timerUnit, setTimerUnit] = useState<"minutes" | "seconds">("minutes");
  const [warningVal, setWarningVal] = useState<string>("30");
  const [warningUnit, setWarningUnit] = useState<"minutes" | "seconds">("seconds");
  const [autoTimerLeft, setAutoTimerLeft] = useState<number | null>(null);
  const [autoTimerActive, setAutoTimerActive] = useState(false);

  // Main user tone import modal
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importToneName, setImportToneName] = useState("");
  const [pendingAudioData, setPendingAudioData] = useState<{ name: string; dataUrl: string; size: string } | null>(null);

  const ringTimeoutRef = useRef<number | null>(null);
  const continuousIntervalRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const audioBufferCacheRef = useRef<Map<string, AudioBuffer>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync selected tone from fest store
  useEffect(() => {
    if (data?.bellToneId && data.bellToneId !== selectedToneId) {
      setSelectedToneId(data.bellToneId);
    }
  }, [data?.bellToneId]);

  // Persist custom tones to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(CUSTOM_TONES_KEY, JSON.stringify(customTones));
    } catch {
      // storage quota
    }
  }, [customTones]);

  // Decode audio dataUrl to AudioBuffer for instant playback
  const loadAudioBuffer = useCallback(async (dataUrl: string): Promise<AudioBuffer | null> => {
    if (audioBufferCacheRef.current.has(dataUrl)) {
      return audioBufferCacheRef.current.get(dataUrl)!;
    }
    try {
      const ctx = getAudioContext();
      const res = await fetch(dataUrl);
      const arrayBuffer = await res.arrayBuffer();
      const decoded = await ctx.decodeAudioData(arrayBuffer);
      audioBufferCacheRef.current.set(dataUrl, decoded);
      return decoded;
    } catch {
      return null;
    }
  }, []);

  // Update sound synthesis params when preset changes
  useEffect(() => {
    const builtin = BUILTIN_TONES.find((t) => t.id === selectedToneId);
    if (builtin) {
      setPitch(builtin.freq);
      setBellDecay(builtin.decay);
      setTimbre(builtin.timbre);
    }
  }, [selectedToneId]);

  // Play synthesized acoustic bell
  const playSynthesizedChime = useCallback((freq: number, duration: number, customVol: number, customTimbre: string) => {
    try {
      const ctx = getAudioContext();
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const now = ctx.currentTime;
      const masterGain = ctx.createGain();
      const volMultiplier = Math.max(0.05, Math.min(1.0, customVol / 100));
      masterGain.gain.setValueAtTime(0.85 * volMultiplier, now);
      masterGain.connect(ctx.destination);

      let partials: { mult: number; gain: number; decay: number; type: OscillatorType }[] = [];

      switch (customTimbre) {
        case "chime":
          partials = [
            { mult: 1.0, gain: 0.9, decay: duration * 0.9, type: "sine" },
            { mult: 2.01, gain: 0.7, decay: duration * 0.7, type: "sine" },
            { mult: 3.0, gain: 0.45, decay: duration * 0.5, type: "triangle" },
            { mult: 4.12, gain: 0.3, decay: duration * 0.35, type: "sine" },
            { mult: 5.2, gain: 0.15, decay: duration * 0.25, type: "sine" },
          ];
          break;
        case "metallic":
          partials = [
            { mult: 1.0, gain: 0.9, decay: duration * 0.6, type: "triangle" },
            { mult: 1.5, gain: 0.6, decay: duration * 0.5, type: "square" },
            { mult: 2.0, gain: 0.7, decay: duration * 0.4, type: "triangle" },
            { mult: 3.14, gain: 0.5, decay: duration * 0.35, type: "triangle" },
            { mult: 4.5, gain: 0.4, decay: duration * 0.25, type: "sine" },
            { mult: 6.2, gain: 0.2, decay: duration * 0.2, type: "sine" },
          ];
          break;
        case "temple":
        case "gong":
          partials = [
            { mult: 0.5, gain: 0.65, decay: duration * 1.8, type: "sine" },
            { mult: 1.0, gain: 1.0, decay: duration * 1.5, type: "sine" },
            { mult: 1.25, gain: 0.45, decay: duration * 1.2, type: "sine" },
            { mult: 2.0, gain: 0.5, decay: duration, type: "sine" },
            { mult: 2.76, gain: 0.35, decay: duration * 0.8, type: "triangle" },
            { mult: 3.8, gain: 0.2, decay: duration * 0.6, type: "sine" },
          ];
          break;
        case "silver":
          partials = [
            { mult: 1.0, gain: 0.85, decay: duration * 0.8, type: "sine" },
            { mult: 2.0, gain: 0.7, decay: duration * 0.6, type: "sine" },
            { mult: 3.02, gain: 0.5, decay: duration * 0.5, type: "sine" },
            { mult: 4.05, gain: 0.35, decay: duration * 0.4, type: "triangle" },
            { mult: 6.0, gain: 0.2, decay: duration * 0.25, type: "sine" },
          ];
          break;
        case "crystal":
          partials = [
            { mult: 1.0, gain: 0.95, decay: duration * 0.7, type: "sine" },
            { mult: 2.75, gain: 0.6, decay: duration * 0.5, type: "triangle" },
            { mult: 4.25, gain: 0.4, decay: duration * 0.35, type: "sine" },
            { mult: 5.4, gain: 0.25, decay: duration * 0.2, type: "sine" },
          ];
          break;
        case "tubular":
          partials = [
            { mult: 0.98, gain: 0.5, decay: duration * 1.2, type: "sine" },
            { mult: 1.0, gain: 0.9, decay: duration, type: "sine" },
            { mult: 2.0, gain: 0.75, decay: duration * 0.8, type: "sine" },
            { mult: 2.76, gain: 0.55, decay: duration * 0.65, type: "triangle" },
            { mult: 3.9, gain: 0.4, decay: duration * 0.5, type: "triangle" },
            { mult: 5.15, gain: 0.25, decay: duration * 0.35, type: "sine" },
          ];
          break;
        case "warm":
          partials = [
            { mult: 0.5, gain: 0.5, decay: duration * 1.2, type: "sine" },
            { mult: 1.0, gain: 0.9, decay: duration, type: "sine" },
            { mult: 1.5, gain: 0.35, decay: duration * 0.7, type: "sine" },
            { mult: 2.0, gain: 0.5, decay: duration * 0.6, type: "sine" },
          ];
          break;
        case "electric":
          partials = [
            { mult: 1.0, gain: 0.95, decay: 0.25, type: "sawtooth" },
            { mult: 2.02, gain: 0.75, decay: 0.22, type: "sawtooth" },
            { mult: 3.01, gain: 0.55, decay: 0.18, type: "triangle" },
            { mult: 4.05, gain: 0.4, decay: 0.15, type: "square" },
          ];
          break;
        case "strike":
          partials = [
            { mult: 0.99, gain: 0.7, decay: duration * 0.9, type: "triangle" },
            { mult: 1.01, gain: 0.8, decay: duration * 0.85, type: "sine" },
            { mult: 2.0, gain: 0.7, decay: duration * 0.6, type: "triangle" },
            { mult: 2.98, gain: 0.4, decay: duration * 0.4, type: "sine" },
          ];
          break;
        default:
          // Standard Classical Brass
          partials = [
            { mult: 0.5, gain: 0.35, decay: duration * 1.1, type: "sine" },
            { mult: 1.0, gain: 0.85, decay: duration, type: "sine" },
            { mult: 2.0, gain: 0.6, decay: duration * 0.75, type: "sine" },
            { mult: 2.76, gain: 0.45, decay: duration * 0.6, type: "triangle" },
            { mult: 3.42, gain: 0.3, decay: duration * 0.5, type: "triangle" },
            { mult: 4.08, gain: 0.22, decay: duration * 0.4, type: "sine" },
            { mult: 5.43, gain: 0.15, decay: duration * 0.3, type: "sine" },
          ];
          break;
      }

      partials.forEach(({ mult, gain: pGain, decay, type }) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq * mult, now);

        gainNode.gain.setValueAtTime(0.0001, now);
        gainNode.gain.linearRampToValueAtTime(pGain, now + 0.004);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.05, decay));

        osc.connect(gainNode);
        gainNode.connect(masterGain);

        osc.start(now);
        osc.stop(now + Math.max(0.05, decay));
      });
    } catch {
      // Audio fallback or autoplay restriction
    }
  }, []);

  // Play custom imported audio sample
  const playCustomAudio = useCallback(async (customTone: CustomTone, customVol = volume) => {
    try {
      const ctx = getAudioContext();
      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      const buffer = await loadAudioBuffer(customTone.dataUrl);
      if (!buffer) {
        const audio = new Audio(customTone.dataUrl);
        audio.volume = Math.max(0.05, Math.min(1.0, customVol / 100));
        audio.play().catch(() => {});
        return;
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const gainNode = ctx.createGain();
      gainNode.gain.value = Math.max(0.05, Math.min(1.0, customVol / 100));

      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      source.start(0);
    } catch {
      // audio error
    }
  }, [loadAudioBuffer, volume]);

  // Unified sound player dispatch
  const playTone = useCallback((customVol = volume) => {
    const customMatch = customTones.find((t) => t.id === selectedToneId);
    if (customMatch) {
      playCustomAudio(customMatch, customVol);
      return;
    }
    playSynthesizedChime(pitch, bellDecay, customVol, timbre);
  }, [selectedToneId, customTones, playCustomAudio, playSynthesizedChime, pitch, bellDecay, volume, timbre]);

  // Single or multiple strike ring
  const ring = useCallback((count = 1, label = "Warning Bell") => {
    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

    setIsRinging(true);
    if (ringTimeoutRef.current) {
      window.clearTimeout(ringTimeoutRef.current);
    }
    const animDuration = count === 1 ? 800 : count === 2 ? 1400 : 2000;
    ringTimeoutRef.current = window.setTimeout(() => setIsRinging(false), animDuration);

    setRingCount((c) => c + count);
    setLastRung(timeStr);

    for (let i = 0; i < count; i++) {
      window.setTimeout(() => {
        playTone();
      }, i * 360);
    }

    const currentToneName =
      customTones.find((t) => t.id === selectedToneId)?.name ||
      BUILTIN_TONES.find((t) => t.id === selectedToneId)?.name ||
      "Bell";

    setHistory((prev) => [
      { id: `${Date.now()}-${count}`, type: `${label} (${currentToneName})`, count, time: timeStr },
      ...prev.slice(0, 24),
    ]);

    if (fest && data && session) {
      updateFest(fest.id, (d) => {
        log(d, session.name, `Rung ${label} [${currentToneName}] (${count} strike${count > 1 ? "s" : ""})`);
      });
    }
  }, [playTone, customTones, selectedToneId, fest, data, session, updateFest]);

  // Continuous Rapid Bell (seamless repeating strikes without gaps)
  const strikeOnce = useCallback(() => {
    playTone();
    setIsRinging(true);
    setRingCount((c) => c + 1);
  }, [playTone]);

  const startContinuous = useCallback(() => {
    if (continuousIntervalRef.current) return;
    strikeOnce();
    setContinuousActive(true);
    setIsRinging(true);
    setLastRung(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));

    continuousIntervalRef.current = window.setInterval(() => {
      strikeOnce();
    }, repeatSpeed);
  }, [strikeOnce, repeatSpeed]);

  const stopContinuous = useCallback(() => {
    if (continuousIntervalRef.current) {
      window.clearInterval(continuousIntervalRef.current);
      continuousIntervalRef.current = null;
    }
    setContinuousActive(false);
    if (ringTimeoutRef.current) window.clearTimeout(ringTimeoutRef.current);
    ringTimeoutRef.current = window.setTimeout(() => setIsRinging(false), 500);

    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const currentToneName =
      customTones.find((t) => t.id === selectedToneId)?.name ||
      BUILTIN_TONES.find((t) => t.id === selectedToneId)?.name ||
      "Bell";

    setHistory((prev) => [
      { id: `${Date.now()}-cont`, type: `Continuous Ringing [${currentToneName}]`, count: 1, time: timeStr },
      ...prev.slice(0, 24),
    ]);

    if (fest && data && session) {
      updateFest(fest.id, (d) => {
        log(d, session.name, `Ended continuous bell ringing [${currentToneName}]`);
      });
    }
  }, [fest, data, session, updateFest, customTones, selectedToneId]);

  const toggleContinuous = () => {
    if (continuousActive) {
      stopContinuous();
    } else {
      startContinuous();
    }
  };

  // Main user automated timer countdown
  const startAutoTimer = () => {
    if (autoTimerActive) {
      if (timerIntervalRef.current) window.clearInterval(timerIntervalRef.current);
      setAutoTimerActive(false);
      setAutoTimerLeft(null);
      return;
    }

    const tNum = Math.max(1, parseInt(timerVal) || 1);
    const total = timerUnit === "minutes" ? tNum * 60 : tNum;
    const wNum = Math.max(0, parseInt(warningVal) || 0);
    const warnSec = warningUnit === "minutes" ? wNum * 60 : wNum;

    setAutoTimerLeft(total);
    setAutoTimerActive(true);

    if (timerIntervalRef.current) window.clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = window.setInterval(() => {
      setAutoTimerLeft((curr) => {
        if (curr === null || curr <= 1) {
          if (timerIntervalRef.current) window.clearInterval(timerIntervalRef.current);
          setAutoTimerActive(false);
          ring(2, "Auto Timer: Time's Up!");
          return 0;
        }
        if (warnSec > 0 && curr === warnSec) {
          ring(1, `Auto Timer: ${warningVal} ${warningUnit} Warning`);
        }
        return curr - 1;
      });
    }, 1000);
  };

  // Handle Audio File Upload (Import Custom Tone)
  const handleAudioFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("audio/") && !file.name.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/i)) {
      alert("Please upload a valid audio file (.mp3, .wav, .ogg, .m4a)");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      setPendingAudioData({
        name: cleanName,
        dataUrl,
        size: `${(file.size / 1024).toFixed(0)} KB`,
      });
      setImportToneName(cleanName);
      setImportModalOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const saveCustomTone = () => {
    if (!pendingAudioData) return;
    const name = importToneName.trim() || pendingAudioData.name;
    const newTone: CustomTone = {
      id: `custom-${uid()}`,
      name,
      dataUrl: pendingAudioData.dataUrl,
      fileName: pendingAudioData.name,
    };
    setCustomTones((prev) => [...prev, newTone]);
    setSelectedToneId(newTone.id);
    if (isMain && fest) {
      updateFest(fest.id, (d) => {
        d.bellToneId = newTone.id;
      });
    }
    setImportModalOpen(false);
    setPendingAudioData(null);
    setImportToneName("");

    // Test play immediately
    playCustomAudio(newTone, volume);
  };

  const deleteCustomTone = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCustomTones((prev) => prev.filter((t) => t.id !== id));
    if (selectedToneId === id) {
      const fallbackId = "concert-880";
      setSelectedToneId(fallbackId);
      if (isMain && fest) {
        updateFest(fest.id, (d) => {
          d.bellToneId = fallbackId;
        });
      }
    }
  };

  const handleSelectTone = (toneId: string) => {
    setSelectedToneId(toneId);
    if (isMain && fest) {
      updateFest(fest.id, (d) => {
        d.bellToneId = toneId;
      });
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (continuousIntervalRef.current) window.clearInterval(continuousIntervalRef.current);
      if (timerIntervalRef.current) window.clearInterval(timerIntervalRef.current);
      if (ringTimeoutRef.current) window.clearTimeout(ringTimeoutRef.current);
    };
  }, []);

  // Keyboard shortcut listener (Spacebar = single, Shift+Space = toggle continuous)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;

      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        if (e.shiftKey) {
          toggleContinuous();
        } else {
          ring(1, "Warning Bell");
        }
      } else if (e.key === "Escape" && continuousActive) {
        stopContinuous();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [ring, toggleContinuous, continuousActive, stopContinuous]);

  // Combined tone list: all built-in (14) + all imported custom tones
  const allTones = useMemo(() => {
    const builtins = BUILTIN_TONES.map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      desc: t.desc,
      isCustom: false,
    }));
    const customs = customTones.map((t) => ({
      id: t.id,
      name: t.name,
      category: "Custom" as const,
      desc: t.fileName ? `Uploaded audio file (${t.fileName})` : "Custom imported sound",
      isCustom: true,
    }));
    return [...builtins, ...customs];
  }, [customTones]);

  const activeToneObj = allTones.find((t) => t.id === selectedToneId) || allTones[0];

  return (
    <div className="max-w-[760px] mx-auto space-y-6">
      <PageHead
        title={isMain ? "Stage & Judge Bell Control" : "Judge Bell"}
        sub={isMain ? "Continuous and multi-strike acoustic signal for stage timings and judging desk." : `Selected sound effect: ${activeToneObj.name}`}
      >
        <Tag color="var(--marigold)">Press Spacebar to ring</Tag>
        {isMain && <Tag color="var(--acc)">Main Admin Controls</Tag>}
      </PageHead>

      {/* ---------------- MAIN BELL STAGE (VISIBLE TO BOTH JUDGE & MAIN) ---------------- */}
      <div className="card p-8 flex flex-col items-center justify-center relative overflow-hidden select-none">
        {/* Glow when ringing */}
        {isRinging && (
          <div
            className="absolute inset-0 pointer-events-none transition-opacity"
            style={{
              background: continuousActive
                ? "radial-gradient(circle at 50% 45%, var(--coral-soft) 0%, transparent 75%)"
                : "radial-gradient(circle at 50% 45%, var(--marigold-soft) 0%, transparent 70%)",
            }}
          />
        )}

        {/* Continuous pulsing rings when continuous is active */}
        {isRinging && (
          <div className="absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div
              className={`w-48 h-48 rounded-full border-2 ${continuousActive ? "border-[var(--coral)]" : "border-[var(--marigold)]"} bell-wave`}
              style={{ animationDelay: "0s" }}
            />
            <div
              className={`w-48 h-48 rounded-full border-2 ${continuousActive ? "border-[var(--coral)]" : "border-[var(--marigold)]"} bell-wave absolute inset-0`}
              style={{ animationDelay: "0.25s" }}
            />
            <div
              className={`w-48 h-48 rounded-full border-2 ${continuousActive ? "border-[var(--coral)]" : "border-[var(--marigold)]"} bell-wave absolute inset-0`}
              style={{ animationDelay: "0.5s" }}
            />
          </div>
        )}

        {/* 3D Realistic Golden Brass Bell */}
        <button
          type="button"
          onClick={() => (continuousActive ? stopContinuous() : ring(1, "Warning Bell"))}
          title={continuousActive ? "Click to stop continuous ringing" : "Click to ring the bell"}
          className="relative cursor-pointer transition-transform active:scale-95 group focus:outline-none"
          style={{ width: 220, height: 230 }}
        >
          <div
            className={`w-full h-full flex items-center justify-center ${
              isRinging ? "bell-ring-active" : "group-hover:scale-105 transition-transform"
            }`}
          >
            <svg
              viewBox="0 0 200 210"
              className="w-full h-full drop-shadow-2xl"
              style={{
                filter: isRinging
                  ? continuousActive
                    ? "drop-shadow(0 0 30px rgba(239,71,111,0.85))"
                    : "drop-shadow(0 0 24px rgba(229,184,75,0.75))"
                  : "drop-shadow(0 14px 28px rgba(0,0,0,0.45))",
              }}
            >
              <defs>
                <linearGradient id="bellGold" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fff3b0" />
                  <stop offset="25%" stopColor={continuousActive ? "#ff8a5c" : "#f3ca52"} />
                  <stop offset="50%" stopColor={continuousActive ? "#d94f27" : "#d49b28"} />
                  <stop offset="75%" stopColor="#b67f1b" />
                  <stop offset="100%" stopColor="#7a4f0b" />
                </linearGradient>

                <linearGradient id="bellCrown" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#ffd97d" />
                  <stop offset="50%" stopColor="#c89222" />
                  <stop offset="100%" stopColor="#6d470a" />
                </linearGradient>

                <linearGradient id="bellHighlight" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="transparent" />
                  <stop offset="35%" stopColor="rgba(255,255,255,0.45)" />
                  <stop offset="55%" stopColor="rgba(255,255,255,0.1)" />
                  <stop offset="100%" stopColor="transparent" />
                </linearGradient>

                <radialGradient id="clapperGrad" cx="35%" cy="35%" r="65%">
                  <stop offset="0%" stopColor="#ffea9f" />
                  <stop offset="50%" stopColor="#b8841c" />
                  <stop offset="100%" stopColor="#4a2e05" />
                </radialGradient>
              </defs>

              <circle cx="100" cy="22" r="14" fill="none" stroke="url(#bellCrown)" strokeWidth="6" />
              <rect x="92" y="32" width="16" height="12" rx="3" fill="url(#bellCrown)" />

              <g className={isRinging ? "animate-bounce" : ""}>
                <line x1="100" y1="120" x2="100" y2="175" stroke="#7a4f0b" strokeWidth="5" strokeLinecap="round" />
                <circle cx="100" cy="180" r="14" fill="url(#clapperGrad)" stroke="#4a2e05" strokeWidth="1.5" />
              </g>

              <path
                d="M100 42 C74 42, 60 70, 56 115 C54 135, 46 150, 32 160 C26 164, 28 172, 36 172 L164 172 C172 172, 174 164, 168 160 C154 150, 146 135, 144 115 C140 70, 126 42, 100 42 Z"
                fill="url(#bellGold)"
                stroke="#684209"
                strokeWidth="2.5"
              />

              <path
                d="M100 45 C77 45, 65 72, 61 114 C59 133, 51 147, 39 157 L48 164 C62 153, 70 137, 72 116 C76 75, 86 48, 100 45 Z"
                fill="url(#bellHighlight)"
              />

              <path d="M40 152 Q100 162 160 152" fill="none" stroke="#7a4f0b" strokeWidth="2.5" opacity="0.6" />
              <path d="M37 158 Q100 168 163 158" fill="none" stroke="#ffe28a" strokeWidth="1.5" opacity="0.8" />

              <ellipse cx="100" cy="172" rx="66" ry="11" fill="url(#bellGold)" stroke="#5a3605" strokeWidth="2.5" />
              <ellipse cx="100" cy="172" rx="60" ry="7" fill="none" stroke="#fff4ba" strokeWidth="1.5" opacity="0.75" />
            </svg>
          </div>
        </button>

        {/* Ring Action Prompt & Selected Sound Indicator */}
        <div className="mt-4 text-center">
          <div
            className={`font-d text-[20px] font-extrabold transition-colors ${
              continuousActive
                ? "text-[var(--coral)]"
                : isRinging
                ? "text-[var(--marigold)]"
                : "text-[var(--ink)]"
            }`}
          >
            {continuousActive
              ? "⚡ CONTINUOUS RINGING ACTIVE"
              : isRinging
              ? "🔔 RINGING..."
              : "TAP OR CLICK TO RING"}
          </div>

          {/* Clean Selected Sound Effect Display */}
          <div className="mt-2.5 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[var(--line2)] bg-[var(--panel2)]">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--mut)]">Selected Sound Effect:</span>
            <span className="font-extrabold text-[13px] text-[var(--marigold)]">{activeToneObj.name}</span>
          </div>

          {continuousActive && (
            <p className="text-[12px] font-bold mt-2 text-[var(--coral)]">
              Continuous rapid strikes without space · Click bell or STOP button to end
            </p>
          )}
        </div>

        {/* Four Buttons under the Bell */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-6 w-full max-w-[620px]">
          {/* Button 1: Continuous Ring */}
          <button
            type="button"
            onClick={toggleContinuous}
            className={`btn flex-1 min-w-[170px] py-3.5 text-[13.5px] font-extrabold shadow-lg active:scale-95 transition-all ${
              continuousActive ? "bg-[var(--coral)] text-white animate-pulse" : "bg-[var(--coral)] text-white hover:brightness-110"
            }`}
          >
            <Icon n="bell" s={17} /> {continuousActive ? "⏹ STOP CONTINUOUS" : "⚡ RING CONTINUOUSLY"}
          </button>

          {/* Button 2: 1 Ding Warning */}
          <button
            type="button"
            onClick={() => ring(1, "1st Warning Bell")}
            disabled={continuousActive}
            className="btn gold flex-1 min-w-[130px] py-3.5 text-[13px] font-extrabold shadow-md active:scale-95 transition-transform"
          >
            <Icon n="bell" s={16} /> 1 Ding · Warning
          </button>

          {/* Button 3: 2 Dings Time's Up */}
          <button
            type="button"
            onClick={() => ring(2, "Time's Up Bell")}
            disabled={continuousActive}
            className="btn primary flex-1 min-w-[130px] py-3.5 text-[13px] font-extrabold shadow-md active:scale-95 transition-transform"
          >
            <Icon n="bell" s={16} /> 2 Dings · Time's Up
          </button>

          {/* Button 4: 3 Dings Stop */}
          <button
            type="button"
            onClick={() => ring(3, "Final Stop Bell")}
            disabled={continuousActive}
            className="btn danger flex-1 min-w-[110px] py-3.5 text-[13px] font-extrabold shadow-md active:scale-95 transition-transform"
          >
            <Icon n="bell" s={16} /> 3 Dings · Stop
          </button>
        </div>
      </div>

      {/* ---------------- MAIN USER ONLY SECTIONS (HIDDEN FOR JUDGE) ---------------- */}
      {isMain && (
        <div className="space-y-6 anim-in">
          {/* TONE SELECTOR & IMPORT SECTION */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="font-d text-[16px] font-extrabold flex items-center gap-2">
                  <Icon n="music" s={18} /> Sound Tones ({allTones.length} Available)
                </div>
                <div className="text-[12px] font-bold text-[var(--mut)]">
                  Pick active tone for all judges, or import unlimited audio sound effects (.mp3, .wav)
                </div>
              </div>

              {/* Import Sound Button */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*,.mp3,.wav,.ogg,.m4a"
                  className="hidden"
                  onChange={handleAudioFileUpload}
                />
                <Btn kind="gold" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Icon n="plus" s={14} /> Import Sound Tone
                </Btn>
              </div>
            </div>

            {/* Tone Selection Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-[300px] overflow-y-auto pr-1">
              {allTones.map((t) => {
                const isSelected = selectedToneId === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => {
                      handleSelectTone(t.id);
                      if (t.isCustom) {
                        const cMatch = customTones.find((ct) => ct.id === t.id);
                        if (cMatch) playCustomAudio(cMatch, volume);
                      } else {
                        const bMatch = BUILTIN_TONES.find((bt) => bt.id === t.id);
                        if (bMatch) playSynthesizedChime(bMatch.freq, 1.8, volume, bMatch.timbre);
                      }
                    }}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                      isSelected
                        ? "bg-[var(--acc-soft)] border-[var(--acc)] shadow-sm"
                        : "bg-[var(--panel2)] border-[var(--line)] hover:border-[var(--line2)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="font-bold text-[13px] leading-tight flex-1">
                        {t.name}
                      </div>
                      {t.isCustom ? (
                        <button
                          type="button"
                          onClick={(e) => deleteCustomTone(t.id, e)}
                          title="Delete imported tone"
                          className="text-gray-400 hover:text-red-500 p-0.5"
                        >
                          <Icon n="x" s={13} />
                        </button>
                      ) : (
                        <span
                          className="text-[9.5px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wider shrink-0"
                          style={{ background: "var(--panel3)", color: "var(--mut)" }}
                        >
                          {t.category}
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] font-semibold text-[var(--mut)] line-clamp-1 mt-1">
                      {t.desc}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SETTINGS & METRICS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="card p-4 flex items-center justify-between">
              <div>
                <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-[var(--mut)]">
                  Total Strikes Rung
                </div>
                <div className="font-d text-[26px] font-black" style={{ color: "var(--marigold)" }}>
                  {ringCount}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--marigold-soft)] text-[var(--marigold)]">
                <Icon n="bell" s={20} />
              </div>
            </div>

            <div className="card p-4 flex items-center justify-between">
              <div>
                <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-[var(--mut)]">
                  Last Rung Time
                </div>
                <div className="mono text-[16px] font-black" style={{ color: "var(--acc)" }}>
                  {lastRung || "—"}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--acc-soft)] text-[var(--acc)]">
                <Icon n="clock" s={20} />
              </div>
            </div>

            <div className="card p-4 flex items-center justify-between">
              <div>
                <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-[var(--mut)]">
                  Active Sound Tone
                </div>
                <div className="font-bold text-[13px] truncate max-w-[140px]" style={{ color: "var(--ink)" }}>
                  {activeToneObj.name}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--panel3)] text-[var(--acc)]">
                <Icon n="music" s={20} />
              </div>
            </div>
          </div>

          {/* MAIN USER EXCLUSIVE CONTROLS */}
          <div className="card p-5 space-y-4 border-2 border-[var(--acc)]">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span style={{ color: "var(--acc)" }}>
                  <Icon n="sliders" s={20} />
                </span>
                <div>
                  <div className="font-d text-[16px] font-extrabold">Main Administrator Bell Control Suite</div>
                  <div className="text-[12px] font-bold text-[var(--mut)]">
                    Exclusive sound engineering, continuous speed tuning, automated timer
                  </div>
                </div>
              </div>
              <Tag color="var(--acc)">Main User Exclusive</Tag>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
              {/* Strike Interval / Speed */}
              <div className="card2 p-3 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="lbl mb-0">Continuous Speed</span>
                  <span className="mono text-[11px] font-bold text-[var(--acc)]">{repeatSpeed}ms</span>
                </div>
                <input
                  type="range"
                  min={70}
                  max={300}
                  step={10}
                  value={repeatSpeed}
                  onChange={(e) => setRepeatSpeed(parseInt(e.target.value))}
                  className="w-full"
                />
                <span className="text-[10px] text-[var(--mut)] font-bold block">
                  {repeatSpeed <= 100 ? "⚡ Ultra Fast" : repeatSpeed <= 170 ? "Medium Rapid" : "Slow Pace"}
                </span>
              </div>

              {/* Bell Decay / Ring Sustain */}
              <div className="card2 p-3 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="lbl mb-0">Ring Sustain</span>
                  <span className="mono text-[11px] font-bold text-[var(--marigold)]">{bellDecay.toFixed(1)}s</span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={7.0}
                  step={0.2}
                  value={bellDecay}
                  onChange={(e) => setBellDecay(parseFloat(e.target.value))}
                  className="w-full"
                />
                <span className="text-[10px] text-[var(--mut)] font-bold block">Acoustic resonance length</span>
              </div>

              {/* Volume */}
              <div className="card2 p-3 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="lbl mb-0">Output Volume</span>
                  <span className="mono text-[11px] font-bold text-[var(--coral)]">{volume}%</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={volume}
                  onChange={(e) => setVolume(parseInt(e.target.value))}
                  className="w-full"
                />
                <span className="text-[10px] text-[var(--mut)] font-bold block">Master gain level</span>
              </div>

              {/* Fine Frequency Pitch Tuning */}
              <div className="card2 p-3 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="lbl mb-0">Pitch Offset</span>
                  <span className="mono text-[11px] font-bold text-[var(--acc)]">{pitch} Hz</span>
                </div>
                <input
                  type="range"
                  min={300}
                  max={1600}
                  step={20}
                  value={pitch}
                  onChange={(e) => {
                    const pVal = parseInt(e.target.value);
                    setPitch(pVal);
                    playSynthesizedChime(pVal, 1.2, volume, timbre);
                  }}
                  className="w-full"
                />
                <span className="text-[10px] text-[var(--mut)] font-bold block">Custom frequency override</span>
              </div>
            </div>

            {/* Automated Stage Countdown Timer */}
            <div className="card2 p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Icon n="clock" s={17} />
                  <span className="font-extrabold text-[13.5px]">Stage Countdown & Auto-Ring Timer</span>
                </div>
                {autoTimerActive && autoTimerLeft !== null && (
                  <span className="mono text-[16px] font-black text-[var(--coral)] animate-pulse">
                    ⏳ {Math.floor(autoTimerLeft / 60)}:{(autoTimerLeft % 60).toString().padStart(2, "0")} left
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-end gap-3">
                {/* Timer Duration - Big input bar + smaller format selector */}
                <div className="flex-1 min-w-[210px]">
                  <span className="lbl">Timer Duration</span>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      min={1}
                      className="input flex-1 text-[17px] font-black h-[48px] px-4"
                      style={{ minWidth: 120 }}
                      disabled={autoTimerActive}
                      value={timerVal}
                      placeholder="e.g. 5"
                      onChange={(e) => setTimerVal(e.target.value.replace(/\D/g, ""))}
                    />
                    <select
                      className="select w-[95px] shrink-0 text-[12px] h-[48px] px-2 font-bold"
                      disabled={autoTimerActive}
                      value={timerUnit}
                      onChange={(e) => setTimerUnit(e.target.value as "minutes" | "seconds")}
                    >
                      <option value="minutes">Minutes</option>
                      <option value="seconds">Seconds</option>
                    </select>
                  </div>
                </div>

                {/* Warning At - Big input bar + smaller format selector */}
                <div className="flex-1 min-w-[210px]">
                  <span className="lbl">Warning At</span>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      min={0}
                      className="input flex-1 text-[17px] font-black h-[48px] px-4"
                      style={{ minWidth: 120 }}
                      disabled={autoTimerActive}
                      value={warningVal}
                      placeholder="e.g. 30"
                      onChange={(e) => setWarningVal(e.target.value.replace(/\D/g, ""))}
                    />
                    <select
                      className="select w-[95px] shrink-0 text-[12px] h-[48px] px-2 font-bold"
                      disabled={autoTimerActive}
                      value={warningUnit}
                      onChange={(e) => setWarningUnit(e.target.value as "minutes" | "seconds")}
                    >
                      <option value="seconds">Seconds</option>
                      <option value="minutes">Minutes</option>
                    </select>
                  </div>
                </div>

                {/* Action Button */}
                <Btn
                  kind={autoTimerActive ? "danger" : "primary"}
                  onClick={startAutoTimer}
                  className="h-[48px] px-6 text-[13.5px] font-extrabold shrink-0"
                >
                  {autoTimerActive ? "Cancel Timer" : "Start Auto Countdown"}
                </Btn>
              </div>

              <p className="text-[11.5px] font-bold text-[var(--mut)]">
                Automatically sounds a 1-ding warning when {warningVal || "0"} {warningUnit} remain, and a 2-ding time's up chime at 0s.
              </p>
            </div>
          </div>

          {/* RING LOG / HISTORY */}
          <div className="card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-d text-[15px] font-extrabold flex items-center gap-2">
                <Icon n="list" s={17} /> Bell Ringing Log
              </div>
              {history.length > 0 && (
                <Btn size="sm" kind="soft" onClick={() => setHistory([])}>
                  Clear Log
                </Btn>
              )}
            </div>

            {history.length === 0 ? (
              <div className="text-[12.5px] font-bold text-center py-6 text-[var(--mut)]">
                No bell signals rung yet. Click the bell or press Spacebar to ring.
              </div>
            ) : (
              <div className="grid gap-1.5 max-h-[220px] overflow-y-auto pr-1">
                {history.map((ev) => (
                  <div
                    key={ev.id}
                    className="card2 px-3.5 py-2 flex items-center justify-between text-[13px] font-bold"
                  >
                    <div className="flex items-center gap-2.5">
                      <span style={{ color: "var(--marigold)" }}>
                        <Icon n="bell" s={14} />
                      </span>
                      <span>{ev.type}</span>
                      <Tag color="var(--acc)">
                        {ev.count} strike{ev.count > 1 ? "s" : ""}
                      </Tag>
                    </div>
                    <span className="mono text-[11.5px] text-[var(--mut)]">{ev.time}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------- IMPORT TONE MODAL (MAIN USER ONLY) ---------------- */}
      {isMain && importModalOpen && pendingAudioData && (
        <div className="modal-back fade-in" onMouseDown={(e) => { if (e.target === e.currentTarget) setImportModalOpen(false); }}>
          <div className="modal pop" style={{ maxWidth: 440 }}>
            <div className="flex items-center justify-between px-5 pt-4 pb-3" style={{ borderBottom: "1px solid var(--line)" }}>
              <div className="font-d text-[15px] font-bold">Import Audio Tone</div>
              <button type="button" className="icobtn" onClick={() => setImportModalOpen(false)}>
                <Icon n="x" s={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="lbl">Tone Name / Label</label>
                <input
                  className="input"
                  value={importToneName}
                  placeholder="e.g. Traditional Kalolsavam Gong"
                  onChange={(e) => setImportToneName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="card2 p-3 text-[12.5px] font-bold space-y-1">
                <div className="flex justify-between">
                  <span style={{ color: "var(--mut)" }}>File size:</span>
                  <span>{pendingAudioData.size}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: "var(--mut)" }}>Status:</span>
                  <span style={{ color: "var(--acc)" }}>Ready to save and use</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Btn kind="soft" onClick={() => setImportModalOpen(false)}>
                  Cancel
                </Btn>
                <Btn kind="gold" onClick={saveCustomTone}>
                  Save & Use Tone
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
