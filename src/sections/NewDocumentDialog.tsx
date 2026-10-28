import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  X,
  Bookmark,
  Sparkles,
  Trophy,
} from "lucide-react";
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

/**
 * The live preview mirrors what the incoming result will look like on the new
 * canvas: an oversized result number, the category, the program name and a
 * footer mark. It is scaled to fit whatever width/height ratio is chosen.
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
      const availableWidth = stage.clientWidth - 48;
      const availableHeight = stage.clientHeight - 48;
      const ratio = Math.min(availableWidth / width, availableHeight / height);
      setScale(Math.max(0.05, ratio));
    };
    compute();
    const observer = new ResizeObserver(compute);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [width, height]);

  const displayWidth = Math.max(80, width * scale);
  const displayHeight = Math.max(80, height * scale);

  return (
    <div className="incoming-preview-stage" ref={stageRef}>
      <div
        className="incoming-canvas"
        style={{
          width: displayWidth,
          height: displayHeight,
          backgroundColor: backgroundColor === "transparent" ? "#e8e8e8" : backgroundColor,
          color: backgroundColor === "#000000" ? "#ffffff" : "#101010",
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
        <div className="incoming-foot">
          {templateType === "teamMark" ? "TEAM MARKS" : "RESULT"}
        </div>
      </div>
    </div>
  );
}

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
  const [docName, setDocName] = useState("Untitled-1");
  const [templateType, setTemplateType] = useState<"result" | "teamMark">("result");
  const [width, setWidth] = useState(1080);
  const [height, setHeight] = useState(1350);
  const [unit, setUnit] = useState<NewDocumentConfig["unit"]>("Pixels");
  const [orientation, setOrientation] = useState<"Portrait" | "Landscape">("Portrait");
  const [artboards, setArtboards] = useState(false);
  const [resolution, setResolution] = useState(300);
  const [resUnit, setResUnit] = useState<NewDocumentConfig["resolutionUnit"]>("Pixels/Inch");
  const [colorMode, setColorMode] = useState<NewDocumentConfig["colorMode"]>("RGB Color");
  const [bitDepth, setBitDepth] = useState<NewDocumentConfig["bitDepth"]>("8 bit");
  const [bgContent, setBgContent] = useState<NewDocumentConfig["backgroundContents"]>("White");
  const [customBgColor, setCustomBgColor] = useState("#ffffff");
  const [colorProfile, setColorProfile] = useState("sRGB IEC61966-2.1");
  const [pixelAspectRatio, setPixelAspectRatio] = useState("Square Pixels");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const toggleOrientation = (target: "Portrait" | "Landscape") => {
    if (orientation === target) return;
    const longest = Math.max(width, height);
    const shortest = Math.min(width, height);
    setWidth(target === "Portrait" ? shortest : longest);
    setHeight(target === "Portrait" ? longest : shortest);
    setOrientation(target);
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

  const handleCreate = () => {
    onCreate({
      name: docName.trim() || "Untitled-1",
      templateType,
      width: Number(width) || 1080,
      height: Number(height) || 1350,
      unit,
      orientation,
      resolution: Number(resolution) || 300,
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
    <div
      className="adobe-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="adobe-doc-window nd-window" role="dialog" aria-modal="true" aria-label="New Document">
        {/* Title bar */}
        <div className="adobe-window-titlebar">
          <span className="adobe-title">New Document</span>
          <button className="adobe-close-btn" onClick={onClose} aria-label="Close dialog">
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
              width={Number(width) || 1080}
              height={Number(height) || 1350}
              templateType={templateType}
              backgroundColor={resolvedBackground}
              sampleNumber="01"
              sampleCategory={(previewCategory || "General").toUpperCase()}
              sampleProgram={previewProgram?.name || "Qawali"}
            />

            <div className="nd-doc-footer">
              <div className="nd-doc-footer-row">
                <strong>{docName || "Untitled-1"}</strong>
                <span>
                  {width} × {height} {unit} · {resolution} {resUnit === "Pixels/Inch" ? "Pixels/Inch" : "Pixels/Centimeter"}
                </span>
              </div>
              <p>The incoming result will use this exact canvas after you click Create.</p>
            </div>
          </div>

          {/* ---- RIGHT: PRESET DETAILS ---- */}
          <div className="adobe-details-panel nd-details-panel">
            <div className="adobe-details-header">
              <h3>PRESET DETAILS</h3>
              <button className="adobe-save-preset-btn" title="Save Preset" type="button">
                <Bookmark size={16} />
              </button>
            </div>

            <div className="adobe-details-scroll">
              <div className="adobe-field-group">
                <input
                  type="text"
                  value={docName}
                  onChange={(event) => setDocName(event.target.value)}
                  className="adobe-input adobe-name-input"
                  placeholder="Untitled-1"
                  aria-label="Document name"
                />
              </div>

              <div className="adobe-field-group">
                <label className="adobe-field-label">TEMPLATE PURPOSE</label>
                <div className="adobe-mode-toggle">
                  <button
                    type="button"
                    className={`adobe-mode-btn ${templateType === "result" ? "active" : ""}`}
                    onClick={() => setTemplateType("result")}
                  >
                    <Sparkles size={13} />
                    <span>Score &amp; Result Poster</span>
                  </button>
                  <button
                    type="button"
                    className={`adobe-mode-btn ${templateType === "teamMark" ? "active" : ""}`}
                    onClick={() => setTemplateType("teamMark")}
                  >
                    <Trophy size={13} />
                    <span>Team Mark Poster</span>
                  </button>
                </div>
              </div>

              <div className="adobe-two-col">
                <div className="adobe-field-group">
                  <label className="adobe-field-label">Width</label>
                  <input
                    type="number"
                    value={width}
                    onChange={(event) => setWidth(Number(event.target.value) || 0)}
                    className="adobe-input"
                  />
                </div>
                <div className="adobe-field-group">
                  <label className="adobe-field-label">&nbsp;</label>
                  <select
                    value={unit}
                    onChange={(event) => setUnit(event.target.value as NewDocumentConfig["unit"])}
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

              <div className="adobe-two-col">
                <div className="adobe-field-group">
                  <label className="adobe-field-label">Height</label>
                  <input
                    type="number"
                    value={height}
                    onChange={(event) => setHeight(Number(event.target.value) || 0)}
                    className="adobe-input"
                  />
                </div>
                <div className="adobe-field-group">
                  <div className="adobe-orient-artboard-row">
                    <div>
                      <label className="adobe-field-label">Orientation</label>
                      <div className="adobe-orientation-buttons">
                        <button
                          type="button"
                          className={`adobe-orient-btn ${orientation === "Portrait" ? "active" : ""}`}
                          onClick={() => toggleOrientation("Portrait")}
                          title="Portrait"
                        >
                          <div className="orient-icon-portrait" />
                        </button>
                        <button
                          type="button"
                          className={`adobe-orient-btn ${orientation === "Landscape" ? "active" : ""}`}
                          onClick={() => toggleOrientation("Landscape")}
                          title="Landscape"
                        >
                          <div className="orient-icon-landscape" />
                        </button>
                      </div>
                    </div>
                    <div className="adobe-artboard-col">
                      <label className="adobe-field-label">Artboards</label>
                      <label className="adobe-checkbox-wrap">
                        <input
                          type="checkbox"
                          checked={artboards}
                          onChange={(event) => setArtboards(event.target.checked)}
                        />
                        <span className="adobe-custom-checkbox" />
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="adobe-two-col">
                <div className="adobe-field-group">
                  <label className="adobe-field-label">Resolution</label>
                  <input
                    type="number"
                    value={resolution}
                    onChange={(event) => setResolution(Number(event.target.value) || 0)}
                    className="adobe-input"
                  />
                </div>
                <div className="adobe-field-group">
                  <label className="adobe-field-label">&nbsp;</label>
                  <select
                    value={resUnit}
                    onChange={(event) =>
                      setResUnit(event.target.value as NewDocumentConfig["resolutionUnit"])
                    }
                    className="adobe-select"
                  >
                    <option value="Pixels/Inch">Pixels/Inch</option>
                    <option value="Pixels/Centimeter">Pixels/Centimeter</option>
                  </select>
                </div>
              </div>

              <div className="adobe-two-col">
                <div className="adobe-field-group">
                  <label className="adobe-field-label">Color Mode</label>
                  <select
                    value={colorMode}
                    onChange={(event) =>
                      setColorMode(event.target.value as NewDocumentConfig["colorMode"])
                    }
                    className="adobe-select"
                  >
                    <option value="RGB Color">RGB Color</option>
                    <option value="CMYK Color">CMYK Color</option>
                    <option value="Grayscale">Grayscale</option>
                  </select>
                </div>
                <div className="adobe-field-group">
                  <label className="adobe-field-label">&nbsp;</label>
                  <select
                    value={bitDepth}
                    onChange={(event) =>
                      setBitDepth(event.target.value as NewDocumentConfig["bitDepth"])
                    }
                    className="adobe-select"
                  >
                    <option value="8 bit">8 bit</option>
                    <option value="16 bit">16 bit</option>
                    <option value="32 bit">32 bit</option>
                  </select>
                </div>
              </div>

              <div className="adobe-field-group">
                <label className="adobe-field-label">Background Contents</label>
                <div className="adobe-bg-select-row">
                  <select
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
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="adobe-advanced-section">
                <button
                  type="button"
                  className="adobe-advanced-toggle"
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
                {showAdvanced && (
                  <div className="adobe-advanced-body">
                    <div className="adobe-field-group">
                      <label className="adobe-field-label">Color Profile</label>
                      <select
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
                      <label className="adobe-field-label">Pixel Aspect Ratio</label>
                      <select
                        value={pixelAspectRatio}
                        onChange={(event) => setPixelAspectRatio(event.target.value)}
                        className="adobe-select"
                      >
                        <option value="Square Pixels">Square Pixels</option>
                        <option value="DVCPRO HD">DVCPRO HD</option>
                        <option value="Anamorphic 2:1">Anamorphic 2:1</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="adobe-details-footer">
              <button className="adobe-create-btn" type="button" onClick={handleCreate}>
                Create
              </button>
              <button className="adobe-cancel-btn" type="button" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
