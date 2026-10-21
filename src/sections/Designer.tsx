import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { ArrowRight, Download, ImagePlus, MoreHorizontal, Plus, Redo2, Save, Trash2, Undo2, Upload, Wand2, ZoomIn, ZoomOut } from "lucide-react";
import { AddButton, askToDownload, Button, DownloadPreview, Empty, Field, IconButton, Modal, PageHead, RowActions } from "../ui";
import { buildFontEmbedCSS, fileSlug, renderNodePng, stampPdfPage } from "../lib/exporter";
import { loadImage, printLogoSrc } from "../lib/brand";
import { entryGrade, getCategoryName, getTeamName, id, type CardDesign, type DesignElement, type ElementKind, type FestData, type Member, type PosterTemplate, type Program } from "../types";
import { ALL_FONTS, fontStack, loadFonts } from "../lib/fonts";
import { backgroundIsLight, fitTextColors } from "../lib/contrast";
import { confirmDelete, rankedEntries, readImage, type SectionProps } from "./common";

/** Reference widths the stored fontSize values are authored against. */
export const CARD_BASE = 300;
export const POSTER_BASE = 340;

const LABELS: Record<ElementKind, string> = { text: "Custom text", image: "Image / logo", name: "Name", team: "Team", category: "Category", number: "Chest number / #", photo: "Member photo", qr: "QR code", winner: "Winner name", runner: "Runner name", secondRunner: "Second runner", program: "Program name", festival: "Fest name", mark: "Points", winnerPoints: "Winner points", runnerPoints: "Runner points", secondRunnerPoints: "Second runner points" };

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
  return { width: Math.min(100, FIXED_SQUARE_MM / card.width * 100), height: Math.min(100, FIXED_SQUARE_MM / card.height * 100) };
}
export function memberLink(festCode: string, member?: Member) {
  if (!member) return "https://festize.app";
  const base = typeof window === "undefined" ? "https://festize.app/" : `${window.location.origin}${window.location.pathname}`;
  return `${base}?fest=${encodeURIComponent(festCode)}&u=${encodeURIComponent(member.name)}&c=${encodeURIComponent(member.code)}`;
}

function createElement(kind: ElementKind, length: number, image?: string, card?: { width: number; height: number }, color = "#26202b"): DesignElement {
  const visual = kind === "image" || squareKinds.includes(kind);
  const square = squareKinds.includes(kind) && card ? squareSize(card) : null;
  return { id: id(), kind, x: 10, y: Math.min(82, 15 + length * 9), width: square?.width ?? (visual ? 24 : 78), height: square?.height ?? (visual ? 22 : 10), fontSize: kind === "name" || kind === "winner" ? 23 : 16, fontFamily: "DM Sans", color, align: "left", shape: "square", zoom: 1, text: kind === "text" ? "Your text" : undefined, image };
}

function resolveText(element: DesignElement, data: FestData, festName: string, member?: Member, program?: Program, memberNumber?: number): string {
  const entries = program ? rankedEntries(program, data) : [];
  const person = (index: number) => {
    const entry = entries[index];
    if (!entry) return ["Winner name", "Runner name", "Second runner"][index];
    const name = data.members.find(item => item.id === entry.memberIds[0])?.name || "Candidate";
    return `${name} · ${getTeamName(data, entry.teamId)}`;
  };
  const points = (index: number) => { const entry = entries[index]; return entry && program ? `${entryGrade(entry, program, data)?.points ?? "No grade"} pts` : "0 pts"; };
  switch (element.kind) {
    case "text": return element.text || "Your text";
    case "name": return member?.name || "Participant Name";
    case "team": return member ? getTeamName(data, member.teamId) : "Team Name";
    case "category": return member ? getCategoryName(data, member.categoryId) : program ? getCategoryName(data, program.categoryId) : "Category";
    case "number": return program ? `#${program.resultNumber || ""}` : String(memberNumber || 1).padStart(3, "0");
    case "winner": return person(0);
    case "runner": return person(1);
    case "secondRunner": return person(2);
    case "program": return program?.name || "Program name";
    case "festival": return festName;
    case "mark": case "winnerPoints": return points(0);
    case "runnerPoints": return points(1);
    case "secondRunnerPoints": return points(2);
    default: return "";
  }
}

export function DesignCanvas({ elements, background, data, festName, festCode = "", member, program, memberNumber, width, height, surface = "card", editable = false, selectedId, onSelect, onMove, onDragStart, onImageZoom, canvasRef }: {
  elements: DesignElement[]; background?: string; data: FestData; festName: string; festCode?: string; member?: Member; program?: Program; memberNumber?: number;
  width: number; height: number; surface?: "card" | "poster"; editable?: boolean; selectedId?: string | null;
  onSelect?: (id: string) => void; onMove?: (id: string, x: number, y: number) => void; onDragStart?: () => void; onImageZoom?: (id: string, value: number) => void;
  canvasRef?: RefObject<HTMLDivElement | null>;
}) {
  const internalRef = useRef<HTMLDivElement>(null); const ref = canvasRef || internalRef;
  const [qrImage, setQrImage] = useState("");
  const isPoster = surface === "poster";
  // Everything scales from one reference width, so the editor, preview and export match exactly.
  const scale = width / (isPoster ? POSTER_BASE : CARD_BASE);
  const qrTarget = member ? memberLink(festCode, member) : "";
  useEffect(() => {
    if (!qrTarget) { setQrImage(""); return; }
    let active = true;
    void QRCode.toDataURL(qrTarget, { margin: 1, width: 420, errorCorrectionLevel: "M", color: { dark: "#1d1d26", light: "#ffffff" } }).then(url => { if (active) setQrImage(url); });
    return () => { active = false; };
  }, [qrTarget]);
  useEffect(() => { loadFonts(elements.map(element => element.fontFamily)); }, [elements]);
  const beginDrag = (event: React.PointerEvent<HTMLDivElement>, element: DesignElement) => {
    if (!editable || !onMove || !ref.current) return;
    event.preventDefault(); event.stopPropagation(); onSelect?.(element.id); onDragStart?.();
    const rect = ref.current.getBoundingClientRect(); const originX = event.clientX; const originY = event.clientY; const startX = element.x; const startY = element.y;
    const move = (next: PointerEvent) => onMove(element.id, Math.max(0, Math.min(95, startX + (next.clientX - originX) / rect.width * 100)), Math.max(0, Math.min(95, startY + (next.clientY - originY) / rect.height * 100)));
    const end = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", end, { once: true });
  };
  return <div ref={ref} className={`design-canvas ${editable ? "editable" : ""}`} style={{ width, height, backgroundImage: background ? `url(${background})` : undefined, backgroundColor: background ? "#fff" : isPoster ? "#34243d" : "#f2e8df" }} onClick={() => editable && onSelect?.("")}>
    {!background && !isPoster && <div className="card-placeholder-art"><span>FESTIZE</span><span>PARTICIPANT</span></div>}
    {elements.map(element => {
      const image = element.kind === "photo" ? member?.photo : element.kind === "qr" ? qrImage : element.image;
      const visual = element.kind === "image" || element.kind === "photo" || element.kind === "qr";
      const style: CSSProperties = { left: `${element.x}%`, top: `${element.y}%`, width: visual ? `${element.width}%` : "max-content", maxWidth: `${element.width}%`, height: visual ? `${element.height}%` : "auto", minHeight: visual ? undefined : `${Math.min(element.height, 4)}%`, fontSize: `${element.fontSize * scale}px`, fontFamily: fontStack(element.fontFamily), color: element.color, textAlign: element.align, borderRadius: element.shape === "round" ? 14 * scale : element.shape === "circle" ? "50%" : undefined, clipPath: element.shape === "heart" ? "polygon(50% 92%, 7% 52%, 2% 31%, 11% 12%, 28% 8%, 50% 25%, 72% 8%, 89% 12%, 98% 31%, 93% 52%)" : undefined };
      const isQr = element.kind === "qr";
      return <div key={element.id} className={`design-element ${visual ? "visual-element" : "text-element"} ${isQr ? "qr-element" : ""} ${editable && selectedId === element.id ? "selected" : ""}`} style={style} onPointerDown={event => beginDrag(event, element)} onWheel={event => { if (editable && visual && !isQr && onImageZoom) { event.preventDefault(); onImageZoom(element.id, Math.max(1, Math.min(4, element.zoom + (event.deltaY < 0 ? .1 : -.1)))); } }} onClick={event => { event.stopPropagation(); if (editable) onSelect?.(element.id); }}>
        {visual ? image ? <img src={image} alt={isQr ? `Link to ${member?.name || "participant"}` : LABELS[element.kind]} style={isQr ? undefined : { transform: `scale(${element.zoom * (element.kind === "photo" ? member?.photoZoom || 1 : 1)})` }} /> : <div className="image-empty">{isQr ? "QR" : element.kind === "photo" ? "PHOTO" : "IMAGE"}</div> : resolveText(element, data, festName, member, program, memberNumber)}
      </div>;
    })}
  </div>;
}

function FontPicker({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  const [query, setQuery] = useState("");
  const matches = query.trim()
    ? ALL_FONTS.filter(name => name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 60)
    : ALL_FONTS.slice(0, 60);
  useEffect(() => { loadFonts(matches); }, [query]);
  return <Field label="Font family" hint={`${ALL_FONTS.length} fonts available. Type to search.`}>
    <input value={query} onChange={event => setQuery(event.target.value)} placeholder={`Search fonts · current: ${value}`} aria-label="Search fonts" />
    <div className="font-list" role="listbox" aria-label="Font family">
      {matches.map(name => <button type="button" role="option" aria-selected={name === value} key={name} className={name === value ? "active" : ""} style={{ fontFamily: fontStack(name) }} onClick={() => onChange(name)}>{name}</button>)}
      {!matches.length && <span className="font-empty">No font matches that search.</span>}
    </div>
  </Field>;
}

function Inspector({ element, onUpdate, onRemove }: { element?: DesignElement; onUpdate: (patch: Partial<DesignElement>) => void; onRemove: () => void }) {
  if (!element) return <div className="inspector-empty"><span>↖</span><h4>Select a field</h4><p>Click any item on the canvas to fine-tune its style, size and position. Drag to move it.</p></div>;
  const visual = ["image", "photo", "qr"].includes(element.kind);
  return <div className="inspector"><div className="inspector-heading"><div><span className="eyebrow">SELECTED FIELD</span><h4>{LABELS[element.kind]}</h4></div><IconButton label="Remove field" onClick={onRemove}><Trash2 size={17} /></IconButton></div>{element.kind === "text" && <Field label="Text"><input value={element.text || ""} onChange={event => onUpdate({ text: event.target.value })} /></Field>}<div className="inspector-grid"><Field label="X position %"><input type="number" min="0" max="95" value={Math.round(element.x)} onChange={event => onUpdate({ x: Number(event.target.value) })} /></Field><Field label="Y position %"><input type="number" min="0" max="95" value={Math.round(element.y)} onChange={event => onUpdate({ y: Number(event.target.value) })} /></Field><Field label="Width %"><input type="number" min="3" max="100" value={element.width} onChange={event => onUpdate({ width: Number(event.target.value) })} /></Field><Field label="Height %"><input type="number" min="3" max="100" value={element.height} onChange={event => onUpdate({ height: Number(event.target.value) })} /></Field></div>{visual ? <><Field label="Image shape"><select value={element.shape} onChange={event => onUpdate({ shape: event.target.value as DesignElement["shape"] })}><option value="square">Square</option><option value="round">Rounded</option><option value="circle">Circle</option><option value="heart">Heart</option></select></Field><Field label="Image fit / zoom"><input type="range" min="1" max="4" step="0.05" value={element.zoom} onChange={event => onUpdate({ zoom: Number(event.target.value) })} /></Field><p className="field-hint">You can also scroll on the image to zoom.</p></> : <><FontPicker value={element.fontFamily} onChange={name => onUpdate({ fontFamily: name })} /><div className="inspector-grid"><Field label="Font size"><input type="number" min="6" max="100" value={element.fontSize} onChange={event => onUpdate({ fontSize: Number(event.target.value) })} /></Field><Field label="Text color"><input type="color" value={element.color} onChange={event => onUpdate({ color: event.target.value })} /></Field></div><Field label="Alignment"><select value={element.align} onChange={event => onUpdate({ align: event.target.value as DesignElement["align"] })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></Field></>}</div>;
}

function useDesigner(initial: DesignElement[]) {
  const [elements, setElements] = useState<DesignElement[]>(initial);
  const [past, setPast] = useState<DesignElement[][]>([]); const [future, setFuture] = useState<DesignElement[][]>([]); const [selectedId, setSelectedId] = useState<string | null>(null);
  const snapshot = () => { setPast(history => [...history.slice(-29), structuredClone(elements)]); setFuture([]); };
  const add = (kind: ElementKind, image?: string, card?: { width: number; height: number }, color?: string) => { snapshot(); const item = createElement(kind, elements.length, image, card, color); setElements([...elements, item]); setSelectedId(item.id); };
  const update = (elementId: string, patch: Partial<DesignElement>, remember = true) => { if (remember) snapshot(); setElements(previous => previous.map(element => element.id === elementId ? { ...element, ...patch } : element)); };
  const remove = (elementId: string) => { snapshot(); setElements(elements.filter(element => element.id !== elementId)); setSelectedId(null); };
  const undo = () => { if (!past.length) return; setFuture([elements, ...future]); setElements(past[past.length - 1]); setPast(past.slice(0, -1)); setSelectedId(null); };
  const redo = () => { if (!future.length) return; setPast([...past, elements]); setElements(future[0]); setFuture(future.slice(1)); setSelectedId(null); };
  return { elements, setElements, selectedId, setSelectedId, add, update, remove, snapshot, undo, redo, canUndo: past.length > 0, canRedo: future.length > 0 };
}

const cardFields: { kind: ElementKind; label: string }[] = [{ kind: "number", label: "Chest number" }, { kind: "name", label: "Name" }, { kind: "team", label: "Team" }, { kind: "category", label: "Category" }, { kind: "photo", label: "Member photo" }, { kind: "qr", label: "QR code" }, { kind: "text", label: "Custom text" }];
const posterFields: { kind: ElementKind; label: string }[] = [{ kind: "number", label: "Result number (#)" }, { kind: "winner", label: "Winner name + team" }, { kind: "winnerPoints", label: "Winner points" }, { kind: "runner", label: "Runner name + team" }, { kind: "runnerPoints", label: "Runner points" }, { kind: "secondRunner", label: "Second runner + team" }, { kind: "secondRunnerPoints", label: "Second runner points" }, { kind: "program", label: "Program name" }, { kind: "category", label: "Category" }, { kind: "festival", label: "Fest name" }, { kind: "text", label: "Custom text" }];

export function IDCardSection({ fest, onChange, notify }: SectionProps) {
  const data = fest.data; const initial = data.cardDesign;
  const [tab, setTab] = useState<"setup" | "design" | "sheet">("setup");
  const [config, setConfig] = useState<CardDesign>({ ...initial }); const [background, setBackground] = useState(initial.background || "");
  const [ratioMode, setRatioMode] = useState<"Fixed" | "Custom">(CARD_PRESETS.some(preset => preset.width === initial.width && preset.height === initial.height) ? "Fixed" : "Custom");
  const designer = useDesigner(initial.elements); const [zoom, setZoom] = useState(100); const [saved, setSaved] = useState(true);
  const [previewLongest, setPreviewLongest] = useState(false);
  const sample = previewLongest ? [...data.members].sort((a, b) => b.name.length - a.name.length)[0] : data.members[0]; const canvasRef = useRef<HTMLDivElement>(null);
  // The editor canvas always fits inside one box, so portrait and landscape both stay usable.
  const fit = fitBox(config.width, config.height, 300, 390);
  const canvasWidth = fit.width; const canvasHeight = fit.height;
  const paper = PAPERS[config.paper || "A4 portrait"] || PAPERS["A4 portrait"];
  const columns = Math.max(1, Math.floor((paper.width - config.margin * 2 + config.gap) / (config.width + config.gap)));
  const rows = Math.max(1, Math.floor((paper.height - config.margin * 2 + config.gap) / (config.height + config.gap)));
  const perPage = columns * rows;
  const previewScale = 347 / paper.width;
  const fitsOnPaper = config.width + config.margin * 2 <= paper.width && config.height + config.margin * 2 <= paper.height;
  const changeConfig = (patch: Partial<CardDesign>) => {
    const next = { ...config, ...patch };
    setConfig(next); setSaved(false);
    if (patch.width || patch.height) {
      const square = squareSize(next);
      designer.setElements(previous => previous.map(element => element.kind === "photo" || element.kind === "qr" ? { ...element, ...square } : element));
    }
  };
  const changeElement = (elementId: string, patch: Partial<DesignElement>, remember = true) => { designer.update(elementId, patch, remember); setSaved(false); };
  const save = () => { onChange(next => ({ ...next, cardDesign: { ...config, background: background || undefined, elements: designer.elements } }), "Saved the ID card design"); setSaved(true); notify("ID card design saved"); };
  const addImage = async (file?: File) => { if (!file) return; designer.add("image", await readImage(file)); setSaved(false); };
  const recolorText = async (source: string, announce = true) => {
    if (!source) return;
    try {
      designer.snapshot();
      designer.setElements(await fitTextColors(source, designer.elements));
      setSaved(false);
      if (announce) notify("Text colours adjusted to suit the background");
    } catch { if (announce) notify("Could not read that image's colours."); }
  };
  // ---- Download: ask → preview → confirm (same flow as the printouts) ----
  const [downloadOpen, setDownloadOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  /** Chest numbers stay stable no matter how the sheet is ordered. */
  const chestNumber = (member: Member) => data.members.indexOf(member) + 1;
  /** Card order on paper: grouped by team when each team starts a new page. */
  const orderedMembers = useMemo(() => config.newTeamPage
    ? [...data.members].sort((a, b) => getTeamName(data, a.teamId).localeCompare(getTeamName(data, b.teamId)))
    : data.members, [config.newTeamPage, data]);
  /** Exactly how the PDF will break into pages. */
  const pages = useMemo(() => {
    const result: Member[][] = []; let current: Member[] = []; let lastTeam = "";
    for (const member of orderedMembers) {
      if (current.length && ((config.newTeamPage && member.teamId !== lastTeam) || current.length >= perPage)) { result.push(current); current = []; }
      current.push(member); lastTeam = member.teamId;
    }
    if (current.length) result.push(current);
    return result;
  }, [orderedMembers, config.newTeamPage, perPage]);
  const startCardDownload = () => {
    if (!data.members.length) return notify("Add members before downloading ID cards.");
    if (!fitsOnPaper) return notify("This card is larger than the chosen paper. Adjust the size, margin or paper first.");
    if (askToDownload(`ID cards for ${data.members.length} member${data.members.length === 1 ? "" : "s"} as a PDF`)) setDownloadOpen(true);
  };
  const confirmCardDownload = async (report: (message: string) => void) => {
    const nodes = Array.from(exportRef.current?.querySelectorAll<HTMLElement>("[data-card-export]") ?? []);
    if (!nodes.length) throw new Error("The cards are still being prepared. Please try again in a moment.");
    // QR codes are generated as the cards mount; wait until none are still placeholders.
    report("Preparing QR codes…");
    const deadline = Date.now() + 4000;
    while (exportRef.current?.querySelector(".qr-element .image-empty") && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 120));
    report("Preparing fonts…");
    // Every card shares one design, so the font CSS is built once and reused.
    const fontEmbedCSS = await buildFontEmbedCSS(nodes[0]).catch(() => "");
    // Tiny recognisable logo stamped at the top-right of each printed page.
    const printLogo = await loadImage(printLogoSrc(data.festLogo)).catch(() => null);
    const pdf = new jsPDF({ orientation: paper.width > paper.height ? "landscape" : "portrait", unit: "mm", format: [paper.width, paper.height] });
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
          pdf.setDrawColor(70); pdf.setLineWidth(.12);
          for (const [cornerX, cornerY, horizontal, vertical] of [[x, y, -1, -1], [x + width, y, 1, -1], [x, y + height, -1, 1], [x + width, y + height, 1, 1]]) {
            pdf.line(cornerX + horizontal * .5, cornerY, cornerX + horizontal * 3, cornerY);
            pdf.line(cornerX, cornerY + vertical * .5, cornerX, cornerY + vertical * 3);
          }
        }
      }
    }
    report("Saving PDF…");
    pdf.save(`${fileSlug(fest.name)}-id-cards.pdf`);
    notify("ID cards downloaded exactly as previewed");
  };
  const modalScale = Math.min(1.65, Math.max(.9, ((typeof window === "undefined" ? 900 : Math.min(window.innerWidth, 900)) - 150) / paper.width));
  const selected = designer.elements.find(element => element.id === designer.selectedId);
  const uploadBackground = async (file?: File) => {
    if (!file) return;
    const source = await readImage(file);
    setBackground(source); setSaved(false);
    await recolorText(source, false);
    notify("Template added. Text colours now follow the background.");
  };
  return <><PageHead eyebrow="CREATE / IDENTITY" title="ID Card Designer" description="A small studio for badges that feel unmistakably yours." action={<div className="button-row"><span className="saved-indicator">{saved ? "Saved" : "Unsaved changes"}</span><Button variant="secondary" onClick={startCardDownload} disabled={!data.members.length || !fitsOnPaper}><Download size={16} /> Download</Button><Button onClick={save}><Save size={16} /> Save design</Button></div>} /><div className="editor-steps"><button className={tab === "setup" ? "active" : ""} onClick={() => setTab("setup")}>1. Card setup</button><button className={tab === "design" ? "active" : ""} onClick={() => setTab("design")}>2. Design</button><button className={tab === "sheet" ? "active" : ""} onClick={() => setTab("sheet")}>3. Sheet preview</button></div>
    {tab === "setup" && <div className="card-setup-layout"><div className="setup-panel"><span className="eyebrow">CARD SETUP</span><h3>Make it yours.</h3><Field label="Card size"><select value={ratioMode === "Custom" ? "custom" : `${config.width}x${config.height}`} onChange={event => {
      if (event.target.value === "custom") { setRatioMode("Custom"); return; }
      const [width, height] = event.target.value.split("x").map(Number);
      setRatioMode("Fixed"); changeConfig({ width, height, orientation: width > height ? "Landscape" : "Portrait" });
    }}>{CARD_PRESETS.map(preset => <option key={preset.label} value={`${preset.width}x${preset.height}`}>{preset.label}</option>)}<option value="custom">Custom size…</option></select></Field>
    {ratioMode === "Custom" && <div className="inspector-grid"><Field label="Width mm"><input type="number" min="20" max="400" value={config.width} onChange={event => { const width = Math.min(400, Math.max(20, Number(event.target.value) || 0)); changeConfig({ width, orientation: width > config.height ? "Landscape" : "Portrait" }); }} /></Field><Field label="Height mm"><input type="number" min="20" max="400" value={config.height} onChange={event => { const height = Math.min(400, Math.max(20, Number(event.target.value) || 0)); changeConfig({ height, orientation: config.width > height ? "Landscape" : "Portrait" }); }} /></Field></div>}
    <Field label="Orientation" hint={`${config.width} × ${config.height} mm`}><select value={config.orientation} onChange={event => { const orientation = event.target.value as CardDesign["orientation"]; const longest = Math.max(config.width, config.height); const shortest = Math.min(config.width, config.height); changeConfig({ orientation, width: orientation === "Landscape" ? longest : shortest, height: orientation === "Landscape" ? shortest : longest }); }}><option>Portrait</option><option>Landscape</option></select></Field><Field label="Paper" hint={`${columns} × ${rows} cards per page · ${perPage} per sheet`}><select value={config.paper || "A4 portrait"} onChange={event => changeConfig({ paper: event.target.value })}>{Object.entries(PAPERS).map(([name, size]) => <option key={name} value={name}>{name} · {size.width} × {size.height} mm</option>)}</select></Field><Field label="Template"><input type="file" accept="image/png,image/jpeg" onChange={event => void uploadBackground(event.target.files?.[0])} /></Field><small className="muted">Upload PNG or JPEG. Recommended with 3 mm bleed: 957 × 1311 px at 300 DPI. Photo and QR fields stay exactly {FIXED_SQUARE_MM} × {FIXED_SQUARE_MM} mm.</small>{background && <div className="button-row"><Button variant="secondary" onClick={() => void recolorText(background)}><Wand2 size={15} /> Re-fit text colours</Button><button type="button" className="subtle-link" onClick={() => { setBackground(""); setSaved(false); }}>Remove template</button></div>}<label className="checkbox-line"><input type="checkbox" checked={previewLongest} onChange={event => setPreviewLongest(event.target.checked)} /> Preview the longest participant name</label><Button onClick={() => setTab("design")}>Continue to design <ArrowRight size={16} /></Button></div><div className="setup-card-preview"><span className="eyebrow">LIVE PREVIEW</span><DesignCanvas elements={designer.elements} background={background} data={data} festName={fest.name} festCode={fest.code} member={sample} memberNumber={1} width={canvasWidth} height={canvasHeight} /></div></div>}
    {tab === "design" && <div className="editor-layout"><div className="editor-work"><div className="editor-work-top"><span>DESIGN CANVAS <small>{config.width} × {config.height} MM</small></span><div><button aria-label="Undo" disabled={!designer.canUndo} onClick={designer.undo}><Undo2 size={17} /></button><button aria-label="Redo" disabled={!designer.canRedo} onClick={designer.redo}><Redo2 size={17} /></button><button aria-label="Zoom out" onClick={() => setZoom(Math.max(50, zoom - 10))}><ZoomOut size={17} /></button><span>{zoom}%</span><button aria-label="Zoom in" onClick={() => setZoom(Math.min(150, zoom + 10))}><ZoomIn size={17} /></button></div></div><div className="editor-work-area"><div style={{ transform: `scale(${zoom / 100})`, transformOrigin: "center" }}><DesignCanvas canvasRef={canvasRef} editable selectedId={designer.selectedId} onSelect={designer.setSelectedId} onDragStart={designer.snapshot} onMove={(elementId, x, y) => changeElement(elementId, { x, y }, false)} onImageZoom={(elementId, value) => changeElement(elementId, { zoom: value }, false)} elements={designer.elements} background={background} data={data} festName={fest.name} festCode={fest.code} member={sample} memberNumber={1} width={canvasWidth} height={canvasHeight} /></div></div><p className="editor-tip">Drag a field to move it. Scroll over a photo to adjust its fit. Each QR code opens that member's own login.</p></div><aside className="editor-tools"><div className="tool-group"><span className="eyebrow">CARD FIELDS</span><div className="field-buttons">{cardFields.map(field => <button key={field.kind} onClick={() => { designer.add(field.kind, undefined, config); setSaved(false); }}><Plus size={14} /> {field.label}</button>)}</div><label className="upload-inline"><ImagePlus size={16} /> Import logo or image<input type="file" accept="image/*" hidden onChange={event => void addImage(event.target.files?.[0])} /></label></div><Inspector element={selected} onUpdate={patch => { if (selected) changeElement(selected.id, patch); }} onRemove={() => { if (selected) designer.remove(selected.id); }} /></aside></div>}
    {tab === "sheet" && <div className="sheet-preview-layout"><div className="print-settings"><span className="eyebrow">PRINT SETUP</span><h3>Ready for the printer.</h3><div className="form-grid"><Field label="Margin mm"><input type="number" min="0" max="50" value={config.margin} onChange={event => changeConfig({ margin: Number(event.target.value) })} /></Field><Field label="Gap mm"><input type="number" min="0" max="50" value={config.gap} onChange={event => changeConfig({ gap: Number(event.target.value) })} /></Field></div><label className="checkbox-line"><input type="checkbox" checked={config.cropMarks} onChange={event => changeConfig({ cropMarks: event.target.checked })} /> Crop marks</label><label className="checkbox-line"><input type="checkbox" checked={config.newTeamPage} onChange={event => changeConfig({ newTeamPage: event.target.checked })} /> Start each team on a new page</label><p className="muted small-text">Every QR code links to that member's own login. Save the design before downloading.</p>{!fitsOnPaper && <p className="warn-text">This card is bigger than the chosen paper. Reduce the card size or margin.</p>}<Button onClick={startCardDownload} disabled={!data.members.length || !fitsOnPaper}><Download size={16} /> Download ID cards</Button></div><div className="a4-area"><div className="a4-top"><span>Sheet preview ({config.paper || "A4 portrait"})</span><small>{paper.width} × {paper.height} mm · {perPage} per page · {pages.length} page{pages.length === 1 ? "" : "s"}</small></div><div className="a4-sheet" style={{ width: paper.width * previewScale, height: paper.height * previewScale, padding: config.margin * previewScale, gap: config.gap * previewScale }}>{(pages[0] ?? []).map(member => <div key={member.id} className="a4-card"><DesignCanvas elements={designer.elements} background={background} data={data} festName={fest.name} festCode={fest.code} member={member} memberNumber={chestNumber(member)} width={config.width * previewScale} height={config.height * previewScale} /></div>)}</div><span className="muted small-text">Showing page one of the real layout. All {data.members.length} members are included in the PDF.</span></div></div>}
    {(tab === "sheet" || downloadOpen) && <div className="export-cards" ref={exportRef} aria-hidden="true">{pages.flat().map(member => <div key={member.id} data-card-export><DesignCanvas elements={designer.elements} background={background} data={data} festName={fest.name} festCode={fest.code} member={member} memberNumber={chestNumber(member)} width={config.width * 4} height={config.height * 4} /></div>)}</div>}
    {downloadOpen && <DownloadPreview title="ID card preview" subtitle={`${data.members.length} cards · ${pages.length} page${pages.length === 1 ? "" : "s"} · ${config.paper || "A4 portrait"}`} format={`PDF · ${paper.width} × ${paper.height} mm`} onClose={() => setDownloadOpen(false)} onConfirm={confirmCardDownload}>
      <div className="card-download-pages">
        {pages.slice(0, 2).map((page, pageIndex) => <div key={pageIndex} className="card-download-page"><span className="eyebrow">PAGE {pageIndex + 1} OF {pages.length}</span><div className="a4-sheet" style={{ width: paper.width * modalScale, height: paper.height * modalScale, padding: config.margin * modalScale, gap: config.gap * modalScale }}>{page.map(member => <div key={member.id} className="a4-card"><DesignCanvas elements={designer.elements} background={background} data={data} festName={fest.name} festCode={fest.code} member={member} memberNumber={chestNumber(member)} width={config.width * modalScale} height={config.height * modalScale} /></div>)}</div></div>)}
        {pages.length > 2 && <p className="muted small-text">+ {pages.length - 2} more page{pages.length - 2 === 1 ? "" : "s"} included in the PDF.</p>}
      </div>
    </DownloadPreview>}

  </>;
}

function PosterEditor({ fest, template, onSave, onBack, notify }: { fest: SectionProps["fest"]; template?: PosterTemplate; onSave: (template: PosterTemplate) => void; onBack: () => void; notify: (message: string) => void }) {
  const [name, setName] = useState(template?.name || "Untitled template"); const [background, setBackground] = useState(template?.background || "");
  const designer = useDesigner(template?.elements || [
    { ...createElement("text", 0), text: "THE WINNERS", x: 9, y: 11, fontSize: 15, color: "#eda989" },
    { ...createElement("program", 1), x: 9, y: 26, fontSize: 30, color: "#ffffff" },
    { ...createElement("winner", 2), x: 9, y: 62, fontSize: 22, color: "#ffffff" },
    { ...createElement("number", 3), x: 79, y: 11, width: 15, fontSize: 20, color: "#ffffff" },
  ]);
  const [zoom, setZoom] = useState(100); const selected = designer.elements.find(element => element.id === designer.selectedId);
  const sample = fest.data.programs.find(program => program.status === 5) || fest.data.programs[0];
  const recolorText = async (source: string, announce = true) => {
    if (!source) return;
    try {
      designer.snapshot();
      designer.setElements(await fitTextColors(source, designer.elements));
      if (announce) notify("Text colours adjusted to suit the background");
    } catch { if (announce) notify("Could not read that image's colours."); }
  };
  const uploadBackground = async (file?: File) => {
    if (!file) return;
    const source = await readImage(file);
    setBackground(source);
    await recolorText(source, false);
    notify("Background added. Text colours now follow the image.");
  };
  const addImage = async (file?: File) => { if (file) designer.add("image", await readImage(file)); };
  const addField = async (kind: ElementKind) => {
    const light = background ? await backgroundIsLight(background) : false;
    designer.add(kind, undefined, undefined, light ? "#16161c" : "#ffffff");
  };
  return <><PageHead back={onBack} eyebrow="CREATE / POSTER STUDIO" title={template ? "Edit template" : "New poster template"} description="What you arrange here is exactly what appears in published results." action={<Button onClick={() => { if (!name.trim()) return notify("Give your template a name."); onSave({ id: template?.id || id(), name: name.trim(), background: background || undefined, elements: designer.elements, fromResult: template?.fromResult ?? null, toResult: template?.toResult ?? null }); }}><Save size={16} /> Save template</Button>} /><div className="poster-name-row"><Field label="Template name"><input value={name} onChange={event => setName(event.target.value)} /></Field><label className="upload-inline"><Upload size={16} /> Upload background<input type="file" accept="image/*" hidden onChange={event => void uploadBackground(event.target.files?.[0])} /></label></div><div className="editor-layout"><div className="editor-work"><div className="editor-work-top"><span>POSTER CANVAS <small>LIVE RESULT PREVIEW</small></span><div><button aria-label="Undo" disabled={!designer.canUndo} onClick={designer.undo}><Undo2 size={17} /></button><button aria-label="Redo" disabled={!designer.canRedo} onClick={designer.redo}><Redo2 size={17} /></button><button aria-label="Zoom out" onClick={() => setZoom(Math.max(50, zoom - 10))}><ZoomOut size={17} /></button><span>{zoom}%</span><button aria-label="Zoom in" onClick={() => setZoom(Math.min(150, zoom + 10))}><ZoomIn size={17} /></button></div></div><div className="editor-work-area"><div style={{ transform: `scale(${zoom / 100})`, transformOrigin: "center" }}><DesignCanvas editable selectedId={designer.selectedId} onSelect={designer.setSelectedId} onDragStart={designer.snapshot} onMove={(elementId, x, y) => designer.update(elementId, { x, y }, false)} onImageZoom={(elementId, value) => designer.update(elementId, { zoom: value }, false)} elements={designer.elements} background={background} data={fest.data} festName={fest.name} program={sample} surface="poster" width={POSTER_BASE} height={440} /></div></div><p className="editor-tip">Drag to position. The # field is your result number.</p></div><aside className="editor-tools"><div className="tool-group"><span className="eyebrow">RESULT FIELDS</span><div className="field-buttons">{posterFields.map(field => <button key={field.kind} onClick={() => void addField(field.kind)}><Plus size={14} /> {field.label}</button>)}</div>{background && <div className="button-row mt-6"><Button variant="secondary" onClick={() => void recolorText(background)}><Wand2 size={15} /> Re-fit text colours</Button><button type="button" className="subtle-link" onClick={() => setBackground("")}>Remove</button></div>}<label className="upload-inline"><ImagePlus size={16} /> Import logo or image<input type="file" accept="image/*" hidden onChange={event => void addImage(event.target.files?.[0])} /></label></div><Inspector element={selected} onUpdate={patch => { if (selected) designer.update(selected.id, patch); }} onRemove={() => { if (selected) designer.remove(selected.id); }} /></aside></div></>;
}

function RangeDialog({ template, onClose, onSave }: { template: PosterTemplate; onClose: () => void; onSave: (from: number | null, to: number | null) => void }) {
  const [from, setFrom] = useState(template.fromResult == null ? "" : String(template.fromResult));
  const [to, setTo] = useState(template.toResult == null ? "" : String(template.toResult));
  const [error, setError] = useState("");
  const submit = () => {
    const start = from.trim() === "" ? null : Number(from);
    const end = to.trim() === "" ? null : Number(to);
    if ((start !== null && (!Number.isInteger(start) || start < 1)) || (end !== null && (!Number.isInteger(end) || end < 1))) return setError("Use whole result numbers of 1 or more.");
    if (start !== null && end !== null && start > end) return setError("The starting result cannot be after the ending result.");
    onSave(start, end);
  };
  return <Modal title={`Result range · ${template.name}`} subtitle="Choose which published results use this template. Leave both empty to use it for every result." onClose={onClose}>
    <div className="form-stack">
      <div className="form-grid">
        <Field label="Starting result"><input autoFocus type="number" min="1" value={from} onChange={event => { setFrom(event.target.value); setError(""); }} placeholder="e.g. 1" /></Field>
        <Field label="Ending result"><input type="number" min="1" value={to} onChange={event => { setTo(event.target.value); setError(""); }} placeholder="e.g. 10" /></Field>
      </div>
      {error && <p className="warn-text">{error}</p>}
      <div className="form-actions"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit}>Confirm <ArrowRight size={16} /></Button></div>
    </div>
  </Modal>;
}

export function PosterTemplatesSection({ fest, user, onChange, notify }: SectionProps) {
  const [editingId, setEditingId] = useState<string | null>(null); const [viewingId, setViewingId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null); const [rangeId, setRangeId] = useState<string | null>(null);
  const editing = fest.data.posters.find(template => template.id === editingId);
  const viewing = fest.data.posters.find(template => template.id === viewingId);
  const ranging = fest.data.posters.find(template => template.id === rangeId);
  const sample = fest.data.programs.find(program => program.status === 5) || fest.data.programs[0];
  const rangeLabel = (template: PosterTemplate) => template.fromResult == null && template.toResult == null
    ? "All results"
    : `Results ${template.fromResult ?? 1}–${template.toResult ?? "∞"}`;
  const removeTemplate = (template: PosterTemplate) => {
    if (!confirmDelete(template.name)) return;
    onChange(data => ({ ...data, posters: data.posters.filter(item => item.id !== template.id) }), `Deleted poster template ${template.name}`);
    notify("Template deleted");
  };
  if (editingId !== null) return <PosterEditor key={editingId} fest={fest} template={editing} notify={notify} onBack={() => setEditingId(null)} onSave={template => { onChange(data => ({ ...data, posters: editing ? data.posters.map(item => item.id === editing.id ? { ...template, createdBy: user.id } : item) : [...data.posters, { ...template, createdBy: user.id }] }), `${editing ? "Updated" : "Created"} poster template ${template.name}`); setEditingId(null); notify("Template saved. Published results will use this exact design."); }} />;
  if (viewing) return <><PageHead back={() => setViewingId(null)} eyebrow="CREATE / PREVIEW" title={viewing.name} description={`A live preview of your saved template · ${rangeLabel(viewing)}`} /><div className="poster-preview-center"><DesignCanvas elements={viewing.elements} background={viewing.background} data={fest.data} festName={fest.name} program={sample} surface="poster" width={390} height={505} /></div></>;
  return <><PageHead eyebrow="CREATE / MEDIA" title="Poster Templates" description="Create once. Celebrate every published result in your own style." action={<AddButton onClick={() => setEditingId("new")}>Add template</AddButton>} />
    {fest.data.posters.length ? <div className="poster-template-grid">{fest.data.posters.map(template => <div className="template-item" key={template.id}>
      <div className="template-thumb-wrap">
        <button className="template-thumbnail" onClick={() => setViewingId(template.id)} aria-label={`Preview ${template.name}`}><div className="template-mini-scale"><DesignCanvas elements={template.elements} background={template.background} data={fest.data} festName={fest.name} program={sample} surface="poster" width={POSTER_BASE} height={440} /></div></button>
        <div className="template-menu-holder">
          <button className="template-dots" aria-label={`Options for ${template.name}`} aria-expanded={menuId === template.id} onClick={() => setMenuId(menuId === template.id ? null : template.id)}><MoreHorizontal size={18} /></button>
          {menuId === template.id && <><div className="menu-scrim" onClick={() => setMenuId(null)} /><div className="template-menu"><button onClick={() => { setRangeId(template.id); setMenuId(null); }}>Result range…</button><button onClick={() => { setViewingId(template.id); setMenuId(null); }}>Preview</button><button onClick={() => { setEditingId(template.id); setMenuId(null); }}>Edit design</button><button className="danger-text" onClick={() => { setMenuId(null); removeTemplate(template); }}>Delete</button></div></>}
        </div>
      </div>
      <div className="template-info"><div><h3>{template.name}</h3><span>{template.elements.length} elements · {rangeLabel(template)}</span></div><RowActions onView={() => setViewingId(template.id)} onEdit={() => setEditingId(template.id)} onDelete={() => removeTemplate(template)} /></div>
    </div>)}</div> : <Empty title="Your first poster starts here" description="Build a flexible template that brings published results to life." action={<AddButton onClick={() => setEditingId("new")}>Add template</AddButton>} />}
    {ranging && <RangeDialog template={ranging} onClose={() => setRangeId(null)} onSave={(from, to) => {
      onChange(data => ({ ...data, posters: data.posters.map(item => item.id === ranging.id ? { ...item, fromResult: from, toResult: to } : item) }), `Set result range for ${ranging.name}`);
      setRangeId(null); notify(from === null && to === null ? "This template now applies to every result" : `Template applies to results ${from ?? 1}–${to ?? "∞"}`);
    }} />}
  </>;
}