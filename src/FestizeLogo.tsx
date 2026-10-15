import { motion } from "framer-motion";
import { useId } from "react";

/**
 * The Festize logo, rebuilt as an exact vector copy of the supplied artwork
 * (512 × 512 artboard): black rounded tile, italic gold "F", darker gold
 * middle stroke, olive dot and white dot. Nothing is added to the artwork.
 */
export const LOGO_COLORS = { tile: "#000000", gold: "#FFC000", deep: "#D9A300", olive: "#9A7400", white: "#FFFFFF" } as const;

export const LOGO_SHAPES = {
  /** Slanted stem of the F, including the rounded top-left corner. */
  stem: "M192.6 180Q196 160 216 160L249 160L198.17 459Q196.3 470 185.3 470L154.3 470Q143.3 470 145.17 459Z",
  /** Middle stroke; its left end sits behind the stem. */
  mid: "M200 270L332 270Q342 270 340.3 280L334.52 314Q332.8 324 322.8 324L190.8 324Z",
  /** White italic dot after the middle stroke. */
  dot: "M353.96 282Q356 270 368 270L381 270Q393 270 390.96 282L385.86 312Q383.8 324 371.8 324L358.8 324Q346.8 324 348.86 312Z",
  /** Outline of the rounded tile (used to trace it during the intro). */
  tile: "M76 0H436A76 76 0 0 1 512 76V436A76 76 0 0 1 436 512H76A76 76 0 0 1 0 436V76A76 76 0 0 1 76 0Z",
} as const;

/** Static logo. Pass `title={null}` when it sits next to visible "festize" text. */
export function FestizeLogo({ className, title = "Festize" }: { className?: string; title?: string | null }) {
  return <svg className={className} viewBox="0 0 512 512" role={title ? "img" : undefined} aria-label={title ?? undefined} aria-hidden={title ? undefined : true} focusable="false">
    <rect width="512" height="512" rx="76" fill={LOGO_COLORS.tile} />
    <path d={LOGO_SHAPES.mid} fill={LOGO_COLORS.deep} />
    <path d={LOGO_SHAPES.stem} fill={LOGO_COLORS.gold} />
    <rect x="216" y="160" width="296" height="54" fill={LOGO_COLORS.gold} />
    <ellipse cx="156" cy="192" rx="28" ry="23" transform="rotate(-28 156 192)" fill={LOGO_COLORS.olive} />
    <path d={LOGO_SHAPES.dot} fill={LOGO_COLORS.white} />
  </svg>;
}

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/**
 * The same logo, assembled piece by piece for the opening intro:
 * the tile is traced and filled, the stem rises, the top stroke runs out,
 * the middle stroke slides from behind the stem, then the two dots pop in.
 * The final frame is identical to <FestizeLogo />.
 */
export function FestizeLogoBuild() {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const ref = (name: string) => `fz-${uid}-${name}`;
  const url = (name: string) => `url(#${ref(name)})`;
  return <svg viewBox="0 0 512 512" aria-hidden="true" focusable="false" style={{ overflow: "visible" }}>
    <defs>
      <clipPath id={ref("tile")}><rect width="512" height="512" rx="76" /></clipPath>
      {/* Reveal masks: attribute animations only, so they work in every browser. */}
      <clipPath id={ref("stem")}><motion.path initial={{ d: "M110 486H290V486H110Z" }} animate={{ d: "M110 148H290V486H110Z" }} transition={{ delay: .86, duration: .46, ease: EASE_OUT }} /></clipPath>
      <clipPath id={ref("bar")}><motion.rect x="206" y="150" height="74" initial={{ width: 0 }} animate={{ width: 320 }} transition={{ delay: 1.14, duration: .4, ease: EASE_OUT }} /></clipPath>
      <clipPath id={ref("mid")}><motion.rect x="212" y="262" height="70" initial={{ width: 0 }} animate={{ width: 146 }} transition={{ delay: 1.36, duration: .34, ease: EASE_OUT }} /></clipPath>
      <radialGradient id={ref("flash")}><stop offset="0" stopColor="#ffffff" stopOpacity=".95" /><stop offset="1" stopColor="#ffffff" stopOpacity="0" /></radialGradient>
    </defs>
    <motion.rect width="512" height="512" rx="76" fill={LOGO_COLORS.tile} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .62, duration: .38 }} />
    <motion.path d={LOGO_SHAPES.tile} fill="none" stroke={LOGO_COLORS.gold} strokeWidth="6" initial={{ pathLength: 0, opacity: 1 }} animate={{ pathLength: 1, opacity: [1, 1, 0] }} transition={{ pathLength: { delay: .16, duration: .64, ease: "easeInOut" }, opacity: { delay: .16, duration: 1.5, times: [0, .74, 1] } }} />
    <g clipPath={url("tile")}>
      <path d={LOGO_SHAPES.mid} fill={LOGO_COLORS.deep} clipPath={url("mid")} />
      <path d={LOGO_SHAPES.stem} fill={LOGO_COLORS.gold} clipPath={url("stem")} />
      <rect x="216" y="160" width="296" height="54" fill={LOGO_COLORS.gold} clipPath={url("bar")} />
      <g transform="rotate(-28 156 192)">
        <motion.ellipse cx="156" cy="192" fill={LOGO_COLORS.olive} initial={{ rx: 0, ry: 0 }} animate={{ rx: 28, ry: 23 }} transition={{ delay: 1.54, duration: .5, ease: [.34, 1.56, .64, 1] }} />
      </g>
      <motion.path d={LOGO_SHAPES.dot} fill={LOGO_COLORS.white} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.72, duration: .14 }} />
      <motion.circle cx="370" cy="297" fill={url("flash")} initial={{ r: 0, opacity: 0 }} animate={{ r: 96, opacity: [0, .85, 0] }} transition={{ delay: 1.72, duration: .58, ease: "easeOut" }} />
    </g>
  </svg>;
}
