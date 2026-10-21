/**
 * Brand + print logo helpers.
 *
 * - Every printed/downloaded output carries a small fest logo in its top-right
 *   corner (the uploaded fest logo when one exists, the Festize mark otherwise).
 * - `stampPngTopRight` composites that logo onto a rendered PNG so exports that
 *   are produced from a node (posters) get it too.
 */
import { LOGO_COLORS, LOGO_SHAPES } from "../FestizeLogo";

/** The Festize mark as a standalone SVG document, for images and PDFs. */
export function festizeLogoSvg(transparentTile = false): string {
  const tile = transparentTile
    ? ""
    : `<rect width="512" height="512" rx="76" fill="${LOGO_COLORS.tile}"/>`;
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">',
    tile,
    `<path d="${LOGO_SHAPES.mid}" fill="${LOGO_COLORS.deep}"/>`,
    `<path d="${LOGO_SHAPES.stem}" fill="${LOGO_COLORS.gold}"/>`,
    `<rect x="216" y="160" width="296" height="54" fill="${LOGO_COLORS.gold}"/>`,
    `<ellipse cx="156" cy="192" rx="28" ry="23" transform="rotate(-28 156 192)" fill="${LOGO_COLORS.olive}"/>`,
    `<path d="${LOGO_SHAPES.dot}" fill="${LOGO_COLORS.white}"/>`,
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
