import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { Bookmark, ChevronDown, Link2, Link2Off, Sparkles, Trophy, X } from "lucide-react";
import type { FestData } from "../types";

export interface NewDocumentConfig {
  name: string;
  templateType: "result" | "teamMark";
  width: number;
  height: number;
  unit: "Pixels" | "Inches" | "Centimeters" | "Millimeters" | "Points" | "Picas";
  orientation: "Portrait" | "Landscape";
  resolution: number;
  resolutionUnit: "Pixels/Inch" | "Pixels/Centimeter";
  colorMode: "RGB Color" | "CMYK Color" | "Grayscale";
  bitDepth: "8 bit" | "16 bit" | "32 bit";
  backgroundContents: "White" | "Black" | "Transparent" | "Custom";
  customBgColor: string;
  artboards: boolean;
  colorProfile: string;
  pixelAspectRatio: string;
}

type Unit = NewDocumentConfig["unit"];
type ResolutionUnit = NewDocumentConfig["resolutionUnit"];
type Orientation = NewDocumentConfig["orientation"];

/* ------------------------------------------------------------------ */
/* Unit maths — the canvas always ends up in real pixels               */
/* ------------------------------------------------------------------ */

/** How many of each unit make one inch (null = already pixels). */
const PER_INCH: Record<Unit, number | null> = {
  Pixels: null,
  Inches: 1,
  Centimeters: 2.54,
  Millimeters: 25.4,
  Points: 72,
  Picas: 6,
};

/** Largest side we allow; bigger canvases exhaust browser memory on export. */
export const MAX_CANVAS_PX = 10000;

/** Every size and resolution field bottoms out at this value. */
const MIN_VALUE = 1;

export function pixelsPerInch(resolution: number, resolutionUnit: ResolutionUnit) {
  const safe = Math.max(MIN_VALUE, resolution || 0);
  return resolutionUnit === "Pixels/Centimeter" ? safe * 2.54 : safe;
}

export function toPixels(value: number, unit: Unit, ppi: number) {
  const perInch = PER_INCH[unit];
  return perInch === null ? value : (value / perInch) * ppi;
}

export function fromPixels(pixels: number, unit: Unit, ppi: number) {
  const perInch = PER_INCH[unit];
  return perInch === null ? pixels : (pixels / ppi) * perInch;
}

/** Pixel size of a document config — what the poster canvas and PNG export use. */
export function documentPixels(
  config: Pick<NewDocumentConfig, "width" | "height" | "unit" | "resolution" | "resolutionUnit">
) {
  const ppi = pixelsPerInch(config.resolution, config.resolutionUnit);
  return {
    width: Math.max(MIN_VALUE, Math.round(toPixels(config.width, config.unit, ppi))),
    height: Math.max(MIN_VALUE, Math.round(toPixels(config.height, config.unit, ppi))),
  };
}

/** Pixels are whole numbers; physical units keep two decimals. */
function tidy(value: number, unit: Unit) {
  return unit === "Pixels" ? Math.round(value) : Math.round(value * 100) / 100;
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
}

/** Dark ink on light backgrounds, white ink on dark ones. */
function readableInk(background: string) {
  if (background === "transparent") return "#101010";
  const hex = background.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return "#101010";
  const [r, g, b] = [0, 2, 4].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55 ? "#101010" : "#ffffff";
}

/* ------------------------------------------------------------------ */
/* Numeric field that can never hold a value below its minimum         */
/* ------------------------------------------------------------------ */

/**
 * Typing stays free: the box can be cleared while you type a new number.
 * Anything below the minimum is raised to it with Math.max as it's typed, and an
 * empty box returns to the last good value when you leave it.
 */
function NumberField({
  id,
  value,
  onCommit,
  min = MIN_VALUE,
}: {
  id: string;
  value: number;
  onCommit: (next: number) => void;
  min?: number;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      id={id}
      type="number"
      inputMode="decimal"
      min={min}
      step="any"
      value={draft ?? formatNumber(value)}
      onFocus={() => setDraft(formatNumber(value))}
      onChange={(event) => {
        const raw = event.target.value;
        if (raw === "") {
          setDraft("");
          return;
        }
        const parsed = Number(raw);
        if (!Number.isFinite(parsed)) return;
        const clamped = Math.max(min, parsed);
        setDraft(clamped === parsed ? raw : String(clamped));
        onCommit(clamped);
      }}
      onBlur={() => {
        const parsed = Number(draft);
        if (draft && Number.isFinite(parsed)) onCommit(Math.max(min, parsed));
        setDraft(null);
      }}
      className="adobe-input"
    />
  );
}

/* ------------------------------------------------------------------ */
/* Saved default ("Save preset")                                       */
/* ------------------------------------------------------------------ */

const PRESET_KEY = "festize-newdoc-default";

type SavedPreset = Omit<NewDocumentConfig, "name" | "orientation">;

const FACTORY: SavedPreset = {
  templateType: "result",
  width: 1080,
  height: 1350,
  unit: "Pixels",
  resolution: 300,
  resolutionUnit: "Pixels/Inch",
  colorMode: "RGB Color",
  bitDepth: "8 bit",
  backgroundContents: "White",
  customBgColor: "#ffffff",
  artboards: false,
  colorProfile: "sRGB IEC61966-2.1",
  pixelAspectRatio: "Square Pixels",
};

function loadPreset(): SavedPreset {
  try {
    const raw = localStorage.getItem(PRESET_KEY);
    if (!raw) return FACTORY;
    const parsed = JSON.parse(raw) as Partial<SavedPreset>;
    return {
      ...FACTORY,
      ...parsed,
      unit: parsed.unit && parsed.unit in PER_INCH ? parsed.unit : FACTORY.unit,
      width: Math.max(MIN_VALUE, Number(parsed.width) || FACTORY.width),
      height: Math.max(MIN_VALUE, Number(parsed.height) || FACTORY.height),
      resolution: Math.max(MIN_VALUE, Number(parsed.resolution) || FACTORY.resolution),
    };
  } catch {
    return FACTORY;
  }
}

/* ------------------------------------------------------------------ */
/* Live preview                                                        */
/* ------------------------------------------------------------------ */

/**
 * The live preview mirrors what the incoming result will look like on the new
 * canvas. It is scaled to fit the stage while keeping the exact proportions.
 */
function IncomingResultPreview({
  width,
  height,
  templateType,
  backgroundColor,
  sampleNumber,
  sampleCategory,
  sampleProgram,
}: {
  width: number;
  height: number;
  templateType: "result" | "teamMark";
  backgroundColor: string;
  sampleNumber: string;
  sampleCategory: string;
  sampleProgram: string;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const compute = () => {
      const availableWidth = Math.max(40, stage.clientWidth - 48);
      const availableHeight = Math.max(40, stage.clientHeight - 48);
      setScale(Math.max(0.0005, Math.min(availableWidth / width, availableHeight / height)));
    };
    compute();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", compute);
      return () => window.removeEventListener("resize", compute);
    }
    const observer = new ResizeObserver(compute);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [width, height]);

  const displayWidth = Math.max(12, width * scale);
  const displayHeight = Math.max(12, height * scale);
  const transparent = backgroundColor === "transparent";

  return (
    <div className="incoming-preview-stage" ref={stageRef}>
      <motion.div
        className={`incoming-canvas ${transparent ? "is-transparent" : ""}`}
        animate={{ width: displayWidth, height: displayHeight }}
        transition={{ type: "spring", stiffness: 300, damping: 32 }}
        style={{
          backgroundColor: transparent ? undefined : backgroundColor,
          color: readableInk(backgroundColor),
        }}
      >
        <div className="incoming-number">{sampleNumber}</div>
        <div className="incoming-lower">
          <div className="incoming-category">{sampleCategory}</div>
          <div className="incoming-program">{sampleProgram}</div>
          <div className="incoming-label">
            {templateType === "teamMark" ? "Team standings" : "Incoming result"}
          </div>
        </div>
        <div className="incoming-foot">{templateType === "teamMark" ? "TEAM MARKS" : "RESULT"}</div>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dialog                                                              */
/* ------------------------------------------------------------------ */

export function NewDocumentDialog({
  onClose,
  onCreate,
  data,
}: {
  onClose: () => void;
  onCreate: (config: NewDocumentConfig) => void;
  /** Used so the live preview can show a real incoming program/category. */
  data?: FestData;
}) {
  const [initial] = useState(loadPreset);
  const [open, setOpen] = useState(true);
  const [docName, setDocName] = useState("Untitled-1");
  const [templateType, setTemplateType] = useState<"result" | "teamMark">(initial.templateType);
  const [width, setWidth] = useState(initial.width);
  const [height, setHeight] = useState(initial.height);
  const [orientation, setOrientation] = useState<Orientation>(
    initial.width > initial.height ? "Landscape" : "Portrait"
  );
  const [unit, setUnit] = useState<Unit>(initial.unit);
  const [locked, setLocked] = useState(false);
  /** width ÷ height, captured when the lock is switched on. */
  const [lockRatio, setLockRatio] = useState(initial.width / initial.height);
  const [artboards, setArtboards] = useState(initial.artboards);
  const [resolution, setResolution] = useState(initial.resolution);
  const [resUnit, setResUnit] = useState<ResolutionUnit>(initial.resolutionUnit);
  const [colorMode, setColorMode] = useState<NewDocumentConfig["colorMode"]>(initial.colorMode);
  const [bitDepth, setBitDepth] = useState<NewDocumentConfig["bitDepth"]>(initial.bitDepth);
  const [bgContent, setBgContent] = useState<NewDocumentConfig["backgroundContents"]>(initial.backgroundContents);
  const [customBgColor, setCustomBgColor] = useState(initial.customBgColor);
  const [colorProfile, setColorProfile] = useState(initial.colorProfile);
  const [pixelAspectRatio, setPixelAspectRatio] = useState(initial.pixelAspectRatio);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [presetSaved, setPresetSaved] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;

  const ppi = pixelsPerInch(resolution, resUnit);
  const pixels = documentPixels({ width, height, unit, resolution, resolutionUnit: resUnit });
  const tooLarge = pixels.width > MAX_CANVAS_PX || pixels.height > MAX_CANVAS_PX;

  // Escape closes, the name is selected, and the page behind stays still.
  useEffect(() => {
    nameRef.current?.select();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  /* ---- Orientation ---- */

  const syncOrientation = (w: number, h: number) => {
    if (w > h) setOrientation("Landscape");
    else if (w < h) setOrientation("Portrait");
  };

  const toggleOrientation = (target: Orientation) => {
    if (orientation === target) return;
    const longest = Math.max(width, height);
    const shortest = Math.min(width, height);
    const nextWidth = target === "Portrait" ? shortest : longest;
    const nextHeight = target === "Portrait" ? longest : shortest;
    setWidth(nextWidth);
    setHeight(nextHeight);
    setLockRatio(nextWidth / nextHeight);
    setOrientation(target);
  };

  /* ---- Aspect ratio lock ---- */

  const toggleLock = () => {
    setLockRatio(width / height);
    setLocked((value) => !value);
  };

  /**
   * Width edits. When the ratio is locked the height follows; if the follower
   * would drop below the minimum, the ratio is re-captured so nothing jumps.
   */
  const applyWidth = (next: number) => {
    const w = Math.max(MIN_VALUE, next);
    setWidth(w);
    if (!locked) {
      syncOrientation(w, height);
      return;
    }
    const exact = w / lockRatio;
    const h = Math.max(MIN_VALUE, tidy(exact, unit));
    setHeight(h);
    if (exact < MIN_VALUE) setLockRatio(w / MIN_VALUE);
    syncOrientation(w, h);
  };

  const applyHeight = (next: number) => {
    const h = Math.max(MIN_VALUE, next);
    setHeight(h);
    if (!locked) {
      syncOrientation(width, h);
      return;
    }
    const exact = h * lockRatio;
    const w = Math.max(MIN_VALUE, tidy(exact, unit));
    setWidth(w);
    if (exact < MIN_VALUE) setLockRatio(MIN_VALUE / h);
    syncOrientation(w, h);
  };

  /** Changing the unit converts the numbers, so the physical size stays the same. */
  const changeUnit = (next: Unit) => {
    if (next === unit) return;
    setWidth(Math.max(MIN_VALUE, tidy(fromPixels(toPixels(width, unit, ppi), next, ppi), next)));
    setHeight(Math.max(MIN_VALUE, tidy(fromPixels(toPixels(height, unit, ppi), next, ppi), next)));
    setUnit(next);
  };

  const previewProgram = data?.programs.find((program) => program.status === 5) || data?.programs[0];
  const previewCategory = previewProgram
    ? data?.categories.find((category) => category.id === previewProgram.categoryId)?.name
    : undefined;

  const resolvedBackground =
    bgContent === "White"
      ? "#ffffff"
      : bgContent === "Black"
      ? "#000000"
      : bgContent === "Transparent"
      ? "transparent"
      : customBgColor;

  const savePreset = () => {
    const preset: SavedPreset = {
      templateType,
      width,
      height,
      unit,
      resolution,
      resolutionUnit: resUnit,
      colorMode,
      bitDepth,
      backgroundContents: bgContent,
      customBgColor,
      artboards,
      colorProfile,
      pixelAspectRatio,
    };
    try {
      localStorage.setItem(PRESET_KEY, JSON.stringify(preset));
      setPresetSaved(true);
      window.setTimeout(() => setPresetSaved(false), 1800);
    } catch {
      /* storage unavailable */
    }
  };

  const handleCreate = () => {
    if (tooLarge) return;
    onCreate({
      name: docName.trim() || "Untitled-1",
      templateType,
      width,
      height,
      unit,
      orientation,
      resolution,
      resolutionUnit: resUnit,
      colorMode,
      bitDepth,
      backgroundContents: bgContent,
      customBgColor,
      artboards,
      colorProfile,
      pixelAspectRatio,
    });
  };

  return (
    <MotionConfig reducedMotion="user">
      {/* The parent unmounts this component once the exit animation has finished. */}
      <AnimatePresence onExitComplete={onClose}>
        {open && (
          <motion.div
            key="nd-backdrop"
            className="adobe-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setOpen(false);
            }}
          >
            <motion.div
              key="nd-window"
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
              className="adobe-doc-window nd-window"
              role="dialog"
              aria-modal="true"
              aria-labelledby={id("title")}
            >
              {/* Title bar */}
              <div className="adobe-window-titlebar">
                <span className="adobe-title" id={id("title")}>New Document</span>
                <button type="button" className="adobe-close-btn" onClick={() => setOpen(false)} aria-label="Close dialog">
                  <X size={18} />
                </button>
              </div>

              <div className="adobe-window-body nd-window-body">
                {/* ---- LEFT: LIVE INCOMING RESULT PREVIEW ---- */}
                <div className="nd-preview-column">
                  <div className="nd-preview-header">
                    <div>
                      <span className="nd-preview-kicker">LIVE INCOMING RESULT PREVIEW</span>
                      <p>Everything on this preview changes as you adjust the document setup.</p>
                    </div>
                    <span className="nd-live-pill">
                      <i /> LIVE
                    </span>
                  </div>

                  <IncomingResultPreview
                    width={pixels.width}
                    height={pixels.height}
                    templateType={templateType}
                    backgroundColor={resolvedBackground}
                    sampleNumber="01"
                    sampleCategory={(previewCategory || "General").toUpperCase()}
                    sampleProgram={previewProgram?.name || "Qawali"}
                  />

                  <div className="nd-doc-footer">
                    <div className="nd-doc-footer-row">
                      <strong>{docName.trim() || "Untitled-1"}</strong>
                      <span>
                        {width} × {height} {unit}
                        {unit !== "Pixels" && ` · ${pixels.width} × ${pixels.height} px`} · {resolution} {resUnit}
                      </span>
                    </div>
                    {tooLarge ? (
                      <p className="nd-warn" role="alert">
                        That is {pixels.width} × {pixels.height} px. Keep each side under {MAX_CANVAS_PX.toLocaleString()} px — lower the size or resolution.
                      </p>
                    ) : (
                      <p>
                        The incoming result will use this exact canvas after you click Create.
                        {locked && <span className="nd-ratio-note"> Ratio locked.</span>}
                      </p>
                    )}
                  </div>
                </div>

                {/* ---- RIGHT: PRESET DETAILS ---- */}
                <div className="adobe-details-panel nd-details-panel">
                  <div className="adobe-details-header">
                    <h3>PRESET DETAILS</h3>
                    <button
                      className={`adobe-save-preset-btn ${presetSaved ? "saved" : ""}`}
                      title={presetSaved ? "Saved as your default" : "Save these settings as your default"}
                      aria-label="Save these settings as your default"
                      type="button"
                      onClick={savePreset}
                    >
                      <Bookmark size={16} fill={presetSaved ? "currentColor" : "none"} />
                    </button>
                  </div>

                  <div className="adobe-details-scroll">
                    <div className="adobe-field-group">
                      <input
                        ref={nameRef}
                        type="text"
                        value={docName}
                        onChange={(event) => setDocName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") handleCreate();
                        }}
                        className="adobe-input adobe-name-input"
                        placeholder="Untitled-1"
                        aria-label="Document name"
                      />
                    </div>

                    <div className="adobe-field-group">
                      <span className="adobe-field-label">TEMPLATE PURPOSE</span>
                      <div className="adobe-mode-toggle" role="group" aria-label="Template purpose">
                        <button
                          type="button"
                          aria-pressed={templateType === "result"}
                          className={`adobe-mode-btn ${templateType === "result" ? "active" : ""}`}
                          onClick={() => setTemplateType("result")}
                        >
                          <Sparkles size={13} />
                          <span>Score &amp; Result Poster</span>
                        </button>
                        <button
                          type="button"
                          aria-pressed={templateType === "teamMark"}
                          className={`adobe-mode-btn ${templateType === "teamMark" ? "active" : ""}`}
                          onClick={() => setTemplateType("teamMark")}
                        >
                          <Trophy size={13} />
                          <span>Team Mark Poster</span>
                        </button>
                      </div>
                    </div>

                    {/* Width · aspect lock · height */}
                    <div className="nd-dimensions">
                      <div className="adobe-two-col">
                        <div className="adobe-field-group">
                          <label className="adobe-field-label" htmlFor={id("width")}>Width</label>
                          <NumberField id={id("width")} value={width} onCommit={applyWidth} />
                        </div>
                        <div className="adobe-field-group">
                          <label className="adobe-field-label" htmlFor={id("unit")}>Unit</label>
                          <select
                            id={id("unit")}
                            value={unit}
                            onChange={(event) => changeUnit(event.target.value as Unit)}
                            className="adobe-select"
                          >
                            <option value="Pixels">Pixels</option>
                            <option value="Inches">Inches</option>
                            <option value="Centimeters">Centimeters</option>
                            <option value="Millimeters">Millimeters</option>
                            <option value="Points">Points</option>
                            <option value="Picas">Picas</option>
                          </select>
                        </div>
                      </div>

                      <div className="nd-link-row">
                        <span className="nd-link-line" aria-hidden="true" />
                        <motion.button
                          type="button"
                          className={`nd-lock ${locked ? "on" : ""}`}
                          aria-pressed={locked}
                          aria-label={locked ? "Aspect ratio locked. Click to unlock" : "Aspect ratio unlocked. Click to lock"}
                          title={locked ? "Unlock aspect ratio" : "Lock aspect ratio"}
                          whileTap={{ scale: 0.88 }}
                          onClick={toggleLock}
                        >
                          <AnimatePresence mode="wait" initial={false}>
                            <motion.span
                              key={locked ? "on" : "off"}
                              className="nd-lock-icon"
                              initial={{ opacity: 0, rotate: -40, scale: 0.6 }}
                              animate={{ opacity: 1, rotate: 0, scale: 1 }}
                              exit={{ opacity: 0, rotate: 40, scale: 0.6 }}
                              transition={{ duration: 0.16 }}
                            >
                              {locked ? <Link2 size={15} /> : <Link2Off size={15} />}
                            </motion.span>
                          </AnimatePresence>
                        </motion.button>
                        <span className="nd-link-line" aria-hidden="true" />
                      </div>

                      <div className="adobe-two-col">
                        <div className="adobe-field-group">
                          <label className="adobe-field-label" htmlFor={id("height")}>Height</label>
                          <NumberField id={id("height")} value={height} onCommit={applyHeight} />
                        </div>
                        <div className="adobe-field-group">
                          <div className="adobe-orient-artboard-row">
                            <div>
                              <span className="adobe-field-label">Orientation</span>
                              <div className="adobe-orientation-buttons" role="group" aria-label="Orientation">
                                <button
                                  type="button"
                                  aria-pressed={orientation === "Portrait"}
                                  className={`adobe-orient-btn ${orientation === "Portrait" ? "active" : ""}`}
                                  onClick={() => toggleOrientation("Portrait")}
                                  title="Portrait"
                                  aria-label="Portrait"
                                >
                                  <div className="orient-icon-portrait" />
                                </button>
                                <button
                                  type="button"
                                  aria-pressed={orientation === "Landscape"}
                                  className={`adobe-orient-btn ${orientation === "Landscape" ? "active" : ""}`}
                                  onClick={() => toggleOrientation("Landscape")}
                                  title="Landscape"
                                  aria-label="Landscape"
                                >
                                  <div className="orient-icon-landscape" />
                                </button>
                              </div>
                            </div>
                            <div className="adobe-artboard-col">
                              <span className="adobe-field-label">Artboards</span>
                              <label className="adobe-checkbox-wrap">
                                <input
                                  type="checkbox"
                                  checked={artboards}
                                  onChange={(event) => setArtboards(event.target.checked)}
                                  aria-label="Artboards"
                                />
                                <span className="adobe-custom-checkbox" />
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="adobe-two-col">
                      <div className="adobe-field-group">
                        <label className="adobe-field-label" htmlFor={id("resolution")}>Resolution</label>
                        <NumberField id={id("resolution")} value={resolution} onCommit={setResolution} />
                      </div>
                      <div className="adobe-field-group">
                        <label className="adobe-field-label" htmlFor={id("resunit")}>Per</label>
                        <select
                          id={id("resunit")}
                          value={resUnit}
                          onChange={(event) => setResUnit(event.target.value as ResolutionUnit)}
                          className="adobe-select"
                        >
                          <option value="Pixels/Inch">Pixels/Inch</option>
                          <option value="Pixels/Centimeter">Pixels/Centimeter</option>
                        </select>
                      </div>
                    </div>

                    <div className="adobe-two-col">
                      <div className="adobe-field-group">
                        <label className="adobe-field-label" htmlFor={id("colormode")}>Color Mode</label>
                        <select
                          id={id("colormode")}
                          value={colorMode}
                          onChange={(event) => setColorMode(event.target.value as NewDocumentConfig["colorMode"])}
                          className="adobe-select"
                        >
                          <option value="RGB Color">RGB Color</option>
                          <option value="CMYK Color">CMYK Color</option>
                          <option value="Grayscale">Grayscale</option>
                        </select>
                      </div>
                      <div className="adobe-field-group">
                        <label className="adobe-field-label" htmlFor={id("bitdepth")}>Bit depth</label>
                        <select
                          id={id("bitdepth")}
                          value={bitDepth}
                          onChange={(event) => setBitDepth(event.target.value as NewDocumentConfig["bitDepth"])}
                          className="adobe-select"
                        >
                          <option value="8 bit">8 bit</option>
                          <option value="16 bit">16 bit</option>
                          <option value="32 bit">32 bit</option>
                        </select>
                      </div>
                    </div>

                    <div className="adobe-field-group">
                      <label className="adobe-field-label" htmlFor={id("bg")}>Background Contents</label>
                      <div className="adobe-bg-select-row">
                        <select
                          id={id("bg")}
                          value={bgContent}
                          onChange={(event) => setBgContent(event.target.value as NewDocumentConfig["backgroundContents"])}
                          className="adobe-select"
                        >
                          <option value="White">White</option>
                          <option value="Black">Black</option>
                          <option value="Transparent">Transparent</option>
                          <option value="Custom">Custom</option>
                        </select>
                        <div
                          className="adobe-bg-color-swatch"
                          style={{ backgroundColor: bgContent === "Transparent" ? "transparent" : resolvedBackground }}
                        >
                          {bgContent === "Transparent" && <div className="adobe-checkerboard" />}
                          {bgContent === "Custom" && (
                            <input
                              type="color"
                              value={customBgColor}
                              onChange={(event) => setCustomBgColor(event.target.value)}
                              className="adobe-color-picker-input"
                              aria-label="Custom background colour"
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="adobe-advanced-section">
                      <button
                        type="button"
                        className="adobe-advanced-toggle"
                        aria-expanded={showAdvanced}
                        onClick={() => setShowAdvanced(!showAdvanced)}
                      >
                        <ChevronDown
                          size={14}
                          style={{
                            transform: showAdvanced ? "rotate(0deg)" : "rotate(-90deg)",
                            transition: "transform 0.2s",
                          }}
                        />
                        <span>Advanced Options</span>
                      </button>
                      <AnimatePresence initial={false}>
                        {showAdvanced && (
                          <motion.div
                            key="advanced"
                            className="adobe-advanced-body"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <div className="adobe-field-group">
                              <label className="adobe-field-label" htmlFor={id("profile")}>Color Profile</label>
                              <select
                                id={id("profile")}
                                value={colorProfile}
                                onChange={(event) => setColorProfile(event.target.value)}
                                className="adobe-select"
                              >
                                <option value="sRGB IEC61966-2.1">sRGB IEC61966-2.1</option>
                                <option value="Adobe RGB (1998)">Adobe RGB (1998)</option>
                                <option value="Display P3">Display P3</option>
                              </select>
                            </div>
                            <div className="adobe-field-group">
                              <label className="adobe-field-label" htmlFor={id("par")}>Pixel Aspect Ratio</label>
                              <select
                                id={id("par")}
                                value={pixelAspectRatio}
                                onChange={(event) => setPixelAspectRatio(event.target.value)}
                                className="adobe-select"
                              >
                                <option value="Square Pixels">Square Pixels</option>
                                <option value="DVCPRO HD">DVCPRO HD</option>
                                <option value="Anamorphic 2:1">Anamorphic 2:1</option>
                              </select>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  <div className="adobe-details-footer">
                    <button className="adobe-create-btn" type="button" onClick={handleCreate} disabled={tooLarge}>
                      Create
                    </button>
                    <button className="adobe-cancel-btn" type="button" onClick={() => setOpen(false)}>
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
