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
    return { ...element, color: light ? "#16161c" : "#ffffff" };
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
