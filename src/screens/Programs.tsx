import React, { useRef, useState } from "react";
import { useStore, uid, log, st, setStatus, undoStatus, STATUS_FLOW, STATUS_LABEL, groupColor, EVALUATION_LIMITS, checkLimit } from "../lib/store";
import type { Program, FestData } from "../lib/store";
import { Icon, Btn, IconBtn, Field, Select, Modal, Tag, Empty, SearchInput, PageHead, Chips, useToast, useAsk, useKeyNav } from "../lib/ui";
import type { Route } from "./Shell";

type P = { push: (r: Route) => void; params?: Record<string, string> };

const teamCount = (p: Program, teamId: string) =>
  p.entries.filter((e) => e.teamId === teamId).reduce((n, e) => n + e.memberIds.length, 0);

export function eligibleMembers(d: FestData, p: Program, teamId: string) {
  const cat = d.categories.find((c) => c.id === p.categoryId);
  const inProgram = new Set(p.entries.flatMap((e) => e.memberIds));
  return d.members.filter((m) =>
    m.teamId === teamId &&
    (cat?.type === "GENERAL" || m.categoryId === p.categoryId) &&
    !inProgram.has(m.id));
}

/* ---------------- program form ---------------- */
interface PForm { name: string; desc: string; categoryId: string; maxPerTeam: string; first: string; second: string; third: string; venue: "STAGE" | "OFF STAGE"; kind: "INDIVIDUAL" | "GROUP"; groupSize: string; gradeScaleId: string; }
const emptyP: PForm = { name: "", desc: "", categoryId: "", maxPerTeam: "2", first: "10", second: "7", third: "5", venue: "STAGE", kind: "INDIVIDUAL", groupSize: "3", gradeScaleId: "" };

function ProgramForm({ init, onSave, onClose, cats, scales }: { init: PForm; onSave: (f: PForm) => void; onClose: () => void; cats: { v: string; l: string }[]; scales: { v: string; l: string }[] }) {
  const [f, setF] = useState<PForm>(init);
  const set = (k: keyof PForm, v: string) => setF((p) => ({ ...p, [k]: v }) as PForm);
  return (
    <Modal open onClose={onClose} title={init.name ? "Edit Program" : "New Program"} w={560} footer={
      <><Btn kind="soft" onClick={onClose}>Cancel</Btn><Btn onClick={() => onSave(f)}>Confirm</Btn></>
    }>
      <Field label="Name of the program">
        <input className="input" value={f.name} autoFocus placeholder="e.g. Solo Singing" onChange={(e) => set("name", e.target.value)} />
      </Field>
      <Field label="Description">
        <textarea className="textarea" value={f.desc} placeholder="Rules, duration, anything useful…" onChange={(e) => set("desc", e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          <Select value={f.categoryId} onChange={(v) => set("categoryId", v)} options={cats} placeholder="Select category" />
        </Field>
        <Field label="Max members per team" hint="How many members one team can put in.">
          <input className="input" inputMode="numeric" value={f.maxPerTeam} onChange={(e) => set("maxPerTeam", e.target.value.replace(/[^\d]/g, ""))} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Venue type">
          <Select value={f.venue} onChange={(v) => set("venue", v)} options={[{ v: "STAGE", l: "Stage" }, { v: "OFF STAGE", l: "Off Stage" }]} />
        </Field>
        <Field label="Participation">
          <Select value={f.kind} onChange={(v) => set("kind", v)} options={[{ v: "INDIVIDUAL", l: "Individual" }, { v: "GROUP", l: "Group" }]} />
        </Field>
      </div>
      {f.kind === "GROUP" && (
        <Field label="Max members in a group" hint="One team forms one group — this caps its size.">
          <input className="input" inputMode="numeric" value={f.groupSize} onChange={(e) => set("groupSize", e.target.value.replace(/[^\d]/g, ""))} />
        </Field>
      )}
      <Field label="Grade point scale" hint="How this program's results are graded — the picked scale is the only one that judges its marks.">
        <Select value={f.gradeScaleId} onChange={(v) => set("gradeScaleId", v)}
          options={scales.length ? scales : [{ v: "", l: "No scales yet — add one in Grade Points" }]}
          placeholder={scales.length ? "Use default scale" : "No scales available"} />
      </Field>
    </Modal>
  );
}

/* ---------------- add members modal ---------------- */
export function AddMembersModal({ program, onClose, restrictTeam }: { program: Program; onClose: () => void; restrictTeam?: string }) {
  const { data, fest, session, updateFest } = useStore();
  const toast = useToast();
  const [selTeam, setSelTeam] = useState(restrictTeam || "");
  const [sel, setSel] = useState<string[]>([]);
  if (!data || !fest || !session) return null;
  const p = data.programs.find((x) => x.id === program.id) || program;
  const teams = restrictTeam ? data.teams.filter((t) => t.id === restrictTeam) : data.teams;
  const remaining = (tid: string) => Math.max(0, p.maxPerTeam - teamCount(p, tid));
  const maxSel = selTeam ? Math.min(p.kind === "GROUP" ? p.groupSize : 99, remaining(selTeam)) : 0;
  const elig = selTeam ? eligibleMembers(data, p, selTeam) : [];
  const cat = data.categories.find((c) => c.id === p.categoryId);
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= maxSel ? (toast(`Limit reached — max ${maxSel} from this team`, "err"), s) : [...s, id]));

  const confirm = () => {
    if (!selTeam) { toast("Pick a team first", "err"); return; }
    if (sel.length === 0) { toast("Select at least one member", "err"); return; }
    if (p.kind === "GROUP" && sel.length > p.groupSize) { toast(`A group can have at most ${p.groupSize} members`, "err"); return; }
    updateFest(fest.id, (d) => {
      const dp = d.programs.find((x) => x.id === p.id);
      if (!dp) return;
      const base = dp.entries.length;
      if (dp.kind === "GROUP") {
        dp.entries.push({ id: uid(), memberIds: sel, teamId: selTeam, color: groupColor(base) });
      } else {
        sel.forEach((mid, i) => dp.entries.push({ id: uid(), memberIds: [mid], teamId: selTeam, color: groupColor(base + i) }));
      }
      log(d, session.name, `Added ${sel.length} member(s) to "${dp.name}"`);
    });
    toast(`${sel.length} member(s) added`, "ok");
    setSel([]);
  };
  const removeEntry = (eid: string) => {
    updateFest(fest.id, (d) => {
      const dp = d.programs.find((x) => x.id === p.id);
      if (!dp) return;
      dp.entries = dp.entries.filter((e) => e.id !== eid);
      log(d, session.name, `Removed an entry from "${dp.name}"`);
    });
    toast("Entry removed", "ok");
  };

  return (
    <Modal open onClose={onClose} title={`Members · ${p.name}`} w={620} footer={
      <><Btn kind="soft" onClick={onClose}>Close</Btn><Btn onClick={confirm} disabled={!selTeam || sel.length === 0}>Confirm ({sel.length})</Btn></>
    }>
      {p.entries.length > 0 && (
        <div className="mb-4">
          <span className="lbl">Already in this program {p.kind === "GROUP" ? "· groups" : ""}</span>
          <div className="grid gap-1.5 max-h-[150px] overflow-y-auto pr-1">
            {p.entries.map((e) => {
              const team = data.teams.find((t) => t.id === e.teamId);
              const names = e.memberIds.map((id) => data.members.find((m) => m.id === id)?.name || "?").join(", ");
              return (
                <div key={e.id} className="card2 px-3 py-2 flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: e.color }} />
                  <span className="font-bold text-[13px] flex-1 min-w-0 truncate">
                    {p.kind === "GROUP" ? <b style={{ color: e.color }}>{team?.name || "Team"}</b> : names}
                    <span className="font-semibold" style={{ color: "var(--mut)" }}> · {team?.name || "—"} · {e.memberIds.length} member{e.memberIds.length > 1 ? "s" : ""}</span>
                  </span>
                  <IconBtn n="x" s={14} title="Remove entry" danger onClick={() => removeEntry(e.id)} />
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Team">
          <Select value={selTeam} onChange={(v) => { setSelTeam(v); setSel([]); }} options={teams.map((t) => ({ v: t.id, l: `${t.name} · ${remaining(t.id)} slot(s) left` }))} placeholder="Select team" />
        </Field>
        <div className="flex items-end pb-3.5 text-[12px] font-bold" style={{ color: "var(--mut)" }}>
          {cat ? <>Category rule: {cat.type === "GENERAL" ? "any member may join (general program)" : `only "${cat.name}" members`}</> : "—"}
        </div>
      </div>
      {!selTeam ? (
        <div className="card2 py-8 text-center text-[13px] font-bold" style={{ color: "var(--mut)" }}>Pick a team to see its eligible members.</div>
      ) : elig.length === 0 ? (
        <div className="card2 py-8 text-center text-[13px] font-bold" style={{ color: "var(--mut)" }}>
          {remaining(selTeam) === 0 ? "This team has used all its slots — remove an entry above to free space." : "No eligible members left in this team for this program."}
        </div>
      ) : (
        <div>
          <span className="lbl">{p.kind === "GROUP" ? `Pick up to ${maxSel} members — one group, one team` : `Pick up to ${maxSel} member(s)`}</span>
          <div className="grid sm:grid-cols-2 gap-1.5 max-h-[240px] overflow-y-auto pr-1">
            {elig.map((m) => {
              const on = sel.includes(m.id);
              return (
                <button key={m.id} type="button" onClick={() => toggle(m.id)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all"
                  style={{ background: on ? "var(--acc-soft)" : "var(--panel2)", border: `1.5px solid ${on ? "var(--acc)" : "var(--line)"}` }}>
                  <span className="w-4.5 h-4.5 rounded flex items-center justify-center shrink-0" style={{ width: 18, height: 18, background: on ? "var(--acc)" : "transparent", border: on ? "none" : "1.5px solid var(--line2)", color: "#08211b" }}>
                    {on && <Icon n="check" s={12} sw={3} />}
                  </span>
                  {m.photo ? <img src={m.photo} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" /> : null}
                  <span className="font-bold text-[13px] truncate">{m.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ---------------- programs section ---------------- */
export function ProgramsSection(_: P) {
  const { data, fest, session, updateFest } = useStore();
  const toast = useToast(); const ask = useAsk();
  const [q, setQ] = useState(""); const [fCat, setFCat] = useState(""); const [fStatus, setFStatus] = useState("");
  const [form, setForm] = useState<null | { edit?: Program }>(null);
  const [view, setView] = useState<Program | null>(null);
  const [addingFor, setAddingFor] = useState<Program | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  useKeyNav(() => searchRef.current?.focus());
  if (!data || !fest || !session) return null;
  const isMain = session.role === "MAIN";
  const isTM = session.role === "TEAM MANAGER";
  const progs = data.programs.filter((p) => 
    p.name.toLowerCase().includes(q.toLowerCase()) && 
    (!fCat || p.categoryId === fCat) &&
    (!fStatus || st(data, p.id) === fStatus)
  );
  const cName = (id: string) => data.categories.find((c) => c.id === id)?.name || "—";

  const save = (f: PForm) => {
    if (!f.name.trim()) { toast("Program name is empty", "err"); return; }
    if (!f.categoryId) { toast("Pick a category", "err"); return; }
    if (!form?.edit) {
      const err = checkLimit(fest.isEvaluation, data.programs.length, EVALUATION_LIMITS.programs, "programs");
      if (err) { toast(err, "err"); return; }
    }
    const maxPerTeam = Math.max(1, parseInt(f.maxPerTeam) || 1);
    const groupSize = Math.max(1, parseInt(f.groupSize) || 2);
    updateFest(fest.id, (d) => {
      if (form?.edit) {
        const p = d.programs.find((x) => x.id === form.edit!.id);
        if (p) Object.assign(p, {
          name: f.name.trim(), desc: f.desc, categoryId: f.categoryId, maxPerTeam, groupSize,
          venue: f.venue, kind: f.kind,
          marks: { first: parseInt(f.first) || 0, second: parseInt(f.second) || 0, third: parseInt(f.third) || 0 },
          gradeScaleId: f.gradeScaleId || undefined,
        });
        log(d, session.name, `Program "${f.name}" updated`);
      } else {
        d.programs.push({
          id: uid(), name: f.name.trim(), desc: f.desc, categoryId: f.categoryId, maxPerTeam, groupSize,
          venue: f.venue, kind: f.kind,
          marks: { first: parseInt(f.first) || 0, second: parseInt(f.second) || 0, third: parseInt(f.third) || 0 },
          entries: [], gradeScaleId: f.gradeScaleId || undefined,
        });
        log(d, session.name, `Program "${f.name}" created`);
      }
    });
    toast(form?.edit ? "Program updated" : "Program created", "ok");
    setForm(null);
  };
  const del = async (p: Program) => {
    const ok = await ask({ title: `Delete program "${p.name}"?`, body: "Its entries, code letters and marks will be erased.", yes: "Delete", danger: true });
    if (!ok) return;
    updateFest(fest.id, (d) => {
      d.programs = d.programs.filter((x) => x.id !== p.id);
      delete d.statuses[p.id]; delete d.codeLetters[p.id]; delete d.judgementMarks[p.id];
      delete d.lettersDone[p.id]; delete d.judgementSaved[p.id]; delete d.monitorDone[p.id];
      log(d, session.name, `Program "${p.name}" deleted`);
    });
    toast("Program deleted", "ok");
  };

  return (
    <div>
      <PageHead title="Programs" sub={isTM ? "You can add members from your team only." : "Create events, then add members respecting category and team limits."}>
        <SearchInput value={q} onChange={setQ} inputRef={searchRef} placeholder="Search programs…  ( / )" />
        <select className="select" style={{ width: "auto" }} value={fCat} onChange={(e) => setFCat(e.target.value)}>
          <option value="">All categories</option>
          {data.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="select" style={{ width: "auto" }} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option value="">All states</option>
          {STATUS_FLOW.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        {isMain && <Btn onClick={() => setForm({})}><Icon n="plus" s={16} sw={2.4} /> Add Program</Btn>}
      </PageHead>
      {progs.length === 0 ? <Empty icon="list" title="No programs yet" body={isMain ? "Add your first program to start filling the schedule." : "Nothing matches these filters."} /> : (
        <div className="grid sm:grid-cols-2 gap-3">
          {progs.map((p, i) => (
            <div key={p.id} className="card hoverable p-4 anim-in" style={{ animationDelay: i * 40 + "ms" }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-d text-[15px] font-extrabold truncate">{p.name}</div>
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    <Tag color="var(--acc)">{cName(p.categoryId)}</Tag>
                    <Tag color={p.kind === "GROUP" ? "var(--plum)" : "var(--sky)"}>{p.kind}</Tag>
                    <Tag>{p.venue}</Tag>
                    <span className={`tag st-${st(data, p.id)}`}>{STATUS_LABEL[st(data, p.id)]}</span>
                  </div>
                </div>
                <span className="flex gap-0.5 shrink-0">
                  <IconBtn n="eye" s={15} title="View details" onClick={() => setView(p)} />
                  {isMain && <IconBtn n="edit" s={15} title="Edit" onClick={() => setForm({ edit: p })} />}
                  {isMain && <IconBtn n="trash" s={15} title="Delete" danger onClick={() => del(p)} />}
                </span>
              </div>
              {p.desc && <p className="text-[12.5px] font-semibold mt-2.5 line-clamp-2" style={{ color: "var(--mut)" }}>{p.desc}</p>}
              <div className="flex items-center justify-between mt-3.5 pt-3" style={{ borderTop: "1px solid var(--line)" }}>
                <span className="text-[12px] font-extrabold" style={{ color: "var(--mut)" }}>
                  {p.entries.length} entr{p.entries.length === 1 ? "y" : "ies"} · max {p.maxPerTeam}/team{p.kind === "GROUP" ? ` · group ≤ ${p.groupSize}` : ""}
                </span>
                <Btn size="sm" kind="gold" onClick={() => setAddingFor(p)}><Icon n="plus" s={14} sw={2.6} /> Members</Btn>
              </div>
            </div>
          ))}
        </div>
      )}
      {form && (
        <ProgramForm init={form.edit ? {
          name: form.edit.name, desc: form.edit.desc, categoryId: form.edit.categoryId,
          maxPerTeam: String(form.edit.maxPerTeam), first: String(form.edit.marks.first),
          second: String(form.edit.marks.second), third: String(form.edit.marks.third),
          venue: form.edit.venue, kind: form.edit.kind, groupSize: String(form.edit.groupSize),
          gradeScaleId: form.edit.gradeScaleId || "",
        } : emptyP} onSave={save} onClose={() => setForm(null)}
          cats={data.categories.map((c) => ({ v: c.id, l: `${c.name} (${c.type.toLowerCase()})` }))}
          scales={(data.gradeScales || []).map((s) => ({ v: s.id, l: s.name }))} />
      )}
      {addingFor && <AddMembersModal program={addingFor} onClose={() => setAddingFor(null)} restrictTeam={isTM ? (session.teamId || "—") : undefined} />}
      <Modal open={!!view} onClose={() => setView(null)} title={view?.name || ""} w={540}>
        {view && (
          <div>
            <div className="flex gap-1.5 flex-wrap mb-3">
              <Tag color="var(--acc)">{cName(view.categoryId)}</Tag>
              <Tag color={view.kind === "GROUP" ? "var(--plum)" : "var(--sky)"}>{view.kind}</Tag>
              <Tag>{view.venue}</Tag>
            </div>
            {view.desc && <p className="text-[13px] font-semibold mb-3" style={{ color: "var(--mut)" }}>{view.desc}</p>}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="card2 p-3"><div className="lbl" style={{ marginBottom: 4 }}>1st / 2nd / 3rd</div><div className="font-d font-extrabold">{view.marks.first} · {view.marks.second} · {view.marks.third}</div></div>
              <div className="card2 p-3"><div className="lbl" style={{ marginBottom: 4 }}>Max per team</div><div className="font-d font-extrabold">{view.maxPerTeam}{view.kind === "GROUP" ? ` · group ≤ ${view.groupSize}` : ""}</div></div>
            </div>
            <span className="lbl">Entries</span>
            <div className="grid gap-1.5 max-h-[240px] overflow-y-auto">
              {view.entries.length === 0 && <div className="text-[12.5px] font-bold py-3 text-center" style={{ color: "var(--mut)" }}>No members added yet.</div>}
              {view.entries.map((e) => {
                const team = data.teams.find((t) => t.id === e.teamId);
                return (
                  <div key={e.id} className="card2 px-3 py-2 flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: e.color }} />
                    <span className="font-bold text-[13px] flex-1 truncate">
                      {e.memberIds.map((id) => data.members.find((m) => m.id === id)?.name || "?").join(", ")}
                      <span style={{ color: "var(--mut)" }}> · {team?.name || "—"}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ---------------- shared control card ---------------- */
function ControlCard({ p, onAdvance, onUndo, canUndo, children }: { p: Program; onAdvance: () => void; onUndo: () => void; canUndo: boolean; children?: React.ReactNode }) {
  const { data } = useStore();
  if (!data) return null;
  const s = st(data, p.id);
  const cat = data.categories.find((c) => c.id === p.categoryId);
  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-d text-[14.5px] font-extrabold truncate">{p.name}</div>
          <div className="flex gap-1.5 mt-1.5 flex-wrap">
            <Tag color="var(--acc)">{cat?.name || "—"}</Tag>
            <Tag>{p.venue}</Tag>
            <Tag color="var(--sky)">{p.entries.length} entries</Tag>
          </div>
        </div>
        <span className={`stbox st-${s}`} title="Current stage">{STATUS_LABEL[s]}</span>
      </div>
      {children}
      <button className={`btn st-${s} w-full`} onClick={onAdvance} disabled={s === "PUBLISHED"} title="Advance to the next stage">
        <Icon n={s === "PUBLISHED" ? "check" : "arrowR"} s={15} sw={2.4} />
        {s === "PUBLISHED" ? "Published" : "Go to next"}
      </button>
      <button className="btn line w-full" onClick={onUndo} disabled={!canUndo}>
        <Icon n="undo" s={15} /> Undo
      </button>
    </div>
  );
}

/** Why a program may not leave its current stage yet — null means it's free to advance. */
export function stageBlocker(data: FestData, p: Program, next: string): string | null {
  const saved = data.judgementSaved[p.id] || {};
  const allJudged = p.entries.length > 0 && p.entries.every((e) => saved[e.id]);
  switch (next) {
    case "REPORTING":
      if (p.entries.length === 0) return "Add candidates to this program before it can start reporting.";
      return null;
    case "STARTED":
      if (!data.lettersDone[p.id]) return "Enter the code letters in Code Letter Entry before the program can start.";
      return null;
    case "JUDGEMENTS":
      if (!allJudged) return "Every candidate needs a saved mark in Judgement before this stage.";
      return null;
    case "FINALYSED":
      if (!allJudged) return "Finish the judgement first — all marks must be saved before finalysing.";
      return null;
    case "PUBLISHED":
      if (!data.monitorDone[p.id]) return "The result must be checked in Monitor before it can be published.";
      return null;
    default:
      return null;
  }
}

export function useControl() {
  const { data, fest, session, updateFest } = useStore();
  const toast = useToast();
  const advance = (p: Program) => {
    if (!data || !fest || !session) return;
    const cur = st(data, p.id);
    const idx = STATUS_FLOW.indexOf(cur);
    if (idx >= STATUS_FLOW.length - 1) return;
    const next = STATUS_FLOW[idx + 1];
    const blocked = stageBlocker(data, p, next);
    if (blocked) { toast(blocked, "err"); return; }
    updateFest(fest.id, (d) => { setStatus(d, p.id, next); log(d, session.name, `"${p.name}" → ${STATUS_LABEL[next]}`); });
    toast(`"${p.name}" → ${STATUS_LABEL[next]}`, "ok");
  };
  const undo = (p: Program) => {
    if (!data || !fest || !session) return;
    const prev = undoStatus(structuredClone(data), p.id);
    if (!prev) { toast("Nothing to undo", "info"); return; }
    updateFest(fest.id, (d) => { undoStatus(d, p.id); log(d, session.name, `"${p.name}" undone → ${STATUS_LABEL[st(d, p.id)]}`); });
    toast(`"${p.name}" → back to ${STATUS_LABEL[prev]}`, "ok");
  };
  const canUndo = (p: Program) => !!data && (data.statuses[p.id]?.history.length || 0) > 0;
  return { advance, undo, canUndo };
}

/* ---------------- program control ---------------- */
export function ProgramControl(_: P) {
  const { data } = useStore();
  const [fStatus, setFStatus] = useState("ALL");
  const [q, setQ] = useState("");
  const { advance, undo, canUndo } = useControl();
  const searchRef = useRef<HTMLInputElement>(null);
  useKeyNav(() => searchRef.current?.focus());
  if (!data) return null;
  const count = (s: string) => data.programs.filter((p) => st(data, p.id) === s).length;
  const progs = data.programs.filter((p) =>
    (fStatus === "ALL" || st(data, p.id) === fStatus) && p.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <PageHead title="Program Control" sub="Push every program through its lifecycle. Changes sync instantly with Stage Control.">
        <SearchInput value={q} onChange={setQ} inputRef={searchRef} placeholder="Search…  ( / )" />
      </PageHead>
      <div className="mb-4">
        <Chips value={fStatus} onChange={setFStatus} items={[{ v: "ALL", l: "All", n: data.programs.length }, ...STATUS_FLOW.map((s) => ({ v: s, l: STATUS_LABEL[s], n: count(s) }))]} />
      </div>
      {progs.length === 0 ? <Empty icon="sliders" title="Nothing here" body="Programs you add will line up in this control room." /> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {progs.map((p, i) => (
            <div key={p.id} className="anim-in" style={{ animationDelay: i * 35 + "ms" }}>
              <ControlCard p={p} onAdvance={() => advance(p)} onUndo={() => undo(p)} canUndo={canUndo(p)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- stage control ---------------- */
export function StageControl(_: P) {
  const { data } = useStore();
  const [q, setQ] = useState("");
  const { advance, undo, canUndo } = useControl();
  const searchRef = useRef<HTMLInputElement>(null);
  useKeyNav(() => searchRef.current?.focus());
  if (!data) return null;
  const live = ["NOT_STARTED", "REPORTING", "STARTED"];
  const progs = data.programs.filter((p) => live.includes(st(data, p.id)) && p.name.toLowerCase().includes(q.toLowerCase()));
  const reporting = data.programs.filter((p) => st(data, p.id) === "REPORTING").length;
  const started = data.programs.filter((p) => st(data, p.id) === "STARTED").length;

  return (
    <div>
      <PageHead title="Stage Control" sub="Live floor view — programs leave this board the moment they are finished.">
        <Tag color="var(--sky)">{reporting} reporting</Tag>
        <Tag color="var(--marigold)">{started} on stage</Tag>
        <SearchInput value={q} onChange={setQ} inputRef={searchRef} placeholder="Search…  ( / )" />
      </PageHead>
      {progs.length === 0 ? <Empty icon="monitor" title="Stage is clear" body="Programs in Reporting or Started show here. Finished programs move on to Judgement." /> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {progs.map((p, i) => (
            <div key={p.id} className="anim-in" style={{ animationDelay: i * 35 + "ms" }}>
              <ControlCard p={p} onAdvance={() => advance(p)} onUndo={() => undo(p)} canUndo={canUndo(p)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
