import type { DesignElement } from "../types";

const TEXT_KINDS = ["text", "name", "team", "category", "number", "winner", "runner", "secondRunner", "program", "festival", "mark", "winnerPoints", "runnerPoints", "secondRunnerPoints"];

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image could not be read"));
    image.src = source;
  });
}

/** Perceived brightness, 0 (black) to 1 (white). */
function luminance(r: number, g: number, b: number) {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * Reads the part of the background sitting behind each text field and gives that
 * field a colour that stays readable on top of it.
 */
export async function fitTextColors(background: string, elements: DesignElement[]): Promise<DesignElement[]> {
  const image = await loadImage(background);
  const canvas = document.createElement("canvas");
  const width = canvas.width = Math.min(image.naturalWidth || 600, 600);
  const height = canvas.height = Math.min(image.naturalHeight || 800, 800);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return elements;
  context.drawImage(image, 0, 0, width, height);

  return elements.map(element => {
    if (!TEXT_KINDS.includes(element.kind)) return element;
    const left = Math.max(0, Math.min(width - 1, Math.round(element.x / 100 * width)));
    const top = Math.max(0, Math.min(height - 1, Math.round(element.y / 100 * height)));
    const sampleWidth = Math.max(1, Math.min(width - left, Math.round(element.width / 100 * width)));
    const sampleHeight = Math.max(1, Math.min(height - top, Math.round(Math.max(element.height, 6) / 100 * height)));
    let red = 0, green = 0, blue = 0, count = 0;
    try {
      const { data } = context.getImageData(left, top, sampleWidth, sampleHeight);
      // Step through the block instead of every pixel; plenty accurate and much faster.
      for (let index = 0; index < data.length; index += 16) {
        red += data[index]; green += data[index + 1]; blue += data[index + 2]; count++;
      }
    } catch { return element; }
    if (!count) return element;
    const light = luminance(red / count, green / count, blue / count) > 0.55;
    // Enhanced professional contrast coloring
    return { ...element, color: light ? "#0f172a" : "#ffffff" };
  });
}

/** Average brightness of a whole image, used to pick a default colour for new fields. */
export async function backgroundIsLight(background: string) {
  try {
    const image = await loadImage(background);
    const canvas = document.createElement("canvas");
    canvas.width = 40; canvas.height = 40;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return true;
    context.drawImage(image, 0, 0, 40, 40);
    const { data } = context.getImageData(0, 0, 40, 40);
    let red = 0, green = 0, blue = 0, count = 0;
    for (let index = 0; index < data.length; index += 4) { red += data[index]; green += data[index + 1]; blue += data[index + 2]; count++; }
    return luminance(red / count, green / count, blue / count) > 0.55;
  } catch { return true; }
}

/* ------------------------------------------------------------------------ */
/* WCAG 2.1 hex contrast helpers (kept for Studio, Tools and brand modules). */
/* ------------------------------------------------------------------------ */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export type WcagLevel = 'AAA' | 'AA' | 'AA Large' | 'Fail';

export interface ContrastReport {
  ratio: number;
  formatted: string;
  level: WcagLevel;
  passesNormal: boolean;
  passesLarge: boolean;
  recommendedText: string;
}

export function normalizeHex(hex: string): string {
  const clean = hex.trim().replace(/^#/, '');
  if (clean.length === 3) {
    return (
      '#' +
      clean
        .split('')
        .map((c) => c + c)
        .join('')
        .toUpperCase()
    );
  }
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    return '#' + clean.toUpperCase();
  }
  return '#151513';
}

export function hexToRgb(hex: string): RGB {
  const normalized = normalizeHex(hex).slice(1);
  const num = parseInt(normalized, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const toLinear = (channel: number) => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const R = toLinear(r);
  const G = toLinear(g);
  const B = toLinear(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

export function contrastRatio(foreground: string, background: string): number {
  const lumA = relativeLuminance(foreground);
  const lumB = relativeLuminance(background);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

export function wcagGrade(ratio: number): WcagLevel {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA Large';
  return 'Fail';
}

export function pickReadableText(
  backgroundHex: string,
  lightOption = '#FFFFFF',
  darkOption = '#141413'
): string {
  const lightContrast = contrastRatio(lightOption, backgroundHex);
  const darkContrast = contrastRatio(darkOption, backgroundHex);
  return lightContrast >= darkContrast ? lightOption : darkOption;
}

export function mixColors(hexA: string, hexB: string, weight = 0.5): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const w = Math.max(0, Math.min(1, weight));
  return rgbToHex(
    a.r * (1 - w) + b.r * w,
    a.g * (1 - w) + b.g * w,
    a.b * (1 - w) + b.b * w
  );
}

export function ensureContrast(
  foreground: string,
  background: string,
  minRatio = 4.5
): string {
  if (contrastRatio(foreground, background) >= minRatio) {
    return normalizeHex(foreground);
  }
  const target = pickReadableText(background, '#FFFFFF', '#0E0E10');
  for (let step = 0.1; step <= 1; step += 0.1) {
    const candidate = mixColors(foreground, target, step);
    if (contrastRatio(candidate, background) >= minRatio) {
      return candidate;
    }
  }
  return target;
}

export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  const clamped = Math.max(0, Math.min(1, alpha));
  return `rgba(${r}, ${g}, ${b}, ${clamped})`;
}

export function inspectContrast(foreground: string, background: string): ContrastReport {
  const ratio = contrastRatio(foreground, background);
  const level = wcagGrade(ratio);
  return {
    ratio,
    formatted: `${ratio.toFixed(2)}:1`,
    level,
    passesNormal: ratio >= 4.5,
    passesLarge: ratio >= 3,
    recommendedText: pickReadableText(background),
  };
}
