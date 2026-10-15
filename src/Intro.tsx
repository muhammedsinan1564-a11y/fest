import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { FestizeLogoBuild } from "./FestizeLogo";

/**
 * Opening intro, played once when the website opens:
 *  1. the logo is built piece by piece in the centre of the screen,
 *  2. "festize." types out beside it,
 *  3. the logo shrinks and flies to its place on the first screen while the
 *     word rushes toward the viewer and disappears,
 *  4. the first screen is revealed underneath, already in place.
 */

type Phase = "build" | "brand" | "exit" | "skip";
type Flight = { x: number; y: number; scale: number; fade: boolean };

const WORD = "festize.".split("");
/** How long the logo build takes before the typing starts. */
const BUILD_MS = 1950;
const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const GLOW_IN = { opacity: [0, .9, .5] };
const GLOW_IN_TRANSITION = { duration: 2, times: [0, .45, 1] };

/** No intro for reduced-motion users or when arriving from a member QR link. */
export function shouldPlayIntro() {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  return !new URLSearchParams(window.location.search).get("fest");
}

export default function IntroSequence({ onDone, targetId = "hero-logo" }: { onDone: (handoff: boolean) => void; targetId?: string }) {
  const [phase, setPhase] = useState<Phase>("build");
  const [typed, setTyped] = useState(0);
  const [flight, setFlight] = useState<Flight | null>(null);
  const phaseRef = useRef<Phase>("build");
  const flightRef = useRef<Flight | null>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const finished = useRef(false);

  const go = (next: Phase) => { phaseRef.current = next; setPhase(next); };
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };
  const clearTimers = () => { timers.current.forEach(timer => window.clearTimeout(timer)); timers.current = []; };

  const finish = useCallback((handoff: boolean) => {
    if (finished.current) return;
    finished.current = true;
    clearTimers();
    onDone(handoff);
  }, [onDone]);

  const skip = useCallback(() => {
    if (phaseRef.current === "exit" || phaseRef.current === "skip") return;
    clearTimers();
    go("skip");
  }, []);

  /** Step 3: measure where the first-screen logo sits and fly there. */
  const startExit = () => {
    if (phaseRef.current !== "brand") return;
    const from = logoRef.current?.getBoundingClientRect();
    if (!from || !from.width) { finish(false); return; }
    const target = document.getElementById(targetId)?.getBoundingClientRect();
    const fromX = from.left + from.width / 2; const fromY = from.top + from.height / 2;
    const visible = Boolean(target && target.width > 0 && target.bottom > 0 && target.top < window.innerHeight);
    const next: Flight = visible && target
      ? { x: target.left + target.width / 2 - fromX, y: target.top + target.height / 2 - fromY, scale: target.width / from.width, fade: false }
      : { x: window.innerWidth * .1 - fromX, y: 0, scale: .4, fade: true };
    flightRef.current = next;
    setFlight(next);
    go("exit");
    // Safety net in case the browser drops the animation-complete callback.
    later(() => finish(visible), 1700);
  };

  // Hold the page still while the intro plays; Escape / Enter / Space skips.
  useEffect(() => {
    const html = document.documentElement;
    const previous = html.style.overflow;
    html.style.overflow = "hidden";
    try { if ("scrollRestoration" in history) history.scrollRestoration = "manual"; } catch { /* not supported */ }
    window.scrollTo(0, 0);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Enter" || event.key === " ") { event.preventDefault(); skip(); }
    };
    window.addEventListener("keydown", onKey);
    return () => { html.style.overflow = previous; window.removeEventListener("keydown", onKey); clearTimers(); };
  }, [skip]);

  // Step 1 → 2 once the build has played and the wordmark font is ready.
  useEffect(() => {
    let alive = true;
    const font = typeof document.fonts?.load === "function" ? document.fonts.load('600 120px "Bodoni Moda"').catch(() => undefined) : Promise.resolve();
    const minimum = new Promise(resolve => window.setTimeout(resolve, BUILD_MS));
    const ceiling = new Promise(resolve => window.setTimeout(resolve, BUILD_MS + 1300));
    void Promise.race([Promise.all([font, minimum]), ceiling]).then(() => { if (alive && phaseRef.current === "build") go("brand"); });
    return () => { alive = false; };
  }, []);

  // Step 2: type the word one letter at a time.
  useEffect(() => {
    if (phase !== "brand") return;
    let index = 0;
    const type = () => {
      if (phaseRef.current !== "brand") return;
      index += 1;
      setTyped(index);
      if (index < WORD.length) later(type, 66 + Math.random() * 48);
      else later(startExit, 560);
    };
    later(type, 470); // let the logo glide aside first
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const exiting = phase === "exit";
  const logoTarget = exiting && flight
    ? { x: flight.x, y: flight.y, scale: flight.scale, opacity: flight.fade ? 0 : 1 }
    : { x: 0, y: 0, scale: phase === "build" ? 1.24 : 1, opacity: 1 };
  const logoTransition = exiting
    ? { duration: .86, ease: [.65, 0, .25, 1] as const }
    : { scale: { type: "spring" as const, stiffness: 115, damping: 18 }, opacity: { duration: .3 } };

  return <motion.div className="intro" initial={{ opacity: 1 }} animate={{ opacity: phase === "skip" ? 0 : 1 }} transition={{ duration: phase === "skip" ? .35 : 0 }} onAnimationComplete={() => { if (phaseRef.current === "skip") finish(false); }} onClick={skip}>
    <motion.div className="intro-bg" animate={{ opacity: exiting ? 0 : 1 }} transition={{ delay: exiting ? .2 : 0, duration: .55, ease: "easeOut" }} />
    <div className="intro-stage" aria-hidden="true">
      <motion.div className="intro-logo-box" layout transition={{ layout: { duration: .55, ease: EASE_OUT } }}>
        <motion.div ref={logoRef} className="intro-logo" initial={{ scale: .84, opacity: 0 }} animate={logoTarget} transition={logoTransition} onAnimationComplete={() => { if (phaseRef.current === "exit") finish(!flightRef.current?.fade); }}>
          <motion.span className="intro-glow" initial={{ opacity: 0 }} animate={exiting ? { opacity: 0 } : GLOW_IN} transition={exiting ? { duration: .3 } : GLOW_IN_TRANSITION} />
          <FestizeLogoBuild />
          <span className="intro-sheen"><motion.i initial={{ x: "-160%" }} animate={{ x: "260%" }} transition={{ delay: 1.9, duration: .75, ease: [.4, 0, .2, 1] }} /></span>
        </motion.div>
      </motion.div>
      {phase !== "build" && <motion.div className="intro-word" initial={{ opacity: 1 }}
        animate={exiting ? { scale: 7, opacity: [1, 1, 0], filter: "blur(14px)" } : { scale: 1, opacity: 1, filter: "blur(0px)" }}
        transition={exiting ? { duration: .55, delay: .06, ease: [.55, 0, 1, .45], opacity: { duration: .55, delay: .06, times: [0, .3, 1] } } : { duration: 0 }}>
        <span className="intro-anchor">{typed === 0 && <i className="intro-caret" />}</span>
        {WORD.map((char, index) => <span key={index} className={`ch${index < typed ? " on" : ""}${char === "." ? " dot" : ""}`}>{char}{index === typed - 1 && !exiting && <i className="intro-caret" />}</span>)}
      </motion.div>}
    </div>
    {!exiting && <button type="button" className="intro-skip" onClick={event => { event.stopPropagation(); skip(); }}>Skip intro</button>}
  </motion.div>;
}
