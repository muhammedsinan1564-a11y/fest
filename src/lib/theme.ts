import { useEffect, useState } from "react";

export interface SiteTheme {
  id: string;
  name: string;
  tagline: string;
  /** [background, surface, accent] used for the little preview swatch. */
  swatch: [string, string, string];
}

// Every palette is defined in index.css under html[data-theme="..."].
export const SITE_THEMES: SiteTheme[] = [
  { id: "obsidian", name: "Obsidian Gold", tagline: "Warm black, gilded accents", swatch: ["#0e0c0b", "#221c17", "#d9a94f"] },
  { id: "sapphire", name: "Midnight Sapphire", tagline: "Deep navy, silver-blue light", swatch: ["#0a0d14", "#171e2e", "#7ea6f7"] },
  { id: "emerald", name: "Emerald Noir", tagline: "Forest dark, jewel green", swatch: ["#08100d", "#16251f", "#3ecf98"] },
  { id: "amethyst", name: "Royal Amethyst", tagline: "Plum night, violet glow", swatch: ["#0f0b14", "#22192d", "#b68cf2"] },
  { id: "rose", name: "Rosé Noir", tagline: "Velvet black, rose gold", swatch: ["#120b0c", "#291b1e", "#e8a4a0"] },
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
  return value || "217,169,79";
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
