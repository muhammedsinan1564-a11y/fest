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
import { loadImage, stampPngTopRight } from "./brand";

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
export async function downloadNodePng(node: HTMLElement, filename: string, targetWidth = 1080, logoSrc?: string | null) {
  const width = node.offsetWidth || 1;
  let dataUrl = await renderNodePng(node, { pixelRatio: Math.min(6, Math.max(1, targetWidth / width)) });
  if (logoSrc) {
    try { dataUrl = await stampPngTopRight(dataUrl, logoSrc); } catch { /* stamping is best-effort */ }
  }
  const blob = await (await fetch(dataUrl)).blob();
  downloadBlob(blob, /\.png$/i.test(filename) ? filename : `${filename}.png`);
}

/**
 * Stamps the fest logo at the top-right of a PDF page (tiny but recognisable).
 * The logo is scaled to roughly 18 mm and kept inside the page margin.
 */
export function stampPdfPage(pdf: jsPDF, logo: HTMLImageElement, widthMm: number) {
  const box = Math.min(18, widthMm * 0.13);
  const scale = Math.min(box / logo.naturalWidth, box / logo.naturalHeight);
  const width = logo.naturalWidth * scale;
  const height = logo.naturalHeight * scale;
  pdf.addImage(logo, "PNG", widthMm - 8 - width, 8, width, height);
}

/**
 * Downloads a node as a paged PDF. Short sheets are captured once; long ones
 * are rendered page by page so they never exceed mobile canvas limits.
 */
export async function downloadNodePdf(node: HTMLElement, filename: string, widthMm = 210, heightMm = 297, report?: (message: string) => void, logoSrc?: string | null) {
  await waitForAssets(node);
  let logo: HTMLImageElement | null = null;
  if (logoSrc) {
    try { logo = await loadImage(logoSrc); } catch { logo = null; }
  }
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
      if (logo) stampPdfPage(pdf, logo, widthMm);
    }
  } else {
    for (let page = 0; page < pages; page++) {
      report?.(`Rendering page ${page + 1} of ${pages}…`);
      const png = await renderNodePng(node, { pixelRatio: ratio, width: captureWidth, height: pageHeightPx, backgroundColor: "#ffffff", style: { ...base, transform: `translateY(-${page * pageHeightPx}px)` }, fontEmbedCSS });
      if (page) pdf.addPage([widthMm, heightMm], orientation);
      pdf.addImage(png, "PNG", 0, 0, widthMm, heightMm);
      if (logo) stampPdfPage(pdf, logo, widthMm);
    }
  }
  report?.("Saving PDF…");
  pdf.save(/\.pdf$/i.test(filename) ? filename : `${filename}.pdf`);
}

/* ------------------------------------------------------------------------ */
/* Legacy export surface used by the Studio, Printouts, Programs and Tools   */
/* modules: SVG document rendering, CSV/JSON downloads and print windows.    */
/* ------------------------------------------------------------------------ */

import { getFontById } from "./fonts";
import { shapeGeometryFor, type AnyShape } from "./shapes";

export type DesignLayerType = 'text' | 'shape' | 'badge';

export interface ExportableLayer {
  id: string;
  name: string;
  type: DesignLayerType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  // Text properties
  text?: string;
  fontId?: string;
  fontSize?: number;
  fontWeight?: number;
  textAlign?: 'left' | 'center' | 'right';
  letterSpacing?: number;
  uppercase?: boolean;
  color?: string;
  // Shape / Badge properties
  shapeKind?: AnyShape;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  badgeLabel?: string;
  badgeSublabel?: string;
}

export interface ExportableDesignDoc {
  id: string;
  title: string;
  formatLabel: string;
  width: number;
  height: number;
  bgColor: string;
  bgGradientTo?: string;
  bgPattern?: 'none' | 'dots' | 'grid' | 'frame';
  layers: ExportableLayer[];
  updatedAt: string;
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function downloadTextFile(
  content: string,
  filename: string,
  mimeType = 'text/plain;charset=utf-8'
): void {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(blob, filename);
}

export function exportToJson(data: unknown, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  downloadTextFile(json, filename, 'application/json;charset=utf-8');
}

export function exportToCsv(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
  filename: string
): void {
  const escapeCell = (cell: string | number | null | undefined): string => {
    const raw = cell === null || cell === undefined ? '' : String(cell);
    if (/[",\n\r]/.test(raw)) {
      return `"${raw.replace(/"/g, '""')}"`;
    }
    return raw;
  };

  const lines = [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => row.map(escapeCell).join(',')),
  ];
  // Include UTF-8 BOM for spreadsheet tools
  downloadTextFile('\uFEFF' + lines.join('\r\n'), filename, 'text/csv;charset=utf-8');
}

function wrapTextLines(text: string, maxCharsPerLine: number): string[] {
  const rawParagraphs = text.split('\n');
  const lines: string[] = [];

  for (const para of rawParagraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let current = words[0];
    for (let i = 1; i < words.length; i++) {
      if ((current + ' ' + words[i]).length <= Math.max(6, maxCharsPerLine)) {
        current += ' ' + words[i];
      } else {
        lines.push(current);
        current = words[i];
      }
    }
    lines.push(current);
  }
  return lines;
}

export function renderDocumentToSvgString(
  doc: ExportableDesignDoc,
  resolveTokens: (input: string) => string = (s) => s
): string {
  const { width, height, bgColor, bgGradientTo, bgPattern } = doc;
  const defs: string[] = [];

  if (bgGradientTo) {
    defs.push(`
      <linearGradient id="fz-bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${escapeXml(bgColor)}" />
        <stop offset="100%" stop-color="${escapeXml(bgGradientTo)}" />
      </linearGradient>
    `);
  }

  if (bgPattern === 'dots') {
    defs.push(`
      <pattern id="fz-pat-dots" width="32" height="32" patternUnits="userSpaceOnUse">
        <circle cx="16" cy="16" r="1.8" fill="currentColor" opacity="0.14" />
      </pattern>
    `);
  } else if (bgPattern === 'grid') {
    defs.push(`
      <pattern id="fz-pat-grid" width="48" height="48" patternUnits="userSpaceOnUse">
        <path d="M 48 0 L 0 0 0 48" fill="none" stroke="currentColor" stroke-width="1" opacity="0.1" />
      </pattern>
    `);
  }

  const bgFill = bgGradientTo ? 'url(#fz-bg-grad)' : escapeXml(bgColor);

  let patternOverlay = '';
  if (bgPattern === 'dots') {
    patternOverlay = `<rect width="${width}" height="${height}" fill="url(#fz-pat-dots)" style="color:#888888" />`;
  } else if (bgPattern === 'grid') {
    patternOverlay = `<rect width="${width}" height="${height}" fill="url(#fz-pat-grid)" style="color:#888888" />`;
  } else if (bgPattern === 'frame') {
    const inset = Math.round(Math.min(width, height) * 0.04);
    patternOverlay = `<rect x="${inset}" y="${inset}" width="${width - inset * 2}" height="${height - inset * 2}" fill="none" stroke="#888888" stroke-opacity="0.32" stroke-width="2" />`;
  }

  const layerElements = doc.layers
    .filter((l) => l.visible)
    .map((layer) => {
      const cx = layer.x + layer.width / 2;
      const cy = layer.y + layer.height / 2;
      const transform = layer.rotation
        ? `transform="rotate(${layer.rotation} ${cx} ${cy})"`
        : '';

      if (layer.type === 'shape') {
        const geom = shapeGeometryFor(
          layer.shapeKind ?? 'starburst',
          layer.fill ?? '#E5484D',
          layer.stroke,
          layer.strokeWidth ?? 0
        );
        return `
          <g opacity="${layer.opacity}" ${transform}>
            <svg x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" viewBox="${geom.viewBox}" preserveAspectRatio="none">
              ${geom.innerSvg}
            </svg>
          </g>
        `;
      }

      if (layer.type === 'badge') {
        const fill = layer.fill ?? '#151513';
        const fg = layer.color ?? '#FFFFFF';
        const label = escapeXml(resolveTokens(layer.badgeLabel ?? 'OFFICIAL RESULT'));
        const sub = escapeXml(resolveTokens(layer.badgeSublabel ?? 'FESTIZE VERIFIED'));
        const rx = Math.min(20, layer.height / 2);
        return `
          <g opacity="${layer.opacity}" ${transform}>
            <rect x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" rx="${rx}" fill="${escapeXml(fill)}" ${
              layer.stroke && layer.strokeWidth
                ? `stroke="${escapeXml(layer.stroke)}" stroke-width="${layer.strokeWidth}"`
                : ''
            } />
            <text x="${cx}" y="${layer.y + layer.height * 0.46}" text-anchor="middle" fill="${escapeXml(fg)}" font-family="'Space Grotesk', sans-serif" font-weight="700" font-size="${Math.round(layer.height * 0.28)}">${label}</text>
            <text x="${cx}" y="${layer.y + layer.height * 0.77}" text-anchor="middle" fill="${escapeXml(fg)}" opacity="0.82" font-family="'JetBrains Mono', monospace" font-weight="500" font-size="${Math.round(layer.height * 0.19)}">${sub}</text>
          </g>
        `;
      }

      // Text layer
      const font = getFontById(layer.fontId ?? 'space-grotesk');
      const fontSize = layer.fontSize ?? 48;
      const fontWeight = layer.fontWeight ?? 700;
      const rawResolved = resolveTokens(layer.text ?? '');
      const finalStr = layer.uppercase ? rawResolved.toUpperCase() : rawResolved;
      const estChars = Math.floor(layer.width / (fontSize * 0.54));
      const lines = wrapTextLines(finalStr, estChars);
      const align = layer.textAlign ?? 'left';
      const anchor = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start';
      const anchorX =
        align === 'center'
          ? layer.x + layer.width / 2
          : align === 'right'
            ? layer.x + layer.width
            : layer.x;
      const lineHeight = fontSize * 1.18;

      const tspans = lines
        .map(
          (line, idx) =>
            `<tspan x="${anchorX}" dy="${idx === 0 ? fontSize : lineHeight}">${escapeXml(line)}</tspan>`
        )
        .join('');

      return `
        <g opacity="${layer.opacity}" ${transform}>
          <text x="${anchorX}" y="${layer.y}" text-anchor="${anchor}" fill="${escapeXml(layer.color ?? '#151513')}" font-family="${escapeXml(font.family)}" font-size="${fontSize}" font-weight="${fontWeight}" letter-spacing="${layer.letterSpacing ?? 0}px">
            ${tspans}
          </text>
        </g>
      `;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>${defs.join('\n')}</defs>
  <rect width="${width}" height="${height}" fill="${bgFill}" />
  ${patternOverlay}
  ${layerElements}
</svg>`;
}

export function exportDesignToSvg(
  doc: ExportableDesignDoc,
  resolveTokens?: (s: string) => string
): void {
  const svg = renderDocumentToSvgString(doc, resolveTokens);
  const safeName = fileSlug(doc.title);
  downloadTextFile(svg, `${safeName}.svg`, 'image/svg+xml;charset=utf-8');
}

export async function exportDesignToPng(
  doc: ExportableDesignDoc,
  resolveTokens?: (s: string) => string,
  scale = 1
): Promise<void> {
  const svgString = renderDocumentToSvgString(doc, resolveTokens);
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = await loadImage(url);

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(doc.width * scale);
    canvas.height = Math.round(doc.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, doc.width, doc.height);

    const pngBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png', 1.0)
    );
    if (pngBlob) {
      downloadBlob(pngBlob, `${fileSlug(doc.title)}.png`);
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function openPrintDocument(
  title: string,
  bodyHtml: string,
  landscape = false
): void {
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeXml(title)}</title>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Plus+Jakarta+Sans:wght@400;600;700&family=Space+Grotesk:wght@600;700&display=swap" rel="stylesheet" />
  <style>
    @page { size: ${landscape ? 'A4 landscape' : 'A4 portrait'}; margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
      color: #111111;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 12px;
      line-height: 1.45;
    }
    h1, h2, h3 { font-family: 'Space Grotesk', sans-serif; margin: 0 0 6px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border: 1px solid #d4d4d8; padding: 7px 9px; text-align: left; }
    th { background: #f4f4f5; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
    .mono { font-family: 'JetBrains Mono', monospace; }
    .header-bar { border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
    .badge { display: inline-block; padding: 2px 8px; border: 1px solid #111; border-radius: 99px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
  </style>
</head>
<body>
  ${bodyHtml}
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 250);
    };
  </script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=960,height=780');
  if (win) {
    win.document.open();
    win.document.write(html);
    win.document.close();
  } else {
    // Fallback download as printable HTML if popups are blocked
    downloadTextFile(html, `${fileSlug(title)}.html`, 'text/html;charset=utf-8');
  }
}
