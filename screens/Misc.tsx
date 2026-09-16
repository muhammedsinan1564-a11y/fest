import { useMemo, useState } from "react";
import { useStore, st, STATUS_FLOW, STATUS_LABEL, teamScores, teamCategoryScores, programResults, log } from "../lib/store";
import { Icon, Btn, PageHead, Stat, Empty, Tag, Modal, useToast } from "../lib/ui";
import type { Route } from "./Shell";

type P = { push: (r: Route) => void; params?: Record<string, string> };

/* ---------------- Dashboard ---------------- */
export function Dashboard(_: P) {
  const { data, fest, session } = useStore();
  if (!data || !fest || !session) return null;

  // Member Dashboard (Read-Only)
  if (session.role === "MEMBER") {
    const member = data.members.find((m) => m.id === session.memberId || m.name.toLowerCase() === session.name.toLowerCase());
    const team = data.teams.find((t) => t.id === member?.teamId);
    const category = data.categories.find((c) => c.id === member?.categoryId);

    const myPrograms = data.programs.filter((p) =>
      p.entries.some((e) => e.memberIds.includes(member?.id || ""))
    );

    const totalPrograms = myPrograms.length;
    const finishedPrograms = myPrograms.filter((p) =>
      ["FINISHED", "JUDGEMENTS", "FINALYSED", "PUBLISHED"].includes(st(data, p.id))
    ).length;
    const nonStartedPrograms = myPrograms.filter((p) =>
      st(data, p.id) === "NOT_STARTED"
    ).length;

    return (
      <div className="space-y-4">
        <PageHead title={`Hey ${session.name}`} sub={`${fest.name} · Member Dashboard`}>
          <Tag color="var(--sky)">Read-Only View</Tag>
        </PageHead>

        {/* Member Profile Details in separate boxes */}
        <div className="card p-5">
          <div className="lbl mb-3">Member Profile Details</div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="w-16 h-16 rounded-full overflow-hidden shrink-0 flex items-center justify-center font-d font-black text-[20px] select-none"
              style={{ background: "var(--panel3)", border: "2px solid var(--acc)", color: "var(--acc)" }}>
              {member?.photo ? (
                <img src={member.photo} alt={member.name} className="w-full h-full object-cover" />
              ) : (
                (member?.name || session.name).slice(0, 2).toUpperCase()
              )}
            </div>

            <div className="flex-1 min-w-[200px]">
              <div className="font-d text-[18px] font-extrabold">{member?.name || session.name}</div>
              <div className="text-[12px] font-bold mt-0.5" style={{ color: "var(--mut)" }}>
                Member Account (Watch Only)
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full sm:w-auto">
              <div className="card2 px-3 py-2 text-center">
                <span className="text-[9.5px] font-extrabold uppercase tracking-wider block" style={{ color: "var(--mut)" }}>Code</span>
                <span className="mono font-extrabold text-[13px]" style={{ color: "var(--marigold)" }}>{member?.code || "—"}</span>
              </div>
              <div className="card2 px-3 py-2 text-center">
                <span className="text-[9.5px] font-extrabold uppercase tracking-wider block" style={{ color: "var(--mut)" }}>Team</span>
                <span className="font-extrabold text-[13px] truncate block" style={{ color: "var(--coral)" }}>{team?.name || "—"}</span>
              </div>
              <div className="card2 px-3 py-2 text-center">
                <span className="text-[9.5px] font-extrabold uppercase tracking-wider block" style={{ color: "var(--mut)" }}>Category</span>
                <span className="font-extrabold text-[13px] truncate block" style={{ color: "var(--acc)" }}>{category?.name || "—"}</span>
              </div>
              <div className="card2 px-3 py-2 text-center">
                <span className="text-[9.5px] font-extrabold uppercase tracking-wider block" style={{ color: "var(--mut)" }}>Place / Phone</span>
                <span className="font-extrabold text-[12px] truncate block" style={{ color: "var(--ink)" }}>{member?.place || member?.phone || "—"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Program Stats in separate boxes */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="card p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-wider mb-0.5" style={{ color: "var(--mut)" }}>
                Total Programs
              </div>
              <div className="font-d text-[28px] font-black" style={{ color: "var(--marigold)" }}>
                {totalPrograms}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--marigold-soft)", color: "var(--marigold)" }}>
              <Icon n="list" s={20} />
            </div>
          </div>

          <div className="card p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-wider mb-0.5" style={{ color: "var(--mut)" }}>
                Finished Programs
              </div>
              <div className="font-d text-[28px] font-black" style={{ color: "var(--acc)" }}>
                {finishedPrograms}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--acc-soft)", color: "var(--acc)" }}>
              <Icon n="check" s={20} />
            </div>
          </div>

          <div className="card p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-wider mb-0.5" style={{ color: "var(--mut)" }}>
                Non Started Programs
              </div>
              <div className="font-d text-[28px] font-black" style={{ color: "var(--coral)" }}>
                {nonStartedPrograms}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--coral-soft)", color: "var(--coral)" }}>
              <Icon n="clock" s={20} />
            </div>
          </div>
        </div>

        {/* Assigned Programs Detail List */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Icon n="list" s={18} className="opacity-70" />
            <span className="font-d text-[15px] font-extrabold">My Programs</span>
            <span className="text-[12px] font-bold ml-auto" style={{ color: "var(--mut)" }}>{myPrograms.length} items</span>
          </div>

          {myPrograms.length === 0 ? (
            <div className="text-[13px] font-bold py-8 text-center" style={{ color: "var(--mut)" }}>
              You are not enrolled in any programs yet.
            </div>
          ) : (
            <div className="grid gap-2.5">
              {myPrograms.map((p) => {
                const status = st(data, p.id);
                const results = programResults(data, p);
                const myResult = results.find((r) => r.e.memberIds.includes(member?.id || ""));
                return (
                  <div key={p.id} className="card2 p-3.5 flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="font-d text-[14.5px] font-extrabold truncate">{p.name}</div>
                      <div className="flex gap-1.5 mt-1.5 flex-wrap text-[11.5px] font-semibold">
                        <Tag color="var(--acc)">{category?.name || "—"}</Tag>
                        <Tag>{p.venue}</Tag>
                        <Tag color={p.kind === "GROUP" ? "var(--plum)" : "var(--sky)"}>{p.kind}</Tag>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`tag st-${status}`}>{STATUS_LABEL[status]}</span>
                      {status === "PUBLISHED" && myResult && (
                        <span className="tag" style={{ background: "var(--marigold-soft)", color: "var(--marigold)", fontWeight: 800 }}>
                          Grade: {myResult.grade?.name || "—"} ({myResult.gp} GP)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  const published = data.programs.filter((p) => st(data, p.id) === "PUBLISHED").length;
  const counts = STATUS_FLOW.map((s) => ({ s, n: data.programs.filter((p) => st(data, p.id) === s).length }));
  const time = (t: number) => new Date(t).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  return (
    <div>
      <PageHead title={`Hey ${session.name}`} sub={`${fest.name} · ${new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}`} />
      {fest.isEvaluation && (
        <div className="card2 p-4 mb-4 border-l-4" style={{ borderColor: "var(--marigold)" }}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="tag" style={{ background: "var(--marigold-soft)", color: "var(--marigold)", fontWeight: 800 }}>⚡ EXPLORE MODE (EVALUATION)</span>
                <span className="font-extrabold text-[13.5px]">Resource Quotas Active</span>
              </div>
              <p className="text-[12px] font-semibold text-[var(--mut)] mt-1">
                You are testing Festize in evaluation mode. You can add up to <b>2 teams</b>, <b>3 categories</b>, <b>20 members</b>, <b>5 programs</b>, and <b>5 crew users</b>.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
              <span className="tag" style={{ background: data.teams.length >= 2 ? "var(--coral-soft)" : "var(--panel3)", color: data.teams.length >= 2 ? "var(--coral)" : "var(--ink)" }}>Teams: {data.teams.length}/2</span>
              <span className="tag" style={{ background: data.categories.length >= 3 ? "var(--coral-soft)" : "var(--panel3)", color: data.categories.length >= 3 ? "var(--coral)" : "var(--ink)" }}>Categories: {data.categories.length}/3</span>
              <span className="tag" style={{ background: data.members.length >= 20 ? "var(--coral-soft)" : "var(--panel3)", color: data.members.length >= 20 ? "var(--coral)" : "var(--ink)" }}>Members: {data.members.length}/20</span>
              <span className="tag" style={{ background: data.programs.length >= 5 ? "var(--coral-soft)" : "var(--panel3)", color: data.programs.length >= 5 ? "var(--coral)" : "var(--ink)" }}>Programs: {data.programs.length}/5</span>
              <span className="tag" style={{ background: data.accessUsers.length >= 5 ? "var(--coral-soft)" : "var(--panel3)", color: data.accessUsers.length >= 5 ? "var(--coral)" : "var(--ink)" }}>Users: {data.accessUsers.length}/5</span>
            </div>
          </div>
        </div>
      )}
      <div className="flex gap-3 flex-wrap mb-5">
        <Stat label={fest.isEvaluation ? "Teams (max 2)" : "Teams"} value={fest.isEvaluation ? `${data.teams.length}/2` : data.teams.length} icon="flag" tone="var(--coral)" />
        <Stat label={fest.isEvaluation ? "Members (max 20)" : "Members"} value={fest.isEvaluation ? `${data.members.length}/20` : data.members.length} icon="users" tone="var(--acc)" />
        <Stat label={fest.isEvaluation ? "Programs (max 5)" : "Programs"} value={fest.isEvaluation ? `${data.programs.length}/5` : data.programs.length} icon="list" tone="var(--marigold)" />
        <Stat label="Published" value={published} icon="trophy" tone="var(--plum)" />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Icon n="sliders" s={16} className="opacity-70" />
            <span className="font-d text-[13.5px] font-extrabold">Program pipeline</span>
          </div>
          <div className="grid gap-2">
            {counts.map(({ s, n }) => (
              <div key={s} className="flex items-center gap-3">
                <span className={`tag st-${s} w-[104px] justify-center`}>{STATUS_LABEL[s]}</span>
                <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: "var(--panel3)" }}>
                  <div className="h-full rounded-full bar-grow" style={{ width: `${data.programs.length ? (n / data.programs.length) * 100 : 0}%`, background: "var(--acc)" }} />
                </div>
                <span className="font-d text-[13px] font-extrabold w-6 text-right">{n}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Icon n="clock" s={16} className="opacity-70" />
            <span className="font-d text-[13.5px] font-extrabold">Recent activity</span>
            <span className="pulse-dot w-2 h-2 rounded-full ml-auto" style={{ background: "var(--acc)" }} />
          </div>
          {data.activities.length === 0 && <div className="text-[13px] font-semibold py-6 text-center" style={{ color: "var(--mut)" }}>No activity yet — everything your crew does lands here.</div>}
          <div className="grid gap-1 max-h-[330px] overflow-y-auto pr-1">
            {data.activities.slice(0, 40).map((a) => (
              <div key={a.id} className="flex items-start gap-3 px-3 py-2 rounded-lg" style={{ background: "var(--panel2)" }}>
                <span className="w-6.5 h-6.5 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ width: 26, height: 26, background: "var(--marigold-soft)", color: "var(--marigold)" }}>
                  <Icon n="bolt" s={12} />
                </span>
                <div className="min-w-0">
                  <div className="text-[12.5px] font-bold leading-snug"><span className="mono" style={{ color: "var(--acc)" }}>{a.user}</span> — {a.action}</div>
                  <div className="text-[10.5px] font-bold mt-0.5" style={{ color: "var(--mut)" }}>{time(a.at)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Random Picker ---------------- */
export function RandomPicker(_: P) {
  const [max, setMax] = useState("");
  const [val, setVal] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);
  const [hist, setHist] = useState<number[]>([]);
  const toast = useToast();
  const draw = () => {
    const m = parseInt(max);
    if (!m || m < 1) { toast("Type a maximum number first", "err"); return; }
    if (m > 100) { setMax("100"); toast("The maximum limit is 100", "err"); return; }
    if (rolling) return;
    setRolling(true);
    setVal(null);
    let ticks = 0;
    const iv = setInterval(() => {
      setVal(Math.floor(Math.random() * m) + 1);
      ticks++;
      if (ticks > 14) {
        clearInterval(iv);
        const final = Math.floor(Math.random() * m) + 1;
        setVal(final);
        setHist((h) => [final, ...h].slice(0, 12));
        setRolling(false);
        toast(`Drawn: ${final}`, "ok");
      }
    }, 70);
  };
  return (
    <div className="max-w-[640px] mx-auto">
      <PageHead title="Random Picker" sub="Fair draws for housefests, tie-breaks and spot prizes." />
      <div className="card p-8 text-center">
        <div className="font-d font-black leading-none my-6 select-none" style={{ fontSize: "clamp(4rem, 14vw, 7.5rem)", color: val !== null ? "var(--marigold)" : "var(--mut)" }}>
          <span key={val ?? "x"} className="inline-block num-flip">{val ?? "?"}</span>
        </div>
        <div className="flex gap-2 max-w-[300px] mx-auto">
          <input className="input text-center font-d font-bold" inputMode="numeric" value={max} autoFocus
             placeholder="Maximum number (max 100)" onChange={(e) => {
               const clean = e.target.value.replace(/[^\d]/g, "");
               setMax(clean && parseInt(clean) > 100 ? "100" : clean);
             }}
            onKeyDown={(e) => e.key === "Enter" && draw()} />
          <Btn kind="gold" onClick={draw} disabled={rolling}>{rolling ? "…" : "Confirm"}</Btn>
        </div>
         <p className="text-[12px] font-bold mt-3" style={{ color: "var(--mut)" }}>draws a number between 1 and your maximum (limit: 100)</p>
      </div>
      {hist.length > 0 && (
        <div className="mt-4 card2 p-4">
          <div className="lbl">Previous draws</div>
          <div className="flex flex-wrap gap-2">
            {hist.map((h, i) => <span key={i} className="tag mono" style={{ background: "var(--panel3)", color: "var(--ink)", fontSize: 13 }}>{h}</span>)}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Random Letter (Monitor only) ---------------- */
export function RandomLetter(_: P) {
  const { session } = useStore();
  const toast = useToast();
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const [endLetter, setEndLetter] = useState("");
  const [value, setValue] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<string[]>([]);
  const [shown, setShown] = useState<string[]>([]);
  const [rolling, setRolling] = useState(false);

  // This route is deliberately restricted even if someone tries to enter it manually.
  if (session?.role !== "MONITOR") {
    return <Empty icon="shuffle" title="Monitor access only" body="Random Letter is available only to Monitor users." />;
  }

  const range = endLetter ? alphabet.slice(0, alphabet.indexOf(endLetter) + 1) : [];
  const allShown = range.length > 0 && remaining.length === 0 && shown.length === range.length;

  const resetRound = (letter = endLetter) => {
    const letters = letter ? alphabet.slice(0, alphabet.indexOf(letter) + 1) : [];
    setValue(null);
    setRemaining(letters);
    setShown([]);
    setRolling(false);
  };

  const changeEnd = (raw: string) => {
    const clean = raw.toUpperCase().replace(/[^A-Z]/g, "").slice(-1);
    setEndLetter(clean);
    setValue(null);
    setShown([]);
    setRemaining(clean ? alphabet.slice(0, alphabet.indexOf(clean) + 1) : []);
  };

  const draw = () => {
    if (!endLetter) { toast("Type the last alphabet letter first", "err"); return; }
    if (rolling) return;
    if (allShown) {
      toast(`A to ${endLetter} have all been shown. Start a new round to draw again.`, "info");
      return;
    }

    // On a fresh range, remaining holds A through the typed end letter.
    const pool = remaining.length ? [...remaining] : [...range];
    if (!pool.length) return;
    setRolling(true);
    setValue(null);
    let ticks = 0;
    const iv = window.setInterval(() => {
      setValue(pool[Math.floor(Math.random() * pool.length)]);
      ticks++;
      if (ticks > 15) {
        window.clearInterval(iv);
        const picked = pool[Math.floor(Math.random() * pool.length)];
        const left = pool.filter((letter) => letter !== picked);
        setValue(picked);
        setRemaining(left);
        setShown((prev) => [...prev, picked]);
        setRolling(false);
        toast(left.length ? `Drawn: ${picked}` : `Drawn: ${picked} — every letter has now been shown.`, "ok");
      }
    }, 70);
  };

  return (
    <div className="max-w-[640px] mx-auto">
      <PageHead title="Random Letter" sub="Draw one letter from A through your chosen letter. No letter repeats until the round is complete." />
      <div className="card p-8 text-center">
        <div className="font-d font-black leading-none my-6 select-none" style={{ fontSize: "clamp(4rem, 14vw, 7.5rem)", color: value ? "var(--marigold)" : "var(--mut)" }}>
          <span key={value ?? "x"} className="inline-block num-flip">{value ?? "?"}</span>
        </div>
        <div className="flex gap-2 max-w-[340px] mx-auto">
          <input
            className="input text-center font-d font-bold uppercase"
            value={endLetter}
            autoFocus
            maxLength={1}
            placeholder="Last letter, e.g. M"
            aria-label="Last alphabet letter"
            onChange={(e) => changeEnd(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && draw()}
          />
          <Btn kind="gold" onClick={draw} disabled={rolling}>{rolling ? "…" : "Confirm"}</Btn>
        </div>
        <p className="text-[12px] font-bold mt-3" style={{ color: "var(--mut)" }}>
          {endLetter ? `Drawing from A to ${endLetter}` : "Type one alphabet letter to set the range"}
        </p>

        {range.length > 0 && (
          <div className="mt-5 flex items-center justify-center gap-3 flex-wrap">
            <span className="tag" style={{ background: "var(--acc-soft)", color: "var(--acc)" }}>{remaining.length} remaining</span>
            <span className="tag" style={{ background: "var(--panel3)", color: "var(--mut)" }}>{shown.length}/{range.length} shown</span>
            <Btn size="sm" kind="soft" onClick={() => resetRound()} disabled={rolling}>New round</Btn>
          </div>
        )}
      </div>
      {shown.length > 0 && (
        <div className="mt-4 card2 p-4">
          <div className="lbl">Letters already shown</div>
          <div className="flex flex-wrap gap-2">
            {shown.map((letter, i) => <span key={`${letter}-${i}`} className="tag mono" style={{ background: "var(--panel3)", color: "var(--ink)", fontSize: 13 }}>{letter}</span>)}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Team Marks ---------------- */
export function TeamMarks(_: P) {
  const { data } = useStore();
  if (!data) return null;
  const scores = teamScores(data);
  const catScores = teamCategoryScores(data);
  const rows = data.teams.map((t) => ({ t, s: scores[t.id] })).sort((a, b) => (b.s.gold - a.s.gold) || (b.s.silver - a.s.silver) || (b.s.bronze - a.s.bronze));
  const catRows = data.teams.map((t) => ({ t, tot: data.categories.reduce((n, c) => n + (catScores[t.id]?.[c.id] || 0), 0) })).sort((a, b) => b.tot - a.tot);
  return (
    <div>
      <PageHead title="Team Marks" sub="Placings from published programs, and grade points earned per category." />
      {rows.length === 0 ? <Empty icon="flag" title="No teams yet" body="Add teams in the Teams section to start the tally." /> : (
        <>
          <div className="card overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>#</th><th>Team</th><th>First</th><th>Second</th><th>Third</th></tr></thead>
              <tbody>
                {rows.map(({ t, s }, i) => (
                  <tr key={t.id}>
                    <td className="font-d font-extrabold">{i + 1}</td>
                    <td><span className="font-extrabold">{t.name}</span></td>
                    <td><span style={{ color: "var(--marigold)" }} className="font-extrabold">{s.gold}</span></td>
                    <td className="font-bold">{s.silver}</td>
                    <td><span style={{ color: "var(--coral)" }} className="font-bold">{s.bronze}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="font-d text-[16px] font-extrabold mt-6 mb-3">Category Grade Points</h2>
          {data.categories.length === 0 ? <Empty icon="tag" title="No categories yet" body="Add categories to see per-category grade points." /> : (
            <div className="card overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Team</th>
                    {data.categories.map((c) => <th key={c.id}>{c.name}</th>)}
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {catRows.map(({ t, tot }) => (
                    <tr key={t.id}>
                      <td className="font-extrabold">{t.name}</td>
                      {data.categories.map((c) => {
                        const v = catScores[t.id]?.[c.id] || 0;
                        return <td key={c.id}><span className="mono font-bold" style={{ color: v ? "var(--ink)" : "var(--mut)" }}>{v}</span></td>;
                      })}
                      <td><span className="tag" style={{ background: "var(--acc-soft)", color: "var(--acc)", fontSize: 13 }}>{tot} GP</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ---------------- Public Team Scores ---------------- */
export function PublicScores(_: P) {
  const { data, fest, session, updateFest } = useStore();
  const toast = useToast();
  const [pick, setPick] = useState(false);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [openTeam, setOpenTeam] = useState<string | null>(null);
  if (!data || !fest || !session) return null;
  const isMain = session.role === "MAIN";
  const scores = teamScores(data, true);
  const rows = data.teams.map((t) => ({ t, s: scores[t.id] })).sort((a, b) => b.s.gp - a.s.gp);
  const maxGp = Math.max(1, ...rows.map((r) => r.s.gp));
  const tones = ["var(--marigold)", "var(--acc)", "var(--sky)", "var(--plum)", "var(--coral)"];
  const published = data.programs.filter((p) => st(data, p.id) === "PUBLISHED");
  const releasedCount = published.filter((p) => data.publicReleased[p.id]).length;

  const openPick = () => { setSel({ ...data.publicReleased }); setPick(true); };
  const confirmPick = () => {
    const chosen = published.filter((p) => sel[p.id]).length;
    updateFest(fest.id, (d) => {
      d.publicReleased = {};
      for (const p of published) if (sel[p.id]) d.publicReleased[p.id] = true;
      log(d, session.name, `Released ${chosen} program(s) to public team score`);
    });
    setPick(false);
    toast(`${chosen} program(s) added to the public score`, "ok");
  };

  // where a team's points came from — every released program it scored in
  const breakdown = (teamId: string) => {
    const out: { program: string; cat: string; who: string; place: number; grade: string; gp: number }[] = [];
    for (const p of data.programs) {
      if (st(data, p.id) !== "PUBLISHED" || !data.publicReleased[p.id]) continue;
      const cat = data.categories.find((c) => c.id === p.categoryId)?.name || "—";
      programResults(data, p).forEach((r, i) => {
        if (r.e.teamId !== teamId || !r.gp) return;
        out.push({ program: p.name, cat, who: r.label, place: i + 1, grade: r.grade?.name || "—", gp: r.gp });
      });
    }
    return out.sort((a, b) => b.gp - a.gp);
  };

  const team = isMain ? data.teams.find((t) => t.id === openTeam) : undefined;
  if (team) {
    const items = breakdown(team.id);
    const total = items.reduce((n, x) => n + x.gp, 0);
    return (
      <div className="max-w-[680px] mx-auto">
        <PageHead title={team.name} sub="Where this team's points came from">
          <Btn kind="soft" onClick={() => setOpenTeam(null)}><Icon n="arrowL" s={15} /> Back</Btn>
        </PageHead>
        {items.length === 0 ? <Empty icon="globe" title="No points yet" body="This team hasn't scored in any released program." /> : (
          <>
            <div className="card p-4 grid gap-2.5">
              {items.map((x, i) => (
                <div key={i} className="card2 px-3.5 py-2.5 flex items-center gap-3 flex-wrap">
                  <span className="font-d text-[12px] font-extrabold w-6 shrink-0" style={{ color: x.place <= 3 ? "var(--marigold)" : "var(--mut)" }}>
                    {x.place === 1 ? "1st" : x.place === 2 ? "2nd" : x.place === 3 ? "3rd" : x.place}
                  </span>
                  <span className="font-bold text-[13.5px] flex-1 min-w-[130px] truncate">
                    {x.program}
                    <span className="block font-semibold text-[11.5px]" style={{ color: "var(--mut)" }}>{x.who}</span>
                  </span>
                  <Tag>{x.cat}</Tag>
                  <span className="tag" style={{ background: "var(--marigold-soft)", color: "var(--marigold)", fontSize: 12.5 }}>{x.grade}</span>
                  <span className="tag" style={{ background: "var(--acc-soft)", color: "var(--acc)", fontSize: 13 }}>+{x.gp}</span>
                </div>
              ))}
            </div>
            <div className="card2 p-3.5 mt-3 flex items-center justify-between">
              <span className="font-extrabold text-[13.5px]">Total from {items.length} result{items.length === 1 ? "" : "s"}</span>
              <span className="tag" style={{ background: "var(--acc-soft)", color: "var(--acc)", fontSize: 15, fontWeight: 900 }}>{total} GP</span>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      <PageHead title="Public Team Scores" sub={`${fest.name} · standing from ${releasedCount} released program${releasedCount === 1 ? "" : "s"}${isMain ? " · tap a team to see where its points came from" : ""}`}>
        {isMain && <Btn kind="gold" onClick={openPick}><Icon n="globe" s={16} /> Public</Btn>}
      </PageHead>
      {rows.length === 0 ? <Empty icon="globe" title="Nothing published yet" body="Team scores appear here once the organiser releases programs to the public score." /> : (
        <div className="grid gap-3">
          {rows.map(({ t, s }, i) => {
            // only the main user may open a team and inspect where its points came from
            const inner = (
              <>
                <div className="font-d text-[22px] font-black w-10 text-center" style={{ color: i === 0 ? "var(--marigold)" : "var(--mut)" }}>{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-3 mb-2">
                    <span className="font-d text-[15px] font-extrabold truncate">{t.name}</span>
                    <span className="font-d text-[15px] font-black shrink-0" style={{ color: tones[i % tones.length] }}>{s.gp} GP</span>
                  </div>
                  <div className="h-3 rounded-full overflow-hidden" style={{ background: "var(--panel3)" }}>
                    <div className="h-full rounded-full bar-grow" style={{ width: `${(s.gp / maxGp) * 100}%`, background: tones[i % tones.length], animationDelay: i * 90 + "ms" }} />
                  </div>
                </div>
                {isMain && <Icon n="arrowR" s={16} className="opacity-40 shrink-0" />}
              </>
            );
            const cls = "card p-4 flex items-center gap-4 anim-in w-full";
            const style = { animationDelay: i * 60 + "ms" };
            return isMain ? (
              <button key={t.id} type="button" onClick={() => setOpenTeam(t.id)} title="See where these points came from"
                className={cls + " hoverable text-left"} style={style}>{inner}</button>
            ) : (
              <div key={t.id} className={cls} style={style}>{inner}</div>
            );
          })}
        </div>
      )}

      <Modal open={pick} onClose={() => setPick(false)} title="Release programs to public score" w={520} footer={
        <><Btn kind="soft" onClick={() => setPick(false)}>Cancel</Btn><Btn onClick={confirmPick}>Confirm</Btn></>
      }>
        <p className="text-[13px] font-semibold mb-3" style={{ color: "var(--mut)" }}>
          Tick the published programs whose marks should count in the public team score. Only what you confirm here is shown to the public.
        </p>
        {published.length === 0 ? (
          <div className="text-[13px] font-bold text-center py-6" style={{ color: "var(--mut)" }}>No published programs yet.</div>
        ) : (
          <div className="grid gap-1.5 max-h-[340px] overflow-y-auto pr-1">
            {published.map((p) => {
              const on = !!sel[p.id];
              const cat = data.categories.find((c) => c.id === p.categoryId)?.name || "—";
              return (
                <button key={p.id} type="button" onClick={() => setSel((s) => ({ ...s, [p.id]: !s[p.id] }))}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all"
                  style={{ background: on ? "var(--acc-soft)" : "var(--panel2)", border: `1.5px solid ${on ? "var(--acc)" : "var(--line)"}` }}>
                  <span className="w-4.5 h-4.5 rounded flex items-center justify-center shrink-0" style={{ width: 18, height: 18, background: on ? "var(--acc)" : "transparent", border: on ? "none" : "1.5px solid var(--line2)", color: "#08211b" }}>
                    {on && <Icon n="check" s={12} sw={3} />}
                  </span>
                  <span className="font-bold text-[13px] flex-1 truncate">{p.name}</span>
                  <Tag>{cat}</Tag>
                </button>
              );
            })}
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ---------------- Top Candidates ---------------- */
export function TopCandidates(_: P) {
  const { data } = useStore();
  const [fCat, setFCat] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [inclGroup, setInclGroup] = useState(false);

  // every member → their published programs and the grade points earned in each
  const cands = useMemo(() => {
    if (!data) return [];
    const byMember: Record<string, { id: string; name: string; catId: string; team: string; total: number; items: { program: string; cat: string; gp: number; group: boolean }[] }> = {};
    for (const p of data.programs) {
      if (st(data, p.id) !== "PUBLISHED") continue;
      const isGroup = p.kind === "GROUP";
      if (isGroup && !inclGroup) continue;
      const cat = data.categories.find((c) => c.id === p.categoryId)?.name || "—";
      for (const r of programResults(data, p)) {
        for (const mid of r.e.memberIds) {
          const m = data.members.find((x) => x.id === mid);
          if (!m) continue;
          if (!byMember[mid]) byMember[mid] = {
            id: mid, name: m.name, catId: m.categoryId,
            team: data.teams.find((t) => t.id === m.teamId)?.name || "—", total: 0, items: [],
          };
          byMember[mid].total += r.gp;
          byMember[mid].items.push({ program: p.name, cat, gp: r.gp, group: isGroup });
        }
      }
    }
    return Object.values(byMember)
      .filter((m) => !fCat || m.catId === fCat)
      .sort((a, b) => b.total - a.total);
  }, [data, fCat, inclGroup]);

  if (!data) return null;
  const open = cands.find((c) => c.id === openId);
  const catName = (id: string) => data.categories.find((c) => c.id === id)?.name || "—";

  if (open) {
    return (
      <div className="max-w-[680px] mx-auto">
        <PageHead title={open.name} sub={`${catName(open.catId)} · ${open.team} · programs and marks`}>
          <Btn kind="soft" onClick={() => setOpenId(null)}><Icon n="arrowL" s={15} /> Back</Btn>
        </PageHead>
        <div className="card p-4 grid gap-2.5">
          {open.items.sort((a, b) => b.gp - a.gp).map((it, i) => (
            <div key={i} className="card2 px-3.5 py-2.5 flex items-center gap-3 flex-wrap">
              <span className="font-d text-[12px] font-extrabold w-6 shrink-0" style={{ color: "var(--mut)" }}>{i + 1}</span>
              <span className="font-bold text-[13.5px] flex-1 min-w-[120px] truncate">{it.program}</span>
              {it.group && <Tag color="var(--plum)">Group</Tag>}
              <Tag>{it.cat}</Tag>
              <span className="tag" style={{ background: "var(--acc-soft)", color: "var(--acc)", fontSize: 13 }}>{it.gp} marks</span>
            </div>
          ))}
        </div>
        <div className="card2 p-3.5 mt-3 flex items-center justify-between">
          <span className="font-extrabold text-[13.5px]">Total from {open.items.length} program{open.items.length === 1 ? "" : "s"}</span>
          <span className="tag" style={{ background: "var(--marigold-soft)", color: "var(--marigold)", fontSize: 15, fontWeight: 900 }}>{open.total} marks</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHead title="Top Candidates" sub="Total marks each member earned across published programs. Tap a name for the breakdown.">
        <button type="button" onClick={() => setInclGroup((v) => !v)} title="Count marks from group programs too"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-[12.5px] font-extrabold transition-all"
          style={{ background: inclGroup ? "var(--acc-soft)" : "var(--panel2)", border: `1.5px solid ${inclGroup ? "var(--acc)" : "var(--line)"}`, color: inclGroup ? "var(--acc)" : "var(--mut)" }}>
          <span className="flex items-center justify-center shrink-0" style={{ width: 17, height: 17, borderRadius: 5, background: inclGroup ? "var(--acc)" : "transparent", border: inclGroup ? "none" : "1.5px solid var(--line2)", color: "#08211b" }}>
            {inclGroup && <Icon n="check" s={11} sw={3} />}
          </span>
          Include group
        </button>
        <select className="select" style={{ width: "auto" }} value={fCat} onChange={(e) => setFCat(e.target.value)}>
          <option value="">All categories</option>
          {data.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </PageHead>
      {cands.length === 0 ? <Empty icon="star" title="No published results yet" body="Once programs are published, the leaderboard lights up here." /> : (
        <div className="card overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>#</th><th>Member</th><th>Category</th><th>Programs</th><th>Total Marks</th></tr></thead>
            <tbody>
              {cands.map((m, i) => (
                <tr key={m.id} onClick={() => setOpenId(m.id)} style={{ cursor: "pointer" }} title="See their programs and marks">
                  <td className="font-d font-extrabold" style={{ color: i < 3 ? "var(--marigold)" : "var(--mut)" }}>{i + 1}</td>
                  <td>
                    <span className="inline-flex items-center gap-2 font-extrabold">
                      {m.name}
                      <span className="font-semibold text-[11.5px]" style={{ color: "var(--mut)" }}>· {m.team}</span>
                    </span>
                  </td>
                  <td><Tag>{catName(m.catId)}</Tag></td>
                  <td className="font-bold">{m.items.length}</td>
                  <td><span className="tag" style={{ background: "var(--acc-soft)", color: "var(--acc)", fontSize: 13 }}>{m.total}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
