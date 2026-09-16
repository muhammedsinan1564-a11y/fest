/**
 * Whole-app font settings (separate body font and heading font).
 *
 * Stored per device in localStorage and applied as CSS variables on :root.
 * The CSS uses:
 *   body      { font-family: var(--app-body-font) }
 *   .font-d   { font-family: var(--app-head-font) }
 * Google families are fetched on demand through the same requestFont() loader
 * the card/poster editors use, so any face from the big FONTS catalogue works.
 */
import { requestFont, FONTS, SYSTEM_FONTS } from "./editor";

const BODY_KEY = "festize.font.body";
const HEAD_KEY = "festize.font.head";

export const DEFAULT_BODY_FONT = "Courier Prime";
export const DEFAULT_HEAD_FONT = "Unbounded";

/** A friendlier, curated list for the Settings pickers (full catalogue lives in the editors). */
export const APP_FONT_CHOICES = Array.from(
  new Set([
    "Unbounded", "Manrope", "Courier Prime", "Bebas Neue", "Inter", "Roboto", "Open Sans", "Lato",
    "Montserrat", "Poppins", "Playfair Display", "Merriweather", "Lora", "Source Serif 4",
    "Barlow", "Josefin Sans", "Quicksand", "Nunito", "Raleway", "Oswald", "Anton", "Bitter",
    "Cabin", "DM Sans", "DM Serif Display", "Fira Sans", "IBM Plex Sans", "IBM Plex Serif",
    "IBM Plex Mono", "Space Grotesk", "Space Mono", "Roboto Mono", "Roboto Slab", "Spectral",
    "Work Sans", "Ubuntu", "Comfortaa", "Rubik", "Karla", "Libre Baskerville", "Cormorant Garamond",
    "Bodoni Moda", "Abril Fatface", "Lobster", "Pacifico", "Caveat", "Shadows Into Light",
    "Dancing Script", "Permanent Marker", "Bangers", "Cinzel", "Special Elite",
    ...SYSTEM_FONTS,
  ]),
).filter((f) => FONTS.includes(f) || SYSTEM_FONTS.includes(f));

const isMono = (name: string) =>
  /mono|courier|consolas|terminal|typewriter/i.test(name);

function stack(name: string, fallback: string) {
  const generic = isMono(name) ? "ui-monospace, SFMono-Regular, Menlo, monospace" : "ui-sans-serif, system-ui, sans-serif";
  return `"${name}", ${fallback}, ${generic}`;
}

export function getBodyFont() {
  try { return localStorage.getItem(BODY_KEY) || DEFAULT_BODY_FONT; } catch { return DEFAULT_BODY_FONT; }
}
export function getHeadFont() {
  try { return localStorage.getItem(HEAD_KEY) || DEFAULT_HEAD_FONT; } catch { return DEFAULT_HEAD_FONT; }
}

/** Apply the stored fonts to the document (called once on boot and after a change). */
export function applyAppFonts() {
  const body = getBodyFont();
  const head = getHeadFont();
  requestFont(body);
  requestFont(head);
  const root = document.documentElement;
  root.style.setProperty("--app-body-font", stack(body, isMono(body) ? '"Courier New"' : '"Segoe UI", Arial'));
  root.style.setProperty("--app-head-font", stack(head, '"Segoe UI", Arial'));
}

export function setBodyFont(name: string) {
  try { localStorage.setItem(BODY_KEY, name); } catch { /* ignore */ }
  requestFont(name);
  document.documentElement.style.setProperty("--app-body-font", stack(name, isMono(name) ? '"Courier New"' : '"Segoe UI", Arial'));
}
export function setHeadFont(name: string) {
  try { localStorage.setItem(HEAD_KEY, name); } catch { /* ignore */ }
  requestFont(name);
  document.documentElement.style.setProperty("--app-head-font", stack(name, '"Segoe UI", Arial'));
}

export function resetBodyFont() {
  try { localStorage.removeItem(BODY_KEY); } catch { /* ignore */ }
  applyAppFonts();
}
export function resetHeadFont() {
  try { localStorage.removeItem(HEAD_KEY); } catch { /* ignore */ }
  applyAppFonts();
}
