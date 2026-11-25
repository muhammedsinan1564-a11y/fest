/**
 * Brand + print logo helpers.
 *
 * - Every printed/downloaded output carries a small fest logo in its top-right
 *   corner (the uploaded fest logo when one exists, the Festize mark otherwise).
 * - `stampPngTopRight` composites that logo onto a rendered PNG so exports that
 *   are produced from a node (posters) get it too.
 */
import { festizeLogoBody } from "../FestizeLogo";
import { pickReadableText } from "./contrast";

/** The official Festize logo as a standalone SVG document, for images and PDFs. */
export function festizeLogoSvg(transparentTile = false): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" fill="none">',
    festizeLogoBody(!transparentTile),
    "</svg>",
  ].join("");
}

export const festizeLogoDataUrl = `data:image/svg+xml;base64,${btoa(festizeLogoSvg())}`;

/** The logo to print: the fest's own logo when uploaded, otherwise Festize. */
export function printLogoSrc(logo?: string | null): string {
  return logo && logo.startsWith("data:") ? logo : festizeLogoDataUrl;
}

/** Wait for one image to be decoded, then draw it onto a PNG at the top right. */
export async function stampPngTopRight(
  pngDataUrl: string,
  logoDataUrl: string,
  options: { ratio?: number; inset?: number; maxSide?: number } = {},
): Promise<string> {
  const { ratio = 0.075, inset = 0.035, maxSide = 96 } = options;
  const [image, logo] = await Promise.all([loadImage(pngDataUrl), loadImage(logoDataUrl)]);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) return pngDataUrl;
  context.drawImage(image, 0, 0);
  const base = Math.max(image.naturalWidth, image.naturalHeight) * ratio;
  const size = Math.min(maxSide, Math.max(18, base));
  const pad = Math.max(6, Math.min(image.naturalWidth, image.naturalHeight) * inset);
  // Keep the logo proportionate; a wide logo is centred in the square box.
  const scale = Math.min(size / logo.naturalWidth, size / logo.naturalHeight);
  const width = logo.naturalWidth * scale;
  const height = logo.naturalHeight * scale;
  const x = canvas.width - pad - width;
  const y = pad + (size - height) / 2;
  context.globalAlpha = 0.94;
  context.drawImage(logo, x, y, width, height);
  context.globalAlpha = 1;
  return canvas.toDataURL("image/png");
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image could not be loaded"));
    image.src = src;
  });
}

/* ------------------------------------------------------------------------ */
/* Festival Brand Kit — palette presets consumed by the Studio, Highlights,  */
/* Printouts and Setup modules.                                              */
/* ------------------------------------------------------------------------ */

export type EmblemStyle = "starburst" | "arch" | "diamond" | "crest" | "minimal";

export interface FestivalBrandKit {
  presetId: string;
  primaryColor: string;
  secondaryColor: string;
  canvasBg: string;
  inkColor: string;
  goldAccent: string;
  fontPairingId: string;
  emblemStyle: EmblemStyle;
  motto: string;
  hashtag: string;
  organizerLine: string;
}

export interface BrandPreset {
  id: string;
  name: string;
  description: string;
  kit: Omit<FestivalBrandKit, "motto" | "hashtag" | "organizerLine">;
}

export const BRAND_PRESETS: BrandPreset[] = [
  {
    id: "vermilion-gala",
    name: "Vermilion Gala",
    description: "Editorial ivory canvas with bold festival vermilion & royal indigo",
    kit: {
      presetId: "vermilion-gala",
      primaryColor: "#E5484D",
      secondaryColor: "#3730A3",
      canvasBg: "#FFFDF9",
      inkColor: "#161514",
      goldAccent: "#D97706",
      fontPairingId: "editorial-festival",
      emblemStyle: "starburst",
    },
  },
  {
    id: "electric-arena",
    name: "Electric Arena",
    description: "Deep stage obsidian with hyper-lime and cobalt spotlight accents",
    kit: {
      presetId: "electric-arena",
      primaryColor: "#A3E635",
      secondaryColor: "#38BDF8",
      canvasBg: "#0F1117",
      inkColor: "#F8FAFC",
      goldAccent: "#FACC15",
      fontPairingId: "kinetic-stage",
      emblemStyle: "diamond",
    },
  },
  {
    id: "biennale-cobalt",
    name: "Biennale Cobalt",
    description: "Architectural gallery blue paired with warm museum paper",
    kit: {
      presetId: "biennale-cobalt",
      primaryColor: "#1D4ED8",
      secondaryColor: "#EA580C",
      canvasBg: "#F5F3EE",
      inkColor: "#0F172A",
      goldAccent: "#B45309",
      fontPairingId: "swiss-broadcast",
      emblemStyle: "arch",
    },
  },
  {
    id: "saffron-heritage",
    name: "Saffron Heritage",
    description: "Rich marigold, deep crimson & parchment inspired by classical arts",
    kit: {
      presetId: "saffron-heritage",
      primaryColor: "#B91C1C",
      secondaryColor: "#D97706",
      canvasBg: "#FEF7EC",
      inkColor: "#27130C",
      goldAccent: "#CA8A04",
      fontPairingId: "editorial-festival",
      emblemStyle: "crest",
    },
  },
  {
    id: "swiss-monolith",
    name: "Swiss Monolith",
    description: "High-contrast brutalist poster black, stark white, and signal red",
    kit: {
      presetId: "swiss-monolith",
      primaryColor: "#FF2E2E",
      secondaryColor: "#111111",
      canvasBg: "#FFFFFF",
      inkColor: "#0A0A0A",
      goldAccent: "#EAB308",
      fontPairingId: "poster-headline",
      emblemStyle: "minimal",
    },
  },
];

export const DEFAULT_BRAND_KIT: FestivalBrandKit = {
  ...BRAND_PRESETS[0].kit,
  motto: "Where Rhythm, Craft & Stage Converge",
  hashtag: "#AureliaFest2026",
  organizerLine: "Directorate of Student Arts & Cultural Affairs",
};

export function getBrandReadableOnPrimary(brand: FestivalBrandKit): string {
  return pickReadableText(brand.primaryColor, "#FFFFFF", "#111111");
}
