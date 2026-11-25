import { useEffect, useState } from "react";

export interface SiteTheme {
  id: string;
  name: string;
  tagline: string;
  lightName: string;
  lightTagline: string;
  /** Dark mode preview swatch: [background, surface, accent]. */
  swatch: [string, string, string];
  /** Light mode preview swatch: [background, surface, accent]. */
  lightSwatch: [string, string, string];
}

// Every palette has both a dark and a distinct light variant under html[data-theme="..."] in index.css.
export const SITE_THEMES: SiteTheme[] = [
  {
    id: "obsidian",
    name: "Obsidian Gold",
    tagline: "Deep obsidian, metallic gold",
    lightName: "Alabaster Gold",
    lightTagline: "Warm ivory parchment, burnished gold",
    swatch: ["#07080a", "#13161c", "#f59e0b"],
    lightSwatch: ["#fbf8f1", "#ffffff", "#b45309"],
  },
  {
    id: "sapphire",
    name: "Midnight Sapphire",
    tagline: "Cosmic navy, vivid electric sky",
    lightName: "Coastal Azure",
    lightTagline: "Glacier mist, crisp royal sapphire",
    swatch: ["#030712", "#0f172a", "#38bdf8"],
    lightSwatch: ["#eef6ff", "#ffffff", "#0284c7"],
  },
  {
    id: "emerald",
    name: "Emerald Noir",
    tagline: "Rich forest dark, neon mint",
    lightName: "Botanical Mint",
    lightTagline: "Sage dew paper, deep botanical green",
    swatch: ["#022c22", "#064e3b", "#34d399"],
    lightSwatch: ["#eefaf4", "#ffffff", "#059669"],
  },
  {
    id: "amethyst",
    name: "Royal Amethyst",
    tagline: "Deep violet dusk, orchid glow",
    lightName: "Lavender Silk",
    lightTagline: "Soft lilac silk, rich royal violet",
    swatch: ["#0f071f", "#1e1b4b", "#c084fc"],
    lightSwatch: ["#f6f2ff", "#ffffff", "#7c3aed"],
  },
  {
    id: "rose",
    name: "Rosé Noir",
    tagline: "Warm espresso, rose gold",
    lightName: "Porcelain Rose",
    lightTagline: "Blush porcelain, deep crimson rose",
    swatch: ["#18080a", "#2b1216", "#fb7185"],
    lightSwatch: ["#fff4f6", "#ffffff", "#e11d48"],
  },
];

const STORAGE_KEY = "festize-site-theme";
const EVENT = "festize-theme-change";

export function readTheme(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SITE_THEMES.some(theme => theme.id === saved)) return saved;
  } catch { /* storage unavailable */ }
  return SITE_THEMES[0].id;
}

export function applyTheme(id: string) {
  const next = SITE_THEMES.some(theme => theme.id === id) ? id : SITE_THEMES[0].id;
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem(STORAGE_KEY, next); } catch { /* storage unavailable */ }
  window.dispatchEvent(new CustomEvent<string>(EVENT, { detail: next }));
}

/** Current theme id, kept in sync across every component that uses it. */
export function useSiteTheme() {
  const [theme, setTheme] = useState(readTheme);
  useEffect(() => {
    const onChange = (event: Event) => setTheme((event as CustomEvent<string>).detail);
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return [theme, applyTheme] as const;
}

/** Reads the active accent as an "r,g,b" string for canvas drawing. */
export function accentRgb(): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue("--accent-rgb").trim();
  return value || "245,158,11";
}

type ViewTransition = { ready: Promise<void>; finished: Promise<void> };

/**
 * Reveals a theme change as a circular wave growing out from the clicked button.
 * Uses the View Transition API when available, with a DOM-circle fallback.
 */
export function waveThemeChange(source: Element, change: () => void, fallbackColor?: string) {
  const rect = source.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const root = document.documentElement;
  root.style.setProperty("--theme-wave-x", `${x}px`);
  root.style.setProperty("--theme-wave-y", `${y}px`);
  root.style.setProperty("--theme-wave-r", `${radius}px`);
  const api = (document as Document & { startViewTransition?: (callback: () => void) => ViewTransition }).startViewTransition;
  if (api && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const transition = api.call(document, change);
    void transition.ready.then(() => root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 650, easing: "cubic-bezier(.2,.75,.2,1)", pseudoElement: "::view-transition-new(root)" },
    ));
    return;
  }
  const wave = document.createElement("div");
  wave.className = "theme-wave-fallback";
  wave.style.cssText = `left:${x}px;top:${y}px;width:${radius * 2}px;height:${radius * 2}px;background:${fallbackColor || "#111"}`;
  document.body.appendChild(wave);
  change();
  requestAnimationFrame(() => wave.classList.add("go"));
  setTimeout(() => wave.remove(), 720);
}

/* ------------------------------------------------------------------------ */
/* Compatibility layer for the existing workspace theme consumers            */
/* (App.tsx, Workspace.tsx, ThemePicker.tsx, Setup.tsx, types.ts).          */
/* Bridges the legacy exports onto the new site-theme system above.         */
/* ------------------------------------------------------------------------ */

export type ThemeId = string;

export interface WorkspaceTheme {
  id: ThemeId;
  name: string;
  mode: "light" | "dark";
  bg: string;
  surface: string;
  elevated: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accentSecondary: string;
}

/** Light studio-paper theme (applied when no `data-theme` attribute is set). */
/** Full light palette — inline on the workspace root so dark `html[data-theme]` rules can't bleed through. */
export const LIGHT_THEME_VARS: Record<string, string> = {
  "--fz-bg": "#F7F6F2",
  "--fz-surface": "#FFFFFF",
  "--fz-elevated": "#F0EEE8",
  "--fz-border": "#E3E0D8",
  "--fz-text": "#151513",
  "--fz-muted": "#65635D",
  "--fz-accent": "#E5484D",
  "--fz-accent-fg": "#FFFFFF",
  "--fz-accent-soft": "rgba(229, 72, 77, 0.11)",
  "--fz-accent-2": "#4F46E5",
};

export const PAPER_THEME: WorkspaceTheme = {
  id: "paper",
  name: "Studio Paper",
  mode: "light",
  bg: "#F7F6F2",
  surface: "#FFFFFF",
  elevated: "#F0EEE8",
  border: "#E3E0D8",
  text: "#151513",
  muted: "#65635D",
  accent: "#E5484D",
  accentSecondary: "#4F46E5",
};

/** Workspace themes = the light paper default + every vibrant site palette. */
export const WORKSPACE_THEMES: WorkspaceTheme[] = [
  PAPER_THEME,
  ...SITE_THEMES.map((t) => ({
    id: t.id,
    name: t.name,
    mode: "dark" as const,
    bg: t.swatch[0],
    surface: t.swatch[1],
    elevated: t.swatch[1],
    border: t.swatch[1],
    text: "#F8FAFC",
    muted: "#94A3B8",
    accent: t.swatch[2],
    accentSecondary: t.swatch[2],
  })),
];

export function getThemeById(themeId: ThemeId): WorkspaceTheme {
  return WORKSPACE_THEMES.find((t) => t.id === themeId) ?? WORKSPACE_THEMES[0];
}

/**
 * Applies a workspace theme: site palettes go through `applyTheme`
 * (`html[data-theme="..."]` drives every `--fz-*` variable in index.css),
 * while the light "paper" theme simply clears the attribute.
 */
export function applyWorkspaceTheme(themeId: ThemeId, accentOverride?: string) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (themeId === "paper" || themeId === "light") {
    root.dataset.theme = "light";
    try { localStorage.setItem(STORAGE_KEY, "light"); } catch { /* storage unavailable */ }
    window.dispatchEvent(new CustomEvent<string>(EVENT, { detail: "light" }));
  } else {
    applyTheme(themeId);
  }
  if (accentOverride) root.style.setProperty("--fz-accent", accentOverride);
  else root.style.removeProperty("--fz-accent");
}
