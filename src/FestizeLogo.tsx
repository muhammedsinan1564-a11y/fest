import React, { useId } from "react";
import { motion } from "framer-motion";
import { cn } from "./utils/cn";

/**
 * Official Festize logo — black rounded tile with the gold monogram.
 * `LOGO_SVG_INNER` is the single source of truth for static marks and
 * `lib/brand.ts` print/PNG stamping, while `FestizeLogoBuild` animates
 * ONLY the letter F stroke-by-stroke during the opening intro.
 */
export const LOGO_COLORS = {
  tile: "#000000",
  gold: "#fdb515",
  bright: "#ffd700",
  white: "#FFFFFF",
  deep: "#000000",
  olive: "#fdb515",
} as const;

export const LOGO_SHAPES = {
  mid: "M15 18 H99 V32 H15 Z",
  stem: "M15 20 H29 V107 H15 Z",
  dot: "M6 29 m-7 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0",
} as const;

const LOGO_TILE = `<rect width="512" height="512" rx="100" fill="#000000"/>`;
const LOGO_GLYPH = `<g transform="translate(135, 80) scale(4.2)">
    <g transform="skewX(-10)">
      <rect x="15" y="18" width="84" height="14" rx="6" fill="#fdb515"/>
      <circle cx="6" cy="29" r="7" fill="#ffd700" opacity="0.6"/>
      <rect x="15" y="50" width="49" height="14" rx="8" fill="#ffd700" opacity="0.5"/>
      <rect x="15" y="20" width="14" height="87" rx="7" fill="#fdb515"/>
      <rect x="70" y="50" width="14" height="14" rx="4" fill="#FFFFFF"/>
    </g>
  </g>`;

export const LOGO_SVG_INNER = LOGO_TILE + LOGO_GLYPH;

/** Returns the logo's SVG inner markup, optionally without the black tile (for transparent backgrounds). */
export function festizeLogoBody(includeTile = true): string {
  return (includeTile ? LOGO_TILE : "") + LOGO_GLYPH;
}

export const FestizeMarkSvg: React.FC<{
  className?: string;
  style?: React.CSSProperties;
}> = ({ className, style }) => (
  <svg
    viewBox="0 0 512 512"
    width="512"
    height="512"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={style}
    aria-hidden="true"
    dangerouslySetInnerHTML={{ __html: LOGO_SVG_INNER }}
  />
);

const STROKE_EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Just the letter F from the Festize mark (no outer box), assembling itself
 * stroke by stroke using SVG clipPaths so every rounded cap stays razor-sharp.
 */
export const FestizeLogoBuild: React.FC<{ size?: number; className?: string }> = ({
  size = 160,
  className,
}) => {
  const uid = useId().replace(/:/g, "");
  const stemClip = `fz-stem-${uid}`;
  const topClip = `fz-top-${uid}`;
  const midClip = `fz-mid-${uid}`;

  return (
    <svg
      viewBox="-14 12 118 102"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("fz-f-build", className)}
      aria-hidden="true"
    >
      <defs>
        {/* 1. Vertical spine draws upward from bottom to top */}
        <clipPath id={stemClip}>
          <motion.rect
            x="13"
            width="18"
            initial={{ y: 109, height: 0 }}
            animate={{ y: 18, height: 91 }}
            transition={{ duration: 0.52, delay: 0.06, ease: STROKE_EASE }}
          />
        </clipPath>
        {/* 2. Top bar sweeps out from the spine to the right */}
        <clipPath id={topClip}>
          <motion.rect
            x="15"
            y="16"
            height="18"
            initial={{ width: 0 }}
            animate={{ width: 86 }}
            transition={{ duration: 0.46, delay: 0.36, ease: STROKE_EASE }}
          />
        </clipPath>
        {/* 3. Middle bar sweeps out from the spine */}
        <clipPath id={midClip}>
          <motion.rect
            x="15"
            y="48"
            height="18"
            initial={{ width: 0 }}
            animate={{ width: 51 }}
            transition={{ duration: 0.4, delay: 0.56, ease: STROKE_EASE }}
          />
        </clipPath>
      </defs>

      <g transform="skewX(-10)">
        <rect
          x="15"
          y="20"
          width="14"
          height="87"
          rx="7"
          fill="#fdb515"
          clipPath={`url(#${stemClip})`}
        />
        <rect
          x="15"
          y="18"
          width="84"
          height="14"
          rx="6"
          fill="#fdb515"
          clipPath={`url(#${topClip})`}
        />
        <rect
          x="15"
          y="50"
          width="49"
          height="14"
          rx="8"
          fill="#ffd700"
          opacity="0.5"
          clipPath={`url(#${midClip})`}
        />
        {/* 4. Left golden dot blooms beside the shoulder */}
        <motion.circle
          cx="6"
          cy="29"
          fill="#ffd700"
          initial={{ r: 0, opacity: 0 }}
          animate={{ r: 7, opacity: 0.6 }}
          transition={{ delay: 0.74, duration: 0.36, ease: [0.34, 1.56, 0.64, 1] }}
        />
        {/* 5. Crisp white terminal square snaps into place */}
        <motion.rect
          y="50"
          width="14"
          height="14"
          rx="4"
          fill="#FFFFFF"
          initial={{ x: 54, opacity: 0 }}
          animate={{ x: 70, opacity: 1 }}
          transition={{ delay: 0.88, duration: 0.36, ease: STROKE_EASE }}
        />
      </g>
    </svg>
  );
};

export interface FestizeLogoProps {
  /** Pixel size of the mark. */
  size?: number;
  /** Native tooltip text (pass `null` to suppress). */
  title?: string | null;
  /** Show the "Festize" wordmark next to the mark. */
  withWordmark?: boolean;
  /** Optional secondary line under the wordmark (e.g. festival name). */
  subtitle?: string;
  className?: string;
}

export const FestizeLogo: React.FC<FestizeLogoProps> = ({
  size = 36,
  withWordmark = true,
  subtitle,
  title,
  className,
}) => {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)} title={title ?? undefined}>
      <span className="block shrink-0" style={{ width: size, height: size }}>
        <FestizeMarkSvg className="w-full h-full" />
      </span>
      {withWordmark && (
        <span className="min-w-0">
          <span className="fz-display font-extrabold tracking-tight leading-none block text-base">
            Festize
          </span>
          {subtitle && (
            <span className="text-[11px] text-[var(--fz-muted)] font-medium block truncate max-w-[180px]">
              {subtitle}
            </span>
          )}
        </span>
      )}
    </span>
  );
};

export default FestizeLogo;
