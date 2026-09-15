import React, { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { useStore, uid, log } from "../lib/store";
import type { TplEl, Member } from "../lib/store";
import { Icon, Btn, IconBtn, Field, Tag, FontPicker, useToast } from "../lib/ui";
import { FONTS, ensureFonts, fontsOf, requestFont, paintTemplate, fileToSizedDataURL } from "../lib/editor";
import type { Route } from "./Shell";

type P = { push: (r: Route) => void; params?: Record<string, string>; back?: () => void };

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

// Presets in mm
const CARD_PRESETS = [
  { id: "75x105", name: "Event badge", w: 75, h: 105 },
  { id: "54x85.6", name: "CR80 Standard", w: 54, h: 85.6 },
  { id: "80x110", name: "ID Badge", w: 80, h: 110 },
  { id: "80x80", name: "Square badge", w: 80, h: 80 },
  { id: "custom", name: "Custom size", w: 75, h: 105 },
];

const PAPERS = [
  { id: "a4_p", name: "A4 portrait · 210 × 297 mm", w: 210, h: 297 },
  { id: "a4_l", name: "A4 landscape · 297 × 210 mm", w: 297, h: 210 },
  { id: "a3_p", name: "A3 portrait · 297 × 420 mm", w: 297, h: 420 },
  { id: "letter_p", name: "Letter portrait · 216 × 279 mm", w: 216, h: 279 },
];

const PRESET_FIELDS = [
  { bind: "code", label: "Chest number", kind: "text" },
  { bind: "name", label: "Name", kind: "text" },
  { bind: "team", label: "Team", kind: "text" },
  { bind: "category", label: "Category", kind: "text" },
  { bind: "qrcode", label: "QR code", kind: "qrcode" },
  { bind: "dp", label: "Photo / DP", kind: "image" },
];

const qrCache = new Map<string, string>();
async function fetchQrUrl(text: string, color = "#000000"): Promise<string> {
  const key = `${text}_${color}`;
  if (qrCache.has(key)) return qrCache.get(key)!;
  try {
    const url = await QRCode.toDataURL(text || "FESTIZE", {
      margin: 1,
      color: { dark: color, light: "#ffffff" },
      width: 250,
    });
    qrCache.set(key, url);
    return url;
  } catch {
    return "";
  }
}

export function IdCardSection(_: P) {
  const { data, fest, session, updateFest } = useStore();
  const toast = useToast();

  const tpl = data?.idTemplate;

  // Active Wizard Tab
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);

  // Setup state
  const [preset, setPreset] = useState(tpl?.preset || "75x105");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">(tpl?.orientation || "portrait");
  const [paper, setPaper] = useState(tpl?.paper || "a4_p");

  const initialWMm = tpl?.wMm || 75;
  const initialHMm = tpl?.hMm || 105;
  const [customWMm, setCustomWMm] = useState(initialWMm);
  const [customHMm, setCustomHMm] = useState(initialHMm);

  const [bgImage, setBgImage] = useState(tpl?.bgImage || "");
  const [bg, setBg] = useState(tpl?.bg || "#ffffff");

  // Elements state
  const [els, setEls] = useState<TplEl[]>(tpl?.els || []);
  const [sel, setSel] = useState<string | null>(null);

  // Undo / Redo history
  const [history, setHistory] = useState<TplEl[][]>([tpl?.els || []]);
  const [historyIdx, setHistoryIdx] = useState(0);

  // Editor states
  const [zoom, setZoom] = useState(1);
  const [previewLongest, setPreviewLongest] = useState(false);

  // Print setup state
  const [marginMm, setMarginMm] = useState(tpl?.marginMm ?? 10);
  const [gapMm, setGapMm] = useState(tpl?.gapMm ?? 4);
  const [cropMarks, setCropMarks] = useState(tpl?.cropMarks ?? true);
  const [teamPageBreak, setTeamPageBreak] = useState(tpl?.teamPageBreak ?? false);
  const [showQrCode, setShowQrCode] = useState(tpl?.showQrCode ?? true);

  // QR URLs state
  const [qrMap, setQrMap] = useState<Record<string, string>>({});

  const [isSaved, setIsSaved] = useState(true);

  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Calculate actual mm dimensions based on preset and orientation
  const rawPreset = CARD_PRESETS.find((p) => p.id === preset) || CARD_PRESETS[0];
  let baseW = preset === "custom" ? customWMm : rawPreset.w;
  let baseH = preset === "custom" ? customHMm : rawPreset.h;

  if (orientation === "landscape") {
    const w = Math.max(baseW, baseH);
    const h = Math.min(baseW, baseH);
    baseW = w;
    baseH = h;
  } else {
    const w = Math.min(baseW, baseH);
    const h = Math.max(baseW, baseH);
    baseW = w;
    baseH = h;
  }

  const cardWMm = baseW;
  const cardHMm = baseH;

  // Pixel dimensions inside canvas coordinate space (1 mm = 8 px space)
  const PX_PER_MM = 8;
  const W_PX = Math.round(cardWMm * PX_PER_MM);
  const H_PX = Math.round(cardHMm * PX_PER_MM);

  // 3mm bleed recommended pixels at 300 DPI (1 mm = 11.811 px)
  const bleedWPx = Math.round((cardWMm + 6) * (300 / 25.4));
  const bleedHPx = Math.round((cardHMm + 6) * (300 / 25.4));

  // Active paper specs
  const paperObj = PAPERS.find((p) => p.id === paper) || PAPERS[0];

  // Font loading
  useEffect(() => { ensureFonts(fontsOf(els)); }, [els]);

  // Push element changes to history for undo/redo
  const pushState = (newEls: TplEl[]) => {
    const nextHistory = history.slice(0, historyIdx + 1);
    nextHistory.push(newEls);
    setHistory(nextHistory);
    setHistoryIdx(nextHistory.length - 1);
    setEls(newEls);
    setIsSaved(false);
  };

  const undo = () => {
    if (historyIdx > 0) {
      const idx = historyIdx - 1;
      setHistoryIdx(idx);
      setEls(history[idx]);
      setIsSaved(false);
    }
  };

  const redo = () => {
    if (historyIdx < history.length - 1) {
      const idx = historyIdx + 1;
      setHistoryIdx(idx);
      setEls(history[idx]);
      setIsSaved(false);
    }
  };

  // Sample data for preview
  const sampleMember: Member = previewLongest
    ? {
        id: "longest",
        name: "Dr. Anjanamithra Sreenivasan",
        teamId: "",
        categoryId: "",
        code: "#99@999",
        place: "Royal Champions Club of Rivertown",
        phone: "+91 98765 43210",
      }
    : data?.members[0] || {
        id: "sample",
        name: "Anjali Nair",
        teamId: "",
        categoryId: "",
        code: "#12@345",
        place: "Rivertown Arts",
      };

  // Pre-generate QR codes for sample and members
  useEffect(() => {
    let active = true;
    (async () => {
      const map: Record<string, string> = {};
      const sampleCode = sampleMember.code;
      map[sampleCode] = await fetchQrUrl(sampleCode);
      if (data?.members) {
        for (const m of data.members.slice(0, 30)) {
          map[m.code] = await fetchQrUrl(m.code);
        }
      }
      if (active) setQrMap(map);
    })();
    return () => { active = false; };
  }, [data?.members, sampleMember.code]);

  if (!data || !fest || !session || !tpl) return null;

  const selEl = els.find((e) => e.id === sel) || null;

  // Save template to store
  const saveDesign = () => {
    updateFest(fest.id, (d) => {
      d.idTemplate = {
        w: W_PX,
        h: H_PX,
        wMm: cardWMm,
        hMm: cardHMm,
        preset,
        orientation,
        paper,
        marginMm,
        gapMm,
        cropMarks,
        teamPageBreak,
        showQrCode,
        bg,
        bgImage: bgImage || undefined,
        els,
      };
      log(d, session.name, "ID card design saved");
    });
    setIsSaved(true);
    toast("ID card design saved successfully", "ok");
  };

  // Element actions
  const addField = (bind: string, label: string, kind = "text") => {
    let newEl: TplEl;
    if (kind === "qrcode" || bind === "qrcode") {
      newEl = {
        id: uid(),
        kind: "qrcode",
        bind: "qrcode",
        x: W_PX / 2 - 50,
        y: H_PX / 2 - 50,
        w: 100,
        h: 100,
        color: "#000000",
      };
    } else if (kind === "image" || bind === "dp") {
      newEl = {
        id: uid(),
        kind: "image",
        bind: bind === "dp" ? "dp" : undefined,
        src: "",
        shape: bind === "dp" ? "circle" : "rect",
        x: W_PX / 2 - 60,
        y: H_PX / 2 - 60,
        w: 120,
        h: 120,
        zoom: 1,
      };
    } else {
      newEl = {
        id: uid(),
        kind: "text",
        bind,
        text: label,
        x: 30,
        y: H_PX / 2 - 15,
        w: W_PX - 60,
        h: 30,
        font: "Manrope",
        size: 22,
        color: "#17211b",
        bold: true,
        align: "center",
      };
    }
    pushState([...els, newEl]);
    setSel(newEl.id);
    toast(`Added field: ${label}`, "ok");
  };

  const patchSel = (fn: (e: TplEl) => TplEl) => {
    if (!sel) return;
    const updated = els.map((e) => (e.id === sel ? fn(e) : e));
    pushState(updated);
  };

  const removeSel = () => {
    if (!sel) return;
    pushState(els.filter((e) => e.id !== sel));
    setSel(null);
    toast("Element removed", "ok");
  };

  // Alignment helpers
  const alignLeft = () => patchSel((e) => ({ ...e, x: 10 }));
  const alignCentre = () => patchSel((e) => ({ ...e, x: Math.round((W_PX - e.w) / 2) }));
  const alignRight = () => patchSel((e) => ({ ...e, x: W_PX - e.w - 10 }));

  // Pointer Dragging on Canvas
  const startDrag = (el: TplEl) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSel(el.id);
    const rect = canvasWrapRef.current!.getBoundingClientRect();
    let last = { x: e.clientX, y: e.clientY };
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - last.x;
      const dy = ev.clientY - last.y;
      last = { x: ev.clientX, y: ev.clientY };
      setEls((prev) =>
        prev.map((x) =>
          x.id === el.id
            ? {
                ...x,
                x: clamp(Math.round(x.x + (dx / rect.width) * W_PX), -x.w + 10, W_PX - 10),
                y: clamp(Math.round(x.y + (dy / rect.height) * H_PX), -10, H_PX - 10),
              }
            : x,
        ),
      );
      setIsSaved(false);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const startResize = (el: TplEl) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    let last = { x: e.clientX, y: e.clientY };
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - last.x;
      const dy = ev.clientY - last.y;
      last = { x: ev.clientX, y: ev.clientY };
      setEls((prev) =>
        prev.map((x) => {
          if (x.id !== el.id) return x;
          if (x.kind === "text") {
            return { ...x, size: clamp(Math.round((x.size || 20) + dx * 0.25), 8, 90) };
          }
          return {
            ...x,
            w: Math.max(20, Math.round(x.w + dx)),
            h: Math.max(20, Math.round(x.h + dy)),
          };
        }),
      );
      setIsSaved(false);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // Convert pixel value to mm string
  const toMm = (px: number, maxPx: number, maxMm: number) =>
    ((px / maxPx) * maxMm).toFixed(1);

  // Template background image upload
  const onBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      const url = await fileToSizedDataURL(f);
      setBgImage(url);
      setIsSaved(false);
      toast("Card template background updated", "ok");
    } catch {
      toast("Could not read template file", "err");
    }
  };

  // Logo upload
  const onLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      const url = await fileToSizedDataURL(f, 800);
      const newEl: TplEl = {
        id: uid(),
        kind: "image",
        src: url,
        shape: "rect",
        x: W_PX / 2 - 50,
        y: 20,
        w: 100,
        h: 100,
        zoom: 1,
      };
      pushState([...els, newEl]);
      setSel(newEl.id);
      toast("Logo image added", "ok");
    } catch {
      toast("Could not read image file", "err");
    }
  };

  // Value map for DOM & Canvas rendering
  const getBindText = (bind?: string, text?: string) => {
    if (!bind) return text || "";
    if (bind === "name") return sampleMember.name;
    if (bind === "code") return sampleMember.code;
    if (bind === "team") return data.teams.find((t) => t.id === sampleMember.teamId)?.name || "Red Warriors";
    if (bind === "category") return data.categories.find((c) => c.id === sampleMember.categoryId)?.name || "Senior Category";
    return text || bind;
  };

  // Render Element on Editor Canvas
  const renderCanvasEl = (el: TplEl) => {
    const selected = sel === el.id;
    const stylePos: React.CSSProperties = {
      left: `${(el.x / W_PX) * 100}%`,
      top: `${(el.y / H_PX) * 100}%`,
    };

    if (el.kind === "text") {
      const textVal = getBindText(el.bind, el.text);
      return (
        <div
          key={el.id}
          className={`el-box ${selected ? "el-sel" : ""}`}
          onPointerDown={startDrag(el)}
          style={{
            ...stylePos,
            width: `${(el.w / W_PX) * 100}%`,
            color: el.color || "#17211b",
            textAlign: el.align || "center",
            whiteSpace: "nowrap",
            fontFamily: `"${el.font || "Manrope"}"`,
            fontWeight: el.bold ? 800 : 500,
            lineHeight: 1.15,
          }}
        >
          <span style={{ fontSize: `calc((100cqw / ${W_PX}) * ${el.size || 20})` }}>
            {textVal}
          </span>
          {selected && <span className="handle" onPointerDown={startResize(el)} />}
        </div>
      );
    }

    if (el.kind === "qrcode" || el.bind === "qrcode") {
      const qrData = qrMap[sampleMember.code] || "";
      return (
        <div
          key={el.id}
          className={`el-box ${selected ? "el-sel" : ""}`}
          onPointerDown={startDrag(el)}
          style={{
            ...stylePos,
            width: `${(el.w / W_PX) * 100}%`,
            height: `${(el.h / H_PX) * 100}%`,
          }}
        >
          <div className="w-full h-full flex items-center justify-center bg-white p-1 rounded">
            {qrData ? (
              <img src={qrData} alt="QR Code" className="w-full h-full object-contain pointer-events-none" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-[9px] font-mono font-bold text-gray-500 border border-dashed border-gray-300">
                <Icon n="grid" s={18} />
                <span>QR</span>
              </div>
            )}
          </div>
          {selected && <span className="handle" onPointerDown={startResize(el)} />}
        </div>
      );
    }

    if (el.kind === "image") {
      const demoPhoto = el.bind === "dp" ? (sampleMember.photo || "") : el.src || "";
      return (
        <div
          key={el.id}
          className={`el-box ${selected ? "el-sel" : ""}`}
          onPointerDown={startDrag(el)}
          style={{
            ...stylePos,
            width: `${(el.w / W_PX) * 100}%`,
            height: `${(el.h / H_PX) * 100}%`,
          }}
        >
          <div
            className="w-full h-full"
            style={{
              background: demoPhoto ? `url(${demoPhoto}) center/cover` : "var(--panel3)",
              borderRadius: el.shape === "circle" ? "50%" : 0,
              border: demoPhoto ? "none" : "2px dashed var(--line2)",
            }}
          >
            {!demoPhoto && (
              <span className="w-full h-full flex items-center justify-center text-[10px] font-extrabold uppercase text-gray-400">
                {el.bind || "photo"}
              </span>
            )}
          </div>
          {selected && <span className="handle" onPointerDown={startResize(el)} />}
        </div>
      );
    }

    // Shape
    return (
      <div
        key={el.id}
        className={`el-box ${selected ? "el-sel" : ""}`}
        onPointerDown={startDrag(el)}
        style={{
          ...stylePos,
          width: `${(el.w / W_PX) * 100}%`,
          height: `${(el.h / H_PX) * 100}%`,
        }}
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
          {el.shape === "circle" ? (
            <ellipse cx="50" cy="50" rx="50" ry="50" fill={el.color || "#0e7c6b"} />
          ) : (
            <rect width="100" height="100" fill={el.color || "#0e7c6b"} />
          )}
        </svg>
        {selected && <span className="handle" onPointerDown={startResize(el)} />}
      </div>
    );
  };

  // Generate printable multi-card A4 HTML Sheet View
  const membersToPrint = data.members.length > 0 ? data.members : [sampleMember];

  // Calculate printable grid layout per paper
  const availWMm = paperObj.w - 2 * marginMm;
  const availHMm = paperObj.h - 2 * marginMm;
  const colsPerPage = Math.max(1, Math.floor((availWMm + gapMm) / (cardWMm + gapMm)));
  const rowsPerPage = Math.max(1, Math.floor((availHMm + gapMm) / (cardHMm + gapMm)));
  const cardsPerPage = colsPerPage * rowsPerPage;

  // Group members into pages
  const renderPages = () => {
    if (!teamPageBreak) {
      const pages: Member[][] = [];
      for (let i = 0; i < membersToPrint.length; i += cardsPerPage) {
        pages.push(membersToPrint.slice(i, i + cardsPerPage));
      }
      return pages;
    }
    // Team break enabled
    const pages: Member[][] = [];
    for (const team of data.teams) {
      const teamMems = membersToPrint.filter((m) => m.teamId === team.id);
      for (let i = 0; i < teamMems.length; i += cardsPerPage) {
        pages.push(teamMems.slice(i, i + cardsPerPage));
      }
    }
    if (pages.length === 0) pages.push(membersToPrint.slice(0, cardsPerPage));
    return pages;
  };

  const pages = renderPages();

  // Print PDF Generator
  const downloadHighResPdf = async () => {
    try {
      toast("Preparing high-resolution PDF printout...", "ok");
      await ensureFonts(fontsOf(els));

      const canvas = document.createElement("canvas");
      const SCALE = 2.5;

      const jsPDFMod = await import("jspdf");
      const doc = new jsPDFMod.jsPDF({
        orientation: paperObj.w > paperObj.h ? "landscape" : "portrait",
        unit: "mm",
        format: [paperObj.w, paperObj.h],
      });

      for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
        if (pageIdx > 0) doc.addPage([paperObj.w, paperObj.h]);
        const pageMembers = pages[pageIdx];

        for (let i = 0; i < pageMembers.length; i++) {
          const m = pageMembers[i];
          const col = i % colsPerPage;
          const row = Math.floor(i / colsPerPage);

          const xMm = marginMm + col * (cardWMm + gapMm);
          const yMm = marginMm + row * (cardHMm + gapMm);

          // Ensure QR is ready for this member
          let memberQr = qrMap[m.code];
          if (!memberQr) memberQr = await fetchQrUrl(m.code);

          const mapRecord: Record<string, { text?: string; src?: string }> = {};
          for (const e of els) {
            if (e.bind === "name") mapRecord[e.id] = { text: m.name };
            else if (e.bind === "code") mapRecord[e.id] = { text: m.code };
            else if (e.bind === "team") mapRecord[e.id] = { text: data.teams.find((t) => t.id === m.teamId)?.name || "—" };
            else if (e.bind === "category") mapRecord[e.id] = { text: data.categories.find((c) => c.id === m.categoryId)?.name || "—" };
            else if (e.bind === "dp") mapRecord[e.id] = { src: m.photo || "", text: m.name };
            else if (e.bind === "qrcode" || e.kind === "qrcode") mapRecord[e.id] = { src: showQrCode ? memberQr : "" };
          }

          // Filter out qr if disabled
          const drawEls = showQrCode ? els : els.filter((e) => e.kind !== "qrcode" && e.bind !== "qrcode");

          await paintTemplate(
            canvas,
            { w: W_PX, h: H_PX, bg, bgImage: bgImage || undefined },
            drawEls,
            mapRecord,
            SCALE,
          );

          const imgData = canvas.toDataURL("image/jpeg", 0.92);
          doc.addImage(imgData, "JPEG", xMm, yMm, cardWMm, cardHMm);

          // Crop marks if enabled
          if (cropMarks) {
            const tick = 3;
            doc.setDrawColor(120, 120, 120);
            doc.setLineWidth(0.2);
            doc.line(xMm - tick, yMm, xMm, yMm);
            doc.line(xMm, yMm - tick, xMm, yMm);
            doc.line(xMm + cardWMm, yMm, xMm + cardWMm + tick, yMm);
            doc.line(xMm + cardWMm, yMm - tick, xMm + cardWMm, yMm);
            doc.line(xMm - tick, yMm + cardHMm, xMm, yMm + cardHMm);
            doc.line(xMm, yMm + cardHMm, xMm, yMm + cardHMm + tick);
            doc.line(xMm + cardWMm, yMm + cardHMm, xMm + cardWMm + tick, yMm + cardHMm);
            doc.line(xMm + cardWMm, yMm + cardHMm, xMm + cardWMm, yMm + cardHMm + tick);
          }
        }
      }

      doc.save(`${fest.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_id_cards.pdf`);
      toast("PDF download ready!", "ok");
    } catch (err) {
      console.error(err);
      toast("PDF generation failed — check console for details", "err");
    }
  };

  return (
    <div className="space-y-4">
      {/* ---------------- TOP HEADER ---------------- */}
      <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span style={{ color: "var(--marigold)" }}>
            <Icon n="idcard" s={24} />
          </span>
          <div>
            <div className="font-d text-[18px] font-black">ID card designer</div>
            <div className="flex items-center gap-2 mt-0.5">
              {isSaved ? (
                <span className="tag" style={{ background: "var(--acc-soft)", color: "var(--acc)" }}>
                  <Icon n="check" s={12} sw={3} /> Saved
                </span>
              ) : (
                <span className="tag" style={{ background: "var(--marigold-soft)", color: "var(--marigold)" }}>
                  Unsaved changes
                </span>
              )}
              <span className="text-[11.5px] font-semibold" style={{ color: "var(--mut)" }}>
                {cardWMm} × {cardHMm} mm · {orientation}
              </span>
            </div>
          </div>
        </div>

        <Btn kind="gold" onClick={saveDesign}>
          <Icon n="check" s={16} sw={2.4} /> Save design
        </Btn>
      </div>

      {/* ---------------- 3 STEPS / TABS ---------------- */}
      <div className="grid grid-cols-3 gap-2 card p-1.5 bg-[var(--panel2)]">
        <button
          type="button"
          onClick={() => setActiveStep(1)}
          className={`py-2.5 px-3 rounded-xl font-extrabold text-[13px] flex items-center justify-center gap-2 transition-all ${
            activeStep === 1
              ? "bg-[var(--panel)] text-[var(--ink)] shadow-md"
              : "text-[var(--mut)] hover:text-[var(--ink)]"
          }`}
        >
          <span className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-black bg-[var(--acc-soft)] text-[var(--acc)]">
            1
          </span>
          <span>Card setup</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveStep(2)}
          className={`py-2.5 px-3 rounded-xl font-extrabold text-[13px] flex items-center justify-center gap-2 transition-all ${
            activeStep === 2
              ? "bg-[var(--panel)] text-[var(--ink)] shadow-md"
              : "text-[var(--mut)] hover:text-[var(--ink)]"
          }`}
        >
          <span className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-black bg-[var(--marigold-soft)] text-[var(--marigold)]">
            2
          </span>
          <span>Design</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveStep(3)}
          className={`py-2.5 px-3 rounded-xl font-extrabold text-[13px] flex items-center justify-center gap-2 transition-all ${
            activeStep === 3
              ? "bg-[var(--panel)] text-[var(--ink)] shadow-md"
              : "text-[var(--mut)] hover:text-[var(--ink)]"
          }`}
        >
          <span className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-black bg-[var(--coral-soft)] text-[var(--coral)]">
            3
          </span>
          <span>Sheet preview</span>
        </button>
      </div>

      {/* ================= STEP 1: CARD SETUP ================= */}
      {activeStep === 1 && (
        <div className="card p-5 space-y-5 anim-in">
          <div className="font-d text-[16px] font-extrabold flex items-center gap-2">
            <Icon n="sliders" s={18} /> Card setup
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Card Preset */}
            <div>
              <span className="lbl">Card preset</span>
              <select
                className="select"
                value={preset}
                onChange={(e) => {
                  setPreset(e.target.value);
                  setIsSaved(false);
                }}
              >
                {CARD_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.w} × {p.h} mm
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Dimensions if selected */}
            {preset === "custom" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="lbl">Width (mm)</span>
                  <input
                    className="input"
                    type="number"
                    value={customWMm}
                    onChange={(e) => {
                      setCustomWMm(parseFloat(e.target.value) || 50);
                      setIsSaved(false);
                    }}
                  />
                </div>
                <div>
                  <span className="lbl">Height (mm)</span>
                  <input
                    className="input"
                    type="number"
                    value={customHMm}
                    onChange={(e) => {
                      setCustomHMm(parseFloat(e.target.value) || 50);
                      setIsSaved(false);
                    }}
                  />
                </div>
              </div>
            )}

            {/* Orientation */}
            <div>
              <span className="lbl">Orientation</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOrientation("portrait");
                    setIsSaved(false);
                  }}
                  className={`flex-1 py-2 rounded-xl font-bold text-[13px] border transition-all ${
                    orientation === "portrait"
                      ? "bg-[var(--acc-soft)] text-[var(--acc)] border-[var(--acc)]"
                      : "bg-[var(--panel2)] border-[var(--line)]"
                  }`}
                >
                  Portrait
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOrientation("landscape");
                    setIsSaved(false);
                  }}
                  className={`flex-1 py-2 rounded-xl font-bold text-[13px] border transition-all ${
                    orientation === "landscape"
                      ? "bg-[var(--acc-soft)] text-[var(--acc)] border-[var(--acc)]"
                      : "bg-[var(--panel2)] border-[var(--line)]"
                  }`}
                >
                  Landscape
                </button>
              </div>
            </div>

            {/* Paper */}
            <div>
              <span className="lbl">Paper</span>
              <select
                className="select"
                value={paper}
                onChange={(e) => {
                  setPaper(e.target.value);
                  setIsSaved(false);
                }}
              >
                {PAPERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Background Color */}
            <div>
              <span className="lbl">Card Solid Background Color</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="w-10 h-9 rounded cursor-pointer border shrink-0"
                  value={bg}
                  onChange={(e) => {
                    setBg(e.target.value);
                    setIsSaved(false);
                  }}
                />
                <input
                  className="input flex-1 mono"
                  value={bg}
                  onChange={(e) => {
                    setBg(e.target.value);
                    setIsSaved(false);
                  }}
                />
              </div>
            </div>
          </div>

          {/* Background / Template Upload */}
          <div className="card2 p-4 space-y-3">
            <span className="lbl mb-0">Template Background Image</span>
            <div className="flex items-center gap-3 flex-wrap">
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={onBgUpload} />
              <span className="text-[13px] font-bold text-gray-400 truncate max-w-[200px]">
                {bgImage ? "Template image loaded" : "No file chosen"}
              </span>
              <Btn size="sm" kind="soft" onClick={() => fileInputRef.current?.click()}>
                <Icon n="image" s={14} /> Upload PNG or JPEG
              </Btn>
              {bgImage && (
                <Btn size="sm" kind="danger" onClick={() => { setBgImage(""); setIsSaved(false); }}>
                  Remove
                </Btn>
              )}
            </div>
            <p className="text-[12px] font-bold" style={{ color: "var(--mut)" }}>
              Recommended with 3 mm bleed: <b style={{ color: "var(--ink)" }}>{bleedWPx} × {bleedHPx} px</b>
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <Btn onClick={() => setActiveStep(2)}>
              Next: Design Card <Icon n="arrowR" s={15} />
            </Btn>
          </div>
        </div>
      )}

      {/* ================= STEP 2: DESIGN ================= */}
      {activeStep === 2 && (
        <div className="space-y-4 anim-in">
          {/* Card fields selector & toolbar */}
          <div className="card p-4 space-y-3">
            <div>
              <div className="font-d text-[15px] font-extrabold">Card fields</div>
              <div className="text-[12px] font-bold text-[var(--mut)]">Select to edit field position, size or style:</div>
            </div>

            {/* Chips of existing elements */}
            <div className="flex flex-wrap gap-1.5">
              {els.map((el) => {
                const isSelected = sel === el.id;
                const fieldLabel =
                  PRESET_FIELDS.find((f) => f.bind === el.bind)?.label || el.bind || el.text || el.kind;
                return (
                  <button
                    key={el.id}
                    type="button"
                    onClick={() => setSel(el.id)}
                    className={`px-3 py-1.5 rounded-xl font-bold text-[12px] border transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? "bg-[var(--acc)] text-[#08211b] border-[var(--acc)] shadow-sm"
                        : "bg-[var(--panel2)] text-[var(--ink)] border-[var(--line)] hover:border-[var(--acc)]"
                    }`}
                  >
                    <span>{fieldLabel}</span>
                  </button>
                );
              })}
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--line)]">
              {/* Add Field Dropdown */}
              <div className="relative inline-block text-left">
                <select
                  className="select"
                  style={{ width: "auto", padding: "6px 28px 6px 10px", fontSize: "12.5px" }}
                  onChange={(e) => {
                    const val = e.target.value;
                    e.target.value = "";
                    if (!val) return;
                    if (val === "custom_text") addField("", "Custom Text", "text");
                    else if (val === "logo") logoInputRef.current?.click();
                    else if (val === "shape_rect") {
                      const newShape: TplEl = { id: uid(), kind: "shape", shape: "rect", color: "#0e7c6b", x: W_PX / 2 - 60, y: H_PX / 2 - 40, w: 120, h: 80 };
                      pushState([...els, newShape]);
                      setSel(newShape.id);
                    } else {
                      const pf = PRESET_FIELDS.find((f) => f.bind === val);
                      if (pf) addField(pf.bind, pf.label, pf.kind);
                    }
                  }}
                >
                  <option value="">+ Add field...</option>
                  {PRESET_FIELDS.map((f) => (
                    <option key={f.bind} value={f.bind}>
                      {f.label}
                    </option>
                  ))}
                  <option value="custom_text">Custom Text</option>
                  <option value="logo">Image / Logo</option>
                  <option value="shape_rect">Rectangle Shape</option>
                </select>
              </div>
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={onLogoUpload} />

              <div className="h-5 w-[1px] bg-[var(--line)]" />

              {/* Undo / Redo */}
              <IconBtn n="undo" s={14} title="Undo" onClick={undo} />
              <IconBtn n="redo" s={14} title="Redo" onClick={redo} />

              <div className="h-5 w-[1px] bg-[var(--line)]" />

              {/* Alignment Buttons */}
              <Btn size="sm" kind="soft" onClick={alignLeft} title="Align left">Left</Btn>
              <Btn size="sm" kind="soft" onClick={alignCentre} title="Align centre">Centre</Btn>
              <Btn size="sm" kind="soft" onClick={alignRight} title="Align right">Right</Btn>

              <div className="h-5 w-[1px] bg-[var(--line)]" />

              {/* Zoom preset */}
              <select
                className="select"
                style={{ width: "auto", padding: "4px 24px 4px 8px", fontSize: "12px" }}
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
              >
                <option value={0.75}>75%</option>
                <option value={1}>100%</option>
                <option value={1.25}>125%</option>
                <option value={1.5}>150%</option>
              </select>

              {/* Longest data toggle */}
              <label className="flex items-center gap-1.5 cursor-pointer ml-auto text-[12px] font-extrabold select-none">
                <input
                  type="checkbox"
                  checked={previewLongest}
                  onChange={(e) => setPreviewLongest(e.target.checked)}
                  className="rounded"
                />
                <span>Preview longest data</span>
              </label>
            </div>
          </div>

          {/* Interactive Ruler & Canvas */}
          <div className="card p-4 flex flex-col items-center">
            {/* RULER CONTAINER */}
            <div className="relative overflow-auto p-4 max-w-full flex flex-col items-center" style={{ maxHeight: "70vh" }}>
              <div className="relative inline-block" style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}>
                {/* TOP HORIZONTAL RULER (mm) */}
                <div className="flex h-5 ml-6 border-b border-[var(--line)] bg-[var(--panel2)] font-mono text-[9px] text-[var(--mut)] select-none">
                  {Array.from({ length: Math.ceil(cardWMm / 10) + 1 }, (_, i) => i * 10).map((mm) => (
                    <div
                      key={mm}
                      className="border-l border-[var(--line2)] h-full relative"
                      style={{ width: `${10 * PX_PER_MM}px` }}
                    >
                      <span className="absolute top-0.5 left-1">{mm}</span>
                    </div>
                  ))}
                  <span className="pl-1 self-center font-bold">mm</span>
                </div>

                <div className="flex">
                  {/* LEFT VERTICAL RULER (mm) */}
                  <div className="w-6 border-r border-[var(--line)] bg-[var(--panel2)] font-mono text-[9px] text-[var(--mut)] select-none flex flex-col">
                    {Array.from({ length: Math.ceil(cardHMm / 10) + 1 }, (_, i) => i * 10).map((mm) => (
                      <div
                        key={mm}
                        className="border-t border-[var(--line2)] w-full relative"
                        style={{ height: `${10 * PX_PER_MM}px` }}
                      >
                        <span className="absolute left-0.5 top-0.5">{mm}</span>
                      </div>
                    ))}
                  </div>

                  {/* INTERACTIVE CARD CANVAS */}
                  <div
                    ref={canvasWrapRef}
                    className="relative overflow-hidden shadow-2xl select-none"
                    style={{
                      width: `${W_PX}px`,
                      height: `${H_PX}px`,
                      background: bg,
                      backgroundImage: bgImage ? `url(${bgImage})` : undefined,
                      backgroundSize: "cover",
                      containerType: "inline-size",
                      touchAction: "none",
                    }}
                    onPointerDown={() => setSel(null)}
                  >
                    {els.map(renderCanvasEl)}
                  </div>
                </div>
              </div>
            </div>

            <p className="text-[12px] font-bold mt-2 text-center text-[var(--mut)]">
              Upload a card template — Use a 300 DPI PNG or JPEG · Edit {selEl ? selEl.bind || selEl.kind : "field"} style and position
            </p>
          </div>

          {/* Selected Field Inspector Panel */}
          {selEl && (
            <div className="card p-4 space-y-4 bg-[var(--panel2)] anim-in">
              <div className="flex items-center justify-between">
                <span className="font-d text-[14.5px] font-extrabold">
                  Edit {PRESET_FIELDS.find((f) => f.bind === selEl.bind)?.label || selEl.bind || selEl.kind} style and position
                </span>
                <Btn size="sm" kind="danger" onClick={removeSel}>
                  <Icon n="trash" s={14} /> Remove field
                </Btn>
              </div>

              {/* Position & Measurements in mm */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Field label="X (mm)">
                  <input
                    className="input"
                    type="number"
                    value={toMm(selEl.x, W_PX, cardWMm)}
                    onChange={(e) => {
                      const valMm = parseFloat(e.target.value) || 0;
                      patchSel((el) => ({ ...el, x: Math.round((valMm / cardWMm) * W_PX) }));
                    }}
                  />
                </Field>
                <Field label="Y (mm)">
                  <input
                    className="input"
                    type="number"
                    value={toMm(selEl.y, H_PX, cardHMm)}
                    onChange={(e) => {
                      const valMm = parseFloat(e.target.value) || 0;
                      patchSel((el) => ({ ...el, y: Math.round((valMm / cardHMm) * H_PX) }));
                    }}
                  />
                </Field>
                <Field label="Width (mm)">
                  <input
                    className="input"
                    type="number"
                    value={toMm(selEl.w, W_PX, cardWMm)}
                    onChange={(e) => {
                      const valMm = parseFloat(e.target.value) || 10;
                      patchSel((el) => ({ ...el, w: Math.round((valMm / cardWMm) * W_PX) }));
                    }}
                  />
                </Field>
                <Field label="Height (mm)">
                  <input
                    className="input"
                    type="number"
                    value={toMm(selEl.h, H_PX, cardHMm)}
                    onChange={(e) => {
                      const valMm = parseFloat(e.target.value) || 10;
                      patchSel((el) => ({ ...el, h: Math.round((valMm / cardHMm) * H_PX) }));
                    }}
                  />
                </Field>
              </div>

              {/* Specific controls for text */}
              {selEl.kind === "text" && (
                <div className="space-y-3">
                  {!selEl.bind && (
                    <Field label="Text Content">
                      <input
                        className="input"
                        value={selEl.text || ""}
                        onChange={(e) => patchSel((el) => ({ ...el, text: e.target.value }))}
                      />
                    </Field>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Font Family">
                      <FontPicker
                        value={selEl.font || "Manrope"}
                        fonts={FONTS}
                        request={requestFont}
                        onChange={(f) => patchSel((el) => ({ ...el, font: f }))}
                      />
                    </Field>

                    <div className="space-y-3">
                      <Field label="Font Size">
                        <input
                          className="input"
                          type="number"
                          value={selEl.size || 20}
                          onChange={(e) => patchSel((el) => ({ ...el, size: parseInt(e.target.value) || 12 }))}
                        />
                      </Field>

                      <Field label="Text Color">
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            className="w-10 h-9 rounded cursor-pointer border"
                            value={selEl.color || "#17211b"}
                            onChange={(e) => patchSel((el) => ({ ...el, color: e.target.value }))}
                          />
                          <input
                            className="input flex-1 mono"
                            value={selEl.color || "#17211b"}
                            onChange={(e) => patchSel((el) => ({ ...el, color: e.target.value }))}
                          />
                        </div>
                      </Field>

                      <div className="flex gap-2">
                        <Btn
                          size="sm"
                          kind={selEl.bold ? "primary" : "soft"}
                          onClick={() => patchSel((el) => ({ ...el, bold: !el.bold }))}
                        >
                          Bold
                        </Btn>
                        <Btn
                          size="sm"
                          kind={selEl.align === "left" ? "primary" : "soft"}
                          onClick={() => patchSel((el) => ({ ...el, align: "left" }))}
                        >
                          Left
                        </Btn>
                        <Btn
                          size="sm"
                          kind={selEl.align === "center" ? "primary" : "soft"}
                          onClick={() => patchSel((el) => ({ ...el, align: "center" }))}
                        >
                          Centre
                        </Btn>
                        <Btn
                          size="sm"
                          kind={selEl.align === "right" ? "primary" : "soft"}
                          onClick={() => patchSel((el) => ({ ...el, align: "right" }))}
                        >
                          Right
                        </Btn>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Specific controls for image/photo */}
              {selEl.kind === "image" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Photo Frame Shape">
                    <div className="flex gap-2">
                      <Btn
                        size="sm"
                        kind={selEl.shape === "rect" ? "primary" : "soft"}
                        onClick={() => patchSel((el) => ({ ...el, shape: "rect" }))}
                      >
                        Rectangle
                      </Btn>
                      <Btn
                        size="sm"
                        kind={selEl.shape === "circle" ? "primary" : "soft"}
                        onClick={() => patchSel((el) => ({ ...el, shape: "circle" }))}
                      >
                        Circle
                      </Btn>
                      <Btn
                        size="sm"
                        kind={selEl.shape === "heart" ? "primary" : "soft"}
                        onClick={() => patchSel((el) => ({ ...el, shape: "heart" }))}
                      >
                        Heart
                      </Btn>
                    </div>
                  </Field>
                </div>
              )}

              {/* Specific controls for QR */}
              {(selEl.kind === "qrcode" || selEl.bind === "qrcode") && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="QR Code Color">
                    <input
                      type="color"
                      className="w-12 h-9 rounded cursor-pointer border"
                      value={selEl.color || "#000000"}
                      onChange={(e) => patchSel((el) => ({ ...el, color: e.target.value }))}
                    />
                  </Field>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between pt-2">
            <Btn kind="soft" onClick={() => setActiveStep(1)}>
              <Icon n="arrowL" s={15} /> Back to Setup
            </Btn>
            <Btn onClick={() => setActiveStep(3)}>
              Next: Sheet Preview <Icon n="arrowR" s={15} />
            </Btn>
          </div>
        </div>
      )}

      {/* ================= STEP 3: SHEET PREVIEW (A4) ================= */}
      {activeStep === 3 && (
        <div className="space-y-5 anim-in">
          {/* Print setup options */}
          <div className="card p-5 space-y-4">
            <div className="font-d text-[16px] font-extrabold flex items-center gap-2">
              <Icon n="printer" s={18} /> Print setup
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Field label="Margin (mm)">
                <input
                  className="input"
                  type="number"
                  value={marginMm}
                  onChange={(e) => {
                    setMarginMm(parseFloat(e.target.value) || 0);
                    setIsSaved(false);
                  }}
                />
              </Field>

              <Field label="Gap (mm)">
                <input
                  className="input"
                  type="number"
                  value={gapMm}
                  onChange={(e) => {
                    setGapMm(parseFloat(e.target.value) || 0);
                    setIsSaved(false);
                  }}
                />
              </Field>

              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="cropMarksCheck"
                  checked={cropMarks}
                  onChange={(e) => {
                    setCropMarks(e.target.checked);
                    setIsSaved(false);
                  }}
                  className="rounded"
                />
                <label htmlFor="cropMarksCheck" className="text-[13px] font-extrabold cursor-pointer">
                  Crop marks
                </label>
              </div>

              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="teamBreakCheck"
                  checked={teamPageBreak}
                  onChange={(e) => {
                    setTeamPageBreak(e.target.checked);
                    setIsSaved(false);
                  }}
                  className="rounded"
                />
                <label htmlFor="teamBreakCheck" className="text-[13px] font-extrabold cursor-pointer">
                  Start each team on a new page
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[var(--line)]">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="qrCodeCheck"
                  checked={showQrCode}
                  onChange={(e) => {
                    setShowQrCode(e.target.checked);
                    setIsSaved(false);
                  }}
                  className="rounded"
                />
                <label htmlFor="qrCodeCheck" className="text-[13px] font-extrabold cursor-pointer">
                  Participant QR code
                </label>
              </div>

              <Btn kind="gold" onClick={downloadHighResPdf}>
                <Icon n="download" s={15} /> Download PDF ({pages.length} Pages)
              </Btn>
            </div>
          </div>

          {/* Sheet preview (A4) Display */}
          <div className="card p-5 space-y-4 flex flex-col items-center">
            <div className="w-full flex items-center justify-between">
              <div className="font-d text-[16px] font-extrabold flex items-center gap-2">
                <Icon n="image" s={18} /> Sheet preview ({paperObj.name.split("·")[0].trim()})
              </div>
              <Tag color="var(--acc)">
                {paperObj.w} × {paperObj.h} mm · {cardsPerPage} cards / page
              </Tag>
            </div>

            {/* Render Pages Grid */}
            <div className="space-y-8 w-full flex flex-col items-center">
              {pages.map((pageMems, pageIdx) => (
                <div key={pageIdx} className="flex flex-col items-center space-y-2">
                  <div className="text-[12px] font-extrabold text-[var(--mut)]">
                    Page {pageIdx + 1} of {pages.length} ({pageMems.length} Cards)
                  </div>

                  {/* A4 Printable Sheet Display Box */}
                  <div
                    className="bg-white shadow-2xl relative border overflow-hidden select-none"
                    style={{
                      width: `${paperObj.w * 2.6}px`,
                      height: `${paperObj.h * 2.6}px`,
                      borderColor: "#c0c0c0",
                      padding: `${(marginMm / paperObj.w) * 100}%`,
                    }}
                  >
                    <div className="w-full h-full relative">
                      {pageMems.map((m, i) => {
                        const col = i % colsPerPage;
                        const row = Math.floor(i / colsPerPage);

                        const leftPct = ((col * (cardWMm + gapMm)) / (paperObj.w - 2 * marginMm)) * 100;
                        const topPct = ((row * (cardHMm + gapMm)) / (paperObj.h - 2 * marginMm)) * 100;
                        const widthPct = (cardWMm / (paperObj.w - 2 * marginMm)) * 100;
                        const heightPct = (cardHMm / (paperObj.h - 2 * marginMm)) * 100;

                        return (
                          <div
                            key={m.id}
                            className="absolute border border-gray-300 overflow-hidden shadow-sm bg-white"
                            style={{
                              left: `${leftPct}%`,
                              top: `${topPct}%`,
                              width: `${widthPct}%`,
                              height: `${heightPct}%`,
                              background: bg,
                              backgroundImage: bgImage ? `url(${bgImage})` : undefined,
                              backgroundSize: "cover",
                              containerType: "inline-size",
                            }}
                          >
                            {/* Render card elements */}
                            {els.map((el) => {
                              const stylePos: React.CSSProperties = {
                                left: `${(el.x / W_PX) * 100}%`,
                                top: `${(el.y / H_PX) * 100}%`,
                              };

                              if (el.kind === "text") {
                                let txt = getBindText(el.bind, el.text);
                                if (el.bind === "name") txt = m.name;
                                if (el.bind === "code") txt = m.code;
                                if (el.bind === "team") txt = data.teams.find((t) => t.id === m.teamId)?.name || "—";
                                if (el.bind === "category") txt = data.categories.find((c) => c.id === m.categoryId)?.name || "—";

                                return (
                                  <div
                                    key={el.id}
                                    style={{
                                      ...stylePos,
                                      position: "absolute",
                                      width: `${(el.w / W_PX) * 100}%`,
                                      color: el.color || "#17211b",
                                      textAlign: el.align || "center",
                                      whiteSpace: "nowrap",
                                      fontFamily: `"${el.font || "Manrope"}"`,
                                      fontWeight: el.bold ? 800 : 500,
                                      lineHeight: 1.15,
                                    }}
                                  >
                                    <span style={{ fontSize: `calc((100cqw / ${W_PX}) * ${el.size || 20})` }}>
                                      {txt}
                                    </span>
                                  </div>
                                );
                              }

                              if (showQrCode && (el.kind === "qrcode" || el.bind === "qrcode")) {
                                const qrData = qrMap[m.code] || "";
                                return (
                                  <div
                                    key={el.id}
                                    style={{
                                      ...stylePos,
                                      position: "absolute",
                                      width: `${(el.w / W_PX) * 100}%`,
                                      height: `${(el.h / H_PX) * 100}%`,
                                    }}
                                  >
                                    <div className="w-full h-full flex items-center justify-center bg-white p-0.5 rounded">
                                      {qrData ? (
                                        <img src={qrData} alt="QR" className="w-full h-full object-contain" />
                                      ) : (
                                        <div className="w-full h-full border border-dashed border-gray-400" />
                                      )}
                                    </div>
                                  </div>
                                );
                              }

                              if (el.kind === "image") {
                                const photo = el.bind === "dp" ? (m.photo || "") : el.src || "";
                                return (
                                  <div
                                    key={el.id}
                                    style={{
                                      ...stylePos,
                                      position: "absolute",
                                      width: `${(el.w / W_PX) * 100}%`,
                                      height: `${(el.h / H_PX) * 100}%`,
                                    }}
                                  >
                                    <div
                                      className="w-full h-full"
                                      style={{
                                        background: photo ? `url(${photo}) center/cover` : "#e0e0e0",
                                        borderRadius: el.shape === "circle" ? "50%" : 0,
                                      }}
                                    />
                                  </div>
                                );
                              }

                              return (
                                <div
                                  key={el.id}
                                  style={{
                                    ...stylePos,
                                    position: "absolute",
                                    width: `${(el.w / W_PX) * 100}%`,
                                    height: `${(el.h / H_PX) * 100}%`,
                                  }}
                                >
                                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
                                    {el.shape === "circle" ? (
                                      <ellipse cx="50" cy="50" rx="50" ry="50" fill={el.color || "#0e7c6b"} />
                                    ) : (
                                      <rect width="100" height="100" fill={el.color || "#0e7c6b"} />
                                    )}
                                  </svg>
                                </div>
                              );
                            })}

                            {/* Crop marks overlay on individual card */}
                            {cropMarks && (
                              <>
                                <div className="absolute top-0 left-0 border-l border-t border-gray-400 w-2 h-2" />
                                <div className="absolute top-0 right-0 border-r border-t border-gray-400 w-2 h-2" />
                                <div className="absolute bottom-0 left-0 border-l border-b border-gray-400 w-2 h-2" />
                                <div className="absolute bottom-0 right-0 border-r border-b border-gray-400 w-2 h-2" />
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
