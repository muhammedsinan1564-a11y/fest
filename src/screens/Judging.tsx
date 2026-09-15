import { useState } from "react";
import { useStore, st, setStatus, log, programResults, entryLabel, pointLabel, gradeFor, resultNo, scaleFor, scaleNameOf } from "../lib/store";
import type { Program } from "../lib/store";
import { Icon, Btn, Tag, Empty, PageHead, SearchInput, useToast, useKeyNav } from "../lib/ui";
import { useRef } from "react";
import type { Route } from "./Shell";

type P = { push: (r: Route) => void; params?: Record<string, string>; back?: () => void };

function ProgList({ progs, onPick, hint, emptyIcon, emptyTitle, emptyBody, badge }: {
  progs: Program[]; onPick: (p: Program) => void; hint: string; emptyIcon: string; emptyTitle: string; emptyBody: string;
  badge?: (p: Program) => React.ReactNode;
}) {
  const { data } = useStore();
  if (!data) return null;
  if (progs.length === 0) return <Empty icon={emptyIcon} title={emptyTitle} body={emptyBody} />;
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {progs.map((p, i) => {
        const cat = data.categories.find((c) => c.id === p.categoryId);
        return (
          <button key={p.id} type="button" onClick={() => onPick(p)}
            className="card hoverable p-4 text-left anim-in flex items-center gap-3" style={{ animationDelay: i * 40 + "ms" }}>
            <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--marigold-soft)", color: "var(--marigold)" }}>
              <Icon n="chevR" s={18} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="font-d text-[14.5px] font-extrabold block truncate">{p.name}</span>
              <span className="text-[12px] font-bold" style={{ color: "var(--mut)" }}>{cat?.name || "—"} · {p.entries.length} entries · {hint}</span>
            </span>
            {badge?.(p)}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- code letter entry ---------------- */
export function CodeLetterSection({ push }: P) {
  const { data } = useStore();
  const [q, setQ] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  useKeyNav(() => searchRef.current?.focus());
  if (!data) return null;
  const progs = data.programs.filter((p) => st(data, p.id) === "REPORTING" && p.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <PageHead title="Code Letter Entry" sub="Programs in Reporting wait here. Assign code letters, then the program auto-starts.">
        <SearchInput value={q} onChange={setQ} inputRef={searchRef} placeholder="Search…  ( / )" />
      </PageHead>
      <ProgList progs={progs} hint="ready for code letters" emptyIcon="mail" emptyTitle="No reporting programs"
        emptyBody="Move a program to Reporting in Program Control or Stage Control and it will appear here."
        onPick={(p) => push({ id: "codeLetterDetail", params: { pid: p.id } })} />
    </div>
  );
}

export function CodeLetterDetail({ params, back }: P) {
  const { data, fest, session, updateFest } = useStore();
  const toast = useToast();
  const p = data?.programs.find((x) => x.id === params?.pid);
  const [letters, setLetters] = useState<Record<string, string>>(() => ({ ...(data?.codeLetters[params?.pid || ""] || {}) }));
  const [busy, setBusy] = useState(false);
  if (!data || !fest || !session) return null;
  if (!p) return <Empty icon="mail" title="Program not found" body="It may have been deleted." />;
  const rows = p.entries;
  const allFilled = rows.length > 0 && rows.every((e) => (letters[e.id] || "").trim());
  const confirm = () => {
    if (busy) return;
    if (!allFilled) { toast("Every candidate needs a code letter", "err"); return; }
    setBusy(true);
    updateFest(fest.id, (d) => {
      d.codeLetters[p.id] = { ...letters };
      d.lettersDone[p.id] = true;
      setStatus(d, p.id, "STARTED");
      log(d, session.name, `Code letters confirmed for "${p.name}" — program started`);
    });
    toast(`"${p.name}" started`, "ok");
    setTimeout(() => back?.(), 250);
  };
  return (
    <div className="max-w-[660px] mx-auto">
      <PageHead title={p.name} sub={`Code letters · ${rows.length} candidates — the program auto-starts once you confirm.`} />
      <div className="card p-4 grid gap-2.5">
        {rows.map((e, i) => (
          <div key={e.id} className="card2 px-3.5 py-2.5 flex items-center gap-3">
            <span className="font-d text-[12px] font-extrabold w-6 shrink-0" style={{ color: "var(--mut)" }}>{i + 1}</span>
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: e.color }} />
            <span className="font-bold text-[13.5px] flex-1 min-w-0 truncate">
              {entryLabel(data, e, p)}
              <span className="font-semibold" style={{ color: "var(--mut)" }}> · {data.teams.find((t) => t.id === e.teamId)?.name || "—"}</span>
            </span>
            <input className="input text-center mono uppercase" style={{ width: 110 }} maxLength={6} value={letters[e.id] || ""}
              placeholder="A" onChange={(ev) => setLetters((l) => ({ ...l, [e.id]: ev.target.value.toUpperCase() }))} />
          </div>
        ))}
        {rows.length === 0 && <div className="text-[13px] font-bold text-center py-6" style={{ color: "var(--mut)" }}>No entries in this program yet.</div>}
      </div>
      <div className="flex justify-end mt-4">
        <Btn size="big" onClick={confirm} disabled={!allFilled || busy}>
          <Icon n="check" s={16} sw={2.6} /> Confirm &amp; Start
        </Btn>
      </div>
    </div>
  );
}

/* ---------------- judgement ---------------- */
export function JudgementSection({ push }: P) {
  const { data } = useStore();
  const [q, setQ] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  useKeyNav(() => searchRef.current?.focus());
  if (!data) return null;
  const progs = data.programs.filter((p) => st(data, p.id) === "FINISHED" && (data.lettersDone[p.id] || Object.keys(data.codeLetters[p.id] || {}).length > 0) && p.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <PageHead title="Judgement" sub="Programs appear here only after they are finished and code letters are in.">
        <SearchInput value={q} onChange={setQ} inputRef={searchRef} placeholder="Search…  ( / )" />
      </PageHead>
      <ProgList progs={progs} hint="awaiting marks" emptyIcon="scale" emptyTitle="Nothing to judge"
        emptyBody="When a program is marked Finished (with code letters entered) it lands here for marking."
        onPick={(p) => push({ id: "judgementDetail", params: { pid: p.id } })} />
    </div>
  );
}

export function JudgementDetail({ params, back }: P) {
  const { data, fest, session, updateFest } = useStore();
  const toast = useToast();
  const p = data?.programs.find((x) => x.id === params?.pid);
  const [marks, setMarks] = useState<Record<string, string>>(() => {
    const saved = data?.judgementMarks[params?.pid || ""] || {};
    const out: Record<string, string> = {};
    for (const k of Object.keys(saved)) out[k] = String(saved[k]);
    return out;
  });
  const savedMap = data?.judgementSaved[params?.pid || ""] || {};
  if (!data || !fest || !session) return null;
  if (!p) return <Empty icon="scale" title="Program not found" body="It may have been deleted." />;
  const rows = p.entries;
  const letters = data.codeLetters[p.id] || {};

  const setMark = (eid: string, v: string) => {
    const clean = v.replace(/[^\d.]/g, "");
    if (clean !== "" && parseFloat(clean) > 100) { toast("Mark cannot go above 100", "err"); setMarks((m) => ({ ...m, [eid]: "100" })); return; }
    setMarks((m) => ({ ...m, [eid]: clean }));
  };
  const saveRow = (eid: string) => {
    const v = parseFloat(marks[eid] || "");
    if (isNaN(v)) { toast("Type a mark first", "err"); return; }
    const done = Object.keys(savedMap).length + 1 >= rows.length;
    updateFest(fest.id, (d) => {
      d.judgementMarks[p.id] = { ...(d.judgementMarks[p.id] || {}), [eid]: v };
      d.judgementSaved[p.id] = { ...(d.judgementSaved[p.id] || {}), [eid]: true };
      log(d, session.name, `Mark saved in "${p.name}"`);
      const all = rows.every((e) => d.judgementSaved[p.id]?.[e.id]);
      if (all) {
        setStatus(d, p.id, "JUDGEMENTS");
        log(d, session.name, `"${p.name}" fully judged`);
      }
    });
    toast(done ? `"${p.name}" fully judged` : "Mark saved", "ok");
    if (done) setTimeout(() => back?.(), 300);
  };

  return (
    <div className="max-w-[680px] mx-auto">
      <PageHead title={p.name} sub={`Judgement · marks are graded on the "${scaleNameOf(data, p)}" scale · out of 100`}>
        <Tag color="var(--marigold)">Mark is out of 100</Tag>
      </PageHead>
      <div className="card p-4 grid gap-2.5">
        {rows.map((e, i) => {
          const isSaved = !!savedMap[e.id];
          const gp = gradeFor(parseFloat(marks[e.id] || ""), scaleFor(data, p));
          return (
            <div key={e.id} className="card2 px-3.5 py-2.5 flex items-center gap-3 flex-wrap">
              <span className="font-d text-[12px] font-extrabold w-6 shrink-0" style={{ color: "var(--mut)" }}>{i + 1}</span>
              <span className="tag mono flex-1 min-w-[90px]" style={{ background: "var(--panel3)", fontSize: 16, fontWeight: 800, letterSpacing: 1, justifyContent: "flex-start" }}>{letters[e.id] || "?"}</span>
              {isSaved ? (
                <span className="tag" style={{ background: "var(--acc-soft)", color: "var(--acc)", fontSize: 12.5 }}>
                  <Icon n="check" s={13} sw={2.6} /> {marks[e.id]} · {gp ? gp.name : "—"}
                </span>
              ) : (
                <>
                  <input className="input text-center mono" style={{ width: 96 }} inputMode="decimal" placeholder="0–100"
                    value={marks[e.id] || ""} onChange={(ev) => setMark(e.id, ev.target.value)}
                    onKeyDown={(ev) => ev.key === "Enter" && saveRow(e.id)} />
                  <Btn size="sm" kind="gold" onClick={() => saveRow(e.id)}>Save</Btn>
                </>
              )}
            </div>
          );
        })}
        {rows.length === 0 && <div className="text-[13px] font-bold text-center py-6" style={{ color: "var(--mut)" }}>No entries in this program.</div>}
      </div>
      <p className="text-[12px] font-bold mt-3 text-right" style={{ color: "var(--mut)" }}>when every mark is saved the program moves to Judgements automatically</p>
    </div>
  );
}


/* ---------------- media ---------------- */
export function MediaSection({ push }: P) {
  const { data } = useStore();
  const [q, setQ] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  useKeyNav(() => searchRef.current?.focus());
  if (!data) return null;
  // only results the monitor has ticked off reach media
  const progs = data.programs
    .filter((p) => data.monitorDone[p.id] && p.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (resultNo(data, a.id) ?? 9e9) - (resultNo(data, b.id) ?? 9e9));
  return (
    <div>
      <PageHead title="Media" sub="Results cleared by the monitor — ready to announce and design posters for.">
        <SearchInput value={q} onChange={setQ} inputRef={searchRef} placeholder="Search…  ( / )" />
      </PageHead>
      {progs.length === 0 ? (
        <Empty icon="camera" title="Nothing cleared yet" body="When the monitor confirms a result it lands here with its result number." />
      ) : (
        <div className="grid gap-3">
          {progs.map((p, i) => {
            const cat = data.categories.find((c) => c.id === p.categoryId);
            const rows = programResults(data, p).slice(0, 3);
            const no = resultNo(data, p.id);
            return (
              <button key={p.id} type="button" onClick={() => push({ id: "monitorDetail", params: { pid: p.id } })}
                className="card hoverable p-4 text-left anim-in w-full" style={{ animationDelay: i * 45 + "ms" }}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {no !== null && <span className="tag mono" style={{ background: "var(--marigold-soft)", color: "var(--marigold)", fontSize: 12 }}>No. {no}</span>}
                      <span className="font-d text-[15px] font-extrabold truncate">{p.name}</span>
                    </div>
                    <div className="flex gap-1.5 mt-1.5 flex-wrap">
                      <Tag color="var(--acc)">{cat?.name || "—"}</Tag>
                      <Tag>{p.kind === "GROUP" ? "Group" : "Individual"}</Tag>
                      {st(data, p.id) === "PUBLISHED" && <Tag color="var(--acc)">Published</Tag>}
                    </div>
                  </div>
                  <Icon n="arrowR" s={16} className="opacity-40 shrink-0 mt-1" />
                </div>
                <div className="divider my-3" />
                <div className="grid gap-1.5">
                  {rows.map((r, idx) => (
                    <div key={r.e.id} className="flex items-center gap-2.5">
                      <span className="font-d text-[11.5px] font-black w-8 shrink-0" style={{ color: idx === 0 ? "var(--marigold)" : "var(--mut)" }}>
                        {idx === 0 ? "1st" : idx === 1 ? "2nd" : "3rd"}
                      </span>
                      <span className="font-bold text-[13px] flex-1 truncate">{r.label}</span>
                      <span className="tag" style={{ background: "var(--acc-soft)", color: "var(--acc)", fontSize: 12 }}>{r.grade?.name || "—"}</span>
                    </div>
                  ))}
                  {rows.length === 0 && <span className="text-[12.5px] font-bold" style={{ color: "var(--mut)" }}>No marks recorded.</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------- monitor ---------------- */
export function MonitorSection({ push }: P) {
  const { data } = useStore();
  const [q, setQ] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  useKeyNav(() => searchRef.current?.focus());
  if (!data) return null;
  const progs = data.programs.filter((p) => ["FINALYSED", "PUBLISHED"].includes(st(data, p.id)) && p.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <PageHead title="Monitor" sub="Review each finalysed result and confirm it — the tick only records your check. Publishing is done from Program Control.">
        <SearchInput value={q} onChange={setQ} inputRef={searchRef} placeholder="Search…  ( / )" />
      </PageHead>
      <ProgList progs={progs} hint="finalysed" emptyIcon="eye" emptyTitle="Nothing to monitor"
        emptyBody="Programs moved to Finalysed in Program Control appear here for a final check."
        onPick={(p) => push({ id: "monitorDetail", params: { pid: p.id } })}
        badge={(p) => data.monitorDone[p.id] ? (
          <span className="tag" style={{ background: "var(--acc-soft)", color: "var(--acc)" }}><Icon n="check" s={13} sw={2.6} /> Confirmed</span>
        ) : undefined} />
    </div>
  );
}

export function MonitorDetail({ params, back }: P) {
  const { data, fest, session, updateFest } = useStore();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const p = data?.programs.find((x) => x.id === params?.pid);
  if (!data || !fest || !session) return null;
  if (!p) return <Empty icon="eye" title="Program not found" body="It may have been deleted." />;
  const rows = programResults(data, p);
  const confirmed = !!data.monitorDone[p.id];
  const published = st(data, p.id) === "PUBLISHED";
  const confirm = () => {
    if (busy || confirmed) return;
    setBusy(true);
    updateFest(fest.id, (d) => {
      d.monitorDone[p.id] = true;
      log(d, session.name, `"${p.name}" confirmed in monitor`);
    });
    toast(`"${p.name}" confirmed`, "ok");
    setTimeout(() => back?.(), 250);
  };
  return (
    <div className="max-w-[680px] mx-auto">
      <PageHead title={p.name} sub="Monitor · grade points only — raw marks stay private. Confirming leaves your tick; it does not publish.">
        {confirmed && <Tag color="var(--acc)"><Icon n="check" s={13} sw={2.6} /> Confirmed</Tag>}
        {published && <Tag color="var(--marigold)">Published</Tag>}
      </PageHead>
      <div className="card p-4 grid gap-2.5">
        {rows.map((r, i) => (
          <div key={r.e.id} className="card2 px-3.5 py-2.5 flex items-center gap-3">
            <span className="font-d text-[13px] font-black w-7 shrink-0" style={{ color: i === 0 ? "var(--marigold)" : "var(--mut)" }}>{i + 1}</span>
            <span className="tag mono" style={{ background: "var(--panel3)", fontSize: 13 }}>{r.letter || "?"}</span>
            <span className="font-bold text-[13.5px] flex-1 min-w-0 truncate">{r.label}<span style={{ color: "var(--mut)" }}> · {data.teams.find((t) => t.id === r.e.teamId)?.name || "—"}</span></span>
            <span className="tag" style={{ background: "var(--plum)" + "26", color: "var(--plum)", fontSize: 13 }}>{r.grade?.name || "—"}</span>
            <span className="tag" style={{ background: "var(--acc-soft)", color: "var(--acc)", fontSize: 13 }}>{pointLabel(r.grade)} GP</span>
          </div>
        ))}
      </div>
      <div className="flex justify-end mt-4">
        <Btn size="big" onClick={confirm} disabled={busy || confirmed}>
          <Icon n="check" s={16} sw={2.6} /> {confirmed ? "Confirmed" : "Confirm"}
        </Btn>
      </div>
    </div>
  );
}
