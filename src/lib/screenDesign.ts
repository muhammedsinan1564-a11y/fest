/** Per-fest dashboard decorations: multiple draggable images, a background and motion presets. */

export type ScreenKey = "publicResults" | "member" | "teamManager" | "judge" | "dashboard";

export interface ScreenLayer {
  id: string;
  src: string;
  /** Percentages relative to the screen canvas. */
  x: number;
  y: number;
  width: number;
  height: number;
  animation: string;
  opacity: number;
  name: string;
}

export interface ScreenDesign {
  background?: string;
  layers: ScreenLayer[];
}

export const SCREEN_KEYS: { key: ScreenKey; label: string }[] = [
  { key: "dashboard", label: "All users dashboard" },
  { key: "publicResults", label: "Public results screen" },
  { key: "member", label: "Member screen" },
  { key: "teamManager", label: "Team manager screen" },
  { key: "judge", label: "Judge screen" },
];

/** 20 motion presets offered by the animation drawer. */
export const SCREEN_ANIMATIONS: { id: string; label: string }[] = [
  { id: "none", label: "Still" },
  { id: "float", label: "Float" },
  { id: "bob", label: "Bob" },
  { id: "pulse", label: "Pulse" },
  { id: "breathe", label: "Breathe" },
  { id: "spin", label: "Spin" },
  { id: "spinSlow", label: "Slow spin" },
  { id: "wobble", label: "Wobble" },
  { id: "swing", label: "Swing" },
  { id: "drift", label: "Drift" },
  { id: "driftBack", label: "Drift back" },
  { id: "slideIn", label: "Slide in" },
  { id: "slideUp", label: "Slide up" },
  { id: "zoomIn", label: "Zoom in" },
  { id: "flipIn", label: "Flip in" },
  { id: "glow", label: "Glow" },
  { id: "shimmer", label: "Shimmer" },
  { id: "tilt", label: "Tilt" },
  { id: "orbit", label: "Orbit" },
  { id: "bounce", label: "Bounce" },
];

export function emptyScreenDesign(): ScreenDesign {
  return { background: undefined, layers: [] };
}
