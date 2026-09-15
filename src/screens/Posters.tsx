import React, { useEffect, useRef, useState } from "react";
import { useStore, uid, log, st, programResults, resultNo, POSTER_FIELDS } from "../lib/store";
import type { Poster, TplEl, Program, FestData } from "../lib/store";
import { Icon, Btn, Empty, PageHead, ZoomBar, FontPicker, useToast, useAsk } from "../lib/ui";
import { FONTS, ensureFonts, fontsOf, requestFont, paintTemplate, downloadCanvas, fileToSizedDataURL } from "../lib/editor";
import type { Route } from "./Shell";

type P = { push: (r: Route) => void; params?: Record<string, string>; back?: () => void };
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const W = 750, H = 1000;

/** Stand-in values shown while designing, so the editor previews real-looking output. */
const SAMPLE: Record<string, string> = {
  program: "Light Music", category: "Senior", resultNo: "RESULT NO. 1",
  wName: "Anjali · Red Warriors", wGp: "A+",
  rName: "Rahul · Blue Titans", rGp: "A",
  r2Name: "Meera · Green Falcons", r2Gp: "B",
};

function posterMapFor(d: FestData, p: Program, els: TplEl[]): Record<string, { text?: string }> {
  const rows = programResults(d, p);
  const cat = d.categories.find((c) => c.id === p.categoryId)?.name || "—";
  const no = resultNo(d, p.id);
  const vals: Record<string, string> = {
    program: p.name, category: cat,
    resultNo: no ? `RESULT NO. ${no}` : "—",
    wName: rows[0]?.label || "—", wGp: rows[0]?.grade?.name || "—",
    rName: rows[1]?.label || "—", rGp: rows[1]?.grade?.name || "—",
    r2Name: rows[2]?.label || "—", r2Gp: rows[2]?.grade?.name || "—",
  };
  const out: Record<string, { text?: string }> = {};
  for (const el of els) if (el.bind && vals[el.bind]) out[el.id] = { text: vals[el.bind] };
  return out;
}

function Thumb({ t, h = 190 }: { t: Poster; h?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let on = true;
    (async () => {
      await ensureFonts(fontsOf(t.els));
      if (ref.current && on) await paintTemplate(ref.current, t, t.els, {}, h / t.h, { fixedTextBox: true });
    })();
    return () => { on = false; };
  }, [t, h]);
  return <canvas ref={ref} className="w-full rounded-lg" style={{ aspectRatio: `${t.w}/${t.h}`, background: t.bg }} />;
}

/* ---------------- list ---------------- */
export function PostersSection({ push }: P) {
  const { data, fest, session, updateFest } = useStore();
  const toast = useToast(); const ask = useAsk();
  if (!data || !fest || !session) return null;
  const del = async (t: Poster) => {
    const ok = await ask({ title: `Delete template "${t.name}"?`, body: "Results using it will fall back to other templates.", yes: "Delete", danger: true });
    if (!ok) return;
    updateFest(fest.id, (d) => { d.posters = d.posters.filter((x) => x.id !== t.id); log(d, session.name, `Poster "${t.name}" deleted`); });
    toast("Template deleted", "ok");
  };
  return (
    <div>
      <PageHead title="Poster Templates" sub="Design result posters once — every published program wears them.">
        <Btn kind="gold" onClick={() => push({ id: "posterEditor", params: { tid: "new" } })}><Icon n="plus" s={16} sw={2.4} /> Add Template</Btn>
      </PageHead>
      {data.posters.length === 0 ? <Empty icon="palette" title="No templates yet" body="Create a template and it will appear on every result." /> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.posters.map((t, i) => (
            <div key={t.id} className="card hoverable p-3 anim-in" style={{ animationDelay: i * 60 + "ms" }}>
              <Thumb t={t} />
              <div className="flex items-center justify-between mt-3">
                <div className="min-w-0">
                  <div className="font-d text-[13.5px] font-extrabold truncate">{t.name}</div>
                  <div className="text-[11px] font-bold" style={{ color: "var(--mut)" }}>{t.els.length} elements</div>
                </div>
                <span className="flex gap-0.5 shrink-0">
                  <button className="icobtn" title="Edit template" onClick={() => push({ id: "posterEditor", params: { tid: t.id } })}><Icon n="edit" s={15} /></button>
                  <button className="icobtn danger" title="Delete template" onClick={() => del(t)}><Icon n="trash" s={15} /></button>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- editor ---------------- */
export function PosterEditor({ params, back }: P) {
  const { data, fest, session, updateFest } = useStore();
  const toast = useToast();
  const existing = params?.tid !== "new" ? data?.posters.find((t) => t.id === params?.tid) : undefined;
  const [name, setName] = useState(existing?.name || "Untitled Poster");
  const [bg, setBg] = useState(existing?.bg || "#10231c");
  const [bgImage, setBgImage] = useState(existing?.bgImage || "");
  const [els, setEls] = useState<TplEl[]>(existing?.els || []);
  const [sel, setSel] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  // pull down whatever fonts this design uses so the live preview is accurate,
  // then re-render so text measures against the real font, exactly like the export
  const [, setFontsTick] = useState(0);
  useEffect(() => {
    let on = true;
    (async () => { await ensureFonts(fontsOf(els)); if (on) setFontsTick((t) => t + 1); })();
    return () => { on = false; };
  }, [els]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  if (!data || !fest || !session) return null;
  const selEl = els.find((e) => e.id === sel) || null;
  const patchSel = (fn: (e: TplEl) => TplEl) => setEls((prev) => prev.map((e) => (e.id === sel ? fn(e) : e)));

  const save = () => {
    if (!name.trim()) { toast("Name the template", "err"); return; }
    updateFest(fest.id, (d) => {
      const t: Poster = { id: existing?.id || uid(), name: name.trim(), w: W, h: H, bg, bgImage: bgImage || undefined, els };
      const i = d.posters.findIndex((x) => x.id === t.id);
      if (i >= 0) d.posters[i] = t; else d.posters.push(t);
      log(d, session.name, `Poster template "${t.name}" saved`);
    });
    toast("Template saved", "ok");
    back?.();
  };

  const addEl = (el: TplEl) => { setEls((p) => [...p, el]); setSel(el.id); toast("Added — drag it into place", "ok"); };
  const startDrag = (el: TplEl) => (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    setSel(el.id);
    const rect = wrapRef.current!.getBoundingClientRect();
    let last = { x: e.clientX, y: e.clientY };
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - last.x, dy = ev.clientY - last.y;
      last = { x: ev.clientX, y: ev.clientY };
      setEls((prev) => prev.map((x) => x.id === el.id ? { ...x, x: clamp(x.x + (dx / rect.width) * W, -x.w + 20, W - 20), y: clamp(x.y + (dy / rect.height) * H, -30, H - 10) } : x));
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const startResize = (el: TplEl) => (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    let last = { x: e.clientX, y: e.clientY };
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - last.x, dy = ev.clientY - last.y;
      last = { x: ev.clientX, y: ev.clientY };
      setEls((prev) => prev.map((x) => {
        if (x.id !== el.id) return x;
        if (x.kind === "text") return { ...x, size: clamp((x.size || 20) + dx * 0.3, 8, 140) };
        return { ...x, w: Math.max(24, x.w + dx * 1.4), h: Math.max(24, x.h + dy * 1.4) };
      }));
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const renderEl = (el: TplEl) => {
    const common: React.CSSProperties = { left: (el.x / W) * 100 + "%", top: (el.y / H) * 100 + "%" };
    const selected = sel === el.id;
    if (el.kind === "text") {
      // preview the value a real result will print. The box is el.w wide — exactly the
      // box the exporter aligns inside — so editor and result match pixel for pixel.
      const shown = el.bind ? (SAMPLE[el.bind] ?? el.text ?? "") : (el.text ?? "");
      return (
        <div key={el.id} className={`el-box ${selected ? "el-sel" : ""}`} onPointerDown={startDrag(el)}
          style={{ ...common, width: (el.w / W) * 100 + "%", color: el.color, textAlign: el.align || "center", whiteSpace: "nowrap", fontFamily: `"${el.font}"`, fontWeight: el.bold ? 800 : 500, overflow: "visible" }}>
          <span style={{ fontSize: ((el.size || 20) / W) * 100 + "cqw", lineHeight: 1.15 }}>{shown}</span>
          {selected && <span className="handle" onPointerDown={startResize(el)} />}
        </div>
      );
    }
    if (el.kind === "image") {
      const zoom = el.zoom || 1;
      // heart uses the same path geometry as the exporter, clipped in SVG
      if (el.shape === "heart") {
        const clipId = `pclip-${el.id}`;
        return (
          <div key={el.id} className={`el-box ${selected ? "el-sel" : ""}`} onPointerDown={startDrag(el)}
            style={{ ...common, width: (el.w / W) * 100 + "%", height: (el.h / H) * 100 + "%" }}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
              <defs>
                <clipPath id={clipId}>
                  <path d="M50 92 C 8 62, 10 22, 50 34 C 90 22, 92 62, 50 92 Z" />
                </clipPath>
              </defs>
              <g clipPath={`url(#${clipId})`}>
                {el.src ? (
                  <image href={el.src} x={50 - 50 * zoom} y={50 - 50 * zoom} width={100 * zoom} height={100 * zoom} preserveAspectRatio="xMidYMid slice" />
                ) : (
                  <rect width="100" height="100" fill="var(--panel3)" />
                )}
              </g>
            </svg>
            {selected && <span className="handle" onPointerDown={startResize(el)} />}
          </div>
        );
      }
      return (
        <div key={el.id} className={`el-box ${selected ? "el-sel" : ""}`} onPointerDown={startDrag(el)}
          style={{ ...common, width: (el.w / W) * 100 + "%", height: (el.h / H) * 100 + "%" }}>
          <div className="w-full h-full overflow-hidden" style={{
            borderRadius: el.shape === "circle" ? "50%" : 0,
            border: el.src ? "none" : "2px dashed var(--line2)",
          }}>
            <div className="w-full h-full" style={{
              background: el.src ? `url(${el.src}) center/cover` : "var(--panel3)",
              transform: `scale(${zoom})`,
            }}>
              {!el.src && <span className="w-full h-full flex items-center justify-center text-[10px] font-extrabold uppercase" style={{ color: "var(--mut)" }}>logo</span>}
            </div>
          </div>
          {selected && <span className="handle" onPointerDown={startResize(el)} />}
        </div>
      );
    }
    return (
      <div key={el.id} className={`el-box ${selected ? "el-sel" : ""}`} onPointerDown={startDrag(el)}
        style={{ ...common, width: (el.w / W) * 100 + "%", height: (el.h / H) * 100 + "%" }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
          {el.shape === "circle" ? <ellipse cx="50" cy="50" rx="50" ry="50" fill={el.color} />
            : el.shape === "heart" ? <path d="M50 92 C 8 62, 10 22, 50 34 C 90 22, 92 62, 50 92 Z" fill={el.color} />
              : <rect width="100" height="100" fill={el.color} />}
        </svg>
        {selected && <span className="handle" onPointerDown={startResize(el)} />}
      </div>
    );
  };

  return (
    <div>
      <PageHead title={existing ? `Edit · ${existing.name}` : "New Poster Template"} sub="The fill-ins (winner, runners, program…) are placed once — Festize fills them per result.">
        <input className="input" style={{ width: 210 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Template name" />
        <Btn kind="gold" onClick={save}><Icon n="check" s={15} sw={2.4} /> Save</Btn>
      </PageHead>
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 min-w-0 flex flex-col items-center">
          <ZoomBar zoom={zoom} setZoom={setZoom} />
          <div className="card p-3 w-full shrink-0" style={{ maxWidth: 350 * zoom }}>
            <div ref={wrapRef} className="relative w-full overflow-hidden rounded-lg select-none"
              style={{ aspectRatio: `${W}/${H}`, background: bg, backgroundImage: bgImage ? `url(${bgImage})` : undefined, backgroundSize: "cover", touchAction: "none", containerType: "inline-size" } as React.CSSProperties}
              onPointerDown={() => setSel(null)}>
              {els.map(renderEl)}
              {els.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="tag" style={{ background: "#ffffff18", color: "#fff", padding: "8px 14px" }}>blank poster — add blocks from the right</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="lg:w-[264px] shrink-0 grid gap-3 content-start">
          <div className="card p-3.5">
            <span className="lbl">Poster base</span>
            <div className="flex gap-1.5">
              <input ref={bgRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
                const f = e.target.files?.[0]; e.target.value = "";
                if (f) { setBgImage(await fileToSizedDataURL(f)); toast("Background uploaded", "ok"); }
              }} />
              <Btn size="sm" kind="soft" className="flex-1" onClick={() => bgRef.current?.click()}><Icon n="image" s={14} /> Upload image</Btn>
              <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} className="w-9 h-8 rounded cursor-pointer" style={{ border: "1px solid var(--line)" }} />
              {bgImage && <button className="icobtn danger" onClick={() => setBgImage("")} title="Remove background"><Icon n="trash" s={14} /></button>}
            </div>
          </div>
          <div className="card p-3.5">
            <span className="lbl">Result blocks</span>
            <div className="grid grid-cols-2 gap-1.5">
              {POSTER_FIELDS.map((f) => (
                <Btn key={f.key} size="sm" kind="soft" onClick={() => addEl({ id: uid(), kind: "text", bind: f.key, text: f.label, x: W / 2 - 160, y: H / 2 - 14, w: 320, h: 34, font: "Unbounded", size: 26, color: "#f2f4ec", bold: false, align: "center" })}>
                  {f.label}
                </Btn>
              ))}
              <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
                const f = e.target.files?.[0]; e.target.value = "";
                if (f) addEl({ id: uid(), kind: "image", src: await fileToSizedDataURL(f, 800), shape: "rect", x: W / 2 - 60, y: 30, w: 120, h: 120, zoom: 1 });
              }} />
              <Btn size="sm" kind="soft" onClick={() => imgRef.current?.click()}><Icon n="image" s={13} /> Logo</Btn>
              <Btn size="sm" kind="soft" onClick={() => addEl({ id: uid(), kind: "text", text: "Custom text", x: W / 2 - 100, y: H / 2, w: 200, h: 30, font: "Manrope", size: 22, color: "#f2f4ec", align: "center" })}>
                <Icon n="edit" s={13} /> Text
              </Btn>
              <Btn size="sm" kind="soft" onClick={() => addEl({ id: uid(), kind: "shape", shape: "rect", color: "#ffc53d", x: W / 2 - 100, y: H / 2, w: 200, h: 10 })}><Icon n="square" s={13} /> Shape</Btn>
            </div>
          </div>
          {selEl && (
            <div className="card p-3.5 pop">
              <span className="lbl">Selected · {selEl.bind || selEl.kind}</span>
              {selEl.kind === "text" && (
                <>
                  {!selEl.bind && <input className="input mb-2" value={selEl.text || ""} onChange={(e) => patchSel((el) => ({ ...el, text: e.target.value }))} />}
                  <div className="mb-2">
                    <FontPicker value={selEl.font || "Manrope"} fonts={FONTS} request={requestFont}
                      onChange={(f) => patchSel((el) => ({ ...el, font: f }))} />
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <input type="range" min={8} max={110} value={selEl.size || 20} className="flex-1" onChange={(e) => patchSel((el) => ({ ...el, size: parseInt(e.target.value) }))} />
                    <span className="mono text-[11.5px] font-bold w-8 text-right">{selEl.size}</span>
                  </div>
                  <div className="flex gap-1.5">
                    <input type="color" value={selEl.color || "#ffffff"} onChange={(e) => patchSel((el) => ({ ...el, color: e.target.value }))} className="w-9 h-8 rounded cursor-pointer" style={{ border: "1px solid var(--line)" }} />
                    <Btn size="sm" kind={selEl.bold ? "primary" : "soft"} onClick={() => patchSel((el) => ({ ...el, bold: !el.bold }))}>B</Btn>
                    {(["left", "center", "right"] as const).map((a) => (
                      <Btn key={a} size="sm" kind={selEl.align === a ? "primary" : "soft"} onClick={() => patchSel((el) => ({ ...el, align: a }))}>{a[0].toUpperCase()}</Btn>
                    ))}
                  </div>
                </>
              )}
              {selEl.kind === "image" && (
                <>
                  <div className="flex gap-1.5 mb-2">
                    {(["rect", "circle", "heart"] as const).map((s) => (
                      <Btn key={s} size="sm" kind={selEl.shape === s ? "primary" : "soft"} className="flex-1" onClick={() => patchSel((el) => ({ ...el, shape: s }))}>
                        <Icon n={s === "rect" ? "square" : s} s={13} />
                      </Btn>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="lbl shrink-0" style={{ marginBottom: 0 }}>Fit</span>
                    <input type="range" min={1} max={3.2} step={0.05} value={selEl.zoom || 1} className="flex-1" onChange={(e) => patchSel((el) => ({ ...el, zoom: parseFloat(e.target.value) }))} />
                  </div>
                </>
              )}
              {selEl.kind === "shape" && (
                <div className="flex gap-1.5">
                  <input type="color" value={selEl.color || "#ffc53d"} onChange={(e) => patchSel((el) => ({ ...el, color: e.target.value }))} className="w-9 h-8 rounded cursor-pointer" style={{ border: "1px solid var(--line)" }} />
                  {(["rect", "circle", "heart"] as const).map((s) => (
                    <Btn key={s} size="sm" kind={selEl.shape === s ? "primary" : "soft"} className="flex-1" onClick={() => patchSel((el) => ({ ...el, shape: s }))}>
                      <Icon n={s === "rect" ? "square" : s} s={13} />
                    </Btn>
                  ))}
                </div>
              )}
              <div className="flex justify-end mt-2.5">
                <Btn size="sm" kind="danger" onClick={() => { setEls((p) => p.filter((e) => e.id !== sel)); setSel(null); }}><Icon n="trash" s={13} /> Remove</Btn>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- results ---------------- */
export function ResultsSection({ push }: P) {
  const { data } = useStore();
  if (!data) return null;
  const progs = data.programs
    .filter((p) => st(data, p.id) === "PUBLISHED")
    .sort((a, b) => (resultNo(data, a.id) ?? 9e9) - (resultNo(data, b.id) ?? 9e9));
  return (
    <div>
      <PageHead title="Results" sub="Published results, numbered in publishing order and dressed in your poster templates." />
      {progs.length === 0 ? <Empty icon="trophy" title="No published results yet" body="Results appear here the moment a program is published from Monitor." /> : (
        <div className="grid sm:grid-cols-2 gap-3">
          {progs.map((p, i) => {
            const cat = data.categories.find((c) => c.id === p.categoryId);
            const rows = programResults(data, p);
            return (
              <button key={p.id} type="button" onClick={() => push({ id: "resultDetail", params: { pid: p.id } })}
                className="card hoverable p-4 text-left anim-in" style={{ animationDelay: i * 50 + "ms" }}>
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0 font-d font-black" style={{ background: "var(--marigold-soft)", color: "var(--marigold)" }}>
                    {resultNo(data, p.id) !== null
                      ? <><span className="text-[8px] leading-none opacity-70">NO.</span><span className="text-[15px] leading-tight">{resultNo(data, p.id)}</span></>
                      : <Icon n="trophy" s={18} />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="font-d text-[14.5px] font-extrabold block truncate">{p.name}</span>
                    <span className="text-[12px] font-bold" style={{ color: "var(--mut)" }}>{cat?.name || "—"} · winner: {rows[0]?.label || "—"}</span>
                  </span>
                  <Icon n="chevR" s={17} className="opacity-50" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ResultDetail({ params, back }: P) {
  const { data, fest } = useStore();
  const toast = useToast();
  const p = data?.programs.find((x) => x.id === params?.pid);
  const posters = data?.posters || [];
  const [idx, setIdx] = useState(0);
  const ref = useRef<HTMLCanvasElement>(null);
  const t = posters[Math.min(idx, posters.length - 1)];
  useEffect(() => {
    let on = true;
    (async () => {
      await ensureFonts(fontsOf(t?.els || []));
      if (ref.current && t && data && p && on) await paintTemplate(ref.current, t, t.els, posterMapFor(data, p, t.els), 1.2, { fixedTextBox: true });
    })();
    return () => { on = false; };
  }, [t, data, p]);
  if (!data || !fest || !p) return <Empty icon="trophy" title="Result not found" body="It may have been unpublished." />;
  const rows = programResults(data, p);
  const cat = data.categories.find((c) => c.id === p.categoryId);

  const download = async () => {
    if (!t) return;
    await ensureFonts(fontsOf(t.els));
    const c = document.createElement("canvas");
    await paintTemplate(c, t, t.els, posterMapFor(data, p, t.els), 1.6, { fixedTextBox: true });
    downloadCanvas(c, `${p.name}-result.png`);
    toast("Poster downloaded", "ok");
  };

  return (
    <div className="max-w-[720px] mx-auto">
      <PageHead title={p.name} sub={`${cat?.name || "—"} · official result`}>
        {posters.length > 1 && (
          <span className="flex items-center gap-1">
            <button className="icobtn card2" onClick={() => setIdx((i) => (i - 1 + posters.length) % posters.length)} title="Previous template" disabled={posters.length < 2}><Icon n="chevL" s={17} /></button>
            <span className="mono text-[12px] font-bold px-1">{Math.min(idx, posters.length - 1) + 1}/{posters.length}</span>
            <button className="icobtn card2" onClick={() => setIdx((i) => (i + 1) % posters.length)} title="Next template" disabled={posters.length < 2}><Icon n="chevR" s={17} /></button>
          </span>
        )}
        <Btn kind="gold" onClick={download}><Icon n="download" s={15} /> Download</Btn>
      </PageHead>
      <div className="grid lg:grid-cols-[1fr_260px] gap-4">
        <div className="card p-3">
          {t ? <canvas ref={ref} className="w-full rounded-lg" style={{ aspectRatio: `${t.w}/${t.h}`, background: t.bg }} /> : <Empty icon="palette" title="No templates" body="Add a poster template first." />}
        </div>
        <div className="card p-4 content-start h-fit">
          <span className="lbl">Standings · grade points</span>
          <div className="grid gap-1.5">
            {rows.slice(0, 5).map((r, i) => (
              <div key={r.e.id} className="flex items-center gap-2.5 card2 px-3 py-2">
                <span className="font-d text-[12.5px] font-black w-5" style={{ color: i === 0 ? "var(--marigold)" : "var(--mut)" }}>{i + 1}</span>
                <span className="font-bold text-[13px] flex-1 truncate">{r.label}</span>
                <span className="tag" style={{ background: "var(--acc-soft)", color: "var(--acc)" }}>{r.grade?.name || "—"}</span>
              </div>
            ))}
          </div>
          <button className="btn line w-full mt-3" onClick={back}><Icon n="back" s={14} /> All results</button>
        </div>
      </div>
    </div>
  );
}
