import React, { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useStore, uid, randPass, randCode, log, memberCountOfTeam, pointLabel, gradeFor, EVALUATION_LIMITS, checkLimit } from "../lib/store";
import type { Team, Category, Member, AccessUser, Grade, GradeScale, Role } from "../lib/store";
import { Icon, Btn, IconBtn, Field, Select, Modal, Dots, Tag, Empty, SearchInput, PageHead, useToast, useAsk, useKeyNav } from "../lib/ui";
import { fileToDataURL, useDrag } from "../lib/editor";
import type { Route } from "./Shell";

type P = { push: (r: Route) => void; params?: Record<string, string> };
const CREW_ROLES: Role[] = ["JUDGE", "MEDIA", "TEAM MANAGER", "MONITOR", "STAGE MANAGER"];

function RowActs({ onView, onEdit, onDel, canEdit = true }: { onView: () => void; onEdit: () => void; onDel: () => void; canEdit?: boolean }) {
  return (
    <span className="flex gap-0.5 justify-end">
      <IconBtn n="eye" s={15} title="View details" onClick={onView} />
      {canEdit && <IconBtn n="edit" s={15} title="Edit" onClick={onEdit} />}
      {canEdit && <IconBtn n="trash" s={15} title="Delete" danger onClick={onDel} />}
    </span>
  );
}
function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5" style={{ borderBottom: "1px solid var(--line)" }}>
      <span className="text-[11px] font-extrabold uppercase tracking-[0.13em]" style={{ color: "var(--mut)" }}>{k}</span>
      <span className="text-[13.5px] font-bold text-right">{v}</span>
    </div>
  );
}

/* ================= TEAMS ================= */
export function TeamsSection(_: P) {
  const { data, fest, session, updateFest } = useStore();
  const toast = useToast(); const ask = useAsk();
  const [q, setQ] = useState(""); const [modal, setModal] = useState<null | { edit?: Team }>(null);
  const [view, setView] = useState<Team | null>(null);
  const [name, setName] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  useKeyNav(() => searchRef.current?.focus());
  if (!data || !fest || !session) return null;
  const isMain = session.role === "MAIN";
  const teams = data.teams.filter((t) => t.name.toLowerCase().includes(q.toLowerCase()));

  const openAdd = () => { setName(""); setModal({}); };
  const openEdit = (t: Team) => { setName(t.name); setModal({ edit: t }); };
  const save = () => {
    const nm = name.trim();
    if (!nm) { toast("Team name is empty", "err"); return; }
    if (!modal?.edit) {
      const err = checkLimit(fest.isEvaluation, data.teams.length, EVALUATION_LIMITS.teams, "teams");
      if (err) { toast(err, "err"); return; }
    }
    updateFest(fest.id, (d) => {
      if (modal?.edit) {
        const t = d.teams.find((x) => x.id === modal.edit!.id);
        if (t) t.name = nm;
        log(d, session.name, `Team renamed → "${nm}"`);
      } else {
        d.teams.push({ id: uid(), name: nm });
        log(d, session.name, `Team "${nm}" added`);
      }
    });
    toast(modal?.edit ? "Team updated" : "Team added", "ok");
    setModal(null);
  };
  const del = async (t: Team) => {
    const n = memberCountOfTeam(data, t.id);
    const ok = await ask({ title: `Delete team "${t.name}"?`, body: n > 0 ? `${n} member(s) belong to this team — they will lose their team.` : "This cannot be undone.", yes: "Delete", danger: true });
    if (!ok) return;
    updateFest(fest.id, (d) => { d.teams = d.teams.filter((x) => x.id !== t.id); log(d, session.name, `Team "${t.name}" deleted`); });
    toast("Team deleted", "ok");
  };

  return (
    <div>
      <PageHead title="Teams" sub="The crews competing in this fest.">
        <SearchInput value={q} onChange={setQ} inputRef={searchRef} placeholder="Search teams…  ( / )" />
        {isMain && <Btn onClick={openAdd}><Icon n="plus" s={16} sw={2.4} /> Add Team</Btn>}
      </PageHead>
      {teams.length === 0 ? <Empty icon="flag" title={q ? "No match" : "No teams yet"} body={q ? "Try a different search." : "Hit Add Team to create your first crew."} /> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {teams.map((t, i) => (
            <div key={t.id} className="card hoverable p-4 anim-in" style={{ animationDelay: i * 40 + "ms" }}>
              <div className="flex items-start justify-between gap-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center font-d font-extrabold text-[15px]" style={{ background: "var(--coral-soft)", color: "var(--coral)" }}>
                  {t.name.slice(0, 1).toUpperCase()}
                </div>
                <RowActs canEdit={isMain} onView={() => setView(t)} onEdit={() => openEdit(t)} onDel={() => del(t)} />
              </div>
              <div className="font-d text-[15px] font-extrabold mt-3">{t.name}</div>
              <div className="text-[12px] font-bold mt-1" style={{ color: "var(--mut)" }}>{memberCountOfTeam(data, t.id)} members</div>
            </div>
          ))}
        </div>
      )}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.edit ? "Edit Team" : "New Team"} footer={
        <><Btn kind="soft" onClick={() => setModal(null)}>Cancel</Btn><Btn onClick={save}>Confirm</Btn></>
      }>
        <Field label="Team name">
          <input className="input" value={name} autoFocus placeholder="e.g. House of Ember" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} />
        </Field>
      </Modal>
      <Modal open={!!view} onClose={() => setView(null)} title={view?.name || ""}>
        {view && (
          <div>
            <KV k="Team" v={view.name} />
            <KV k="Members" v={memberCountOfTeam(data, view.id)} />
            <div className="mt-3 grid gap-1.5">
              {data.members.filter((m) => m.teamId === view.id).map((m) => (
                <div key={m.id} className="card2 px-3 py-2 flex items-center justify-between">
                  <span className="font-bold text-[13px]">{m.name}</span>
                  <span className="mono text-[12px]" style={{ color: "var(--mut)" }}>{m.code}</span>
                </div>
              ))}
              {data.members.filter((m) => m.teamId === view.id).length === 0 && <div className="text-[12.5px] font-semibold text-center py-3" style={{ color: "var(--mut)" }}>No members in this team yet.</div>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ================= CATEGORIES ================= */
export function CategoriesSection(_: P) {
  const { data, fest, session, updateFest } = useStore();
  const toast = useToast(); const ask = useAsk();
  const [q, setQ] = useState(""); const [modal, setModal] = useState<null | { edit?: Category }>(null);
  const [view, setView] = useState<Category | null>(null);
  const [name, setName] = useState(""); const [type, setType] = useState<"REGULAR" | "GENERAL">("REGULAR");
  const searchRef = useRef<HTMLInputElement>(null);
  useKeyNav(() => searchRef.current?.focus());
  if (!data || !fest || !session) return null;
  const isMain = session.role === "MAIN";
  const cats = data.categories.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));

  const openAdd = () => { setName(""); setType("REGULAR"); setModal({}); };
  const openEdit = (c: Category) => { setName(c.name); setType(c.type); setModal({ edit: c }); };
  const save = () => {
    const nm = name.trim();
    if (!nm) { toast("Category name is empty", "err"); return; }
    if (!modal?.edit) {
      const err = checkLimit(fest.isEvaluation, data.categories.length, EVALUATION_LIMITS.categories, "categories");
      if (err) { toast(err, "err"); return; }
    }
    updateFest(fest.id, (d) => {
      if (modal?.edit) {
        const c = d.categories.find((x) => x.id === modal.edit!.id);
        if (c) { c.name = nm; c.type = type; }
        log(d, session.name, `Category updated → "${nm}"`);
      } else {
        d.categories.push({ id: uid(), name: nm, type });
        log(d, session.name, `Category "${nm}" (${type}) added`);
      }
    });
    toast(modal?.edit ? "Category updated" : "Category added", "ok");
    setModal(null);
  };
  const del = async (c: Category) => {
    const ok = await ask({ title: `Delete category "${c.name}"?`, body: "Programs and members using it will show '—' until reassigned.", yes: "Delete", danger: true });
    if (!ok) return;
    updateFest(fest.id, (d) => { d.categories = d.categories.filter((x) => x.id !== c.id); log(d, session.name, `Category "${c.name}" deleted`); });
    toast("Category deleted", "ok");
  };

  return (
    <div>
      <PageHead title="Categories" sub="GENERAL categories accept members from any category inside programs.">
        <SearchInput value={q} onChange={setQ} inputRef={searchRef} placeholder="Search categories…  ( / )" />
        {isMain && <Btn onClick={openAdd}><Icon n="plus" s={16} sw={2.4} /> Add Category</Btn>}
      </PageHead>
      {cats.length === 0 ? <Empty icon="tag" title="No categories yet" body="Create categories like 'CC' or 'General' to group members and programs." /> : (
        <div className="card overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Name</th><th>Type</th><th>Members</th><th>Programs</th><th className="text-right">Actions</th></tr></thead>
            <tbody>
              {cats.map((c) => (
                <tr key={c.id}>
                  <td className="font-extrabold">{c.name}</td>
                  <td><Tag color={c.type === "GENERAL" ? "var(--marigold)" : "var(--acc)"}>{c.type}</Tag></td>
                  <td className="font-bold">{data.members.filter((m) => m.categoryId === c.id).length}</td>
                  <td className="font-bold">{data.programs.filter((p) => p.categoryId === c.id).length}</td>
                  <td><RowActs canEdit={isMain} onView={() => setView(c)} onEdit={() => openEdit(c)} onDel={() => del(c)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.edit ? "Edit Category" : "New Category"} footer={
        <><Btn kind="soft" onClick={() => setModal(null)}>Cancel</Btn><Btn onClick={save}>Confirm</Btn></>
      }>
        <Field label="Category name">
          <input className="input" value={name} autoFocus placeholder="e.g. CC" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} />
        </Field>
        <Field label="Type" hint="REGULAR = only its own members join its programs. GENERAL = any member can join.">
          <Select value={type} onChange={(v) => setType(v as "REGULAR" | "GENERAL")} options={[{ v: "REGULAR", l: "Regular" }, { v: "GENERAL", l: "General" }]} />
        </Field>
      </Modal>
      <Modal open={!!view} onClose={() => setView(null)} title={view?.name || ""}>
        {view && (<>
          <KV k="Name" v={view.name} />
          <KV k="Type" v={<Tag color={view.type === "GENERAL" ? "var(--marigold)" : "var(--acc)"}>{view.type}</Tag>} />
          <KV k="Members" v={data.members.filter((m) => m.categoryId === view.id).length} />
          <KV k="Programs" v={data.programs.filter((p) => p.categoryId === view.id).length} />
        </>)}
      </Modal>
    </div>
  );
}

/* ================= PHOTO CROP ================= */
function CropModal({ src, onClose, onSave }: { src: string; onClose: () => void; onSave: (d: string) => void }) {
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [nat, setNat] = useState({ w: 1, h: 1 });
  const drag = useDrag((dx, dy) => setOff((o) => ({ x: o.x + dx, y: o.y + dy })));
  const SIZE = 210;
  const scale = Math.max(SIZE / nat.w, SIZE / nat.h) * zoom;
  const save = () => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d")!;
    const img = new Image();
    img.onload = () => {
      const s2 = Math.max(256 / img.width, 256 / img.height) * zoom;
      const k = 256 / SIZE;
      ctx.drawImage(img, (256 - img.width * s2) / 2 + off.x * k, (256 - img.height * s2) / 2 + off.y * k, img.width * s2, img.height * s2);
      onSave(c.toDataURL("image/jpeg", 0.85));
    };
    img.src = src;
  };
  return (
    <Modal open onClose={onClose} title="Adjust photo" footer={<><Btn kind="soft" onClick={onClose}>Cancel</Btn><Btn onClick={save}>Save photo</Btn></>}>
      <div className="flex flex-col items-center gap-4">
        <div className="rounded-full overflow-hidden relative select-none"
          style={{ width: SIZE, height: SIZE, background: "var(--panel3)", cursor: "grab", touchAction: "none" }}
          onPointerDown={drag}
          onWheel={(e) => {
            e.preventDefault();
            setZoom((z) => Math.max(1, Math.min(4, z - e.deltaY * 0.0025)));
          }}>
          <img src={src} alt="" draggable={false} onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            style={{ position: "absolute", width: nat.w * scale, height: nat.h * scale, left: (SIZE - nat.w * scale) / 2 + off.x, top: (SIZE - nat.h * scale) / 2 + off.y, pointerEvents: "none" }} />
        </div>
        <p className="text-[12px] font-bold text-center" style={{ color: "var(--mut)" }}>drag photo to position · scroll mouse wheel to zoom photo</p>
      </div>
    </Modal>
  );
}

/* ================= MEMBERS ================= */
interface MForm { name: string; teamId: string; categoryId: string; phone: string; place: string; photo: string; }
const emptyM: MForm = { name: "", teamId: "", categoryId: "", phone: "", place: "", photo: "" };

export function MembersSection(_: P) {
  const { data, fest, session, updateFest } = useStore();
  const toast = useToast(); const ask = useAsk();
  const [q, setQ] = useState(""); const [fTeam, setFTeam] = useState(""); const [fCat, setFCat] = useState("");
  const [modal, setModal] = useState<null | { edit?: Member }>(null);
  const [view, setView] = useState<Member | null>(null);
  const [form, setForm] = useState<MForm>(emptyM);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [bulkModal, setBulkModal] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkDefaultTeam, setBulkDefaultTeam] = useState("");
  const [bulkDefaultCat, setBulkDefaultCat] = useState("");
  const [parsedMembers, setParsedMembers] = useState<{ name: string; teamName: string; categoryName: string; phone: string; place: string }[]>([]);

  const fileRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  useKeyNav(() => searchRef.current?.focus());
  if (!data || !fest || !session) return null;
  const isMain = session.role === "MAIN";
  const isTM = session.role === "TEAM MANAGER";
  const canAdd = isMain || isTM;
  const scoped = isTM ? data.members.filter((m) => m.teamId === session.teamId) : data.members;
  const members = scoped.filter((m) =>
    m.name.toLowerCase().includes(q.toLowerCase()) &&
    (!fTeam || m.teamId === fTeam) && (!fCat || m.categoryId === fCat));
  const tName = (id: string) => data.teams.find((t) => t.id === id)?.name || "—";
  const cName = (id: string) => data.categories.find((c) => c.id === id)?.name || "—";

  const openAdd = () => { setForm(isTM ? { ...emptyM, teamId: session.teamId || "" } : emptyM); setModal({}); };
  const openEdit = (m: Member) => { setForm({ name: m.name, teamId: m.teamId, categoryId: m.categoryId, phone: m.phone || "", place: m.place || "", photo: m.photo || "" }); setModal({ edit: m }); };
  const save = () => {
    if (!form.name.trim()) { toast("Member name is empty", "err"); return; }
    if (!form.teamId) { toast("Pick a team", "err"); return; }
    if (!form.categoryId) { toast("Pick a category", "err"); return; }
    if (!modal?.edit) {
      const err = checkLimit(fest.isEvaluation, data.members.length, EVALUATION_LIMITS.members, "members");
      if (err) { toast(err, "err"); return; }
    }
    updateFest(fest.id, (d) => {
      if (modal?.edit) {
        const m = d.members.find((x) => x.id === modal.edit!.id);
        if (m) Object.assign(m, { name: form.name.trim(), teamId: form.teamId, categoryId: form.categoryId, phone: form.phone, place: form.place, photo: form.photo || undefined });
        log(d, session.name, `Member "${form.name}" updated`);
      } else {
        const code = randCode();
        d.members.push({ id: uid(), name: form.name.trim(), teamId: form.teamId, categoryId: form.categoryId, phone: form.phone, place: form.place, photo: form.photo || undefined, code });
        log(d, session.name, `Member "${form.name}" added (${code})`);
      }
    });
    toast(modal?.edit ? "Member updated" : "Member added — code is their password", "ok");
    setModal(null);
  };
  const del = async (m: Member) => {
    const ok = await ask({ title: `Delete member "${m.name}"?`, body: "They will be removed from every program entry too.", yes: "Delete", danger: true });
    if (!ok) return;
    updateFest(fest.id, (d) => {
      d.members = d.members.filter((x) => x.id !== m.id);
      for (const p of d.programs) {
        p.entries = p.entries.map((e) => ({ ...e, memberIds: e.memberIds.filter((id) => id !== m.id) })).filter((e) => e.memberIds.length > 0);
      }
      log(d, session.name, `Member "${m.name}" deleted`);
    });
    toast("Member deleted", "ok");
  };
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try { setCropSrc(await fileToDataURL(f)); } catch { toast("Could not read that image", "err"); }
  };

  // ---- Excel & Bulk Member Import ----
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const processRawRows = (rows: any[][]) => {
    if (!rows || rows.length === 0) return;
    let startIdx = 0;
    let nameCol = 0, teamCol = 1, catCol = 2, phoneCol = 3, placeCol = 4;

    if (rows.length > 0 && Array.isArray(rows[0])) {
      const header = rows[0].map((c) => String(c || "").toLowerCase().trim());
      const hasHeader = header.some((h) =>
        h.includes("name") || h.includes("member") || h.includes("team") || h.includes("category") || h.includes("phone")
      );
      if (hasHeader) {
        startIdx = 1;
        header.forEach((colStr, idx) => {
          if (colStr.includes("name") || colStr.includes("member") || colStr.includes("student") || colStr.includes("candidate")) nameCol = idx;
          else if (colStr.includes("team") || colStr.includes("house") || colStr.includes("group") || colStr.includes("club")) teamCol = idx;
          else if (colStr.includes("cat") || colStr.includes("class") || colStr.includes("division")) catCol = idx;
          else if (colStr.includes("phone") || colStr.includes("mobile") || colStr.includes("contact") || colStr.includes("tel")) phoneCol = idx;
          else if (colStr.includes("place") || colStr.includes("city") || colStr.includes("address") || colStr.includes("location")) placeCol = idx;
        });
      }
    }

    const items: { name: string; teamName: string; categoryName: string; phone: string; place: string }[] = [];
    for (let i = startIdx; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !Array.isArray(row)) continue;
      const name = String(row[nameCol] || "").trim();
      if (!name) continue;
      const teamName = String(row[teamCol] || "").trim();
      const categoryName = String(row[catCol] || "").trim();
      const phone = String(row[phoneCol] || "").trim();
      const place = String(row[placeCol] || "").trim();
      items.push({ name, teamName, categoryName, phone, place });
    }

    setParsedMembers(items);
    if (items.length > 0) {
      toast(`Parsed ${items.length} member record(s)`, "ok");
    } else {
      toast("No member records found in spreadsheet", "err");
    }
  };

  const handleExcelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const sheetName = wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
      processRawRows(rows);
      setBulkModal(true);
    } catch {
      toast("Could not parse Excel / CSV file", "err");
    }
  };

  const parsePastedText = () => {
    if (!bulkText.trim()) { toast("Paste some Excel rows or CSV lines first", "err"); return; }
    const lines = bulkText.split("\n");
    const rows = lines.map((l) => l.split(/[\t,;]/));
    processRawRows(rows);
  };

  const confirmBulkImport = () => {
    if (parsedMembers.length === 0) {
      toast("No member records to import", "err");
      return;
    }
    if (fest.isEvaluation && data.members.length + parsedMembers.length > EVALUATION_LIMITS.members) {
      toast(`Evaluation plan limit: cannot exceed ${EVALUATION_LIMITS.members} total members (currently ${data.members.length}).`, "err");
      return;
    }

    updateFest(fest.id, (d) => {
      let addedCount = 0;
      for (const item of parsedMembers) {
        let tId = isTM ? session.teamId || "" : "";
        if (!tId && item.teamName) {
          const matchedTeam = d.teams.find((t) => t.name.toLowerCase() === item.teamName.toLowerCase());
          if (matchedTeam) tId = matchedTeam.id;
          else {
            const newTId = uid();
            d.teams.push({ id: newTId, name: item.teamName });
            tId = newTId;
          }
        }
        if (!tId) tId = bulkDefaultTeam || d.teams[0]?.id || "";

        let cId = "";
        if (item.categoryName) {
          const matchedCat = d.categories.find((c) => c.name.toLowerCase() === item.categoryName.toLowerCase());
          if (matchedCat) cId = matchedCat.id;
          else {
            const newCId = uid();
            d.categories.push({ id: newCId, name: item.categoryName, type: "REGULAR" });
            cId = newCId;
          }
        }
        if (!cId) cId = bulkDefaultCat || d.categories[0]?.id || "";

        if (item.name && tId && cId) {
          const code = randCode();
          d.members.push({
            id: uid(),
            name: item.name,
            teamId: tId,
            categoryId: cId,
            phone: item.phone || undefined,
            place: item.place || undefined,
            code,
          });
          addedCount++;
        }
      }
      log(d, session.name, `Bulk imported ${addedCount} member(s)`);
    });

    toast(`Successfully imported ${parsedMembers.length} member(s)!`, "ok");
    setBulkModal(false);
    setParsedMembers([]);
    setBulkText("");
  };

  return (
    <div>
      <PageHead title="Members" sub={isTM ? "Members you add join your team automatically." : "Each member gets a random code — it is their login password."}>
        <SearchInput value={q} onChange={setQ} inputRef={searchRef} placeholder="Search members…  ( / )" />
        {!isTM && (
          <select className="select" style={{ width: "auto" }} value={fTeam} onChange={(e) => setFTeam(e.target.value)}>
            <option value="">All teams</option>
            {data.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
        <select className="select" style={{ width: "auto" }} value={fCat} onChange={(e) => setFCat(e.target.value)}>
          <option value="">All categories</option>
          {data.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {canAdd && (
          <>
            <Btn onClick={openAdd}><Icon n="plus" s={16} sw={2.4} /> Add Member</Btn>
            <Btn kind="soft" onClick={() => { setBulkModal(true); setParsedMembers([]); setBulkText(""); }}><Icon n="plus" s={15} /> Bulk Add</Btn>
            <Btn kind="gold" onClick={() => excelInputRef.current?.click()}><Icon n="download" s={15} /> Import Excel</Btn>
            <input ref={excelInputRef} type="file" accept=".xlsx,.xls,.csv,.tsv,.txt" className="hidden" onChange={handleExcelFile} />
          </>
        )}
      </PageHead>
      {members.length === 0 ? <Empty icon="users" title="No members here" body={isMain ? "Add members with the button above." : "Nothing matches these filters."} /> : (
        <div className="card overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Member</th><th>Code</th><th>Team</th><th>Category</th><th className="hidden md:table-cell">Place</th><th className="text-right">Actions</th></tr></thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>
                    <span className="flex items-center gap-2.5">
                      {m.photo
                        ? <img src={m.photo} alt="" className="w-8 h-8 rounded-full object-cover" />
                        : <span className="w-8 h-8 rounded-full flex items-center justify-center font-d text-[11px] font-extrabold" style={{ background: "var(--acc-soft)", color: "var(--acc)" }}>{m.name.slice(0, 1).toUpperCase()}</span>}
                      <span className="font-extrabold">{m.name}</span>
                    </span>
                  </td>
                  <td className="mono font-bold" style={{ color: "var(--coral)" }}>{m.code}</td>
                  <td><Tag color="var(--sky)">{tName(m.teamId)}</Tag></td>
                  <td><Tag>{cName(m.categoryId)}</Tag></td>
                  <td className="hidden md:table-cell font-bold" style={{ color: "var(--mut)" }}>{m.place || "—"}</td>
                  <td><RowActs canEdit={canAdd} onView={() => setView(m)} onEdit={() => openEdit(m)} onDel={() => del(m)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.edit ? "Edit Member" : "New Member"} w={520} footer={
        <><Btn kind="soft" onClick={() => setModal(null)}>Cancel</Btn><Btn onClick={save}>Confirm</Btn></>
      }>
        <div className="flex gap-4">
          <button type="button" className="shrink-0 flex flex-col items-center gap-2" onClick={() => fileRef.current?.click()} title="Upload photo">
            {form.photo
              ? <img src={form.photo} alt="" className="w-20 h-20 rounded-full object-cover" style={{ border: "2.5px solid var(--acc)" }} />
              : <span className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: "var(--panel3)", color: "var(--mut)", border: "2px dashed var(--line2)" }}><Icon n="camera" s={24} /></span>}
            <span className="text-[10.5px] font-extrabold uppercase tracking-wider" style={{ color: "var(--acc)" }}>Import photo</span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
          <div className="flex-1">
            <Field label="Name">
              <input className="input" value={form.name} autoFocus placeholder="Full name" onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              {isTM ? (
                <Field label="Team" hint="Locked to your team.">
                  <div className="input flex items-center" style={{ opacity: 0.72, cursor: "default" }}>
                    <Icon n="flag" s={14} className="mr-2 opacity-70" />
                    {data.teams.find((t) => t.id === form.teamId)?.name || "Your team"}
                  </div>
                </Field>
              ) : (
                <Field label="Team">
                  <Select value={form.teamId} onChange={(v) => setForm({ ...form, teamId: v })} options={data.teams.map((t) => ({ v: t.id, l: t.name }))} placeholder="Select team" />
                </Field>
              )}
              <Field label="Category">
                <Select value={form.categoryId} onChange={(v) => setForm({ ...form, categoryId: v })} options={data.categories.map((c) => ({ v: c.id, l: `${c.name} (${c.type.toLowerCase()})` }))} placeholder="Select category" />
              </Field>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mobile number (optional)">
            <input className="input" value={form.phone} placeholder="Phone" onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Place (optional)">
            <input className="input" value={form.place} placeholder="Place" onChange={(e) => setForm({ ...form, place: e.target.value })} />
          </Field>
        </div>
        {!modal?.edit && <p className="text-[12px] font-bold flex items-center gap-2" style={{ color: "var(--mut)" }}><Icon n="hash" s={14} /> A random login code like #34@123 is generated automatically.</p>}
      </Modal>

      <Modal open={bulkModal} onClose={() => setBulkModal(false)} title="Bulk Add & Excel Import" w={680} footer={
        <>
          <Btn kind="soft" onClick={() => setBulkModal(false)}>Cancel</Btn>
          <Btn onClick={confirmBulkImport} disabled={parsedMembers.length === 0}>
            Confirm Import ({parsedMembers.length} Members)
          </Btn>
        </>
      }>
        <div className="space-y-4">
          <div className="card2 p-3.5 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="lbl mb-0">Option 1: Import Excel / CSV File</span>
              <Btn size="sm" kind="gold" onClick={() => excelInputRef.current?.click()}>
                <Icon n="download" s={14} /> Select File (.xlsx, .csv)
              </Btn>
            </div>
            <p className="text-[12.5px] font-semibold" style={{ color: "var(--mut)" }}>
              Spreadsheets with headers (Name, Team, Category, Phone, Place) are mapped automatically.
            </p>
          </div>

          <div className="card2 p-3.5 space-y-2">
            <span className="lbl mb-0">Option 2: Paste Rows directly from Excel / Table</span>
            <textarea
              className="textarea font-mono text-[12px]"
              rows={3}
              value={bulkText}
              placeholder={"Paste lines here:\nJohn Doe\tRed Team\tSenior\t9876543210\tRivertown\nSarah Smith\tBlue Team\tJunior"}
              onChange={(e) => setBulkText(e.target.value)}
            />
            <div className="flex justify-end">
              <Btn size="sm" kind="soft" onClick={parsePastedText}>
                Parse Pasted Text
              </Btn>
            </div>
          </div>

          {/* Defaults / Fallback Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {!isTM && (
              <Field label="Fallback Team (if unmapped)" hint="Used if row team is blank or unmapped">
                <select className="select" value={bulkDefaultTeam} onChange={(e) => setBulkDefaultTeam(e.target.value)}>
                  <option value="">Default (First Team)</option>
                  {data.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </Field>
            )}
            <Field label="Fallback Category (if unmapped)" hint="Used if row category is blank or unmapped">
              <select className="select" value={bulkDefaultCat} onChange={(e) => setBulkDefaultCat(e.target.value)}>
                <option value="">Default (First Category)</option>
                {data.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          </div>

          {/* Parsed Members Preview Table */}
          {parsedMembers.length > 0 ? (
            <div className="card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-[13.5px]">Parsed Preview ({parsedMembers.length} Members)</span>
                <Tag color="var(--acc)">Ready to import</Tag>
              </div>
              <div className="max-h-[220px] overflow-y-auto overflow-x-auto">
                <table className="tbl text-[12px]">
                  <thead>
                    <tr><th>#</th><th>Name</th><th>Team</th><th>Category</th><th>Phone / Place</th></tr>
                  </thead>
                  <tbody>
                    {parsedMembers.map((m, idx) => (
                      <tr key={idx}>
                        <td className="mono font-bold" style={{ color: "var(--mut)" }}>{idx + 1}</td>
                        <td className="font-extrabold">{m.name}</td>
                        <td><Tag color="var(--sky)">{m.teamName || "Default"}</Tag></td>
                        <td><Tag>{m.categoryName || "Default"}</Tag></td>
                        <td style={{ color: "var(--mut)" }}>{[m.phone, m.place].filter(Boolean).join(" · ") || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-[12.5px] font-bold text-center py-4" style={{ color: "var(--mut)" }}>
              Upload an Excel file or paste rows above to preview members before importing.
            </div>
          )}
        </div>
      </Modal>

      {cropSrc && <CropModal src={cropSrc} onClose={() => setCropSrc(null)} onSave={(d) => { setForm((f) => ({ ...f, photo: d })); setCropSrc(null); toast("Photo adjusted", "ok"); }} />}

      <Modal open={!!view} onClose={() => setView(null)} title="Member details">
        {view && (
          <div>
            <div className="flex items-center gap-3 mb-3">
              {view.photo ? <img src={view.photo} alt="" className="w-14 h-14 rounded-full object-cover" /> : <span className="w-14 h-14 rounded-full flex items-center justify-center font-d font-extrabold" style={{ background: "var(--acc-soft)", color: "var(--acc)" }}>{view.name.slice(0, 1).toUpperCase()}</span>}
              <div>
                <div className="font-d text-[16px] font-extrabold">{view.name}</div>
                <div className="mono text-[12.5px] font-bold" style={{ color: "var(--coral)" }}>{view.code}</div>
              </div>
            </div>
            <KV k="Team" v={tName(view.teamId)} />
            <KV k="Category" v={cName(view.categoryId)} />
            <KV k="Mobile" v={view.phone || "—"} />
            <KV k="Place" v={view.place || "—"} />
            <KV k="Login code" v={<span className="mono">{view.code}</span>} />
            <KV k="Programs" v={data.programs.filter((p) => p.entries.some((e) => e.memberIds.includes(view.id))).length} />
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ================= ACCESS CONTROL ================= */
export function AccessSection(_: P) {
  const { data, fest, session, updateFest } = useStore();
  const toast = useToast(); const ask = useAsk();
  const [q, setQ] = useState(""); const [modal, setModal] = useState<null | { edit?: AccessUser }>(null);
  const [view, setView] = useState<AccessUser | null>(null);
  const [name, setName] = useState(""); const [role, setRole] = useState<string>(""); const [teamId, setTeamId] = useState("");
  const [pw, setPw] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  useKeyNav(() => searchRef.current?.focus());
  if (!data || !fest || !session) return null;

  const users = data.accessUsers.filter((u) => u.name.toLowerCase().includes(q.toLowerCase()));
  const openAdd = () => { setName(""); setRole(""); setTeamId(""); setPw(randPass()); setModal({}); };
  const openEdit = (u: AccessUser) => { setName(u.name); setRole(u.role); setTeamId(u.teamId || ""); setPw(u.password); setModal({ edit: u }); };
  const save = () => {
    if (!name.trim()) { toast("Give the user a name", "err"); return; }
    if (!role) { toast("Pick a role", "err"); return; }
    if (!modal?.edit) {
      const err = checkLimit(fest.isEvaluation, data.accessUsers.length, EVALUATION_LIMITS.accessUsers, "users");
      if (err) { toast(err, "err"); return; }
    }
    updateFest(fest.id, (d) => {
      if (modal?.edit) {
        const u = d.accessUsers.find((x) => x.id === modal.edit!.id);
        if (u) Object.assign(u, { name: name.trim(), role: role as Role, teamId: role === "TEAM MANAGER" ? teamId || undefined : undefined, password: pw });
        log(d, session.name, `Crew user "${name}" updated`);
      } else {
        d.accessUsers.push({ id: uid(), name: name.trim(), role: role as Role, teamId: role === "TEAM MANAGER" ? teamId || undefined : undefined, password: pw });
        log(d, session.name, `Crew user "${name}" added as ${role}`);
      }
    });
    toast(modal?.edit ? "User updated" : "User added — they can log in via Play", "ok");
    setModal(null);
  };
  const del = async (u: AccessUser) => {
    const ok = await ask({ title: `Remove ${u.name}?`, body: "They will no longer be able to log in.", yes: "Remove", danger: true });
    if (!ok) return;
    updateFest(fest.id, (d) => { d.accessUsers = d.accessUsers.filter((x) => x.id !== u.id); log(d, session.name, `Crew user "${u.name}" removed`); });
    toast("User removed", "ok");
  };

  return (
    <div>
      <PageHead title="Access Control" sub="Crew logins — judges, media, team managers, monitors and stage managers sign in through the Play screen.">
        <SearchInput value={q} onChange={setQ} inputRef={searchRef} placeholder="Search users…  ( / )" />
        <Btn onClick={openAdd}><Icon n="plus" s={16} sw={2.4} /> Add User</Btn>
      </PageHead>
      {users.length === 0 ? <Empty icon="key" title="No crew users yet" body="Add a user, pick their role, and share the random password with them." /> : (
        <div className="card overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>User</th><th>Role</th><th>Password</th><th className="text-right">Actions</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="font-extrabold">{u.name}</td>
                  <td><Tag color="var(--plum)">{u.role}{u.role === "TEAM MANAGER" && u.teamId ? ` · ${data.teams.find((t) => t.id === u.teamId)?.name || ""}` : ""}</Tag></td>
                  <td><Dots secret={u.password} /></td>
                  <td><RowActs onView={() => setView(u)} onEdit={() => openEdit(u)} onDel={() => del(u)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.edit ? "Edit User" : "New Crew User"} footer={
        <><Btn kind="soft" onClick={() => setModal(null)}>Cancel</Btn><Btn onClick={save}>Confirm</Btn></>
      }>
        <Field label="Name of the user">
          <input className="input" value={name} autoFocus placeholder="e.g. Asha" onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Role">
          <Select value={role} onChange={setRole} options={CREW_ROLES.map((r) => ({ v: r, l: r }))} placeholder="Select role" />
        </Field>
        {role === "TEAM MANAGER" && (
          <Field label="Team they manage" hint="They will only see and manage this team.">
            <Select value={teamId} onChange={setTeamId} options={data.teams.map((t) => ({ v: t.id, l: t.name }))} placeholder="Select team" />
          </Field>
        )}
        <Field label="Password" hint="Randomly generated — share it privately.">
          <div className="flex gap-2">
            <input className="input mono" value={pw} onChange={(e) => setPw(e.target.value)} />
            <Btn kind="soft" onClick={() => setPw(randPass())} title="Regenerate"><Icon n="shuffle" s={15} /></Btn>
          </div>
        </Field>
      </Modal>
      <Modal open={!!view} onClose={() => setView(null)} title="User details">
        {view && (<>
          <KV k="Name" v={view.name} />
          <KV k="Role" v={<Tag color="var(--plum)">{view.role}</Tag>} />
          {view.teamId && <KV k="Team" v={data.teams.find((t) => t.id === view.teamId)?.name || "—"} />}
          <KV k="Password" v={<Dots secret={view.password} />} />
        </>)}
      </Modal>
    </div>
  );
}

/* ================= GRADE POINTS ================= */
export function GradesSection(_: P) {
  const { data, fest, session, updateFest } = useStore();
  const toast = useToast(); const ask = useAsk();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [scaleModal, setScaleModal] = useState<null | { edit?: GradeScale }>(null);
  const [scaleName, setScaleName] = useState("");
  const [modal, setModal] = useState<null | { edit?: Grade }>(null);
  const [name, setName] = useState(""); const [min, setMin] = useState(""); const [max, setMax] = useState(""); const [point, setPoint] = useState("");
  if (!data || !fest || !session) return null;
  const scales = data.gradeScales || [];
  const active = scales.find((s) => s.id === activeId) || scales[0];

  // ---- scale management ----
  const openAddScale = () => { setScaleName(""); setScaleModal({}); };
  const openEditScale = (s: GradeScale) => { setScaleName(s.name); setScaleModal({ edit: s }); };
  const saveScale = () => {
    const nm = scaleName.trim();
    if (!nm) { toast("Give the scale a name", "err"); return; }
    updateFest(fest.id, (d) => {
      if (scaleModal?.edit) {
        const s = d.gradeScales.find((x) => x.id === scaleModal.edit!.id);
        if (s) s.name = nm;
        log(d, session.name, `Grade scale renamed → "${nm}"`);
      } else {
        const created: GradeScale = { id: uid(), name: nm, grades: [] };
        d.gradeScales.push(created);
        log(d, session.name, `Grade scale "${nm}" created`);
      }
    });
    toast(scaleModal?.edit ? "Scale renamed" : "Scale added", "ok");
    setScaleModal(null);
  };
  const delScale = async (s: GradeScale) => {
    if (scales.length <= 1) { toast("Keep at least one grade scale", "err"); return; }
    const used = data.programs.filter((p) => p.gradeScaleId === s.id).length;
    const ok = await ask({
      title: `Delete scale "${s.name}"?`,
      body: used ? `${used} program${used === 1 ? "" : "s"} use this scale — they will fall back to the first available scale.` : "Its grades will be removed.",
      yes: "Delete", danger: true,
    });
    if (!ok) return;
    updateFest(fest.id, (d) => {
      d.gradeScales = d.gradeScales.filter((x) => x.id !== s.id);
      for (const p of d.programs) if (p.gradeScaleId === s.id) delete p.gradeScaleId;
      log(d, session.name, `Grade scale "${s.name}" deleted`);
    });
    if (activeId === s.id) setActiveId(null);
    toast("Scale deleted", "ok");
  };

  // ---- grade rows inside the active scale ----
  const openAdd = () => { if (!active) return; setName(""); setMin(""); setMax(""); setPoint(""); setModal({}); };
  const openEdit = (g: Grade) => { setName(g.name); setMin(String(g.min)); setMax(String(g.max)); setPoint(String(g.point)); setModal({ edit: g }); };
  const save = () => {
    if (!active) return;
    if (!name.trim()) { toast("Give the grade a name", "err"); return; }
    const mn = parseFloat(min), mx = parseFloat(max), pt = parseFloat(point);
    if (isNaN(mn) || isNaN(mx) || isNaN(pt)) { toast("Fill minimum, maximum and grade point", "err"); return; }
    if (mn > mx) { toast("Minimum cannot be above maximum", "err"); return; }
    updateFest(fest.id, (d) => {
      const s = d.gradeScales.find((x) => x.id === active.id);
      if (!s) return;
      if (modal?.edit) {
        const g = s.grades.find((x) => x.id === modal.edit!.id);
        if (g) Object.assign(g, { name: name.trim(), min: mn, max: mx, point: pt });
      } else {
        s.grades.push({ id: uid(), name: name.trim(), min: mn, max: mx, point: pt });
      }
      s.grades.sort((a, b) => b.max - a.max);
      log(d, session.name, `Grade "${name}" ${modal?.edit ? "updated" : "added"} in "${s.name}"`);
    });
    toast(modal?.edit ? "Grade updated" : "Grade added", "ok");
    setModal(null);
  };
  const del = async (g: Grade) => {
    if (!active) return;
    const ok = await ask({ title: `Delete grade "${g.name}"?`, body: "Marks in this range will have no grade in this scale until you add one.", yes: "Delete", danger: true });
    if (!ok) return;
    updateFest(fest.id, (d) => {
      const s = d.gradeScales.find((x) => x.id === active.id);
      if (s) s.grades = s.grades.filter((x) => x.id !== g.id);
      log(d, session.name, `Grade "${g.name}" deleted from "${active.name}"`);
    });
    toast("Grade deleted", "ok");
  };
  const sample = 85;
  const sg = active ? gradeFor(sample, active.grades) : undefined;
  const usedCount = active ? data.programs.filter((p) => (p.gradeScaleId || scales[0]?.id) === active.id).length : 0;

  return (
    <div>
      <PageHead title="Grade Point Scales"
        sub="Build as many scales as you like — each program picks the one that judges its result. Grade point 0 means NO GRADE.">
        <Btn kind="soft" onClick={openAddScale}><Icon n="plus" s={16} sw={2.4} /> Add Scale</Btn>
        {active && <Btn onClick={openAdd}><Icon n="plus" s={16} sw={2.4} /> Add Grade</Btn>}
      </PageHead>

      <div className="flex flex-wrap gap-2 mb-4">
        {scales.map((s) => {
          const on = active?.id === s.id;
          return (
            <span key={s.id} className="inline-flex items-center gap-1">
              <button type="button" onClick={() => setActiveId(s.id)}
                className="chip" style={on ? { background: "var(--ink)", color: "var(--bg)", borderColor: "var(--ink)" } : undefined}>
                {s.name} <span className="opacity-60">·  {s.grades.length}</span>
              </button>
              {on && (
                <>
                  <IconBtn n="edit" s={14} title="Rename scale" onClick={() => openEditScale(s)} />
                  <IconBtn n="trash" s={14} danger title="Delete scale" onClick={() => delScale(s)} />
                </>
              )}
            </span>
          );
        })}
      </div>

      {!active ? <Empty icon="award" title="No grade scales yet" body="Add your first scale — for example 'Standard (out of 10)' or 'Simple (out of 5)'." /> : (
        <>
          <div className="card overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Grade</th><th>Minimum mark</th><th>Maximum mark</th><th>Grade point</th><th className="text-right">Actions</th></tr></thead>
              <tbody>
                {active.grades.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-[13px] font-bold" style={{ color: "var(--mut)" }}>No grades in this scale yet.</td></tr>}
                {active.grades.map((g) => (
                  <tr key={g.id}>
                    <td><span className="font-d text-[16px] font-extrabold" style={{ color: g.point >= 9 ? "var(--marigold)" : g.point === 0 ? "var(--coral)" : "var(--ink)" }}>{g.name}</span></td>
                    <td className="font-bold">{g.min}</td>
                    <td className="font-bold">{g.max}</td>
                    <td><Tag color={g.point === 0 ? "var(--coral)" : "var(--acc)"}>{pointLabel(g)}</Tag></td>
                    <td><RowActs onView={() => openEdit(g)} onEdit={() => openEdit(g)} onDel={() => del(g)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[12.5px] font-bold mt-3 flex items-center gap-2" style={{ color: "var(--mut)" }}>
            <Icon n="info" s={14} /> Used by <b style={{ color: "var(--ink)" }}>{usedCount}</b> program{usedCount === 1 ? "" : "s"} · a mark of {sample} lands on grade
            <b style={{ color: "var(--marigold)" }}>{sg?.name || "—"}</b> ({pointLabel(sg)}).
          </p>
        </>
      )}

      <Modal open={!!scaleModal} onClose={() => setScaleModal(null)} title={scaleModal?.edit ? "Rename Scale" : "New Grade Scale"} footer={
        <><Btn kind="soft" onClick={() => setScaleModal(null)}>Cancel</Btn><Btn onClick={saveScale}>Confirm</Btn></>
      }>
        <Field label="Name of the scale"><input className="input" value={scaleName} autoFocus placeholder="e.g. Junior · out of 5" onChange={(e) => setScaleName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveScale()} /></Field>
      </Modal>
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.edit ? "Edit Grade" : `New Grade in "${active?.name || ""}"`} footer={
        <><Btn kind="soft" onClick={() => setModal(null)}>Cancel</Btn><Btn onClick={save}>Confirm</Btn></>
      }>
        <Field label="Name of the grade">
          <input className="input" value={name} autoFocus placeholder="e.g. A+" onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Minimum mark"><input className="input" inputMode="decimal" value={min} placeholder="91" onChange={(e) => setMin(e.target.value)} /></Field>
          <Field label="Maximum mark"><input className="input" inputMode="decimal" value={max} placeholder="100" onChange={(e) => setMax(e.target.value)} /></Field>
          <Field label="Grade point"><input className="input" inputMode="decimal" value={point} placeholder="10" onChange={(e) => setPoint(e.target.value)} /></Field>
        </div>
      </Modal>
    </div>
  );
}
