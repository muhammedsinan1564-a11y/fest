import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ImagePlus, Layers, Move, Plus, Sparkles, Trash2, X } from "lucide-react";
import { Button, Field, Modal } from "../ui";
import { getTeamName, id } from "../types";
import { readImage } from "./common";
import {
  SCREEN_ANIMATIONS,
  emptyScreenDesign,
  type ScreenDesign,
  type ScreenKey,
  type ScreenLayer,
} from "../lib/screenDesign";
import type { FestData } from "../types";

/** Renders the interactive dashboard head for each role's screen. */
export function ScreenCanvas({
  design,
  fallback,
  label,
}: {
  design?: ScreenDesign;
  fallback?: string;
  label: string;
}) {
  if (!design || (!design.background && !design.layers.length)) {
    if (!fallback) return null;
    return (
      <div className="screen-banner">
        <img src={fallback} alt={`${label} screen image`} />
      </div>
    );
  }
  return (
    <div className="screen-canvas" aria-label={`${label} screen`}>
      {design.background && (
        <div className="screen-canvas-bg" style={{ backgroundImage: `url(${JSON.stringify(design.background)})` }} />
      )}
      {design.layers.map((layer) => (
        <img
          key={layer.id}
          src={layer.src}
          alt={layer.name}
          className={`screen-canvas-layer fz-scr-${layer.animation}`}
          style={{
            left: `${layer.x}%`,
            top: `${layer.y}%`,
            width: `${layer.width}%`,
            height: `${layer.height}%`,
            opacity: layer.opacity,
          }}
        />
      ))}
    </div>
  );
}

/** Miniature dashboard behind the editable layers. */
function DashboardMock({ data }: { data: FestData }) {
  return (
    <div className="screen-mock" aria-hidden="true">
      <div className="screen-mock-top">
        <span>{data.teams[0] ? getTeamName(data, data.teams[0].id) : "Festival"} / LIVE WORKSPACE</span>
        <strong>Dashboard</strong>
      </div>
      <div className="screen-mock-stats">
        {["Participants", "Programs", "Live now", "Published"].map((label) => (
          <div key={label}>
            <b>02</b>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div className="screen-mock-lines">
        {data.programs.slice(0, 3).map((program) => (
          <div key={program.id}>
            <span>{program.name}</span>
            <i />
          </div>
        ))}
        {!data.programs.length && <div><span>Programs will appear here</span><i /> </div>}
      </div>
    </div>
  );
}

interface ScreenEditorProps {
  open: boolean;
  screenKey: ScreenKey | null;
  label: string;
  data: FestData;
  onSave: (key: ScreenKey, design: ScreenDesign) => void;
  onClose: () => void;
}

export function ScreenEditor({
  open,
  screenKey,
  label,
  data,
  onSave,
  onClose,
}: ScreenEditorProps) {
  const [draft, setDraft] = useState<ScreenDesign>(emptyScreenDesign());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; clientX: number; clientY: number; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!open || !screenKey) return;
    setDraft(data.screenDesigns?.[screenKey] ?? emptyScreenDesign());
    setSelectedId(null);
    setDrawerOpen(false);
    // Only re-seed when the editor opens for another screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, screenKey]);

  const selected = draft.layers.find((layer) => layer.id === selectedId) ?? null;

  const updateLayer = (layerId: string, patch: Partial<ScreenLayer>) => {
    setDraft((previous) => ({
      ...previous,
      layers: previous.layers.map((layer) => (layer.id === layerId ? { ...layer, ...patch } : layer)),
    }));
  };

  const addImages = async (files: FileList | null) => {
    if (!files?.length) return;
    const sources: string[] = [];
    const names: string[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 2_000_000) continue;
      try {
        sources.push(await readImage(file));
        names.push(file.name.replace(/\.[^.]+$/, "").slice(0, 28) || "Image");
      } catch {
        /* unreadable file skipped */
      }
    }
    if (!sources.length) return;
    setDraft((previous) => ({
      ...previous,
      layers: [
        ...previous.layers,
        ...sources.map((src, index) => ({
          id: id(),
          src,
          name: names[index],
          x: 8 + ((previous.layers.length + index) * 11) % 62,
          y: 12 + ((previous.layers.length + index) * 9) % 52,
          width: 28,
          height: 28,
          animation: "float",
          opacity: 1,
        })),
      ],
    }));
  };

  const setBackground = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 2_000_000) return;
    try {
      const source = await readImage(file);
      setDraft((previous) => ({ ...previous, background: source }));
    } catch {
      /* unreadable file ignored */
    }
  };

  const beginDrag = (event: ReactPointerEvent<HTMLImageElement>, layer: ScreenLayer) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(layer.id);
    dragRef.current = { id: layer.id, clientX: event.clientX, clientY: event.clientY, x: layer.x, y: layer.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: ReactPointerEvent<HTMLImageElement>) => {
    const drag = dragRef.current;
    const box = previewRef.current;
    if (!drag || !box) return;
    const dx = ((event.clientX - drag.clientX) / box.clientWidth) * 100;
    const dy = ((event.clientY - drag.clientY) / box.clientHeight) * 100;
    const layer = draft.layers.find((item) => item.id === drag.id);
    if (!layer) return;
    updateLayer(drag.id, {
      x: Math.max(0, Math.min(100 - layer.width, drag.x + dx)),
      y: Math.max(0, Math.min(100 - layer.height, drag.y + dy)),
    });
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const removeLayer = (layerId: string) => {
    setDraft((previous) => ({ ...previous, layers: previous.layers.filter((layer) => layer.id !== layerId) }));
    if (selectedId === layerId) setSelectedId(null);
  };

  const save = () => {
    if (!screenKey) return;
    onSave(screenKey, draft);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && screenKey && (
        <Modal
          key={`screen-editor-${screenKey}`}
          title={`Edit ${label.toLowerCase()}`}
          subtitle="Drag images, stack as many as you like, set a background and pick from 20 animations."
          onClose={onClose}
          wide
        >
          <div className="screen-editor">
            <div className="screen-editor-toolbar">
              <label className="upload-inline">
                <Plus size={15} /> Add images
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/*"
                  multiple
                  hidden
                  onChange={(event) => {
                    const input = event.currentTarget;
                    void addImages(input.files).finally(() => {
                      input.value = "";
                    });
                  }}
                />
              </label>
              <label className="upload-inline">
                <ImagePlus size={15} /> Background
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/*"
                  hidden
                  onChange={(event) => {
                    const input = event.currentTarget;
                    void setBackground(input.files?.[0]).finally(() => {
                      input.value = "";
                    });
                  }}
                />
              </label>
              <button
                type="button"
                className={`outline-small ${drawerOpen ? "active" : ""}`}
                onClick={() => setDrawerOpen((value) => !value)}
              >
                <Sparkles size={14} /> 20 animations
              </button>
              {draft.background && (
                <button type="button" className="subtle-link" onClick={() => setDraft((p) => ({ ...p, background: undefined }))}>
                  Clear background
                </button>
              )}
            </div>

            <div className="screen-editor-body">
              <div className="screen-preview-wrap">
                <div
                  className="screen-preview"
                  ref={previewRef}
                  onClick={() => setSelectedId(null)}
                >
                  <DashboardMock data={data} />
                  {draft.background && (
                    <div
                      className="screen-preview-bg"
                      style={{ backgroundImage: `url(${JSON.stringify(draft.background)})` }}
                    />
                  )}
                  <AnimatePresence initial={false}>
                    {draft.layers.map((layer) => (
                      <motion.img
                        key={layer.id}
                        src={layer.src}
                        alt={layer.name}
                        className={`screen-preview-layer fz-scr-${layer.animation} ${selectedId === layer.id ? "selected" : ""}`}
                        style={{
                          left: `${layer.x}%`,
                          top: `${layer.y}%`,
                          width: `${layer.width}%`,
                          height: `${layer.height}%`,
                          opacity: layer.opacity,
                        }}
                        onPointerDown={(event) => beginDrag(event, layer)}
                        onPointerMove={moveDrag}
                        onPointerUp={endDrag}
                        onPointerCancel={endDrag}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedId(layer.id);
                        }}
                      />
                    ))}
                  </AnimatePresence>
                  <span className="screen-preview-hint"><Move size={12} /> Drag images to arrange</span>
                </div>

                <AnimatePresence initial={false}>
                  {drawerOpen && (
                    <motion.div
                      className="animation-drawer"
                      initial={{ opacity: 0, x: 18 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 18 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="animation-drawer-head">
                        <strong>Animation drawer</strong>
                        <button type="button" aria-label="Close animation drawer" onClick={() => setDrawerOpen(false)}>
                          <X size={15} />
                        </button>
                      </div>
                      <p className="muted small-text">
                        {selected ? `Applying to “${selected.name}”` : "Select an image to animate it."}
                      </p>
                      <div className="animation-grid">
                        {SCREEN_ANIMATIONS.map((animation) => (
                          <button
                            type="button"
                            key={animation.id}
                            disabled={!selected}
                            className={selected?.animation === animation.id ? "active" : ""}
                            onClick={() => selected && updateLayer(selected.id, { animation: animation.id })}
                          >
                            <span className={`animation-dot fz-scr-${animation.id}`} />
                            {animation.label}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="screen-layer-panel">
                <span className="eyebrow"><Layers size={13} /> LAYERS ({draft.layers.length})</span>
                {draft.layers.length ? (
                  <div className="screen-layer-list">
                    {draft.layers.map((layer) => (
                      <button
                        type="button"
                        key={layer.id}
                        className={`screen-layer-item ${selectedId === layer.id ? "active" : ""}`}
                        onClick={() => setSelectedId(layer.id)}
                      >
                        <img src={layer.src} alt="" />
                        <span>
                          <strong>{layer.name}</strong>
                          <small>{SCREEN_ANIMATIONS.find((a) => a.id === layer.animation)?.label ?? "Still"}</small>
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label={`Remove ${layer.name}`}
                          className="layer-remove"
                          onClick={(event) => {
                            event.stopPropagation();
                            removeLayer(layer.id);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              event.stopPropagation();
                              removeLayer(layer.id);
                            }
                          }}
                        >
                          <Trash2 size={13} />
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="muted small-text">No images yet. Add one or more to build this screen.</p>
                )}

                {selected && (
                  <div className="screen-layer-props">
                    <span className="eyebrow">EDIT IMAGE</span>
                    <div className="screen-prop-grid">
                      <Field label="Width %">
                        <input
                          type="number"
                          min={5}
                          max={100}
                          value={Math.round(selected.width)}
                          onChange={(event) =>
                            updateLayer(selected.id, { width: Math.max(5, Math.min(100, Number(event.target.value) || 5)) })
                          }
                        />
                      </Field>
                      <Field label="Height %">
                        <input
                          type="number"
                          min={5}
                          max={100}
                          value={Math.round(selected.height)}
                          onChange={(event) =>
                            updateLayer(selected.id, { height: Math.max(5, Math.min(100, Number(event.target.value) || 5)) })
                          }
                        />
                      </Field>
                      <Field label="Name">
                        <input value={selected.name} onChange={(event) => updateLayer(selected.id, { name: event.target.value })} />
                      </Field>
                      <Field label="Animation">
                        <select
                          value={selected.animation}
                          onChange={(event) => updateLayer(selected.id, { animation: event.target.value })}
                        >
                          {SCREEN_ANIMATIONS.map((animation) => (
                            <option key={animation.id} value={animation.id}>
                              {animation.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <label className="checkbox-line compact">
                      <span>Opacity {Math.round(selected.opacity * 100)}%</span>
                      <input
                        type="range"
                        min={0.2}
                        max={1}
                        step={0.05}
                        value={selected.opacity}
                        onChange={(event) => updateLayer(selected.id, { opacity: Number(event.target.value) })}
                      />
                    </label>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setDraft((previous) => ({ ...previous, background: selected.src }));
                        removeLayer(selected.id);
                      }}
                    >
                      Use as background
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="form-actions">
              <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
              <Button type="button" onClick={save}>Save screen design</Button>
            </div>
          </div>
        </Modal>
      )}
    </AnimatePresence>
  );
}

export type { ScreenEditorProps };
