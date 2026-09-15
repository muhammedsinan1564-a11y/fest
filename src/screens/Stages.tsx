import React, { useRef, useState } from "react";
import { useStore, uid, log } from "../lib/store";
import type { Stage, Marker } from "../lib/store";
import { Icon, Btn, IconBtn, Field, Modal, Empty, PageHead, useToast, useAsk } from "../lib/ui";
import { fileToSizedDataURL } from "../lib/editor";
import type { Route } from "./Shell";

type P = { push: (r: Route) => void; params?: Record<string, string>; back?: () => void };

const MARKER_ICONS = ["pin", "star", "flag", "camera", "bolt", "heart", "mic", "target", "music", "diamond"];

export function StagesSection({ push }: P) {
  const { data, fest, session, updateFest } = useStore();
  const toast = useToast(); const ask = useAsk();
  const [add, setAdd] = useState(false);
  const [name, setName] = useState("");
  const [details, setDetails] = useState("");
  const [image, setImage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  if (!data || !fest || !session) return null;
  const isMain = session.role === "MAIN";

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try { setImage(await fileToSizedDataURL(f)); } catch { toast("Could not read that image", "err"); }
  };
  const save = () => {
    if (!name.trim()) { toast("Name the stage", "err"); return; }
    if (!details.trim()) { toast("Add the details of the place", "err"); return; }
    updateFest(fest.id, (d) => {
      d.stages.push({ id: uid(), name: name.trim(), details: details.trim(), image, markers: [] });
      log(d, session.name, `Stage "${name}" added`);
    });
    toast("Stage added", "ok");
    setAdd(false); setName(""); setDetails(""); setImage("");
  };
  const del = async (s: Stage) => {
    const ok = await ask({ title: `Delete stage "${s.name}"?`, body: "Its details, map and markers will be removed.", yes: "Delete", danger: true });
    if (!ok) return;
    updateFest(fest.id, (d) => { d.stages = d.stages.filter((x) => x.id !== s.id); log(d, session.name, `Stage "${s.name}" deleted`); });
    toast("Stage deleted", "ok");
  };

  return (
    <div>
      <PageHead title="Stages" sub={isMain ? "Add each venue with its details. A picture is optional — if added, open the stage to view and pin it." : "Venue details — read only for crew roles."}>
        {isMain && <Btn onClick={() => { setName(""); setDetails(""); setImage(""); setAdd(true); }}><Icon n="plus" s={16} sw={2.4} /> Add Stage</Btn>}
      </PageHead>
      {data.stages.length === 0 ? <Empty icon="image" title="No stages yet" body="Add a stage with its name and place details. A picture is optional." /> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.stages.map((s, i) => (
            <button key={s.id} type="button" onClick={() => push({ id: "stageDetail", params: { sid: s.id } })}
              className="card hoverable overflow-hidden text-left anim-in group" style={{ animationDelay: i * 50 + "ms" }}>
              <div className="h-[150px] overflow-hidden relative" style={{ background: "var(--panel3)" }}>
                {s.image ? (
                  <img src={s.image} alt={s.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-1.5" style={{ color: "var(--mut)" }}>
                    <Icon n="mappin" s={26} />
                    <span className="text-[11px] font-extrabold uppercase tracking-wider">No picture</span>
                  </div>
                )}
                {s.image && <span className="absolute top-2 right-2 tag" style={{ background: "#000000aa", color: "#fff" }}>{s.markers.filter((m) => m.visible).length} pins</span>}
              </div>
              <div className="p-3.5 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-d text-[14px] font-extrabold truncate">{s.name}</div>
                  <div className="text-[11.5px] font-semibold mt-0.5 line-clamp-2" style={{ color: "var(--mut)" }}>{s.details || "open the stage"}</div>
                </div>
                {isMain && (
                  <span onClick={(e) => e.stopPropagation()}>
                    <IconBtn n="trash" s={15} title="Delete stage" danger onClick={() => del(s)} />
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
      <Modal open={add} onClose={() => setAdd(false)} title="New Stage" footer={
        <><Btn kind="soft" onClick={() => setAdd(false)}>Cancel</Btn><Btn onClick={save}>Confirm</Btn></>
      }>
        <Field label="Name of the stage">
          <input className="input" value={name} autoFocus placeholder="e.g. Main Arena" onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Details of the place">
          <textarea className="textarea" value={details} placeholder="Location, seating, entry point, backstage notes…" onChange={(e) => setDetails(e.target.value)} />
        </Field>
        <Field label="Picture of the place (optional)">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
          {image ? (
            <div className="relative rounded-xl overflow-hidden" style={{ border: "1.5px solid var(--line)" }}>
              <img src={image} alt="" className="w-full max-h-[220px] object-cover" />
              <button className="icobtn absolute top-2 right-2 card2" onClick={() => fileRef.current?.click()} title="Replace image"><Icon n="image" s={16} /></button>
              <button className="icobtn danger absolute top-2 right-12 card2" onClick={() => setImage("")} title="Remove image"><Icon n="trash" s={16} /></button>
            </div>
          ) : (
            <button type="button" className="w-full card2 py-9 flex flex-col items-center gap-2" style={{ border: "2px dashed var(--line2)" }} onClick={() => fileRef.current?.click()}>
              <Icon n="image" s={26} className="opacity-60" />
              <span className="text-[12.5px] font-extrabold uppercase tracking-wider" style={{ color: "var(--acc)" }}>Import image (optional)</span>
            </button>
          )}
        </Field>
      </Modal>
    </div>
  );
}

export function StageDetail({ params }: P) {
  const { data, fest, session, updateFest } = useStore();
  const toast = useToast(); const ask = useAsk();
  const stage = data?.stages.find((s) => s.id === params?.sid);
  const imgRef = useRef<HTMLDivElement>(null);
  const [dragIcon, setDragIcon] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const [selMarker, setSelMarker] = useState<string | null>(null);
  const [renaming, setRenaming] = useState("");
  const movedRef = useRef(false);
  if (!data || !fest || !session) return null;
  if (!stage) return <Empty icon="image" title="Stage not found" body="It may have been deleted." />;
  const isMain = session.role === "MAIN";
  const sel = stage.markers.find((m) => m.id === selMarker);

  const startPaletteDrag = (icon: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    movedRef.current = false;
    setDragIcon(icon);
    setGhost({ x: e.clientX, y: e.clientY });
    const move = (ev: PointerEvent) => { movedRef.current = true; setGhost({ x: ev.clientX, y: ev.clientY }); };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const rect = imgRef.current?.getBoundingClientRect();
      if (rect && ev.clientX >= rect.left && ev.clientX <= rect.right && ev.clientY >= rect.top && ev.clientY <= rect.bottom) {
        const x = ((ev.clientX - rect.left) / rect.width) * 100;
        const y = ((ev.clientY - rect.top) / rect.height) * 100;
        addMarker(icon, x, y);
      } else if (!movedRef.current) {
        addMarker(icon, 50, 50);
      }
      setDragIcon(null); setGhost(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const addMarker = (icon: string, x: number, y: number) => {
    updateFest(fest.id, (d) => {
      const s = d.stages.find((st) => st.id === stage.id);
      if (!s) return;
      const m: Marker = { id: uid(), icon, x, y, name: icon.toUpperCase() + " " + (s.markers.length + 1), visible: true };
      s.markers.push(m);
      log(d, session.name, `Marker added on "${stage.name}"`);
      setSelMarker(m.id); setRenaming(m.name);
    });
    toast("Marker placed — drag it, rename it", "ok");
  };
  const markerDrag = (m: Marker) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    let last = { x: e.clientX, y: e.clientY };
    const move = (ev: PointerEvent) => {
      const rect = imgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const dx = ev.clientX - last.x, dy = ev.clientY - last.y;
      last = { x: ev.clientX, y: ev.clientY };
      updateFest(fest.id, (d) => {
        const s = d.stages.find((st) => st.id === stage.id);
        const mm = s?.markers.find((x) => x.id === m.id);
        if (mm) {
          mm.x = Math.min(100, Math.max(0, mm.x + (dx / rect.width) * 100));
          mm.y = Math.min(100, Math.max(0, mm.y + (dy / rect.height) * 100));
        }
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const patch = (mid: string, fn: (m: Marker) => void, msg?: string) => {
    updateFest(fest.id, (d) => {
      const s = d.stages.find((st) => st.id === stage.id);
      const m = s?.markers.find((x) => x.id === mid);
      if (m) fn(m);
      if (msg) log(d, session.name, msg);
    });
  };
  const delMarker = async (m: Marker) => {
    const ok = await ask({ title: `Remove marker "${m.name}"?`, yes: "Remove", danger: true });
    if (!ok) return;
    updateFest(fest.id, (d) => {
      const s = d.stages.find((st) => st.id === stage.id);
      if (s) s.markers = s.markers.filter((x) => x.id !== m.id);
      log(d, session.name, `Marker "${m.name}" removed`);
    });
    setSelMarker(null);
    toast("Marker removed", "ok");
  };
  const saveRename = () => {
    if (!sel) return;
    patch(sel.id, (m) => { m.name = renaming.trim() || m.name; }, `Marker renamed → "${renaming}"`);
    toast("Marker renamed", "ok");
  };

  return (
    <div>
      <PageHead title={stage.name} sub={stage.image ? (isMain ? "Drag icons from the tray onto the photo. Click a pin to rename, hide or delete it." : "Read-only venue map.") : "Venue details."} />
      <div className="card2 p-4 mb-4 anim-in">
        <div className="lbl">Details of the place</div>
        <p className="text-[13.5px] font-semibold whitespace-pre-wrap" style={{ color: "var(--ink)" }}>{stage.details || "No details added."}</p>
      </div>
      {!stage.image ? (
        <Empty icon="mappin" title="No picture for this stage" body="This stage was added without a picture. Add one from the Stages list to pin locations on it." />
      ) : (
      <div className="flex gap-4 flex-col lg:flex-row">
        <div className="flex-1">
          <div ref={imgRef} className="relative card overflow-hidden select-none" style={{ touchAction: "none" }}>
            <img src={stage.image} alt={stage.name} className="w-full block max-h-[64vh] object-contain" style={{ background: "var(--panel2)" }} draggable={false} />
            {stage.markers.filter((m) => m.visible || isMain).map((m) => (
              <button key={m.id} type="button"
                onPointerDown={isMain ? markerDrag(m) : undefined}
                onClick={() => { setSelMarker(m.id); setRenaming(m.name); }}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                style={{ left: m.x + "%", top: m.y + "%", opacity: m.visible ? 1 : 0.35, cursor: isMain ? "grab" : "default" }}>
                <span className="w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-110"
                  style={{ background: selMarker === m.id ? "var(--marigold)" : "var(--acc)", color: "#08211b", border: "2.5px solid #fff" }}>
                  <Icon n={m.icon} s={16} sw={2.1} />
                </span>
                <span className="mt-1 px-1.5 py-0.5 rounded text-[9.5px] font-extrabold tracking-wide" style={{ background: "#000000b0", color: "#fff" }}>{m.name}</span>
              </button>
            ))}
            {stage.markers.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="tag" style={{ background: "#000000a0", color: "#fff", fontSize: 12.5, padding: "8px 14px" }}>
                  {isMain ? "Drag pins from the tray on the right" : "No markers placed yet"}
                </span>
              </div>
            )}
          </div>
        </div>
        {isMain && (
          <div className="lg:w-[240px] shrink-0 grid gap-3 content-start">
            <div className="card p-3.5">
              <span className="lbl">Marker tray</span>
              <div className="grid grid-cols-5 gap-1.5">
                {MARKER_ICONS.map((ic) => (
                  <button key={ic} type="button" onPointerDown={startPaletteDrag(ic)}
                    className="w-9.5 h-9.5 rounded-lg flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                    style={{ width: 38, height: 38, background: "var(--panel3)", color: "var(--ink)", border: "1px solid var(--line)", cursor: "grab", touchAction: "none" }}
                    title={`Drag ${ic} onto the photo`}>
                    <Icon n={ic} s={16} />
                  </button>
                ))}
              </div>
              <p className="text-[11px] font-bold mt-2.5" style={{ color: "var(--mut)" }}>drag onto the photo · or tap to drop in the centre</p>
            </div>
            {sel && (
              <div className="card p-3.5 pop">
                <span className="lbl">Selected marker</span>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--acc-soft)", color: "var(--acc)" }}><Icon n={sel.icon} s={15} /></span>
                  <input className="input" value={renaming} onChange={(e) => setRenaming(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveRename()} />
                </div>
                <div className="flex gap-1.5">
                  <Btn size="sm" kind="soft" className="flex-1" onClick={saveRename}><Icon n="check" s={14} /> Name</Btn>
                  <Btn size="sm" kind="soft" className="flex-1" onClick={() => patch(sel.id, (m) => { m.visible = !m.visible; })}>
                    <Icon n={sel.visible ? "eyeoff" : "eye"} s={14} /> {sel.visible ? "Hide" : "Show"}
                  </Btn>
                  <Btn size="sm" kind="danger" onClick={() => delMarker(sel)}><Icon n="trash" s={14} /></Btn>
                </div>
              </div>
            )}
            <div className="card p-3.5">
              <span className="lbl">All markers</span>
              <div className="grid gap-1 max-h-[220px] overflow-y-auto">
                {stage.markers.map((m) => (
                  <button key={m.id} type="button" onClick={() => { setSelMarker(m.id); setRenaming(m.name); }}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left"
                    style={{ background: selMarker === m.id ? "var(--acc-soft)" : "transparent", opacity: m.visible ? 1 : 0.5 }}>
                    <Icon n={m.icon} s={14} />
                    <span className="text-[12.5px] font-bold flex-1 truncate">{m.name}</span>
                    <Icon n={m.visible ? "eye" : "eyeoff"} s={13} className="opacity-60" />
                  </button>
                ))}
                {stage.markers.length === 0 && <div className="text-[12px] font-bold py-2 text-center" style={{ color: "var(--mut)" }}>empty tray, empty map</div>}
              </div>
            </div>
          </div>
        )}
      </div>
      )}
      {dragIcon && ghost && (
        <div className="fixed z-[100] pointer-events-none -translate-x-1/2 -translate-y-1/2" style={{ left: ghost.x, top: ghost.y }}>
          <span className="w-10 h-10 rounded-full flex items-center justify-center shadow-xl" style={{ background: "var(--marigold)", color: "#231a04" }}>
            <Icon n={dragIcon} s={18} sw={2.1} />
          </span>
        </div>
      )}
    </div>
  );
}
