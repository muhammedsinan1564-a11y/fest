import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore, uid, randPass, randMainName, newFestData, log, ensureUniqueFestCode, normalizeFestCode } from "../lib/store";
import type { Fest, MainUser } from "../lib/store";
import { Icon, Btn, IconBtn, Field, EyeInput, Modal, Dots, ThemePicker, useToast, useAsk } from "../lib/ui";

import { LandingPage } from "./LandingPage";
import { pullSharedFests, fetchSharedFestByCode, festHash as sharedFestHash } from "../lib/sharedCloud";

type HR = "landing" | "adminLogin" | "adminPanel" | "joinByCode" | "userLogin";

export default function Home() {
  const [joinFestId, setJoinFestId] = useState<string | null>(null);
  const [route, setRoute] = useState<HR>("landing");
  const { db, updateDb, login } = useStore();

  /** Jump straight into one fest's login after its code is verified. */
  const openFestLogin = (festId: string) => {
    setJoinFestId(festId);
    setRoute("userLogin");
  };

  const handleExplorePlatform = () => {
    // Find or create an Evaluation Fest with strict limits: 2 teams, 3 categories, 20 members, 5 programs, 5 users
    const existing = db.fests.find((f) => f.isEvaluation || f.name.toLowerCase().includes("evaluation") || f.name.toLowerCase().includes("demo"));
    if (existing) {
      const mainUser = existing.mainUsers[0] || { name: "MAIN999", password: "demo" };
      login({
        festId: existing.id,
        name: mainUser.name,
        role: "MAIN",
        isEvaluation: true,
      });
      return;
    }

    // Create a ready-to-explore evaluation fest
    const evalFestId = uid();
    const evalFestName = "Evaluation Fest (Demo)";
    const evalData = newFestData();

    // Populate initial sample data that respects the limits:
    evalData.teams = [
      { id: uid(), name: "Phoenix Warriors" },
      { id: uid(), name: "Titan Legends" },
    ];
    evalData.categories = [
      { id: uid(), name: "Junior", type: "REGULAR" },
      { id: uid(), name: "Senior", type: "REGULAR" },
      { id: uid(), name: "General", type: "GENERAL" },
    ];
    evalData.members = [
      { id: uid(), name: "Anjali Menon", teamId: evalData.teams[0].id, categoryId: evalData.categories[0].id, code: "#11@101" },
      { id: uid(), name: "Raghav Krishnan", teamId: evalData.teams[1].id, categoryId: evalData.categories[0].id, code: "#22@202" },
      { id: uid(), name: "Meera Vasudev", teamId: evalData.teams[0].id, categoryId: evalData.categories[1].id, code: "#33@303" },
      { id: uid(), name: "Arjun Suresh", teamId: evalData.teams[1].id, categoryId: evalData.categories[1].id, code: "#44@404" },
    ];
    evalData.programs = [
      {
        id: uid(),
        name: "Classical Solo Vocal",
        desc: "Individual classical vocal performance",
        categoryId: evalData.categories[0].id,
        maxPerTeam: 2,
        marks: { first: 0, second: 0, third: 0 },
        venue: "STAGE",
        kind: "INDIVIDUAL",
        groupSize: 1,
        entries: [
          { id: uid(), memberIds: [evalData.members[0].id], teamId: evalData.teams[0].id, color: "#2fbf9f" },
          { id: uid(), memberIds: [evalData.members[1].id], teamId: evalData.teams[1].id, color: "#ffc53d" },
        ],
      },
      {
        id: uid(),
        name: "Folk Dance (Group)",
        desc: "Traditional group dance presentation",
        categoryId: evalData.categories[2].id,
        maxPerTeam: 1,
        marks: { first: 0, second: 0, third: 0 },
        venue: "STAGE",
        kind: "GROUP",
        groupSize: 4,
        entries: [],
      },
    ];

    const mainAdminUser = { name: "MAIN" + (Math.floor(Math.random() * 900) + 100), password: randPass() };
    const evalCreatedAt = Date.now();
    const newEvalFest: Fest = {
      id: evalFestId,
      name: evalFestName,
      mainUsers: [mainAdminUser],
      data: evalData,
      isEvaluation: true,
      createdAt: evalCreatedAt,
      code: ensureUniqueFestCode(db, evalFestName, evalCreatedAt),
    };

    log(evalData, mainAdminUser.name, "Created and entered evaluation mode");

    updateDb((d) => {
      d.fests.push(newEvalFest);
    });

    login({
      festId: evalFestId,
      name: mainAdminUser.name,
      role: "MAIN",
      isEvaluation: true,
    });
  };

  const goLanding = () => {
    setJoinFestId(null);
    setRoute("landing");
  };

  return (
    <div className="min-h-full relative overflow-hidden">
      {route !== "landing" && <Ambient />}
      {route === "landing" && (
        <LandingPage
          onUnlock={() => setRoute("adminLogin")}
          onExplore={handleExplorePlatform}
          onHaveFest={() => setRoute("joinByCode")}
        />
      )}
      {route === "adminLogin" && <AdminLogin go={setRoute} onHome={goLanding} />}
      {route === "adminPanel" && (
        <AdminPanel go={setRoute} onHome={goLanding} onOpenFestLogin={openFestLogin} />
      )}
      {route === "joinByCode" && (
        <JoinByCode go={setRoute} onHome={goLanding} onFestId={openFestLogin} />
      )}
      {route === "userLogin" && (
        <UserLogin go={setRoute} onHome={goLanding} festId={joinFestId} onJoinByCode={() => setRoute("joinByCode")} />
      )}
    </div>
  );
}

/**
 * Ambient backdrop: slow aurora blobs drifting behind a soft film grain,
 * with a warm spotlight that glides after the cursor. No pointer physics —
 * everything is CSS-driven except the spotlight position.
 */
function Ambient() {
  const blobs = useMemo(() => [
    { w: 640, h: 520, left: "-12%", top: "-18%", color: "var(--acc)", dur: "26s", dx1: "80px", dy1: "60px", dx2: "-40px", dy2: "120px", dx3: "50px", dy3: "20px" },
    { w: 560, h: 560, left: "62%", top: "-14%", color: "var(--marigold)", dur: "31s", dx1: "-90px", dy1: "70px", dx2: "60px", dy2: "-30px", dx3: "-30px", dy3: "80px" },
    { w: 520, h: 460, left: "55%", top: "58%", color: "var(--coral)", dur: "28s", dx1: "-70px", dy1: "-60px", dx2: "50px", dy2: "40px", dx3: "-20px", dy3: "-90px" },
    { w: 480, h: 480, left: "-8%", top: "62%", color: "var(--sky)", dur: "35s", dx1: "60px", dy1: "-80px", dx2: "-30px", dy2: "-20px", dx3: "90px", dy3: "40px" },
    { w: 380, h: 380, left: "35%", top: "35%", color: "var(--plum)", dur: "24s", dx1: "-50px", dy1: "50px", dx2: "70px", dy2: "-60px", dx3: "-40px", dy3: "-30px" },
  ], []);

  const spotRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = spotRef.current;
    if (!el) return;
    // ease the spotlight toward the pointer so it feels like a real light rig, not a cursor
    let tx = window.innerWidth / 2, ty = window.innerHeight * 0.4;
    let cx = tx, cy = ty;
    let raf = 0;
    const onMove = (e: PointerEvent) => { tx = e.clientX; ty = e.clientY; };
    const onLeave = () => { tx = window.innerWidth / 2; ty = window.innerHeight * 0.4; };
    const step = () => {
      cx += (tx - cx) * 0.07;
      cy += (ty - cy) * 0.07;
      el.style.setProperty("--mx", `${cx}px`);
      el.style.setProperty("--my", `${cy}px`);
      raf = requestAnimationFrame(step);
    };
    window.addEventListener("pointermove", onMove);
    document.addEventListener("pointerleave", onLeave);
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("pointermove", onMove); document.removeEventListener("pointerleave", onLeave); };
  }, []);

  return (
    <>
      <div className="absolute inset-0 pointer-events-none" style={{ background: "var(--bg)" }} />
      {blobs.map((b, i) => (
        <span
          key={i}
          className="aurora-blob"
          style={{
            width: b.w, height: b.h, left: b.left, top: b.top,
            background: b.color, opacity: 0.22,
            ["--dur" as string]: b.dur,
            ["--dx1" as string]: b.dx1, ["--dy1" as string]: b.dy1,
            ["--dx2" as string]: b.dx2, ["--dy2" as string]: b.dy2,
            ["--dx3" as string]: b.dx3, ["--dy3" as string]: b.dy3,
            animationDelay: `${-i * 6}s`,
          }}
        />
      ))}
      <div ref={spotRef} className="spotlight" />
      <div className="grain" />
    </>
  );
}

function ThemeMini() {
  const { theme, setTheme } = useStore();
  return <ThemePicker theme={theme} setTheme={setTheme} />;
}

function BackBtn({ onClick, title = "Back" }: { onClick: () => void; title?: string }) {
  return (
    <button className="icobtn card2 anim-in" style={{ width: 40, height: 40 }} onClick={onClick} title={title}>
      <Icon n="back" s={19} />
    </button>
  );
}

/* ---------------- admin login (screen 2 — reached via the 5-click logo) ---------------- */
function AdminLogin({ go, onHome }: { go: (r: HR) => void; onHome: () => void }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  const toast = useToast();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pw === "ADMIN999") { toast("Admin unlocked", "ok"); go("adminPanel"); }
    else { setErr(true); setTimeout(() => setErr(false), 450); toast("Wrong admin password", "err"); }
  };
  return (
    <div className="relative z-10 min-h-screen flex flex-col">
      <div className="p-5 flex items-center justify-between">
        <BackBtn onClick={onHome} title="Back to overview" />
        <ThemeMini />
      </div>
      <div className="flex-1 flex items-center justify-center px-5 pb-16">
        <form onSubmit={submit} className={`card p-7 w-full max-w-[380px] anim-in ${err ? "shake" : ""}`}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: "var(--marigold-soft)", color: "var(--marigold)" }}>
            <Icon n="lock" s={22} />
          </div>
          <h2 className="font-d text-[19px] font-extrabold">Admin Access</h2>
          <p className="text-[13px] font-semibold mt-1 mb-5" style={{ color: "var(--mut)" }}>Restricted control desk. Enter the admin password to manage fests and share fest codes.</p>
          <Field label="Password">
            <EyeInput value={pw} onChange={setPw} placeholder="Admin password" autoFocus />
          </Field>
          <Btn type="submit" className="w-full" size="big">Confirm</Btn>
        </form>
      </div>
    </div>
  );
}

/* ---------------- admin panel ---------------- */
function AdminPanel({ onHome, onOpenFestLogin }: { go: (r: HR) => void; onHome: () => void; onOpenFestLogin: (festId: string) => void }) {
  const { db, updateDb, cloudReady, fetchAllFests, fetchDeletedFestIds } = useStore();
  const toast = useToast();
  const ask = useAsk();
  const [add, setAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [count, setCount] = useState(2);
  const [delId, setDelId] = useState<string | null>(null);
  const [delText, setDelText] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const syncingRef = useRef(false);

  /** Pull every fest from every cloud so the admin sees added fests on any device. */
  const syncAllFests = useCallback(async (silent = false) => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      // 1) Firebase (when configured): full pull + tombstone prune
      let remote: Fest[] = [];
      let removed: string[] = [];
      if (cloudReady) {
        try {
          remote = await fetchAllFests();
        } catch {
          remote = [];
        }
        try {
          removed = await fetchDeletedFestIds();
        } catch {
          removed = [];
        }
      }
      // 2) Zero-config shared cloud: pull-all (works on every device, no setup)
      let sharedRemoved: string[] = [];
      try {
        const known = new Map<string, string>();
        for (const f of db.fests) {
          try {
            known.set(f.id, sharedFestHash(JSON.stringify(f)));
          } catch {
            /* ignore */
          }
        }
        const pulled = await pullSharedFests(known);
        sharedRemoved = pulled.removedIds;
        for (const f of pulled.fests) {
          if (!remote.some((x) => x.id === f.id)) remote.push(f);
        }
      } catch {
        /* offline — keep local */
      }
      const removedSet = new Set([...removed, ...sharedRemoved]);
      let added = 0;
      let updated = 0;
      let pruned = 0;
      updateDb((d) => {
        for (const f of remote) {
          if (removedSet.has(f.id)) continue;
          const idx = d.fests.findIndex((x) => x.id === f.id);
          if (idx < 0) {
            d.fests.push(f);
            added++;
          } else if (JSON.stringify(d.fests[idx]) !== JSON.stringify(f)) {
            d.fests[idx] = f;
            updated++;
          }
        }
        if (removedSet.size > 0) {
          const before = d.fests.length;
          d.fests = d.fests.filter((x) => !removedSet.has(x.id));
          pruned = before - d.fests.length;
        }
      });
      const stamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setLastSync(stamp);
      if (!silent) {
        if (added || updated || pruned) {
          const parts: string[] = [];
          if (added) parts.push(`${added} new`);
          if (updated) parts.push(`${updated} updated`);
          if (pruned) parts.push(`${pruned} removed`);
          setSyncNote(parts.join(" · "));
          toast(`Synced from cloud — ${parts.join(", ")}`, "ok");
        } else {
          setSyncNote(remote.length ? "up to date" : "no fests in cloud yet");
          toast("Already up to date", "ok");
        }
      } else if (added || updated || pruned) {
        const parts: string[] = [];
        if (added) parts.push(`${added} new`);
        if (updated) parts.push(`${updated} updated`);
        if (pruned) parts.push(`${pruned} removed`);
        setSyncNote(parts.join(" · "));
        toast(`Synced from cloud — ${parts.join(", ")}`, "ok");
      }
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [cloudReady, fetchAllFests, fetchDeletedFestIds, updateDb, toast]); // eslint-disable-line react-hooks/exhaustive-deps

  // auto-sync once every time the admin desk opens (any time, any device)
  useEffect(() => {
    void syncAllFests(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAdd = () => { setName(""); setCount(2); setAdd(true); };
  const openEdit = (f: Fest) => { setEditId(f.id); setName(f.name); setCount(f.mainUsers.length); };

  const createFest = () => {
    const nm = name.trim();
    if (!nm) { toast("Give the fest a name", "err"); return; }
    if (db.fests.some((f) => f.name.toLowerCase() === nm.toLowerCase())) { toast("A fest with that name exists", "err"); return; }
    const n = Math.min(10, Math.max(1, count || 1));
    const createdAt = Date.now();
    const code = ensureUniqueFestCode(db, nm, createdAt);
    updateDb((d) => {
      const f: Fest = { id: uid(), name: nm, mainUsers: [], data: newFestData(), code, createdAt };
      for (let i = 0; i < n; i++) f.mainUsers.push({ name: randMainName(f), password: randPass() });
      log(f.data, "ADMIN", `Fest "${nm}" created with ${n} main user${n > 1 ? "s" : ""}`);
      d.fests.push(f);
    });
    setAdd(false);
    toast(`Fest "${nm}" created — code ${code}`, "ok");
  };
  const saveEdit = () => {
    const nm = name.trim();
    if (!nm) { toast("Name cannot be empty", "err"); return; }
    updateDb((d) => {
      const f = d.fests.find((x) => x.id === editId);
      if (!f) return;
      f.name = nm;
      const n = Math.min(10, Math.max(1, count || 1));
      while (f.mainUsers.length < n) f.mainUsers.push({ name: randMainName(f), password: randPass() });
      f.mainUsers = f.mainUsers.slice(0, n);
      log(f.data, "ADMIN", `Fest updated → "${nm}"`);
    });
    setEditId(null);
    toast("Fest updated", "ok");
  };
  // Deleting a fest is the only way its data ever disappears, and only the admin can do it.
  // The exact name must be typed to be sure it is never an accident.
  const delFest = db.fests.find((x) => x.id === delId) || null;
  const confirmDelete = () => {
    const f = db.fests.find((x) => x.id === delId);
    if (!f) return;
    if (delText.trim().toLowerCase() !== f.name.toLowerCase()) { toast("Type the fest name exactly to delete it", "err"); return; }
    updateDb((d) => { d.fests = d.fests.filter((x) => x.id !== f.id); });
    setDelId(null); setDelText("");
    toast(`Fest "${f.name}" deleted`, "ok");
  };
  const leave = async () => {
    const ok = await ask({ title: "Leave the admin desk?", body: "You will return to the main home page.", yes: "Leave" });
    if (ok) onHome();
  };

  const copyFestCode = async (f: Fest) => {
    const code = f.code || "";
    if (!code) { toast("This fest has no code yet", "err"); return; }
    try {
      await navigator.clipboard.writeText(code);
      toast("Fest code copied — share it to join this fest from any device", "ok");
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = code;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        toast("Fest code copied — share it to join this fest from any device", "ok");
      } catch {
        toast("Copy failed — long-press the code to copy it manually", "err");
      }
    }
  };

  const regenerateFestCode = async (f: Fest) => {
    const ok = await ask({ title: `New code for "${f.name}"?`, body: "The old code will stop working. Share the new code with everyone who joins this fest.", yes: "Generate" });
    if (!ok) return;
    const createdAt = f.createdAt || Date.now();
    const code = ensureUniqueFestCode(db, f.name, createdAt);
    updateDb((d) => {
      const target = d.fests.find((x) => x.id === f.id);
      if (!target) return;
      target.code = code;
      target.createdAt = target.createdAt || createdAt;
      log(target.data, "ADMIN", `Fest code regenerated → ${code}`);
    });
    toast(`New fest code: ${code}`, "ok");
  };

  return (
    <div className="relative z-10 min-h-screen flex flex-col">
      <div className="flex items-center justify-between p-5 gap-3">
        <BackBtn onClick={leave} title="Back to home" />
        <div className="font-d text-[15px] font-extrabold flex items-center gap-2">
          <span style={{ color: "var(--marigold)" }}><Icon n="sparkle" s={16} /></span> Fest Console
        </div>
        <span className="chip" title={cloudReady ? "Every fest is synced to the cloud in real time" : "Fests sync across devices automatically — no setup needed"} style={{ borderColor: "var(--acc)", color: "var(--acc)" }}><Icon n="globe" s={12} /> {syncing ? "Syncing…" : lastSync ? `Synced ${lastSync}${syncNote ? ` · ${syncNote}` : ""}` : "Sync on"}</span>
        <Btn kind="soft" size="sm" onClick={() => void syncAllFests(false)} title="Pull every fest from the cloud now"><Icon n="download" s={14} /> Sync</Btn>
        <Btn kind="gold" onClick={openAdd}><Icon n="plus" s={16} sw={2.4} /> Add Fest</Btn>
      </div>
      <div className="flex-1 px-5 pb-10 max-w-[720px] w-full mx-auto">
        {db.fests.length === 0 && (
          <div className="card2 text-center py-16 px-6 anim-in">
            <div className="font-d text-[17px] font-extrabold mb-2">{syncing ? "Syncing your fests…" : "No fests yet"}</div>
            <p className="text-[13.5px] font-semibold max-w-[380px] mx-auto" style={{ color: "var(--mut)" }}>
              {syncing
                ? "Pulling every fest from the cloud so this device shows the same list."
                : "Create your first fest. Festize will generate main users with secret passwords you can hand out to organizers — and it will appear here on any device you log in from."}
            </p>
          </div>
        )}
        {db.fests.length > 0 && (
          <div className="card2 px-4 py-3 mb-4 flex items-start gap-2.5 anim-in">
            <span style={{ color: "var(--acc)" }}><Icon n="info" s={15} /></span>
            <p className="text-[12.5px] font-semibold" style={{ color: "var(--mut)" }}>
              Every fest and everything inside it is kept permanently. Nothing expires and no other user — not even a main
              user — can remove a fest. Deleting one here is the only way it ever goes away. Added fests appear here
              automatically whenever you log in as admin — on any device.
            </p>
          </div>
        )}
        <div className="grid gap-4">
          {db.fests.map((f, i) => (
            <div key={f.id} className="card p-5 anim-in" style={{ animationDelay: i * 60 + "ms" }}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="font-d text-[18px] font-extrabold">{f.name}</div>
                  <div className="text-[12px] font-bold mt-1" style={{ color: "var(--mut)" }}>
                    {f.mainUsers.length} main user{f.mainUsers.length > 1 ? "s" : ""} · {f.data.teams.length} teams · {f.data.members.length} members · {f.data.programs.length} programs
                  </div>
                </div>
                <div className="flex gap-1">
                  <IconBtn n="edit" title="Edit fest" onClick={() => openEdit(f)} />
                  <IconBtn n="trash" title="Delete fest (admin only)" danger onClick={() => { setDelId(f.id); setDelText(""); }} />
                </div>
              </div>
              <div className="divider my-4" />
              <div className="grid gap-2.5 sm:grid-cols-2">
                {f.mainUsers.map((u: MainUser) => (
                  <div key={u.name} className="card2 px-3.5 py-2.5 flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[10px] font-extrabold uppercase tracking-[0.14em]" style={{ color: "var(--mut)" }}>Main user</div>
                      <div className="mono text-[14px] font-extrabold" style={{ color: "var(--acc)" }}>{u.name}</div>
                    </div>
                    <Dots secret={u.password} />
                  </div>
                ))}
              </div>
              <div className="divider my-4" />
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] mb-1.5" style={{ color: "var(--mut)" }}>
                  Fest code — share it so anyone can join this fest's login on any device
                </div>
                <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                  <input
                    className="input mono flex-1 min-w-0 text-center font-extrabold tracking-[0.12em]"
                    readOnly
                    value={f.code || "—"}
                    onFocus={(e) => e.target.select()}
                    aria-label={`Fest code for ${f.name}`}
                  />
                  <div className="flex gap-2 shrink-0">
                    <Btn kind="soft" onClick={() => copyFestCode(f)}>
                      <Icon n="copy" s={15} /> Copy
                    </Btn>
                    <Btn kind="soft" onClick={() => regenerateFestCode(f)} title="Generate a new random code">
                      <Icon n="shuffle" s={15} /> New code
                    </Btn>
                    <Btn kind="gold" onClick={() => onOpenFestLogin(f.id)}>
                      <Icon n="play" s={15} /> Open login
                    </Btn>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal open={add} onClose={() => setAdd(false)} title="New Fest" footer={
        <><Btn kind="soft" onClick={() => setAdd(false)}>Cancel</Btn><Btn onClick={createFest}>Confirm</Btn></>
      }>
        <Field label="Name of the fest">
          <input className="input" value={name} autoFocus placeholder="e.g. Rivertown Arts Fest" onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createFest()} />
        </Field>
        <Field label="How many main users?" hint="Each main user gets a name like MAIN427 and a random password.">
          <input className="input" type="number" min={1} max={10} value={count} onChange={(e) => setCount(parseInt(e.target.value) || 1)} />
        </Field>
      </Modal>
      <Modal open={!!editId} onClose={() => setEditId(null)} title="Edit Fest" footer={
        <><Btn kind="soft" onClick={() => setEditId(null)}>Cancel</Btn><Btn onClick={saveEdit}>Confirm</Btn></>
      }>
        <Field label="Name of the fest">
          <input className="input" value={name} autoFocus onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveEdit()} />
        </Field>
        <Field label="Main user count" hint="Increasing the count adds new main users. Decreasing removes the last ones.">
          <input className="input" type="number" min={1} max={10} value={count} onChange={(e) => setCount(parseInt(e.target.value) || 1)} />
        </Field>
      </Modal>
      <Modal open={!!delId} onClose={() => setDelId(null)} title="Delete this fest?" footer={
        <><Btn kind="soft" onClick={() => setDelId(null)}>Cancel</Btn><Btn kind="danger" onClick={confirmDelete}>Delete forever</Btn></>
      }>
        <p className="text-[13px] font-semibold mb-3" style={{ color: "var(--mut)" }}>
          Everything inside <b style={{ color: "var(--ink)" }}>{delFest?.name}</b> — teams, members, programs, code letters,
          marks, results, posters and the timetable — is stored permanently and is only ever removed here, by you.
          There is no way to bring it back.
        </p>
        <Field label={`Type "${delFest?.name || ""}" to confirm`}>
          <input className="input" value={delText} autoFocus placeholder={delFest?.name}
            onChange={(e) => setDelText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && confirmDelete()} />
        </Field>
      </Modal>
    </div>
  );
}

/* ---------------- join by fest code (from the landing "have a fest?" button) ----------------
   One text bar + confirm. A correct code opens that fest's login on any device. */
function JoinByCode({ onHome, onFestId }: { go: (r: HR) => void; onHome: () => void; onFestId: (festId: string) => void }) {
  const { db, updateDb, cloudReady, fetchFestByCode } = useStore();
  const toast = useToast();
  const [code, setCode] = useState("");
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);

  const fail = (msg: string) => { setErr(true); setTimeout(() => setErr(false), 450); toast(msg, "err"); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const normalized = normalizeFestCode(code);
    if (!normalized) { fail("Type your fest code"); return; }
    setBusy(true);
    try {
      const local = db.fests.find((x) => x.code && normalizeFestCode(x.code) === normalized);
      if (local) {
        toast(`Fest found: ${local.name}`, "ok");
        onFestId(local.id);
        return;
      }
      if (cloudReady) {
        const remote = await fetchFestByCode(normalized);
        if (remote) {
          updateDb((d) => {
            if (!d.fests.some((x) => x.id === remote.id)) d.fests.push(remote);
          });
          toast(`Fest found: ${remote.name}`, "ok");
          onFestId(remote.id);
          return;
        }
      }
      // zero-config shared cloud fallback — works on every device with internet
      const shared = await fetchSharedFestByCode(normalized);
      if (shared) {
        updateDb((d) => {
          if (!d.fests.some((x) => x.id === shared.id)) d.fests.push(shared);
        });
        toast(`Fest found: ${shared.name}`, "ok");
        onFestId(shared.id);
        return;
      }
      fail("Wrong fest code — check the code and try again");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative z-10 min-h-screen flex flex-col">
      <div className="p-5 flex items-center justify-between">
        <BackBtn onClick={onHome} title="Back to home" />
        <ThemeMini />
      </div>
      <div className="flex-1 flex items-center justify-center px-5 pb-16">
        <form onSubmit={submit} className={`card p-7 w-full max-w-[400px] anim-in ${err ? "shake" : ""}`}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: "var(--marigold-soft)", color: "var(--marigold)" }}>
            <Icon n="key" s={20} />
          </div>
          <h2 className="font-d text-[19px] font-extrabold">Have a fest?</h2>
          <p className="text-[13px] font-semibold mt-1 mb-5" style={{ color: "var(--mut)" }}>
            Type the fest code your admin shared. The same code opens the fest login on any device.
          </p>
          <Field label="Fest code">
            <input
              className="input mono text-center font-extrabold tracking-[0.14em]"
              value={code}
              autoFocus
              placeholder="e.g. RIVE-20260513-K7Q2"
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
          </Field>
          <Btn type="submit" className="w-full" size="big" disabled={busy}>Confirm</Btn>
          <p className="text-[12px] font-semibold mt-3 text-center" style={{ color: "var(--mut)" }}>
            Fest codes work on any device with an internet connection — no setup needed.
          </p>
        </form>
      </div>
    </div>
  );
}

/* ---------------- fest login (opened after a correct fest code) ----------------
   No fest-name typing: the fest is already known from its code. */
function UserLogin({ onHome, festId, onJoinByCode }: { go: (r: HR) => void; onHome: () => void; festId: string | null; onJoinByCode: () => void }) {
  const { db, login, updateFest } = useStore();
  const toast = useToast();
  const [user, setUser] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);

  const fest = festId ? db.fests.find((x) => x.id === festId) || null : null;

  const tryCredentials = (f: import("../lib/store").Fest, un: string) => {
    const mu = f.mainUsers.find((u) => u.name.toLowerCase() === un.toLowerCase());
    if (mu && mu.password === pw) {
      updateFest(f.id, (d) => log(d, mu.name, "Logged in"));
      login({ festId: f.id, name: mu.name, role: "MAIN" });
      return true;
    }
    const au = f.data.accessUsers.find((u) => u.name.toLowerCase() === un.toLowerCase());
    if (au && au.password === pw) {
      updateFest(f.id, (d) => log(d, au.name, `Logged in (${au.role})`));
      login({ festId: f.id, name: au.name, role: au.role, teamId: au.teamId });
      return true;
    }
    const mem = f.data.members.find((m) => m.name.toLowerCase() === un.toLowerCase());
    if (mem && mem.code === pw) {
      updateFest(f.id, (d) => log(d, mem.name, "Logged in (member)"));
      login({ festId: f.id, name: mem.name, role: "MEMBER", memberId: mem.id, teamId: mem.teamId });
      return true;
    }
    return false;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !fest) return;
    setBusy(true);
    try {
      const un = user.trim();
      if (!un || !pw) { fail("Fill in username and password"); return; }
      if (!tryCredentials(fest, un)) fail("Wrong username or password for this fest");
    } finally {
      setBusy(false);
    }
  };
  const fail = (msg: string) => { setErr(true); setTimeout(() => setErr(false), 450); toast(msg, "err"); };
  const ask = useAsk();
  const askLeave = () => ask({ title: "Return to the home page?", body: "Your login details on this screen will be cleared.", yes: "Go home" });
  const leave = async () => {
    const ok = await askLeave();
    if (ok) onHome();
  };

  return (
    <div className="relative z-10 min-h-screen flex flex-col">
      <div className="p-5 flex items-center justify-between">
        <BackBtn onClick={onJoinByCode} title="Back to fest code" />
        <ThemeMini />
      </div>
      <div className="flex-1 flex items-center justify-center px-5 pb-16">
        {!fest ? (
          <div className="card p-7 w-full max-w-[400px] anim-in text-center">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 mx-auto" style={{ background: "var(--marigold-soft)", color: "var(--marigold)" }}>
              <Icon n="key" s={20} />
            </div>
            <h2 className="font-d text-[19px] font-extrabold">No fest selected</h2>
            <p className="text-[13px] font-semibold mt-1 mb-5" style={{ color: "var(--mut)" }}>
              Enter your fest code first to open its login.
            </p>
            <Btn className="w-full" size="big" onClick={onJoinByCode}>Enter fest code</Btn>
          </div>
        ) : (
          <form onSubmit={submit} className={`card p-7 w-full max-w-[400px] anim-in ${err ? "shake" : ""}`}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: "var(--acc-soft)", color: "var(--acc)" }}>
              <Icon n="play" s={20} />
            </div>
            <div className="chip mb-3" title="This fest was opened with its fest code">
              <Icon n="check" s={12} /> Fest code verified
            </div>
            <h2 className="font-d text-[19px] font-extrabold">{fest.name}</h2>
            <p className="text-[13px] font-semibold mt-1 mb-5" style={{ color: "var(--mut)" }}>
              Main users, crew roles and members all sign in here — just your username and password.
            </p>
            <Field label="Username">
              <input className="input" value={user} autoFocus placeholder="MAIN427 or your name" onChange={(e) => setUser(e.target.value)} />
            </Field>
            <Field label="Password">
              <EyeInput value={pw} onChange={setPw} placeholder="Password or member code" />
            </Field>
            <Btn type="submit" className="w-full" size="big" disabled={busy}>Confirm</Btn>
            <button
              type="button"
              className="w-full text-center text-[12px] font-bold mt-3 underline underline-offset-2"
              style={{ color: "var(--mut)" }}
              onClick={leave}
            >
              Joined the wrong fest? Go back and enter a different code
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
