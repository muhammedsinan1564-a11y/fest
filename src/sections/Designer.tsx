import React, { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  ImagePlus,
  MoreHorizontal,
  Plus,
  Redo2,
  Save,
  Trash2,
  Undo2,
  Upload,
  Wand2,
  ZoomIn,
  ZoomOut,
  Sparkles,
  ChevronDown,
  Shapes,
  Trophy,
} from "lucide-react";
import {
  AddButton,
  askToDownload,
  Button,
  DownloadPreview,
  Empty,
  Field,
  IconButton,
  Modal,
  PageHead,
  RowActions,
} from "../ui";
import { buildFontEmbedCSS, fileSlug, renderNodePng, stampPdfPage } from "../lib/exporter";
import { loadImage, printLogoSrc } from "../lib/brand";
import {
  entryGrade,
  getCategoryName,
  getTeamName,
  id,
  type CardDesign,
  type DesignElement,
  type ElementKind,
  type FestData,
  type Member,
  type PosterTemplate,
  type Program,
  type ShapeType } from "../types";
import { ALL_FONTS, fontStack, loadFonts } from "../lib/fonts";
import { backgroundIsLight, fitTextColors } from "../lib/contrast";
import { confirmDelete, rankedEntries, readImage, teamPoints, type SectionProps } from "./common";
import { NewDocumentDialog, type NewDocumentConfig } from "./NewDocumentDialog";
import { SHAPES_LIBRARY, renderSvgShape } from "../lib/shapes";

/** Reference widths the stored fontSize values are authored against. */
export const CARD_BASE = 300;
export const POSTER_BASE = 340;

const LABELS: Record<ElementKind, string> = {
  text: "Custom text",
  image: "Image / logo",
  name: "Name",
  team: "Team",
  category: "Category",
  number: "Result number",
  photo: "Member photo",
  qr: "QR code",
  winner: "1st Place Winner",
  winnerGrade: "1st Place Grade",
  winnerPoints: "1st Place Points",
  runner: "2nd Place Runner",
  runnerGrade: "2nd Place Grade",
  runnerPoints: "2nd Place Points",
  secondRunner: "3rd Place Runner",
  secondRunnerGrade: "3rd Place Grade",
  secondRunnerPoints: "3rd Place Points",
  placeName: "Place Name",
  placeGrade: "Place Grade",
  placePoints: "Place Points",
  teamMarkName: "Team Name",
  teamMarkPoints: "Team Total Points",
  teamRankName: "Rank Team Name",
  teamRankPoints: "Rank Team Points",
  program: "Program name",
  festival: "Fest name",
  mark: "Points",
  shape: "Vector Shape",
};

export const PAPERS: Record<string, { width: number; height: number }> = {
  "A4 portrait": { width: 210, height: 297 },
  "A4 landscape": { width: 297, height: 210 },
  "A3 portrait": { width: 297, height: 420 },
  "A3 landscape": { width: 420, height: 297 },
  "A5 portrait": { width: 148, height: 210 },
  "Letter portrait": { width: 216, height: 279 },
  "Letter landscape": { width: 279, height: 216 },
  "Legal portrait": { width: 216, height: 356 },
};
export const CARD_PRESETS = [
  { label: "Event badge · 75 × 105 mm", width: 75, height: 105 },
  { label: "Standard ID · 54 × 86 mm", width: 54, height: 86 },
  { label: "Wide badge · 90 × 60 mm", width: 90, height: 60 },
  { label: "Lanyard card · 70 × 100 mm", width: 70, height: 100 },
  { label: "Compact · 60 × 90 mm", width: 60, height: 90 },
];

/** Largest size with the same proportions that still fits inside the given box. */
export function fitBox(width: number, height: number, maxWidth: number, maxHeight: number) {
  const ratio = Math.min(maxWidth / width, maxHeight / height);
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

export const FIXED_SQUARE_MM = 30;
const squareKinds: ElementKind[] = ["photo", "qr"];
export function squareSize(card: { width: number; height: number }) {
  return {
    width: Math.min(100, (FIXED_SQUARE_MM / card.width) * 100),
    height: Math.min(100, (FIXED_SQUARE_MM / card.height) * 100),
  };
}
export function memberLink(festCode: string, member?: Member) {
  if (!member) return "https://festize.app";
  const base =
    typeof window === "undefined"
      ? "https://festize.app/"
      : `${window.location.origin}${window.location.pathname}`;
  return `${base}?fest=${encodeURIComponent(festCode)}&u=${encodeURIComponent(
    member.name
  )}&c=${encodeURIComponent(member.code)}`;
}

function createElement(
  kind: ElementKind,
  length: number,
  image?: string,
  card?: { width: number; height: number },
  color = "#26202b",
  extra: Partial<DesignElement> = {}
): DesignElement {
  const visual = kind === "image" || squareKinds.includes(kind) || kind === "shape";
  const square = squareKinds.includes(kind) && card ? squareSize(card) : null;
  return {
    id: id(),
    kind,
    x: 10,
    y: Math.min(82, 15 + length * 9),
    width: square?.width ?? (kind === "shape" ? 22 : visual ? 24 : 78),
    height: square?.height ?? (kind === "shape" ? 22 : visual ? 22 : 10),
    fontSize: kind === "name" || kind === "winner" ? 23 : 16,
    fontFamily: "DM Sans",
    color,
    align: "left",
    shape: "square",
    zoom: 1,
    text: kind === "text" ? "Your text" : undefined,
    image,
    ...extra,
  };
}

function resolveText(
  element: DesignElement,
  data: FestData,
  festName: string,
  member?: Member,
  program?: Program,
  memberNumber?: number
): string {
  const entries = program ? rankedEntries(program, data) : [];
  const candidateAt = (index: number) => {
    const entry = entries[index];
    if (!entry) return null;
    const name = data.members.find((item) => item.id === entry.memberIds[0])?.name || "Candidate";
    const team = getTeamName(data, entry.teamId);
    const grade = entryGrade(entry, program!, data);
    return {
      name:
        program!.format === "Group"
          ? `${name} + ${Math.max(entry.memberIds.length - 1, 0)} / ${team}`
          : `${name} · ${team}`,
      gradeName: grade?.name || "—",
      gradePoints: grade?.points != null ? `${grade.points} pts` : "No grade",
    };
  };

  const sortedTeams = [...data.teams].sort(
    (a, b) => teamPoints(b.id, data, false) - teamPoints(a.id, data, false)
  );

  switch (element.kind) {
    case "text":
      return element.text || "Your text";
    case "name":
      return member?.name || "Participant Name";
    case "team":
      return member ? getTeamName(data, member.teamId) : "Team Name";
    case "category":
      return member
        ? getCategoryName(data, member.categoryId)
        : program
        ? getCategoryName(data, program.categoryId)
        : "Category";
    case "number":
      return program ? `${program.resultNumber || ""}` : String(memberNumber || 1).padStart(3, "0");
    case "festival":
      return festName;
    case "program":
      return program?.name || "Program name";

    // 1st place
    case "winner":
      return candidateAt(0)?.name || "1st Place Winner";
    case "winnerGrade":
      return candidateAt(0)?.gradeName || "A+";
    case "mark":
    case "winnerPoints":
      return candidateAt(0)?.gradePoints || "10 pts";

    // 2nd place
    case "runner":
      return candidateAt(1)?.name || "2nd Place Runner";
    case "runnerGrade":
      return candidateAt(1)?.gradeName || "A";
    case "runnerPoints":
      return candidateAt(1)?.gradePoints || "9 pts";

    // 3rd place
    case "secondRunner":
      return candidateAt(2)?.name || "3rd Place Runner";
    case "secondRunnerGrade":
      return candidateAt(2)?.gradeName || "B";
    case "secondRunnerPoints":
      return candidateAt(2)?.gradePoints || "8 pts";

    // 4th to 10th places
    case "placeName": {
      const p = element.place || 4;
      return candidateAt(p - 1)?.name || `${p}th Place Candidate`;
    }
    case "placeGrade": {
      const p = element.place || 4;
      return candidateAt(p - 1)?.gradeName || "Grade";
    }
    case "placePoints": {
      const p = element.place || 4;
      return candidateAt(p - 1)?.gradePoints || "Points";
    }

    // Team Mark mode
    case "teamMarkName": {
      if (element.teamId) return getTeamName(data, element.teamId);
      const rank = element.teamRank || 1;
      return sortedTeams[rank - 1]?.name || `Rank ${rank} Team`;
    }
    case "teamMarkPoints": {
      if (element.teamId) return `${teamPoints(element.teamId, data, false)} pts`;
      const rank = element.teamRank || 1;
      const targetTeam = sortedTeams[rank - 1];
      return targetTeam ? `${teamPoints(targetTeam.id, data, false)} pts` : "0 pts";
    }
    case "teamRankName": {
      const rank = element.teamRank || 1;
      return sortedTeams[rank - 1]?.name || `Rank ${rank} Team`;
    }
    case "teamRankPoints": {
      const rank = element.teamRank || 1;
      const targetTeam = sortedTeams[rank - 1];
      return targetTeam ? `${teamPoints(targetTeam.id, data, false)} pts` : "0 pts";
    }

    default:
      return "";
  }
}

export function DesignCanvas({
  elements,
  background,
  backgroundColor,
  data,
  festName,
  festCode = "",
  member,
  program,
  memberNumber,
  width,
  height,
  surface = "card",
  editable = false,
  selectedId,
  onSelect,
  onMove,
  onDragStart,
  onImageZoom,
  canvasRef,
}: {
  elements: DesignElement[];
  background?: string;
  backgroundColor?: string;
  data: FestData;
  festName: string;
  festCode?: string;
  member?: Member;
  program?: Program;
  memberNumber?: number;
  width: number;
  height: number;
  surface?: "card" | "poster";
  editable?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onMove?: (id: string, x: number, y: number) => void;
  onDragStart?: () => void;
  onImageZoom?: (id: string, value: number) => void;
  canvasRef?: RefObject<HTMLDivElement | null>;
}) {
  const internalRef = useRef<HTMLDivElement>(null);
  const ref = canvasRef || internalRef;
  const [qrImage, setQrImage] = useState("");
  const isPoster = surface === "poster";
  // Everything scales from one reference width, so the editor, preview and export match exactly.
  const scale = width / (isPoster ? POSTER_BASE : CARD_BASE);
  const qrTarget = member ? memberLink(festCode, member) : "";
  useEffect(() => {
    if (!qrTarget) {
      setQrImage("");
      return;
    }
    let active = true;
    void QRCode.toDataURL(qrTarget, {
      margin: 1,
      width: 420,
      errorCorrectionLevel: "M",
      color: { dark: "#1d1d26", light: "#ffffff" },
    }).then((url) => {
      if (active) setQrImage(url);
    });
    return () => {
      active = false;
    };
  }, [qrTarget]);
  useEffect(() => {
    loadFonts(elements.map((element) => element.fontFamily));
  }, [elements]);
  const beginDrag = (event: React.PointerEvent<HTMLDivElement>, element: DesignElement) => {
    if (!editable || !onMove || !ref.current || element.locked) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect?.(element.id);
    onDragStart?.();
    const rect = ref.current.getBoundingClientRect();
    const originX = event.clientX;
    const originY = event.clientY;
    const startX = element.x;
    const startY = element.y;
    const move = (next: PointerEvent) =>
      onMove(
        element.id,
        Math.max(0, Math.min(95, startX + ((next.clientX - originX) / rect.width) * 100)),
        Math.max(0, Math.min(95, startY + ((next.clientY - originY) / rect.height) * 100))
      );
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end, { once: true });
  };
  return (
    <div
      ref={ref}
      className={`design-canvas ${editable ? "editable" : ""}`}
      style={{
        width,
        height,
        backgroundImage: background
          ? `url(${background})`
          : backgroundColor === "transparent"
          ? "repeating-conic-gradient(#d8d8d8 0% 25%, #f7f7f7 0% 50%)"
          : undefined,
        backgroundSize: background ? undefined : backgroundColor === "transparent" ? "18px 18px" : undefined,
        backgroundColor: background ? "#fff" : backgroundColor && backgroundColor !== "transparent" ? backgroundColor : isPoster ? "#34243d" : "#f2e8df",
      }}
      onClick={() => editable && onSelect?.("")}
    >
      {!background && !isPoster && (
        <div className="card-placeholder-art">
          <span>FESTIZE</span>
          <span>PARTICIPANT</span>
        </div>
      )}
      {elements.map((element, elementIndex) => {
        if (element.hidden) return null;
        const image =
          element.kind === "photo" ? member?.photo : element.kind === "qr" ? qrImage : element.image;
        const visual = element.kind === "image" || element.kind === "photo" || element.kind === "qr";
        const isShape = element.kind === "shape";
        const isText = !visual && !isShape;
        const rawText = isText ? resolveText(element, data, festName, member, program, memberNumber) : "";
        const displayText = isText ? `${element.prefix || ""}${rawText}${element.suffix || ""}` : "";
        const fitMode = element.fitMode ?? "Width";
        const effectiveWidth = Math.max(1, element.insideWidth && element.insideWidth > 0 ? element.insideWidth : element.width);
        let fontSizePx = element.fontSize * scale;
        const minimumFontSize = element.minFontSize ?? (isPoster ? 32 : 0);
        if (isText && minimumFontSize > 0 && displayText.length) {
          const availableWidth = (effectiveWidth / 100) * width;
          const approximateWidth = fontSizePx * 0.56 * displayText.length;
          if (availableWidth > 0 && approximateWidth > availableWidth) {
            fontSizePx = Math.max(
              minimumFontSize * scale,
              availableWidth / Math.max(1, displayText.length * 0.56)
            );
          }
        }
        const hasShadow = Boolean(
          element.shadowColor || (element.shadowBlur ?? 0) !== 0 || (element.shadowX ?? 0) !== 0 || (element.shadowY ?? 0) !== 0
        );
        const shadow = hasShadow
          ? `${(element.shadowX ?? 0) * scale}px ${(element.shadowY ?? 0) * scale}px ${(element.shadowBlur ?? 0) * scale}px ${element.shadowColor || "#000000"}`
          : undefined;
        const style: CSSProperties = {
          left: `${element.x}%`,
          top: `${element.y}%`,
          width: visual || isShape || fitMode === "Width" ? `${effectiveWidth}%` : "max-content",
          maxWidth: `${effectiveWidth}%`,
          height: `${Math.max(1, element.height)}%`,
          minHeight: isText && element.minLines ? `${element.minLines * fontSizePx * (element.lineHeight ?? 1.2)}px` : undefined,
          overflow: isText ? "hidden" : undefined,
          display: isText ? "flex" : undefined,
          flexDirection: isText ? "column" : undefined,
          justifyContent: isText
            ? element.verticalAlign === "Middle"
              ? "center"
              : element.verticalAlign === "Bottom"
              ? "flex-end"
              : "flex-start"
            : undefined,
          fontSize: `${fontSizePx}px`,
          fontFamily: fontStack(element.fontFamily),
          fontWeight: element.fontWeight ?? (element.fontStyle === "Bold" || element.fontStyle === "Bold Italic" ? 700 : isPoster ? 700 : 400),
          fontStyle: element.fontStyle === "Italic" || element.fontStyle === "Bold Italic" ? "italic" : "normal",
          lineHeight: element.lineHeight ?? 1.22,
          letterSpacing: `${(element.letterSpacing ?? 0) * scale}px`,
          textTransform:
            element.textTransform === "Title case"
              ? "capitalize"
              : element.textTransform === "UPPERCASE"
              ? "uppercase"
              : element.textTransform === "lowercase"
              ? "lowercase"
              : "none",
          color: element.color,
          textAlign: element.align,
          opacity: element.opacity ?? 1,
          transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
          transformOrigin: "center",
          zIndex: elementIndex,
          backgroundColor: isText && element.prefillColor ? element.prefillColor : undefined,
          padding: isText && element.prefillColor ? `${4 * scale}px ${8 * scale}px` : undefined,
          textShadow: isText ? shadow : undefined,
          filter: !isText && hasShadow ? `drop-shadow(${shadow})` : undefined,
          borderRadius:
            element.shape === "round"
              ? 14 * scale
              : element.shape === "circle"
              ? "50%"
              : undefined,
          clipPath:
            element.shape === "heart" && !isShape
              ? "polygon(50% 92%, 7% 52%, 2% 31%, 11% 12%, 28% 8%, 50% 25%, 72% 8%, 89% 12%, 98% 31%, 93% 52%)"
              : undefined,
        };
        const isQr = element.kind === "qr";
        return (
          <div
            key={element.id}
            className={`design-element ${
              visual ? "visual-element" : isShape ? "shape-element" : "text-element"
            } ${isQr ? "qr-element" : ""} ${editable && selectedId === element.id ? "selected" : ""}`}
            style={style}
            onPointerDown={(event) => beginDrag(event, element)}
            onWheel={(event) => {
              if (editable && visual && !isQr && onImageZoom) {
                event.preventDefault();
                onImageZoom(
                  element.id,
                  Math.max(1, Math.min(4, element.zoom + (event.deltaY < 0 ? 0.1 : -0.1)))
                );
              }
            }}
            onClick={(event) => {
              event.stopPropagation();
              if (editable) onSelect?.(element.id);
            }}
          >
            {isShape ? (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {renderSvgShape(
                  element.shapeType || "circle",
                  element.color,
                  element.strokeColor,
                  element.strokeWidth || 0
                )}
              </div>
            ) : visual ? (
              image ? (
                <img
                  src={image}
                  alt={isQr ? `Link to ${member?.name || "participant"}` : LABELS[element.kind]}
                  style={
                    isQr
                      ? undefined
                      : {
                          transform: `scale(${
                            element.zoom * (element.kind === "photo" ? member?.photoZoom || 1 : 1)
                          })`,
                        }
                  }
                />
              ) : (
                <div className="image-empty">
                  {isQr ? "QR" : element.kind === "photo" ? "PHOTO" : "IMAGE"}
                </div>
              )
            ) : (
              displayText
            )}
          </div>
        );
      })}
    </div>
  );
}

function FontPicker({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  const [query, setQuery] = useState("");
  const matches = query.trim()
    ? ALL_FONTS.filter((name) => name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 60)
    : ALL_FONTS.slice(0, 60);
  useEffect(() => {
    loadFonts(matches);
  }, [query]);
  return (
    <Field label="Font family" hint={`${ALL_FONTS.length} fonts available. Type to search.`}>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={`Search fonts · current: ${value}`}
        aria-label="Search fonts"
      />
      <div className="font-list" role="listbox" aria-label="Font family">
        {matches.map((name) => (
          <button
            type="button"
            role="option"
            aria-selected={name === value}
            key={name}
            className={name === value ? "active" : ""}
            style={{ fontFamily: fontStack(name) }}
            onClick={() => onChange(name)}
          >
            {name}
          </button>
        ))}
        {!matches.length && <span className="font-empty">No font matches that search.</span>}
      </div>
    </Field>
  );
}

function Inspector({
  element,
  onUpdate,
  onRemove,
}: {
  element?: DesignElement;
  onUpdate: (patch: Partial<DesignElement>) => void;
  onRemove: () => void;
}) {
  if (!element)
    return (
      <div className="inspector-empty">
        <span>↖</span>
        <h4>Select a field</h4>
        <p>Click any item on the canvas to fine-tune its style, size and position. Drag to move it.</p>
      </div>
    );
  const visual = ["image", "photo", "qr"].includes(element.kind);
  const isShape = element.kind === "shape";
  return (
    <div className="inspector">
      <div className="inspector-heading">
        <div>
          <span className="eyebrow">SELECTED FIELD</span>
          <h4>{LABELS[element.kind]}</h4>
        </div>
        <IconButton label="Remove field" onClick={onRemove}>
          <Trash2 size={17} />
        </IconButton>
      </div>

      {element.kind === "text" && (
        <Field label="Text">
          <input
            value={element.text || ""}
            onChange={(event) => onUpdate({ text: event.target.value })}
          />
        </Field>
      )}

      {isShape && (
        <>
          <Field label="Shape Symbol">
            <select
              value={element.shapeType || "circle"}
              onChange={(e) => onUpdate({ shapeType: e.target.value as ShapeType })}
            >
              {SHAPES_LIBRARY.map((s) => (
                <option key={s.type} value={s.type}>
                  {s.name} ({s.category})
                </option>
              ))}
            </select>
          </Field>
          <div className="inspector-grid">
            <Field label="Fill Color">
              <input
                type="color"
                value={element.color || "#FFC000"}
                onChange={(e) => onUpdate({ color: e.target.value })}
              />
            </Field>
            <Field label="Stroke Color">
              <input
                type="color"
                value={element.strokeColor || "#000000"}
                onChange={(e) => onUpdate({ strokeColor: e.target.value })}
              />
            </Field>
          </div>
          <div className="inspector-grid">
            <Field label="Stroke Width">
              <input
                type="number"
                min="0"
                max="24"
                value={element.strokeWidth ?? 0}
                onChange={(e) => onUpdate({ strokeWidth: Number(e.target.value) })}
              />
            </Field>
            <Field label="Rotation (deg)">
              <input
                type="number"
                min="0"
                max="360"
                value={element.rotation ?? 0}
                onChange={(e) => onUpdate({ rotation: Number(e.target.value) })}
              />
            </Field>
          </div>
        </>
      )}

      <div className="inspector-grid">
        <Field label="X position %">
          <input
            type="number"
            min="0"
            max="95"
            value={Math.round(element.x)}
            onChange={(event) => onUpdate({ x: Number(event.target.value) })}
          />
        </Field>
        <Field label="Y position %">
          <input
            type="number"
            min="0"
            max="95"
            value={Math.round(element.y)}
            onChange={(event) => onUpdate({ y: Number(event.target.value) })}
          />
        </Field>
        <Field label="Width %">
          <input
            type="number"
            min="3"
            max="100"
            value={element.width}
            onChange={(event) => onUpdate({ width: Number(event.target.value) })}
          />
        </Field>
        <Field label="Height %">
          <input
            type="number"
            min="3"
            max="100"
            value={element.height}
            onChange={(event) => onUpdate({ height: Number(event.target.value) })}
          />
        </Field>
      </div>

      {visual && !isShape && (
        <>
          <Field label="Image shape">
            <select
              value={element.shape}
              onChange={(event) => onUpdate({ shape: event.target.value as DesignElement["shape"] })}
            >
              <option value="square">Square</option>
              <option value="round">Rounded</option>
              <option value="circle">Circle</option>
              <option value="heart">Heart</option>
            </select>
          </Field>
          <Field label="Image fit / zoom">
            <input
              type="range"
              min="1"
              max="4"
              step="0.05"
              value={element.zoom}
              onChange={(event) => onUpdate({ zoom: Number(event.target.value) })}
            />
          </Field>
          <p className="field-hint">You can also scroll on the image to zoom.</p>
        </>
      )}

      {!visual && !isShape && (
        <>
          <FontPicker
            value={element.fontFamily}
            onChange={(name) => onUpdate({ fontFamily: name })}
          />
          <div className="inspector-grid">
            <Field label="Font size">
              <input
                type="number"
                min="6"
                max="100"
                value={element.fontSize}
                onChange={(event) => onUpdate({ fontSize: Number(event.target.value) })}
              />
            </Field>
            <Field label="Text color">
              <input
                type="color"
                value={element.color}
                onChange={(event) => onUpdate({ color: event.target.value })}
              />
            </Field>
          </div>
          <Field label="Alignment">
            <select
              value={element.align}
              onChange={(event) => onUpdate({ align: event.target.value as DesignElement["align"] })}
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </Field>
        </>
      )}
    </div>
  );
}

function useDesigner(initial: DesignElement[]) {
  const [elements, setElements] = useState<DesignElement[]>(initial);
  const [past, setPast] = useState<DesignElement[][]>([]);
  const [future, setFuture] = useState<DesignElement[][]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const snapshot = () => {
    setPast((history) => [...history.slice(-29), structuredClone(elements)]);
    setFuture([]);
  };
  const add = (
    kind: ElementKind,
    image?: string,
    card?: { width: number; height: number },
    color?: string,
    extra: Partial<DesignElement> = {}
  ) => {
    snapshot();
    const item = createElement(kind, elements.length, image, card, color, extra);
    setElements([...elements, item]);
    setSelectedId(item.id);
  };
  const update = (elementId: string, patch: Partial<DesignElement>, remember = true) => {
    if (remember) snapshot();
    setElements((previous) =>
      previous.map((element) => (element.id === elementId ? { ...element, ...patch } : element))
    );
  };
  const remove = (elementId: string) => {
    snapshot();
    setElements(elements.filter((element) => element.id !== elementId));
    setSelectedId(null);
  };
  const undo = () => {
    if (!past.length) return;
    setFuture([elements, ...future]);
    setElements(past[past.length - 1]);
    setPast(past.slice(0, -1));
    setSelectedId(null);
  };
  const redo = () => {
    if (!future.length) return;
    setPast([...past, elements]);
    setElements(future[0]);
    setFuture(future.slice(1));
    setSelectedId(null);
  };
  return {
    elements,
    setElements,
    selectedId,
    setSelectedId,
    add,
    update,
    remove,
    snapshot,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}

const cardFields: { kind: ElementKind; label: string }[] = [
  { kind: "number", label: "Chest number" },
  { kind: "name", label: "Name" },
  { kind: "team", label: "Team" },
  { kind: "category", label: "Category" },
  { kind: "photo", label: "Member photo" },
  { kind: "qr", label: "QR code" },
  { kind: "text", label: "Custom text" },
];

export function IDCardSection({ fest, onChange, notify }: SectionProps) {
  const data = fest.data;
  const initial = data.cardDesign;
  const [tab, setTab] = useState<"setup" | "design" | "sheet">("setup");
  const [config, setConfig] = useState<CardDesign>({ ...initial });
  const [background, setBackground] = useState(initial.background || "");
  const [ratioMode, setRatioMode] = useState<"Fixed" | "Custom">(
    CARD_PRESETS.some((preset) => preset.width === initial.width && preset.height === initial.height)
      ? "Fixed"
      : "Custom"
  );
  const designer = useDesigner(initial.elements);
  const [zoom, setZoom] = useState(100);
  const [saved, setSaved] = useState(true);
  const [previewLongest, setPreviewLongest] = useState(false);
  const sample = previewLongest
    ? [...data.members].sort((a, b) => b.name.length - a.name.length)[0]
    : data.members[0];
  const canvasRef = useRef<HTMLDivElement>(null);
  // The editor canvas always fits inside one box, so portrait and landscape both stay usable.
  const fit = fitBox(config.width, config.height, 300, 390);
  const canvasWidth = fit.width;
  const canvasHeight = fit.height;
  const paper = PAPERS[config.paper || "A4 portrait"] || PAPERS["A4 portrait"];
  const columns = Math.max(
    1,
    Math.floor((paper.width - config.margin * 2 + config.gap) / (config.width + config.gap))
  );
  const rows = Math.max(
    1,
    Math.floor((paper.height - config.margin * 2 + config.gap) / (config.height + config.gap))
  );
  const perPage = columns * rows;
  const previewScale = 347 / paper.width;
  const fitsOnPaper =
    config.width + config.margin * 2 <= paper.width && config.height + config.margin * 2 <= paper.height;
  const changeConfig = (patch: Partial<CardDesign>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    setSaved(false);
    if (patch.width || patch.height) {
      const square = squareSize(next);
      designer.setElements((previous) =>
        previous.map((element) =>
          element.kind === "photo" || element.kind === "qr" ? { ...element, ...square } : element
        )
      );
    }
  };
  const changeElement = (elementId: string, patch: Partial<DesignElement>, remember = true) => {
    designer.update(elementId, patch, remember);
    setSaved(false);
  };
  const save = () => {
    onChange(
      (next) => ({
        ...next,
        cardDesign: { ...config, background: background || undefined, elements: designer.elements },
      }),
      "Saved the ID card design"
    );
    setSaved(true);
    notify("ID card design saved");
  };
  const addImage = async (file?: File) => {
    if (!file) return;
    designer.add("image", await readImage(file));
    setSaved(false);
  };
  const recolorText = async (source: string, announce = true) => {
    if (!source) return;
    try {
      designer.snapshot();
      designer.setElements(await fitTextColors(source, designer.elements));
      setSaved(false);
      if (announce) notify("Text colours adjusted to suit the background");
    } catch {
      if (announce) notify("Could not read that image's colours.");
    }
  };
  // ---- Download: ask → preview → confirm (same flow as the printouts) ----
  const [downloadOpen, setDownloadOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  /** Chest numbers stay stable no matter how the sheet is ordered. */
  const chestNumber = (member: Member) => data.members.indexOf(member) + 1;
  /** Card order on paper: grouped by team when each team starts a new page. */
  const orderedMembers = useMemo(
    () =>
      config.newTeamPage
        ? [...data.members].sort((a, b) =>
            getTeamName(data, a.teamId).localeCompare(getTeamName(data, b.teamId))
          )
        : data.members,
    [config.newTeamPage, data]
  );
  /** Exactly how the PDF will break into pages. */
  const pages = useMemo(() => {
    const result: Member[][] = [];
    let current: Member[] = [];
    let lastTeam = "";
    for (const member of orderedMembers) {
      if (
        current.length &&
        ((config.newTeamPage && member.teamId !== lastTeam) || current.length >= perPage)
      ) {
        result.push(current);
        current = [];
      }
      current.push(member);
      lastTeam = member.teamId;
    }
    if (current.length) result.push(current);
    return result;
  }, [orderedMembers, config.newTeamPage, perPage]);
  const startCardDownload = () => {
    if (!data.members.length) return notify("Add members before downloading ID cards.");
    if (!fitsOnPaper)
      return notify("This card is larger than the chosen paper. Adjust the size, margin or paper first.");
    if (askToDownload(`ID cards for ${data.members.length} member${data.members.length === 1 ? "" : "s"} as a PDF`))
      setDownloadOpen(true);
  };
  const confirmCardDownload = async (report: (message: string) => void) => {
    const nodes = Array.from(exportRef.current?.querySelectorAll<HTMLElement>("[data-card-export]") ?? []);
    if (!nodes.length) throw new Error("The cards are still being prepared. Please try again in a moment.");
    // QR codes are generated as the cards mount; wait until none are still placeholders.
    report("Preparing QR codes…");
    const deadline = Date.now() + 4000;
    while (exportRef.current?.querySelector(".qr-element .image-empty") && Date.now() < deadline)
      await new Promise((resolve) => setTimeout(resolve, 120));
    report("Preparing fonts…");
    // Every card shares one design, so the font CSS is built once and reused.
    const fontEmbedCSS = await buildFontEmbedCSS(nodes[0]).catch(() => "");
    // Tiny recognisable logo stamped at the top-right of each printed page.
    const printLogo = await loadImage(printLogoSrc(data.festLogo)).catch(() => null);
    const pdf = new jsPDF({
      orientation: paper.width > paper.height ? "landscape" : "portrait",
      unit: "mm",
      format: [paper.width, paper.height],
    });
    const { width, height, margin, gap } = config;
    let rendered = 0;
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
      if (pageIndex) pdf.addPage([paper.width, paper.height]);
      for (let slot = 0; slot < pages[pageIndex].length; slot++) {
        const x = margin + (slot % columns) * (width + gap);
        const y = margin + Math.floor(slot / columns) * (height + gap);
        rendered += 1;
        report(`Rendering card ${rendered} of ${nodes.length}…`);
        const png = await renderNodePng(nodes[rendered - 1], { pixelRatio: 3, fontEmbedCSS });
        pdf.addImage(png, "PNG", x, y, width, height);
        // Tiny recognisable logo at the top-right corner of the printed page.
        if (slot === 0 && printLogo) stampPdfPage(pdf, printLogo, paper.width);
        if (config.cropMarks) {
          pdf.setDrawColor(70);
          pdf.setLineWidth(0.12);
          for (const [cornerX, cornerY, horizontal, vertical] of [
            [x, y, -1, -1],
            [x + width, y, 1, -1],
            [x, y + height, -1, 1],
            [x + width, y + height, 1, 1],
          ]) {
            pdf.line(cornerX + horizontal * 0.5, cornerY, cornerX + horizontal * 3, cornerY);
            pdf.line(cornerX, cornerY + vertical * 0.5, cornerX, cornerY + vertical * 3);
          }
        }
      }
    }
    report("Saving PDF…");
    pdf.save(`${fileSlug(fest.name)}-id-cards.pdf`);
    notify("ID cards downloaded exactly as previewed");
  };
  const modalScale = Math.min(
    1.65,
    Math.max(
      0.9,
      ((typeof window === "undefined" ? 900 : Math.min(window.innerWidth, 900)) - 150) / paper.width
    )
  );
  const selected = designer.elements.find((element) => element.id === designer.selectedId);
  const uploadBackground = async (file?: File) => {
    if (!file) return;
    const source = await readImage(file);
    setBackground(source);
    setSaved(false);
    await recolorText(source, false);
    notify("Template added. Text colours now follow the background.");
  };
  return (
    <>
      <PageHead
        eyebrow="CREATE / IDENTITY"
        title="ID Card Designer"
        description="A small studio for badges that feel unmistakably yours."
        action={
          <div className="button-row">
            <span className="saved-indicator">{saved ? "Saved" : "Unsaved changes"}</span>
            <Button
              variant="secondary"
              onClick={startCardDownload}
              disabled={!data.members.length || !fitsOnPaper}
            >
              <Download size={16} /> Download
            </Button>
            <Button onClick={save}>
              <Save size={16} /> Save design
            </Button>
          </div>
        }
      />
      <div className="editor-steps">
        <button className={tab === "setup" ? "active" : ""} onClick={() => setTab("setup")}>
          1. Card setup
        </button>
        <button className={tab === "design" ? "active" : ""} onClick={() => setTab("design")}>
          2. Design
        </button>
        <button className={tab === "sheet" ? "active" : ""} onClick={() => setTab("sheet")}>
          3. Sheet preview
        </button>
      </div>
      {tab === "setup" && (
        <div className="card-setup-layout">
          <div className="setup-panel">
            <span className="eyebrow">CARD SETUP</span>
            <h3>Make it yours.</h3>
            <Field label="Card size">
              <select
                value={ratioMode === "Custom" ? "custom" : `${config.width}x${config.height}`}
                onChange={(event) => {
                  if (event.target.value === "custom") {
                    setRatioMode("Custom");
                    return;
                  }
                  const [width, height] = event.target.value.split("x").map(Number);
                  setRatioMode("Fixed");
                  changeConfig({
                    width,
                    height,
                    orientation: width > height ? "Landscape" : "Portrait",
                  });
                }}
              >
                {CARD_PRESETS.map((preset) => (
                  <option key={preset.label} value={`${preset.width}x${preset.height}`}>
                    {preset.label}
                  </option>
                ))}
                <option value="custom">Custom size…</option>
              </select>
            </Field>
            {ratioMode === "Custom" && (
              <div className="inspector-grid">
                <Field label="Width mm">
                  <input
                    type="number"
                    min="20"
                    max="400"
                    value={config.width}
                    onChange={(event) => {
                      const width = Math.min(400, Math.max(20, Number(event.target.value) || 0));
                      changeConfig({
                        width,
                        orientation: width > config.height ? "Landscape" : "Portrait",
                      });
                    }}
                  />
                </Field>
                <Field label="Height mm">
                  <input
                    type="number"
                    min="20"
                    max="400"
                    value={config.height}
                    onChange={(event) => {
                      const height = Math.min(400, Math.max(20, Number(event.target.value) || 0));
                      changeConfig({
                        height,
                        orientation: config.width > height ? "Landscape" : "Portrait",
                      });
                    }}
                  />
                </Field>
              </div>
            )}
            <Field label="Orientation" hint={`${config.width} × ${config.height} mm`}>
              <select
                value={config.orientation}
                onChange={(event) => {
                  const orientation = event.target.value as CardDesign["orientation"];
                  const longest = Math.max(config.width, config.height);
                  const shortest = Math.min(config.width, config.height);
                  changeConfig({
                    orientation,
                    width: orientation === "Landscape" ? longest : shortest,
                    height: orientation === "Landscape" ? shortest : longest,
                  });
                }}
              >
                <option>Portrait</option>
                <option>Landscape</option>
              </select>
            </Field>
            <Field
              label="Paper"
              hint={`${columns} × ${rows} cards per page · ${perPage} per sheet`}
            >
              <select
                value={config.paper || "A4 portrait"}
                onChange={(event) => changeConfig({ paper: event.target.value })}
              >
                {Object.entries(PAPERS).map(([name, size]) => (
                  <option key={name} value={name}>
                    {name} · {size.width} × {size.height} mm
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Template">
              <input
                type="file"
                accept="image/png,image/jpeg"
                onChange={(event) => void uploadBackground(event.target.files?.[0])}
              />
            </Field>
            <small className="muted">
              Upload PNG or JPEG. Recommended with 3 mm bleed: 957 × 1311 px at 300 DPI. Photo and QR
              fields stay exactly {FIXED_SQUARE_MM} × {FIXED_SQUARE_MM} mm.
            </small>
            {background && (
              <div className="button-row">
                <Button variant="secondary" onClick={() => void recolorText(background)}>
                  <Wand2 size={15} /> Re-fit text colours
                </Button>
                <button
                  type="button"
                  className="subtle-link"
                  onClick={() => {
                    setBackground("");
                    setSaved(false);
                  }}
                >
                  Remove template
                </button>
              </div>
            )}
            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={previewLongest}
                onChange={(event) => setPreviewLongest(event.target.checked)}
              />{" "}
              Preview the longest participant name
            </label>
            <Button onClick={() => setTab("design")}>
              Continue to design <ArrowRight size={16} />
            </Button>
          </div>
          <div className="setup-card-preview">
            <span className="eyebrow">LIVE PREVIEW</span>
            <DesignCanvas
              elements={designer.elements}
              background={background}
              data={data}
              festName={fest.name}
              festCode={fest.code}
              member={sample}
              memberNumber={1}
              width={canvasWidth}
              height={canvasHeight}
            />
          </div>
        </div>
      )}
      {tab === "design" && (
        <div className="editor-layout">
          <div className="editor-work">
            <div className="editor-work-top">
              <span>
                DESIGN CANVAS <small>{config.width} × {config.height} MM</small>
              </span>
              <div>
                <button
                  aria-label="Undo"
                  disabled={!designer.canUndo}
                  onClick={designer.undo}
                >
                  <Undo2 size={17} />
                </button>
                <button
                  aria-label="Redo"
                  disabled={!designer.canRedo}
                  onClick={designer.redo}
                >
                  <Redo2 size={17} />
                </button>
                <button
                  aria-label="Zoom out"
                  onClick={() => setZoom(Math.max(50, zoom - 10))}
                >
                  <ZoomOut size={17} />
                </button>
                <span>{zoom}%</span>
                <button
                  aria-label="Zoom in"
                  onClick={() => setZoom(Math.min(150, zoom + 10))}
                >
                  <ZoomIn size={17} />
                </button>
              </div>
            </div>
            <div className="editor-work-area">
              <div style={{ transform: `scale(${zoom / 100})`, transformOrigin: "center" }}>
                <DesignCanvas
                  canvasRef={canvasRef}
                  editable
                  selectedId={designer.selectedId}
                  onSelect={designer.setSelectedId}
                  onDragStart={designer.snapshot}
                  onMove={(elementId, x, y) => changeElement(elementId, { x, y }, false)}
                  onImageZoom={(elementId, value) => changeElement(elementId, { zoom: value }, false)}
                  elements={designer.elements}
                  background={background}
                  data={data}
                  festName={fest.name}
                  festCode={fest.code}
                  member={sample}
                  memberNumber={1}
                  width={canvasWidth}
                  height={canvasHeight}
                />
              </div>
            </div>
            <p className="editor-tip">
              Drag a field to move it. Scroll over a photo to adjust its fit. Each QR code opens that
              member's own login.
            </p>
          </div>
          <aside className="editor-tools">
            <div className="tool-group">
              <span className="eyebrow">CARD FIELDS</span>
              <div className="field-buttons">
                {cardFields.map((field) => (
                  <button
                    key={field.kind}
                    onClick={() => {
                      designer.add(field.kind, undefined, config);
                      setSaved(false);
                    }}
                  >
                    <Plus size={14} /> {field.label}
                  </button>
                ))}
              </div>
              <label className="upload-inline">
                <ImagePlus size={16} /> Import logo or image
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(event) => void addImage(event.target.files?.[0])}
                />
              </label>
            </div>
            <Inspector
              element={selected}
              onUpdate={(patch) => {
                if (selected) changeElement(selected.id, patch);
              }}
              onRemove={() => {
                if (selected) designer.remove(selected.id);
              }}
            />
          </aside>
        </div>
      )}
      {tab === "sheet" && (
        <div className="sheet-preview-layout">
          <div className="print-settings">
            <span className="eyebrow">PRINT SETUP</span>
            <h3>Ready for the printer.</h3>
            <div className="form-grid">
              <Field label="Margin mm">
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={config.margin}
                  onChange={(event) => changeConfig({ margin: Number(event.target.value) })}
                />
              </Field>
              <Field label="Gap mm">
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={config.gap}
                  onChange={(event) => changeConfig({ gap: Number(event.target.value) })}
                />
              </Field>
            </div>
            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={config.cropMarks}
                onChange={(event) => changeConfig({ cropMarks: event.target.checked })}
              />{" "}
              Crop marks
            </label>
            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={config.newTeamPage}
                onChange={(event) => changeConfig({ newTeamPage: event.target.checked })}
              />{" "}
              Start each team on a new page
            </label>
            <p className="muted small-text">
              Every QR code links to that member's own login. Save the design before downloading.
            </p>
            {!fitsOnPaper && (
              <p className="warn-text">
                This card is bigger than the chosen paper. Reduce the card size or margin.
              </p>
            )}
            <Button onClick={startCardDownload} disabled={!data.members.length || !fitsOnPaper}>
              <Download size={16} /> Download ID cards
            </Button>
          </div>
          <div className="a4-area">
            <div className="a4-top">
              <span>Sheet preview ({config.paper || "A4 portrait"})</span>
              <small>
                {paper.width} × {paper.height} mm · {perPage} per page · {pages.length} page
                {pages.length === 1 ? "" : "s"}
              </small>
            </div>
            <div
              className="a4-sheet"
              style={{
                width: paper.width * previewScale,
                height: paper.height * previewScale,
                padding: config.margin * previewScale,
                gap: config.gap * previewScale,
              }}
            >
              {(pages[0] ?? []).map((member) => (
                <div key={member.id} className="a4-card">
                  <DesignCanvas
                    elements={designer.elements}
                    background={background}
                    data={data}
                    festName={fest.name}
                    festCode={fest.code}
                    member={member}
                    memberNumber={chestNumber(member)}
                    width={config.width * previewScale}
                    height={config.height * previewScale}
                  />
                </div>
              ))}
            </div>
            <span className="muted small-text">
              Showing page one of the real layout. All {data.members.length} members are included in
              the PDF.
            </span>
          </div>
        </div>
      )}
      {(tab === "sheet" || downloadOpen) && (
        <div className="export-cards" ref={exportRef} aria-hidden="true">
          {pages.flat().map((member) => (
            <div key={member.id} data-card-export>
              <DesignCanvas
                elements={designer.elements}
                background={background}
                data={data}
                festName={fest.name}
                festCode={fest.code}
                member={member}
                memberNumber={chestNumber(member)}
                width={config.width * 4}
                height={config.height * 4}
              />
            </div>
          ))}
        </div>
      )}
      {downloadOpen && (
        <DownloadPreview
          title="ID card preview"
          subtitle={`${data.members.length} cards · ${pages.length} page${
            pages.length === 1 ? "" : "s"
          } · ${config.paper || "A4 portrait"}`}
          format={`PDF · ${paper.width} × ${paper.height} mm`}
          onClose={() => setDownloadOpen(false)}
          onConfirm={confirmCardDownload}
        >
          <div className="card-download-pages">
            {pages.slice(0, 2).map((page, pageIndex) => (
              <div key={pageIndex} className="card-download-page">
                <span className="eyebrow">
                  PAGE {pageIndex + 1} OF {pages.length}
                </span>
                <div
                  className="a4-sheet"
                  style={{
                    width: paper.width * modalScale,
                    height: paper.height * modalScale,
                    padding: config.margin * modalScale,
                    gap: config.gap * modalScale,
                  }}
                >
                  {page.map((member) => (
                    <div key={member.id} className="a4-card">
                      <DesignCanvas
                        elements={designer.elements}
                        background={background}
                        data={data}
                        festName={fest.name}
                        festCode={fest.code}
                        member={member}
                        memberNumber={chestNumber(member)}
                        width={config.width * modalScale}
                        height={config.height * modalScale}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {pages.length > 2 && (
              <p className="muted small-text">
                + {pages.length - 2} more page{pages.length - 2 === 1 ? "" : "s"} included in the
                PDF.
              </p>
            )}
          </div>
        </DownloadPreview>
      )}
    </>
  );
}

function PosterEditor({
  fest,
  template,
  onSave,
  onBack,
  notify,
}: {
  fest: SectionProps["fest"];
  template?: PosterTemplate;
  onSave: (template: PosterTemplate) => void;
  onBack: () => void;
  notify: (message: string) => void;
}) {
  const data = fest.data;
  const [templateType, setTemplateType] = useState<"result" | "teamMark">(template?.templateType || "result");
  const [name, setName] = useState(template?.name || "Result poster");
  const [background, setBackground] = useState(template?.background || "");
  const [bgColor, setBgColor] = useState(template?.backgroundColor || "#34243d");
  const [bgWidth, setBgWidth] = useState(template?.backgroundWidth ?? template?.width ?? 1080);
  const [bgHeight, setBgHeight] = useState(template?.backgroundHeight ?? template?.height ?? 1350);
  const [previewMode, setPreviewMode] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showShadow, setShowShadow] = useState(false);
  const [showShapesModal, setShowShapesModal] = useState(false);
  const [showAddPlaceMenu, setShowAddPlaceMenu] = useState(false);
  const [showAddTeamRankMenu, setShowAddTeamRankMenu] = useState(false);
  const [layersOpen, setLayersOpen] = useState(true);

  const designer = useDesigner(template?.elements || defaultElementsFor(templateType));
  const selected = designer.elements.find((element) => element.id === designer.selectedId) || null;

  const canvasProgram = data.programs.find((program) => program.status === 5) || data.programs[0];
  const posterFit = fitBox(Math.max(1, bgWidth || 1080), Math.max(1, bgHeight || 1350), 360, 470);

  const recolorText = async (source: string, announce = true) => {
    if (!source) return;
    try {
      designer.snapshot();
      designer.setElements(await fitTextColors(source, designer.elements));
      if (announce) notify("Text colours adjusted to suit the background");
    } catch {
      if (announce) notify("Could not read that image's colours.");
    }
  };

  const uploadBackground = async (file?: File) => {
    if (!file) return;
    const source = await readImage(file);
    setBackground(source);
    await recolorText(source, false);
    notify("Background added. Text colours now follow the image.");
  };

  const addImage = async (file?: File) => {
    if (file) designer.add("image", await readImage(file));
  };

  const addField = async (kind: ElementKind, extra: Partial<DesignElement> = {}) => {
    const light = background ? await backgroundIsLight(background) : false;
    designer.add(kind, undefined, undefined, light ? "#16161c" : "#ffffff", extra);
  };

  const handleAddShape = (shapeType: ShapeType) => {
    addField("shape", { shapeType, color: "#FFC000", strokeColor: "#000000", strokeWidth: 0, layerName: SHAPES_LIBRARY.find((s) => s.type === shapeType)?.name });
    setShowShapesModal(false);
  };

  const selectedLabel = selected ? selected.layerName || LABELS[selected.kind] || "Layer" : "";
  const isTextElement = selected && !["image", "photo", "qr", "shape"].includes(selected.kind);

  const updateSelected = (patch: Partial<DesignElement>) => {
    if (selected) designer.update(selected.id, patch);
  };

  const moveLayer = (direction: "forward" | "backward" | "front" | "back") => {
    if (!selected) return;
    designer.snapshot();
    const list = [...designer.elements];
    const index = list.findIndex((el) => el.id === selected.id);
    if (index < 0) return;
    const [item] = list.splice(index, 1);
    const target =
      direction === "forward" ? Math.min(list.length, index + 1)
      : direction === "backward" ? Math.max(0, index - 1)
      : direction === "front" ? list.length
      : 0;
    list.splice(target, 0, item);
    designer.setElements(list);
  };

  const handleSave = (exit: boolean) => {
    if (!name.trim()) return notify("Give your template a name.");
    onSave({
      id: template?.id || id(),
      name: name.trim(),
      templateType,
      background: background || undefined,
      backgroundColor: bgColor,
      backgroundWidth: bgWidth,
      backgroundHeight: bgHeight,
      width: bgWidth,
      height: bgHeight,
      resolution: template?.resolution,
      unit: template?.unit,
      elements: designer.elements,
      fromResult: template?.fromResult ?? null,
      toResult: template?.toResult ?? null,
    });
    if (exit) onBack();
  };

  const layerIcon = (kind: ElementKind) => {
    if (kind === "shape") return "⬡";
    if (["image", "photo", "qr"].includes(kind)) return "▣";
    return "T";
  };

  return (
    <div className="poster-studio">
      {/* ===== Top bar ===== */}
      <header className="poster-studio-header">
        <button className="poster-back-btn" onClick={onBack} aria-label="Back to templates">
          <ArrowLeft size={18} />
        </button>
        <h1 className="poster-studio-title">{template ? "Edit poster template" : "New poster template"}</h1>
        <div className="poster-studio-actions">
          <button className="poster-btn secondary" onClick={() => handleSave(false)}>
            Save
          </button>
          <button className="poster-btn primary" onClick={() => handleSave(true)}>
            <Save size={15} /> Create &amp; Exit
          </button>
        </div>
      </header>

      <div className="poster-studio-body">
        {/* ===== LEFT: LIVE PREVIEW ONLY ===== */}
        <aside className="poster-preview-pane">
          <div className="poster-preview-head">
            <span className="poster-preview-label">Preview</span>
            <button
              className={`poster-preview-toggle ${previewMode ? "active" : ""}`}
              onClick={() => setPreviewMode(!previewMode)}
            >
              <Sparkles size={13} /> {previewMode ? "Editing" : "Preview"}
            </button>
          </div>

          <div className={`poster-preview-stage ${previewMode ? "pure" : ""}`}>
            <DesignCanvas
              editable={!previewMode}
              selectedId={previewMode ? null : designer.selectedId}
              onSelect={(id) => { if (!previewMode) { designer.setSelectedId(id); } }}
              onDragStart={designer.snapshot}
              onMove={(elementId, x, y) => designer.update(elementId, { x, y }, false)}
              onImageZoom={(elementId, value) => designer.update(elementId, { zoom: value }, false)}
              elements={designer.elements}
              background={background}
              backgroundColor={bgColor}
              data={data}
              festName={fest.name}
              program={canvasProgram}
              surface="poster"
              width={posterFit.width}
              height={posterFit.height}
            />
          </div>

          {!background && (
            <button className="poster-upload-bg-btn" onClick={() => document.getElementById("poster-bg-input")?.click()}>
              <Upload size={14} /> Upload Background
            </button>
          )}
          <input
            id="poster-bg-input"
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => void uploadBackground(event.target.files?.[0])}
          />
          <label className="poster-import-inline">
            <ImagePlus size={13} /> Import logo or image
            <input type="file" accept="image/*" hidden onChange={(event) => void addImage(event.target.files?.[0])} />
          </label>
        </aside>

        {/* ===== RIGHT: ALL CONTROLS ===== */}
        <div className="poster-controls-pane">
          {/* --- Template name --- */}
          <section className="poster-control-block">
            <label className="poster-field-label">Template name</label>
            <input
              className="poster-text-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Result poster"
            />
          </section>

          {/* --- Background & document setup from the New Document choices --- */}
          <section className="poster-control-block">
            <label className="poster-field-label">Background & document</label>
            <div className="poster-type-badge" role="group" aria-label="Template purpose">
              <button type="button" className={`poster-mode-tag ${templateType === "result" ? "result active" : "result"}`} onClick={() => setTemplateType("result")}>
                <Sparkles size={13} /> Score & Result Poster
              </button>
              <button type="button" className={`poster-mode-tag ${templateType === "teamMark" ? "team active" : "team"}`} onClick={() => setTemplateType("teamMark")}>
                Team Mark Poster
              </button>
            </div>
            <div className="poster-grid-2">
              <Field label="Canvas width"><input type="number" min="20" value={bgWidth} onChange={(event) => setBgWidth(Math.max(20, Number(event.target.value) || 20))} /></Field>
              <Field label="Canvas height"><input type="number" min="20" value={bgHeight} onChange={(event) => setBgHeight(Math.max(20, Number(event.target.value) || 20))} /></Field>
            </div>
            <div className="poster-grid-2">
              <Field label="Canvas colour">
                <div className="poster-color-control">
                  <input type="color" value={bgColor === "transparent" ? "#ffffff" : bgColor} onChange={(event) => setBgColor(event.target.value)} />
                  <button type="button" className={bgColor === "transparent" ? "active" : ""} onClick={() => setBgColor("transparent")}>Transparent</button>
                </div>
              </Field>
              <Field label="Document size"><input value={`${bgWidth} × ${bgHeight}${template?.unit ? ` ${template.unit}` : ""}`} readOnly /></Field>
            </div>
            <div className="poster-bg-row">
              <span className="poster-bg-dims">{bgWidth} × {bgHeight}</span>
              <label className="poster-upload-btn">
                <Upload size={14} /> Upload Background
                <input type="file" accept="image/*" hidden onChange={(event) => void uploadBackground(event.target.files?.[0])} />
              </label>
            </div>
            {background && (
              <div className="poster-bg-actions">
                <Button variant="secondary" onClick={() => void recolorText(background)}>
                  <Wand2 size={14} /> Re-fit text colours
                </Button>
                <button type="button" className="poster-clear-btn" onClick={() => setBackground("")}>
                  Remove background
                </button>
              </div>
            )}
          </section>

          {/* --- Add elements (just above Layers) --- */}
          <section className="poster-control-block poster-add-elements">
            <div className="poster-block-head">
              <span className="poster-field-label">Add elements</span>
              <span className="soft-tag">{templateType === "teamMark" ? "Team mark" : "Score"}</span>
            </div>

            <div className="field-buttons">
              <label className="poster-tool-button">
                <Upload size={14} /> Upload background
                <input type="file" accept="image/*" hidden onChange={(event) => void uploadBackground(event.target.files?.[0])} />
              </label>
              <button type="button" onClick={() => void addField("number")}><Plus size={14} /> Result number</button>
              <button type="button" onClick={() => void addField("festival")}><Plus size={14} /> Fest name</button>
              {templateType === "result" && (
                <>
                  <button type="button" onClick={() => void addField("program")}><Plus size={14} /> Program name</button>
                  <button type="button" onClick={() => void addField("category")}><Plus size={14} /> Category</button>
                </>
              )}
              <button type="button" onClick={() => void addField("text")}><Plus size={14} /> Custom text</button>
              <label className="poster-tool-button">
                <ImagePlus size={14} /> Import image
                <input type="file" accept="image/*" hidden onChange={(event) => void addImage(event.target.files?.[0])} />
              </label>
              <button type="button" onClick={() => setShowShapesModal(true)}><Shapes size={14} /> Add shapes</button>
            </div>

            {templateType === "result" ? (
              <>
                <span className="eyebrow">Winner, runner & second runner</span>
                <div className="field-buttons">
                  <button type="button" onClick={() => void addField("winner")}><Trophy size={13} /> Winner name</button>
                  <button type="button" onClick={() => void addField("winnerGrade")}><Plus size={14} /> Winner grade</button>
                  <button type="button" onClick={() => void addField("winnerPoints")}><Plus size={14} /> Winner points</button>
                  <button type="button" onClick={() => void addField("runner")}><Plus size={14} /> Runner name</button>
                  <button type="button" onClick={() => void addField("runnerGrade")}><Plus size={14} /> Runner grade</button>
                  <button type="button" onClick={() => void addField("runnerPoints")}><Plus size={14} /> Runner points</button>
                  <button type="button" onClick={() => void addField("secondRunner")}><Plus size={14} /> Second runner name</button>
                  <button type="button" onClick={() => void addField("secondRunnerGrade")}><Plus size={14} /> Second runner grade</button>
                  <button type="button" onClick={() => void addField("secondRunnerPoints")}><Plus size={14} /> Second runner points</button>
                </div>

                <div className="add-place-dropdown-wrap">
                  <button type="button" className="add-place-main-btn" onClick={() => { setShowAddPlaceMenu(!showAddPlaceMenu); setShowAddTeamRankMenu(false); }}>
                    <Plus size={15} /><span>Add button</span><ChevronDown size={14} />
                  </button>
                  {showAddPlaceMenu && (
                    <div className="add-place-menu">
                      <div className="add-place-header">ADD 4TH TO 10TH PLACE</div>
                      {[4, 5, 6, 7, 8, 9, 10].map((place) => (
                        <div key={place} className="add-place-row">
                          <span className="add-place-label">{place}th place</span>
                          <button type="button" onClick={() => { void addField("placeName", { place, layerName: `${place}th place name` }); setShowAddPlaceMenu(false); }}>Name</button>
                          <button type="button" onClick={() => { void addField("placeGrade", { place, layerName: `${place}th place grade` }); setShowAddPlaceMenu(false); }}>Grade</button>
                          <button type="button" onClick={() => { void addField("placePoints", { place, layerName: `${place}th place points` }); setShowAddPlaceMenu(false); }}>Points</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <span className="eyebrow">All teams · name & total points</span>
                {data.teams.length ? (
                  <div className="field-buttons team-mark-buttons">
                    {data.teams.map((team) => (
                      <div className="team-add-pair" key={team.id}>
                        <button type="button" onClick={() => void addField("teamMarkName", { teamId: team.id, layerName: `${team.name} name` })}><Trophy size={13} /> {team.name} name</button>
                        <button type="button" onClick={() => void addField("teamMarkPoints", { teamId: team.id, layerName: `${team.name} total points` })}><Plus size={14} /> {team.name} total points</button>
                      </div>
                    ))}
                  </div>
                ) : <p className="muted small-text">No teams yet. Rank buttons below still work once teams are added.</p>}

                <span className="eyebrow">Team standings by rank</span>
                <div className="field-buttons">
                  {[1, 2, 3].map((rank) => (
                    <div className="team-add-pair" key={rank}>
                      <button type="button" onClick={() => void addField("teamRankName", { teamRank: rank, layerName: `Rank ${rank} team name` })}><Plus size={14} /> Rank {rank} name</button>
                      <button type="button" onClick={() => void addField("teamRankPoints", { teamRank: rank, layerName: `Rank ${rank} total points` })}><Plus size={14} /> Rank {rank} points</button>
                    </div>
                  ))}
                </div>

                <div className="add-place-dropdown-wrap">
                  <button type="button" className="add-place-main-btn" onClick={() => { setShowAddTeamRankMenu(!showAddTeamRankMenu); setShowAddPlaceMenu(false); }}>
                    <Plus size={15} /><span>Add button</span><ChevronDown size={14} />
                  </button>
                  {showAddTeamRankMenu && (
                    <div className="add-place-menu">
                      <div className="add-place-header">ADD 4TH TO 10TH TEAM RANK</div>
                      {[4, 5, 6, 7, 8, 9, 10].map((rank) => (
                        <div key={rank} className="add-place-row team-rank-row">
                          <span className="add-place-label">{rank}th rank</span>
                          <button type="button" onClick={() => { void addField("teamRankName", { teamRank: rank, layerName: `Rank ${rank} team name` }); setShowAddTeamRankMenu(false); }}>Team name</button>
                          <button type="button" onClick={() => { void addField("teamRankPoints", { teamRank: rank, layerName: `Rank ${rank} total points` }); setShowAddTeamRankMenu(false); }}>Total points</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </section>

          {/* --- Layers --- */}
          <section className="poster-control-block">
            <div className="poster-block-head">
              <span className="poster-field-label">Layers</span>
              <div className="poster-block-head-actions">
                <button className="poster-mini-btn" onClick={() => addField("text")}>
                  <Plus size={13} /> Add
                </button>
                <button aria-label="Undo" disabled={!designer.canUndo} onClick={designer.undo}><Undo2 size={14} /></button>
                <button aria-label="Redo" disabled={!designer.canRedo} onClick={designer.redo}><Redo2 size={14} /></button>
                <button aria-label="Toggle layers" onClick={() => setLayersOpen(!layersOpen)}>
                  <ChevronDown size={14} style={{ transform: layersOpen ? "none" : "rotate(-90deg)" }} />
                </button>
              </div>
            </div>

            {layersOpen && (
              <div className="poster-layers-list">
                {designer.elements.map((element) => {
                  const isSelected = element.id === designer.selectedId;
                  return (
                    <button
                      key={element.id}
                      className={`poster-layer-row ${isSelected ? "active" : ""} ${element.hidden ? "hidden" : ""}`}
                      onClick={() => designer.setSelectedId(element.id)}
                    >
                      <span className="poster-layer-icon">{layerIcon(element.kind)}</span>
                      <span className="poster-layer-name">
                        {element.layerName || LABELS[element.kind] || element.kind}
                      </span>
                      <button
                        className="poster-layer-eye"
                        title={element.hidden ? "Show layer" : "Hide layer"}
                        onClick={(event) => {
                          event.stopPropagation();
                          designer.update(element.id, { hidden: !element.hidden });
                        }}
                      >
                        {element.hidden ? "○" : "●"}
                      </button>
                    </button>
                  );
                })}
                {!designer.elements.length && (
                  <p className="poster-empty-layers">No layers yet — add one with “+ Add”.</p>
                )}
              </div>
            )}
          </section>

          {/* --- Selected element properties --- */}
          {selected && (
            <>
              <section className="poster-control-block">
                <div className="poster-block-head">
                  <h3 className="poster-element-title">{selectedLabel}</h3>
                  <div className="poster-block-head-actions">
                    <button className="poster-mini-btn" onClick={() => updateSelected({ hidden: !selected.hidden })}>
                      {selected.hidden ? "Show" : "Hide"}
                    </button>
                    <button className="poster-mini-btn danger" onClick={() => designer.remove(selected.id)}>
                      Remove
                    </button>
                  </div>
                </div>

                {/* Position and size */}
                <div className="poster-subhead">Position and size</div>
                <div className="poster-grid-2">
                  <Field label="X"><input type="number" value={Math.round(selected.x * 100) / 100} onChange={(e) => updateSelected({ x: Number(e.target.value) || 0 })} /></Field>
                  <Field label="Y"><input type="number" value={Math.round(selected.y * 100) / 100} onChange={(e) => updateSelected({ y: Number(e.target.value) || 0 })} /></Field>
                </div>
                <div className="poster-grid-2">
                  <Field label="Width"><input type="number" value={Math.round(selected.width)} onChange={(e) => updateSelected({ width: Math.max(1, Number(e.target.value) || 1) })} /></Field>
                  <Field label="Height"><input type="number" value={Math.round(selected.height)} onChange={(e) => updateSelected({ height: Math.max(1, Number(e.target.value) || 1) })} /></Field>
                </div>
                <div className="poster-grid-2">
                  <Field label="Rotation"><input type="number" value={selected.rotation ?? 0} onChange={(e) => updateSelected({ rotation: Number(e.target.value) || 0 })} /></Field>
                  <Field label="Opacity"><input type="number" min="0" max="1" step="0.05" value={selected.opacity ?? 1} onChange={(e) => updateSelected({ opacity: Math.max(0, Math.min(1, Number(e.target.value))) })} /></Field>
                </div>
                <Field label="Layer name">
                  <input
                    value={selected.layerName || ""}
                    onChange={(e) => updateSelected({ layerName: e.target.value })}
                    placeholder={LABELS[selected.kind] || "Layer"}
                  />
                </Field>

                <div className="poster-order-buttons">
                  <button onClick={() => moveLayer("forward")}><ArrowRight size={13} /> Forward</button>
                  <button onClick={() => moveLayer("backward")}>Backward</button>
                  <button onClick={() => moveLayer("front")}>To front</button>
                  <button onClick={() => moveLayer("back")}>To back</button>
                </div>
              </section>

              {/* Shape properties */}
              {selected.kind === "shape" && (
                <section className="poster-control-block">
                  <div className="poster-subhead">Shape</div>
                  <Field label="Shape type">
                    <select value={selected.shapeType || "circle"} onChange={(e) => updateSelected({ shapeType: e.target.value as ShapeType })}>
                      {SHAPES_LIBRARY.map((s) => (
                        <option key={s.type} value={s.type}>{s.name} ({s.category})</option>
                      ))}
                    </select>
                  </Field>
                  <div className="poster-grid-2">
                    <Field label="Fill"><input type="color" value={selected.color} onChange={(e) => updateSelected({ color: e.target.value })} /></Field>
                    <Field label="Stroke"><input type="color" value={selected.strokeColor || "#000000"} onChange={(e) => updateSelected({ strokeColor: e.target.value })} /></Field>
                  </div>
                  <Field label="Stroke width"><input type="number" min="0" max="24" value={selected.strokeWidth ?? 0} onChange={(e) => updateSelected({ strokeWidth: Number(e.target.value) || 0 })} /></Field>
                </section>
              )}

              {/* Text properties */}
              {isTextElement && (
                <section className="poster-control-block">
                  <div className="poster-subhead">Text</div>
                  {selected.kind === "text" && (
                    <Field label="Content">
                      <input value={selected.text || ""} onChange={(e) => updateSelected({ text: e.target.value })} placeholder="program name" />
                    </Field>
                  )}
                  <div className="poster-grid-2">
                    <Field label="Font family">
                      <select value={selected.fontFamily} onChange={(e) => updateSelected({ fontFamily: e.target.value })}>
                        {ALL_FONTS.slice(0, 80).map((font) => <option key={font} value={font}>{font}</option>)}
                      </select>
                    </Field>
                    <Field label="Weight">
                      <select value={selected.fontWeight ?? 700} onChange={(e) => updateSelected({ fontWeight: Number(e.target.value) })}>
                        {[300, 400, 500, 600, 700, 800].map((w) => <option key={w} value={w}>{w}</option>)}
                      </select>
                    </Field>
                  </div>
                  <div className="poster-grid-2">
                    <Field label="Font size"><input type="number" value={selected.fontSize} onChange={(e) => updateSelected({ fontSize: Math.max(4, Number(e.target.value) || 4) })} /></Field>
                    <Field label="Minimum size"><input type="number" value={selected.minFontSize ?? 32} onChange={(e) => updateSelected({ minFontSize: Number(e.target.value) || 0 })} /></Field>
                  </div>
                  <div className="poster-grid-2">
                    <Field label="Line height"><input type="number" step="0.1" value={selected.lineHeight ?? 1.2} onChange={(e) => updateSelected({ lineHeight: Number(e.target.value) || 1 })} /></Field>
                    <Field label="Letter spacing"><input type="number" step="0.1" value={selected.letterSpacing ?? 0} onChange={(e) => updateSelected({ letterSpacing: Number(e.target.value) || 0 })} /></Field>
                  </div>
                  <div className="poster-grid-2">
                    <Field label="Text color"><input type="color" value={selected.color} onChange={(e) => updateSelected({ color: e.target.value })} /></Field>
                    <Field label="Style">
                      <select value={selected.fontStyle ?? "Normal"} onChange={(e) => updateSelected({ fontStyle: e.target.value as DesignElement["fontStyle"] })}>
                        <option value="Normal">Normal</option>
                        <option value="Italic">Italic</option>
                        <option value="Bold">Bold</option>
                        <option value="Bold Italic">Bold Italic</option>
                      </select>
                    </Field>
                  </div>
                  <div className="poster-grid-2">
                    <Field label="Horizontal align">
                      <select value={selected.align} onChange={(e) => updateSelected({ align: e.target.value as DesignElement["align"] })}>
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </Field>
                    <Field label="Vertical align">
                      <select value={selected.verticalAlign ?? "Top"} onChange={(e) => updateSelected({ verticalAlign: e.target.value as DesignElement["verticalAlign"] })}>
                        <option value="Top">Top</option>
                        <option value="Middle">Middle</option>
                        <option value="Bottom">Bottom</option>
                      </select>
                    </Field>
                  </div>
                  <div className="poster-grid-2">
                    <Field label="Fit">
                      <select value={selected.fitMode ?? "Width"} onChange={(e) => updateSelected({ fitMode: e.target.value as DesignElement["fitMode"] })}>
                        <option value="Width">Width</option>
                        <option value="Height">Height</option>
                        <option value="Auto">Auto</option>
                      </select>
                    </Field>
                    <Field label="Transformation">
                      <select value={selected.textTransform ?? "None"} onChange={(e) => updateSelected({ textTransform: e.target.value as DesignElement["textTransform"] })}>
                        <option value="None">None</option>
                        <option value="Title case">Title case</option>
                        <option value="UPPERCASE">UPPERCASE</option>
                        <option value="lowercase">lowercase</option>
                      </select>
                    </Field>
                  </div>
                  <div className="poster-grid-2">
                    <Field label="Minimum lines"><input type="number" min="0" value={selected.minLines ?? 0} onChange={(e) => updateSelected({ minLines: Number(e.target.value) || 0 })} /></Field>
                    <Field label="Inside width"><input type="number" min="0" value={selected.insideWidth ?? 0} onChange={(e) => updateSelected({ insideWidth: Number(e.target.value) || 0 })} /></Field>
                  </div>

                  {/* Advanced text */}
                  <button className="poster-collapse-toggle" onClick={() => setShowAdvanced(!showAdvanced)}>
                    <ChevronDown size={14} style={{ transform: showAdvanced ? "none" : "rotate(-90deg)" }} />
                    Advanced text
                  </button>
                  {showAdvanced && (
                    <div className="poster-advanced-body">
                      <div className="poster-grid-2">
                        <Field label="Prefill color"><input type="color" value={selected.prefillColor || selected.color} onChange={(e) => updateSelected({ prefillColor: e.target.value })} /></Field>
                        <Field label="Prefix"><input value={selected.prefix || ""} onChange={(e) => updateSelected({ prefix: e.target.value })} placeholder="Prefix" /></Field>
                      </div>
                      <Field label="Suffix"><input value={selected.suffix || ""} onChange={(e) => updateSelected({ suffix: e.target.value })} placeholder="Suffix" /></Field>
                    </div>
                  )}

                  {/* Shadow */}
                  <button className="poster-collapse-toggle" onClick={() => setShowShadow(!showShadow)}>
                    <ChevronDown size={14} style={{ transform: showShadow ? "none" : "rotate(-90deg)" }} />
                    Shadow
                    <span className="poster-collapse-action" onClick={(e) => { e.stopPropagation(); updateSelected({ shadowColor: undefined, shadowBlur: undefined, shadowX: undefined, shadowY: undefined }); }}>Remove</span>
                  </button>
                  {showShadow && (
                    <div className="poster-advanced-body">
                      <div className="poster-grid-2">
                        <Field label="Color"><input type="color" value={selected.shadowColor || "#000000"} onChange={(e) => updateSelected({ shadowColor: e.target.value })} /></Field>
                        <Field label="Blur"><input type="number" min="0" value={selected.shadowBlur ?? 0} onChange={(e) => updateSelected({ shadowBlur: Number(e.target.value) || 0 })} /></Field>
                      </div>
                      <div className="poster-grid-2">
                        <Field label="X offset"><input type="number" value={selected.shadowX ?? 0} onChange={(e) => updateSelected({ shadowX: Number(e.target.value) || 0 })} /></Field>
                        <Field label="Y offset"><input type="number" value={selected.shadowY ?? 0} onChange={(e) => updateSelected({ shadowY: Number(e.target.value) || 0 })} /></Field>
                      </div>
                    </div>
                  )}
                </section>
              )}
            </>
          )}

        </div>
      </div>

      {/* Shapes modal */}
      {showShapesModal && (
        <Modal
          title="Add Shapes & Mathematical Symbols"
          subtitle="Choose geometric figures, arrows, badges or decorative symbols"
          onClose={() => setShowShapesModal(false)}
          wide
        >
          <div className="shapes-picker-container">
            {["Geometric & Math", "Arrows & Flow", "Badges & Ribbons", "Geographical & Icons"].map((category) => {
              const shapesInCat = SHAPES_LIBRARY.filter((s) => s.category === category);
              return (
                <div key={category} className="shapes-category-group">
                  <span className="eyebrow shapes-cat-title">{category.toUpperCase()}</span>
                  <div className="shapes-grid">
                    {shapesInCat.map((s) => (
                      <button
                        key={s.type}
                        type="button"
                        className="shape-choice-btn"
                        onClick={() => handleAddShape(s.type)}
                        title={`Add ${s.name}`}
                      >
                        <div className="shape-preview-box">{renderSvgShape(s.type, "#FFC000", "#111111", 1)}</div>
                        <span className="shape-choice-name">{s.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Modal>
      )}
    </div>
  );
}

function defaultElementsFor(templateType: "result" | "teamMark"): DesignElement[] {
  const base: DesignElement[] = [
    { ...createElement("text", 0), text: templateType === "teamMark" ? "TEAM STANDINGS" : "THE WINNERS", x: 9, y: 9, fontSize: 13, color: "#eda989", layerName: "Header" },
    { ...createElement(templateType === "teamMark" ? "festival" : "program", 1), x: 9, y: 20, fontSize: 26, color: "#ffffff", layerName: templateType === "teamMark" ? "Fest name" : "Program name" },
    { ...createElement("number", 2), x: 8, y: 34, width: 30, fontSize: 42, color: "#ffffff", layerName: "Result number" },
  ];
  if (templateType === "teamMark") {
    return [
      ...base,
      { ...createElement("teamRankName", 3, undefined, undefined, "#ffffff", { teamRank: 1, layerName: "Rank 1 team" }), x: 9, y: 56, fontSize: 20 },
      { ...createElement("teamRankPoints", 4, undefined, undefined, "#FFC000", { teamRank: 1, layerName: "Rank 1 points" }), x: 76, y: 56, fontSize: 20 },
      { ...createElement("teamRankName", 5, undefined, undefined, "#e9ccce", { teamRank: 2, layerName: "Rank 2 team" }), x: 9, y: 70, fontSize: 15 },
      { ...createElement("teamRankPoints", 6, undefined, undefined, "#e9ccce", { teamRank: 2, layerName: "Rank 2 points" }), x: 76, y: 70, fontSize: 15 },
    ];
  }
  return [
    ...base,
    { ...createElement("winner", 3, undefined, undefined, "#ffffff", { layerName: "Winner name" }), x: 9, y: 58, fontSize: 19 },
    { ...createElement("winnerGrade", 4, undefined, undefined, "#FFC000", { layerName: "Winner grade" }), x: 76, y: 58, fontSize: 18 },
    { ...createElement("winnerPoints", 5, undefined, undefined, "#FFC000", { layerName: "Winner points" }), x: 76, y: 66, fontSize: 13 },
    { ...createElement("runner", 6, undefined, undefined, "#e9ccce", { layerName: "Runner name" }), x: 9, y: 76, fontSize: 14 },
    { ...createElement("secondRunner", 7, undefined, undefined, "#e9ccce", { layerName: "2nd runner name" }), x: 9, y: 87, fontSize: 12 },
  ];
}

function RangeDialog({
  template,
  onClose,
  onSave,
}: {
  template: PosterTemplate;
  onClose: () => void;
  onSave: (from: number | null, to: number | null) => void;
}) {
  const [from, setFrom] = useState(
    template.fromResult == null ? "" : String(template.fromResult)
  );
  const [to, setTo] = useState(template.toResult == null ? "" : String(template.toResult));
  const [error, setError] = useState("");
  const submit = () => {
    const start = from.trim() === "" ? null : Number(from);
    const end = to.trim() === "" ? null : Number(to);
    if (
      (start !== null && (!Number.isInteger(start) || start < 1)) ||
      (end !== null && (!Number.isInteger(end) || end < 1))
    )
      return setError("Use whole result numbers of 1 or more.");
    if (start !== null && end !== null && start > end)
      return setError("The starting result cannot be after the ending result.");
    onSave(start, end);
  };
  return (
    <Modal
      title={`Result range · ${template.name}`}
      subtitle="Choose which published results use this template. Leave both empty to use it for every result."
      onClose={onClose}
    >
      <div className="form-stack">
        <div className="form-grid">
          <Field label="Starting result">
            <input
              autoFocus
              type="number"
              min="1"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                setError("");
              }}
              placeholder="e.g. 1"
            />
          </Field>
          <Field label="Ending result">
            <input
              type="number"
              min="1"
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                setError("");
              }}
              placeholder="e.g. 10"
            />
          </Field>
        </div>
        {error && <p className="warn-text">{error}</p>}
        <div className="form-actions">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>
            Confirm <ArrowRight size={16} />
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function PosterTemplatesSection({ fest, user, onChange, notify }: SectionProps) {
  const [editingTemplate, setEditingTemplate] = useState<PosterTemplate | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [showNewDocModal, setShowNewDocModal] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [rangeId, setRangeId] = useState<string | null>(null);

  const viewing = fest.data.posters.find((template) => template.id === viewingId);
  const ranging = fest.data.posters.find((template) => template.id === rangeId);
  const sample =
    fest.data.programs.find((program) => program.status === 5) || fest.data.programs[0];

  const rangeLabel = (template: PosterTemplate) =>
    template.fromResult == null && template.toResult == null
      ? "All results"
      : `Results ${template.fromResult ?? 1}–${template.toResult ?? "∞"}`;

  const removeTemplate = (template: PosterTemplate) => {
    if (!confirmDelete(template.name)) return;
    onChange(
      (data) => ({
        ...data,
        posters: data.posters.filter((item) => item.id !== template.id),
      }),
      `Deleted poster template ${template.name}`
    );
    notify("Template deleted");
  };

  const handleCreateFromNewDoc = (config: NewDocumentConfig) => {
    const isTeamMark = config.templateType === "teamMark";
    const selectedBackground =
      config.backgroundContents === "Custom"
        ? config.customBgColor
        : config.backgroundContents === "White"
        ? "#ffffff"
        : config.backgroundContents === "Black"
        ? "#000000"
        : "transparent";
    const lightBackground = (() => {
      if (selectedBackground === "transparent" || selectedBackground.toLowerCase() === "#ffffff") return true;
      const hex = selectedBackground.replace("#", "");
      if (!/^[0-9a-f]{6}$/i.test(hex)) return false;
      const luminance = (0.2126 * parseInt(hex.slice(0, 2), 16) + 0.7152 * parseInt(hex.slice(2, 4), 16) + 0.0722 * parseInt(hex.slice(4, 6), 16)) / 255;
      return luminance > 0.68;
    })();
    const mainColour = lightBackground ? "#17130f" : "#ffffff";
    const secondaryColour = lightBackground ? "#574c40" : "#e9ccce";
    const accentColour = lightBackground ? "#8a5a00" : "#FFC000";
    const kickerColour = lightBackground ? "#9a5416" : "#eda989";
    const newTemplate: PosterTemplate = {
      id: id(),
      name: config.name,
      templateType: config.templateType,
      backgroundColor: selectedBackground,
      backgroundWidth: config.width,
      backgroundHeight: config.height,
      width: config.width,
      height: config.height,
      resolution: config.resolution,
      unit: config.unit,
      elements: [
        {
          ...createElement("text", 0),
          text: isTeamMark ? "TEAM STANDINGS" : "THE WINNERS",
          x: 9,
          y: 10,
          fontSize: 15,
          color: kickerColour,
        },
        {
          ...createElement(isTeamMark ? "festival" : "program", 1),
          x: 9,
          y: 22,
          fontSize: 28,
          color: mainColour,
        },
        ...(isTeamMark
          ? [
              {
                ...createElement("teamRankName", 2, undefined, undefined, mainColour, { teamRank: 1 }),
                x: 9,
                y: 45,
                fontSize: 22,
              },
              {
                ...createElement("teamRankPoints", 3, undefined, undefined, accentColour, {
                  teamRank: 1,
                }),
                x: 75,
                y: 45,
                fontSize: 22,
              },
            ]
          : [
              {
                ...createElement("winner", 2),
                x: 9,
                y: 52,
                fontSize: 22,
                color: mainColour,
              },
              {
                ...createElement("winnerGrade", 3, undefined, undefined, accentColour),
                x: 78,
                y: 52,
                fontSize: 20,
              },
              {
                ...createElement("runner", 4),
                x: 9,
                y: 68,
                fontSize: 16,
                color: secondaryColour,
              },
              {
                ...createElement("secondRunner", 5),
                x: 9,
                y: 80,
                fontSize: 14,
                color: secondaryColour,
              },
            ]),
        { ...createElement("number", 6), x: 79, y: 10, width: 15, fontSize: 18, color: mainColour },
      ],
      createdBy: user.id,
    };

    setShowNewDocModal(false);
    setEditingTemplate(newTemplate);
    setIsCreatingNew(true);
  };

  if (editingTemplate !== null)
    return (
      <PosterEditor
        key={editingTemplate.id}
        fest={fest}
        template={editingTemplate}
        notify={notify}
        onBack={() => {
          setEditingTemplate(null);
          setIsCreatingNew(false);
        }}
        onSave={(saved) => {
          onChange(
            (data) => ({
              ...data,
              posters: isCreatingNew
                ? [...data.posters, { ...saved, createdBy: user.id }]
                : data.posters.map((item) =>
                    item.id === saved.id ? { ...saved, createdBy: user.id } : item
                  ),
            }),
            `${isCreatingNew ? "Created" : "Updated"} poster template ${saved.name}`
          );
          setEditingTemplate(null);
          setIsCreatingNew(false);
          notify("Template saved. Published results will use this exact design.");
        }}
      />
    );

  if (viewing)
    return (
      <>
        <PageHead
          back={() => setViewingId(null)}
          eyebrow="CREATE / PREVIEW"
          title={viewing.name}
          description={`A live preview of your saved template · ${rangeLabel(viewing)}`}
        />
        <div className="poster-preview-center">
          <DesignCanvas
            elements={viewing.elements}
            background={viewing.background}
            backgroundColor={viewing.backgroundColor}
            data={fest.data}
            festName={fest.name}
            program={sample}
            surface="poster"
            width={390}
            height={505}
          />
        </div>
      </>
    );

  return (
    <>
      <PageHead
        eyebrow="CREATE / MEDIA"
        title="Poster Templates"
        description="Create once. Celebrate every published result and team standing in your own style."
        action={<AddButton onClick={() => setShowNewDocModal(true)}>Add template</AddButton>}
      />

      {fest.data.posters.length ? (
        <div className="poster-template-grid">
          {fest.data.posters.map((template) => (
            <div className="template-item" key={template.id}>
              <div className="template-thumb-wrap">
                <button
                  className="template-thumbnail"
                  onClick={() => setViewingId(template.id)}
                  aria-label={`Preview ${template.name}`}
                >
                  <div className="template-mini-scale">
                    <DesignCanvas
                      elements={template.elements}
                      background={template.background}
                      backgroundColor={template.backgroundColor}
                      data={fest.data}
                      festName={fest.name}
                      program={sample}
                      surface="poster"
                      width={POSTER_BASE}
                      height={440}
                    />
                  </div>
                </button>
                <div className="template-menu-holder">
                  <button
                    className="template-dots"
                    aria-label={`Options for ${template.name}`}
                    aria-expanded={menuId === template.id}
                    onClick={() => setMenuId(menuId === template.id ? null : template.id)}
                  >
                    <MoreHorizontal size={18} />
                  </button>
                  {menuId === template.id && (
                    <>
                      <div className="menu-scrim" onClick={() => setMenuId(null)} />
                      <div className="template-menu">
                        <button
                          onClick={() => {
                            setRangeId(template.id);
                            setMenuId(null);
                          }}
                        >
                          Result range…
                        </button>
                        <button
                          onClick={() => {
                            setViewingId(template.id);
                            setMenuId(null);
                          }}
                        >
                          Preview
                        </button>
                        <button
                          onClick={() => {
                            setEditingTemplate(template);
                            setIsCreatingNew(false);
                            setMenuId(null);
                          }}
                        >
                          Edit design
                        </button>
                        <button
                          className="danger-text"
                          onClick={() => {
                            setMenuId(null);
                            removeTemplate(template);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="template-info">
                <div>
                  <div className="flex items-center gap-2">
                    <h3>{template.name}</h3>
                    {template.templateType === "teamMark" && (
                      <span className="soft-tag text-[9px] py-0.5">Team Mark</span>
                    )}
                  </div>
                  <span>
                    {template.elements.length} elements · {rangeLabel(template)}
                  </span>
                </div>
                <RowActions
                  onView={() => setViewingId(template.id)}
                  onEdit={() => {
                    setEditingTemplate(template);
                    setIsCreatingNew(false);
                  }}
                  onDelete={() => removeTemplate(template)}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty
          title="Your first poster starts here"
          description="Build a flexible template that brings published results to life."
          action={<AddButton onClick={() => setShowNewDocModal(true)}>Add template</AddButton>}
        />
      )}

      {/* Adobe Photoshop-style New Document Dialog */}
      {showNewDocModal && (
        <NewDocumentDialog
          data={fest.data}
          onClose={() => setShowNewDocModal(false)}
          onCreate={handleCreateFromNewDoc}
        />
      )}

      {ranging && (
        <RangeDialog
          template={ranging}
          onClose={() => setRangeId(null)}
          onSave={(from, to) => {
            onChange(
              (data) => ({
                ...data,
                posters: data.posters.map((item) =>
                  item.id === ranging.id ? { ...item, fromResult: from, toResult: to } : item
                ),
              }),
              `Set result range for ${ranging.name}`
            );
            setRangeId(null);
            notify(
              from === null && to === null
                ? "This template now applies to every result"
                : `Template applies to results ${from ?? 1}–${to ?? "∞"}`
            );
          }}
        />
      )}
    </>
  );
}
