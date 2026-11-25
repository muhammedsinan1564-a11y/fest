import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { FestizeLogoBuild } from "./FestizeLogo";

/**
 * Opening intro, played once when the website opens:
 *  1. Just the letter "F" from the Festize mark builds up stroke by stroke in the centre,
 *  2. "festize." slides in smoothly right beside it,
 *  3. The whole lockup rushes closer toward the screen and disappears,
 *  4. The landing screen is revealed underneath.
 */

type Phase = "build" | "brand" | "exit" | "skip";

const WORD = "festize.".split("");
/** How long the F build plays before the wordmark enters. */
const BUILD_MS = 1320;
const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const RUSH_EASE = [0.6, 0.02, 0.96, 0.36] as const;

/** No intro for reduced-motion users or when arriving from a member QR link. */
export function shouldPlayIntro() {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  return !new URLSearchParams(window.location.search).get("fest");
}

export default function IntroSequence({
  onDone,
}: {
  onDone: (handoff: boolean) => void;
  targetId?: string;
}) {
  const [phase, setPhase] = useState<Phase>("build");
  const phaseRef = useRef<Phase>("build");
  const timers = useRef<number[]>([]);
  const finished = useRef(false);

  const go = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  };
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  const clearTimers = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  };

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    clearTimers();
    onDone(false);
  }, [onDone]);

  const skip = useCallback(() => {
    if (phaseRef.current === "exit" || phaseRef.current === "skip") return;
    clearTimers();
    go("skip");
  }, []);

  // Hold the page still while the intro plays; Escape / Enter / Space skips.
  useEffect(() => {
    const html = document.documentElement;
    const previous = html.style.overflow;
    html.style.overflow = "hidden";
    try {
      if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    } catch {
      /* not supported */
    }
    window.scrollTo(0, 0);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        skip();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      html.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
      clearTimers();
    };
  }, [skip]);

  // Step 1 -> 2 once the F has finished making up and the display font is ready.
  useEffect(() => {
    let alive = true;
    const font =
      typeof document.fonts?.load === "function"
        ? document.fonts.load('800 110px "Space Grotesk"').catch(() => undefined)
        : Promise.resolve();
    const minimum = new Promise((resolve) => window.setTimeout(resolve, BUILD_MS));
    const ceiling = new Promise((resolve) => window.setTimeout(resolve, BUILD_MS + 900));
    void Promise.race([Promise.all([font, minimum]), ceiling]).then(() => {
      if (alive && phaseRef.current === "build") go("brand");
    });
    return () => {
      alive = false;
    };
  }, []);

  // Step 2 -> 3: let "festize." settle, then rush closer to the screen and vanish.
  useEffect(() => {
    if (phase !== "brand") return;
    later(() => {
      if (phaseRef.current !== "brand") return;
      go("exit");
      // Safety fallback if animation completion callback is skipped by the tab.
      later(finish, 950);
    }, 1150);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const exiting = phase === "exit";

  return (
    <motion.div
      className="intro"
      initial={{ opacity: 1 }}
      animate={{ opacity: phase === "skip" ? 0 : 1 }}
      transition={{ duration: phase === "skip" ? 0.28 : 0 }}
      onAnimationComplete={() => {
        if (phaseRef.current === "skip") finish();
      }}
      onClick={skip}
      role="region"
      aria-label="Opening animation"
    >
      <motion.div
        className="intro-bg"
        animate={{ opacity: exiting ? 0 : 1 }}
        transition={{ delay: exiting ? 0.22 : 0, duration: 0.52, ease: "easeOut" }}
      />

      <div className="intro-stage" aria-hidden="true">
        <motion.div
          className="intro-lockup"
          initial={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
          animate={
            exiting
              ? {
                  scale: [1, 1.06, 9.5],
                  opacity: [1, 0.96, 0],
                  filter: ["blur(0px)", "blur(1px)", "blur(20px)"],
                }
              : { scale: 1, opacity: 1, filter: "blur(0px)" }
          }
          transition={
            exiting
              ? {
                  duration: 0.76,
                  ease: RUSH_EASE,
                  times: [0, 0.22, 1],
                }
              : { duration: 0.3 }
          }
          onAnimationComplete={() => {
            if (phaseRef.current === "exit") finish();
          }}
        >
          <motion.div
            className="intro-f-wrap"
            layout
            initial={{ scale: 1.18 }}
            animate={{ scale: phase === "build" ? 1.18 : 1 }}
            transition={{
              layout: { duration: 0.5, ease: EASE_OUT },
              scale: { duration: 0.5, ease: EASE_OUT },
            }}
          >
            <motion.span
              className="intro-glow"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: [0, 0.75, 0.45], scale: [0.75, 1.12, 1] }}
              transition={{ duration: 1.4, times: [0, 0.5, 1], ease: "easeOut" }}
            />
            <FestizeLogoBuild />
          </motion.div>

          {phase !== "build" && (
            <motion.div
              className="intro-word"
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15 }}
            >
              {WORD.map((char, index) => (
                <motion.span
                  key={index}
                  className={char === "." ? "intro-char dot" : "intro-char"}
                  initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{
                    duration: 0.42,
                    delay: 0.08 + index * 0.048,
                    ease: EASE_OUT,
                  }}
                >
                  {char}
                </motion.span>
              ))}
            </motion.div>
          )}
        </motion.div>
      </div>

      {!exiting && (
        <button
          type="button"
          className="intro-skip"
          onClick={(event) => {
            event.stopPropagation();
            skip();
          }}
        >
          Skip intro
        </button>
      )}
    </motion.div>
  );
}
