/**
 * One reliable export pipeline for every download in Festize.
 *
 * Why this exists: html-to-image, left to itself, scans every stylesheet on the
 * page and embeds every web font it finds. The font pickers load dozens of
 * Google Fonts, so that scan could take minutes or stall. Here we embed only
 * the font families actually used inside the node being exported (latin
 * subsets, cached), and hand that CSS to html-to-image directly.
 */
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { SYSTEM_FONTS } from "./fonts";

const GENERIC_FAMILIES = new Set([
  "serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "ui-serif", "ui-sans-serif",
  "ui-monospace", "ui-rounded", "emoji", "math", "fangsong", "inherit", "initial", "unset",
  "-apple-system", "blinkmacsystemfont", "segoe ui", "helvetica neue", "apple color emoji",
  "segoe ui emoji", "segoe ui symbol", "noto color emoji", "arial black",
]);
const SYSTEM_SET = new Set(SYSTEM_FONTS.map(name => name.toLowerCase()));

/** Every non-generic, non-system font family used anywhere inside the node. */
function usedFamilies(node: HTMLElement): string[] {
  const families = new Set<string>();
  const visit = (element: Element) => {
    const stack = getComputedStyle(element).fontFamily || "";
    for (const raw of stack.split(",")) {
      const family = raw.trim().replace(/^["']|["']$/g, "");
      const key = family.toLowerCase();
      if (family && !GENERIC_FAMILIES.has(key) && !SYSTEM_SET.has(key)) families.add(family);
    }
    for (const child of Array.from(element.children)) visit(child);
  };
  visit(node);
  return [...families];
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function fetchWithTimeout(url: string, ms = 9000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try { return await fetch(url, { signal: controller.signal, mode: "cors" }); }
  finally { clearTimeout(timer); }
}

const fontFileCache = new Map<string, Promise<string>>();
function fontFileToDataUrl(url: string): Promise<string> {
  let cached = fontFileCache.get(url);
  if (!cached) {
    cached = fetchWithTimeout(url)
      .then(response => { if (!response.ok) throw new Error(`Font ${response.status}`); return response.blob(); })
      .then(blobToDataUrl);
    fontFileCache.set(url, cached);
    cached.catch(() => fontFileCache.delete(url));
  }
  return cached;
}

/** Fetches one family from Google Fonts and inlines its latin font files. */
async function loadFamilyCss(family: string): Promise<string> {
  const base = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}`;
  // Ask for regular + bold; static families without bold reject that, so retry plain.
  let response = await fetchWithTimeout(`${base}:wght@400;700&display=swap`);
  if (!response.ok) response = await fetchWithTimeout(`${base}&display=swap`);
  if (!response.ok) return "";
  const css = await response.text();
  const blocks: { subset: string; rule: string }[] = [];
  const pattern = /(?:\/\*\s*([\w-]+)\s*\*\/\s*)?(@font-face\s*\{[^}]*\})/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(css))) blocks.push({ subset: (match[1] || "").toLowerCase(), rule: match[2] });
  let chosen = blocks.filter(block => block.subset === "latin" || block.subset === "latin-ext");
  if (!chosen.length) chosen = blocks.slice(0, 8);
  const embedded = await Promise.all(chosen.map(async ({ rule }) => {
    let output = rule;
    for (const found of rule.matchAll(/url\((['"]?)([^'")]+)\1\)/g)) {
      try { output = output.split(found[2]).join(await fontFileToDataUrl(found[2])); }
      catch { return ""; }
    }
    return output;
  }));
  return embedded.filter(Boolean).join("\n");
}

const familyCssCache = new Map<string, Promise<string>>();
function familyCss(family: string): Promise<string> {
  let cached = familyCssCache.get(family);
  if (!cached) {
    cached = loadFamilyCss(family).catch(() => "");
    familyCssCache.set(family, cached);
  }
  return cached;
}

/** Self-contained @font-face CSS for exactly the fonts used inside `node`. */
export async function buildFontEmbedCSS(node: HTMLElement): Promise<string> {
  const parts = await Promise.all(usedFamilies(node).map(familyCss));
  return parts.filter(Boolean).join("\n");
}

/** Waits for web fonts, every <img> inside the node, and two paint frames. */
export async function waitForAssets(node: HTMLElement): Promise<void> {
  try { await document.fonts?.ready; } catch { /* font loading API unavailable */ }
  const images = Array.from(node.querySelectorAll("img"));
  await Promise.all(images.map(image => (image.complete && image.naturalWidth > 0 ? Promise.resolve() : image.decode().catch(() => undefined))));
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

const isSafari = typeof navigator !== "undefined" && /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(navigator.userAgent);

export interface PngOptions {
  pixelRatio?: number;
  width?: number;
  height?: number;
  backgroundColor?: string;
  style?: Partial<CSSStyleDeclaration>;
  /** Precomputed font CSS (reuse it when exporting many similar nodes). */
  fontEmbedCSS?: string;
}

/** Renders a DOM node to a PNG data URL. */
export async function renderNodePng(node: HTMLElement, options: PngOptions = {}): Promise<string> {
  await waitForAssets(node);
  const fontEmbedCSS = options.fontEmbedCSS ?? await buildFontEmbedCSS(node).catch(() => "");
  const config = {
    pixelRatio: options.pixelRatio ?? 2,
    cacheBust: false,
    fontEmbedCSS,
    width: options.width ?? node.offsetWidth,
    height: options.height ?? node.offsetHeight,
    backgroundColor: options.backgroundColor,
    style: { transform: "none", margin: "0", boxShadow: "none", ...options.style },
  };
  // Safari sometimes paints images only on the second pass of the SVG snapshot.
  if (isSafari) await toPng(node, config).catch(() => undefined);
  return toPng(node, config);
}

export function downloadHref(href: string, filename: string) {
  const link = document.createElement("a");
  link.href = href; link.download = filename; link.rel = "noopener"; link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  setTimeout(() => link.remove(), 0);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  downloadHref(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export const fileSlug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "festize";

/** Downloads a node as a PNG. `targetWidth` is the output width in pixels. */
export async function downloadNodePng(node: HTMLElement, filename: string, targetWidth = 1080) {
  const width = node.offsetWidth || 1;
  const dataUrl = await renderNodePng(node, { pixelRatio: Math.min(6, Math.max(1, targetWidth / width)) });
  const blob = await (await fetch(dataUrl)).blob();
  downloadBlob(blob, /\.png$/i.test(filename) ? filename : `${filename}.png`);
}

/**
 * Downloads a node as a paged PDF. Short sheets are captured once; long ones
 * are rendered page by page so they never exceed mobile canvas limits.
 */
export async function downloadNodePdf(node: HTMLElement, filename: string, widthMm = 210, heightMm = 297, report?: (message: string) => void) {
  await waitForAssets(node);
  const captureWidth = Math.max(node.clientWidth, node.scrollWidth, 1);
  const captureHeight = Math.max(node.clientHeight, node.scrollHeight, 1);
  report?.("Preparing fonts…");
  const fontEmbedCSS = await buildFontEmbedCSS(node).catch(() => "");
  const orientation = widthMm > heightMm ? "landscape" : "portrait";
  const pdf = new jsPDF({ orientation, unit: "mm", format: [widthMm, heightMm] });
  const pageHeightPx = Math.max(1, Math.round(captureWidth * heightMm / widthMm));
  const pages = Math.max(1, Math.ceil(captureHeight / pageHeightPx));
  const ratio = 2;
  const base: Partial<CSSStyleDeclaration> = { width: `${captureWidth}px`, height: `${captureHeight}px`, maxHeight: "none", overflow: "visible" };
  const oneShot = captureWidth * ratio * captureHeight * ratio <= 12_000_000 && captureHeight * ratio <= 14_000;
  if (oneShot) {
    report?.("Rendering sheet…");
    const png = await renderNodePng(node, { pixelRatio: ratio, width: captureWidth, height: captureHeight, backgroundColor: "#ffffff", style: base, fontEmbedCSS });
    const renderedHeight = widthMm * captureHeight / captureWidth;
    for (let page = 0; page < pages; page++) {
      if (page) pdf.addPage([widthMm, heightMm], orientation);
      pdf.addImage(png, "PNG", 0, -page * heightMm, widthMm, renderedHeight);
    }
  } else {
    for (let page = 0; page < pages; page++) {
      report?.(`Rendering page ${page + 1} of ${pages}…`);
      const png = await renderNodePng(node, { pixelRatio: ratio, width: captureWidth, height: pageHeightPx, backgroundColor: "#ffffff", style: { ...base, transform: `translateY(-${page * pageHeightPx}px)` }, fontEmbedCSS });
      if (page) pdf.addPage([widthMm, heightMm], orientation);
      pdf.addImage(png, "PNG", 0, 0, widthMm, heightMm);
    }
  }
  report?.("Saving PDF…");
  pdf.save(/\.pdf$/i.test(filename) ? filename : `${filename}.pdf`);
}
