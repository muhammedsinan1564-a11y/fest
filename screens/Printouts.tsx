import React, { useState } from "react";
import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";
import { useStore, st } from "../lib/store";
import type { Program, Member } from "../lib/store";
import { Icon, Btn, Modal, Empty, PageHead, useToast, useAsk } from "../lib/ui";
import type { Route } from "./Shell";

type P = { push: (r: Route) => void; params?: Record<string, string>; back?: () => void };

/**
 * combo      → group/general program sheet; names are joined, no code column
 * reportTeam → reporting list; the `code` field carries the TEAM name instead of a member code
 */
interface Group { heading: string; rows: { name: string; code: string }[]; combo?: boolean; reportTeam?: boolean; }

/* ---------- shared download flow ---------- */
function useDownload() {
  const ask = useAsk(); const toast = useToast();
  const [preview, setPreview] = useState<null | { title: string; node: React.ReactNode; runPdf: () => void; runXlsx?: () => void }>(null);
  const flow = async (title: string, node: React.ReactNode, runPdf: () => void, runXlsx?: () => void) => {
    const ok = await ask({ title: "Download this sheet?", body: "An Excel spreadsheet preview will open — confirm to download as PDF or Excel (.xlsx).", yes: "Yes, preview" });
    if (!ok) return;
    setPreview({ title, node, runPdf, runXlsx });
  };
  const modal = (
    <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.title || ""} w={680} footer={
      <>
        <Btn kind="soft" onClick={() => setPreview(null)}>Close</Btn>
        {preview?.runXlsx && (
          <Btn kind="gold" onClick={() => { preview.runXlsx!(); toast("Excel file (.xlsx) downloaded", "ok"); setPreview(null); }}>
            <Icon n="download" s={15} /> Download Excel (.xlsx)
          </Btn>
        )}
        <Btn onClick={() => { preview?.runPdf(); toast("PDF downloaded", "ok"); setPreview(null); }}>
          <Icon n="download" s={15} /> Download PDF
        </Btn>
      </>
    }>
      <div className="max-h-[64vh] overflow-y-auto rounded-lg" style={{ background: "#e8ebe8", padding: 12 }}>
        {preview?.node}
      </div>
    </Modal>
  );
  return { flow, modal };
}

function Sheet({ title, festName, children }: { title: string; festName: string; children: React.ReactNode }) {
  return (
    <div className="sheet-excel mx-auto shadow-2xl rounded-lg overflow-hidden select-none"
      style={{ width: 580, background: "#ffffff", border: "2px solid #107c41", fontFamily: "Calibri, 'Segoe UI', Arial, sans-serif" }}>
      {/* Excel Title Ribbon */}
      <div className="px-4 py-2 flex items-center justify-between text-white" style={{ background: "#107c41" }}>
        <div className="flex items-center gap-2">
          <span className="font-mono font-extrabold text-[12px] px-1.5 py-0.5 rounded bg-white text-[#107c41]">XLS</span>
          <span className="font-bold text-[13.5px] tracking-wide">{title.replace(/[^a-zA-Z0-9\s—]/g, "")}.xlsx</span>
        </div>
        <div className="text-[11px] font-bold opacity-90">{festName} · Festize Sheet</div>
      </div>

      {/* Formula Bar Look */}
      <div className="px-3 py-1 flex items-center gap-3 border-b text-[11px] font-mono" style={{ background: "#f8f9f8", borderColor: "#d4d4d4", color: "#444" }}>
        <span className="font-extrabold text-[#107c41]">fx</span>
        <span className="opacity-30">|</span>
        <span className="truncate opacity-80">=WORKSHEET("{title.toUpperCase()}", "{festName}")</span>
      </div>

      {/* Spreadsheet Content Grid Container */}
      <div className="p-3.5 overflow-x-auto" style={{ background: "#ffffff" }}>
        {children}
      </div>

      {/* Excel Bottom Sheet Tab Bar */}
      <div className="px-3 py-1 flex items-center justify-between border-t text-[10.5px] font-bold" style={{ background: "#f3f3f3", borderColor: "#d4d4d4", color: "#666" }}>
        <div className="flex items-center gap-1">
          <span className="px-2.5 py-0.5 rounded-t bg-white border-x border-t font-extrabold text-[#107c41]" style={{ borderColor: "#d4d4d4" }}>
            Sheet1
          </span>
          <span className="px-2 py-0.5 opacity-50">+</span>
        </div>
        <span>READY · 100%</span>
      </div>
    </div>
  );
}

function ExcelTableGrid({ groups }: { groups: Group[] }) {
  let rowCounter = 1;
  return (
    <div className="border rounded overflow-hidden text-[12px] select-text" style={{ borderColor: "#c0c0c0", fontFamily: "Calibri, 'Segoe UI', Arial, sans-serif" }}>
      <table className="w-full border-collapse">
        <thead>
          <tr style={{ background: "#e6e6e6", color: "#444", fontSize: "11px", fontWeight: 700 }}>
            <th className="border px-2 py-1 text-center w-10" style={{ borderColor: "#d4d4d4", background: "#d0d0d0" }}>#</th>
            <th className="border px-2 py-1 text-center w-12" style={{ borderColor: "#d4d4d4" }}>A</th>
            <th className="border px-2 py-1 text-left" style={{ borderColor: "#d4d4d4" }}>B</th>
            <th className="border px-2 py-1 text-right w-28" style={{ borderColor: "#d4d4d4" }}>C</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => {
            const headerRowNo = rowCounter++;
            return (
              <React.Fragment key={g.heading}>
                {/* Category / Program Header Row */}
                <tr style={{ background: "#e8f5e9" }}>
                  <td className="border px-2 py-1 text-center text-[10px] font-mono font-bold" style={{ borderColor: "#c0c0c0", background: "#f3f3f3", color: "#555" }}>
                    {headerRowNo}
                  </td>
                  <td colSpan={3} className="border px-3 py-1.5 font-extrabold uppercase tracking-wide text-[#107c41]" style={{ borderColor: "#a6d4b2" }}>
                    {g.heading}
                  </td>
                </tr>

                {/* Subheader */}
                <tr style={{ background: "#f9fbf9", color: "#444", fontSize: "10.5px", fontWeight: 700 }}>
                  <td className="border px-2 py-1 text-center text-[10px] font-mono" style={{ borderColor: "#d4d4d4", background: "#f3f3f3" }}>
                    {rowCounter++}
                  </td>
                  <td className="border px-2 py-1 text-center" style={{ borderColor: "#d4d4d4" }}>NO</td>
                  <td className="border px-2 py-1 text-left" style={{ borderColor: "#d4d4d4" }}>
                    {g.reportTeam ? "MEMBER(S)" : g.combo ? "CANDIDATES / GROUP" : "PARTICIPANT"}
                  </td>
                  <td className="border px-2 py-1 text-right" style={{ borderColor: "#d4d4d4" }}>
                    {g.reportTeam ? "TEAM" : g.combo ? "" : "CODE"}
                  </td>
                </tr>

                {/* Rows */}
                {g.rows.map((r, i) => {
                  const currRowNo = rowCounter++;
                  return (
                    <tr key={i} style={{ background: i % 2 === 1 ? "#fcfcfc" : "#ffffff" }}>
                      <td className="border px-2 py-1 text-center text-[10px] font-mono text-[#777]" style={{ borderColor: "#e1e1e1", background: "#f8f8f8" }}>
                        {currRowNo}
                      </td>
                      <td className="border px-2 py-1 text-center font-bold text-[#444]" style={{ borderColor: "#e1e1e1" }}>
                        {i + 1}
                      </td>
                      <td className="border px-2.5 py-1 font-bold text-[#111]" style={{ borderColor: "#e1e1e1" }}>
                        {r.name}
                      </td>
                      <td
                        className={`border px-2.5 py-1 text-right font-bold ${g.reportTeam ? "text-[#107c41]" : "font-mono text-[#d94f27]"}`}
                        style={{ borderColor: "#e1e1e1" }}
                      >
                        {r.code}
                      </td>
                    </tr>
                  );
                })}

                {g.rows.length === 0 && (
                  <tr>
                    <td className="border px-2 py-1 text-center text-[10px] font-mono" style={{ borderColor: "#e1e1e1", background: "#f8f8f8" }}>
                      {rowCounter++}
                    </td>
                    <td colSpan={3} className="border px-3 py-1.5 italic text-gray-400" style={{ borderColor: "#e1e1e1" }}>
                      No entries recorded
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function makeExcel(title: string, festName: string, groups: Group[]) {
  const wb = XLSX.utils.book_new();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[][] = [
    [title.toUpperCase()],
    [`${festName} - Generated by Festize`],
    [],
  ];
  for (const g of groups) {
    rows.push([`[ ${g.heading.toUpperCase()} ]`]);
    if (g.reportTeam) {
      rows.push(["NO.", "MEMBER(S)", "TEAM"]);
      g.rows.forEach((r, idx) => rows.push([idx + 1, r.name, r.code]));
    } else if (g.combo) {
      rows.push(["NO.", "CANDIDATE / GROUP"]);
      g.rows.forEach((r, idx) => rows.push([idx + 1, r.name]));
    } else {
      rows.push(["NO.", "PARTICIPANT", "CODE"]);
      g.rows.forEach((r, idx) => rows.push([idx + 1, r.name, r.code]));
    }
    rows.push([]);
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, `${title.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.xlsx`);
}

function makePdf(title: string, festName: string, groups: Group[], report = false) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = 595.28, M = 42;
  let y = 52;
  doc.setFont("helvetica", "bold"); doc.setFontSize(18);
  doc.text(title.toUpperCase(), M, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(110);
  doc.text(`${festName}  ·  generated by Festize  ·  ${new Date().toLocaleDateString()}`, M, y + 15);
  doc.setTextColor(20); doc.setDrawColor(20); doc.setLineWidth(1.4);
  y += 26; doc.line(M, y, W - M, y); y += 24;
  const cols = report ? [M, M + 165, M + 330] : null;
  for (const g of groups) {
    if (y > 740) { doc.addPage(); y = 54; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(12.5);
    doc.text(g.heading, M, y); y += 8;
    doc.setLineWidth(0.7); doc.setDrawColor(150); doc.line(M, y, W - M, y); y += 16;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10.5);
    g.rows.forEach((r, idx) => {
      if (report) {
        doc.setFont("helvetica", "bold"); doc.setFontSize(10.5);
        const lines = doc.splitTextToSize(`${idx + 1}.  ${r.name}`, 152) as string[];
        const rowH = Math.max(idx === 2 ? 34 : 26, lines.length * 13 + 18);
        if (y + rowH > 790) { doc.addPage(); y = 54; }
        doc.text(lines, cols![0], y + 8);
        // second line: the team name, readable and green
        if (r.code) {
          doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(16, 124, 65);
          doc.text(`Team: ${r.code}`, cols![0], y + 8 + lines.length * 13);
        }
        doc.setTextColor(20);
        doc.setDrawColor(210); doc.setLineWidth(0.5);
        doc.line(M, y + rowH - 4, W - M, y + rowH - 4);
        doc.setDrawColor(150); doc.setLineWidth(0.7);
        doc.line(cols![1], y + rowH - 8, cols![1] + 150, y + rowH - 8);
        doc.line(cols![2], y + rowH - 8, cols![2] + 168, y + rowH - 8);
        y += rowH;
        return;
      }
      const nameW = r.code ? W - M * 2 - 80 : W - M * 2 - 6;
      const lines = doc.splitTextToSize(`${idx + 1}.  ${r.name}`, nameW) as string[];
      const rowH = Math.max(22, lines.length * 13 + 9);
      if (y + rowH > 790) { doc.addPage(); y = 54; }
      doc.text(lines, M, y + 4);
      doc.setTextColor(110);
      if (r.code) doc.text(r.code, W - M - 60, y + 4);
      doc.setTextColor(20);
      doc.setDrawColor(210); doc.setLineWidth(0.5);
      doc.line(M, y + rowH - 4, W - M, y + rowH - 4);
      doc.setDrawColor(150); doc.setLineWidth(0.7);
      y += rowH;
    });
    y += 14;
  }
  doc.save(title.toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".pdf");
}

/* ---------- hub ---------- */
export function PrintoutsHub({ push }: P) {
  const { session, data } = useStore();
  if (!data || !session) return null;
  const role = session.role;
  const cards: { id: string; icon: string; title: string; body: string }[] = [];
  if (role !== "MONITOR") cards.push({ id: "printTeams", icon: "flag", title: "Team", body: role === "TEAM MANAGER" ? "Your team's members grouped by category, with codes." : "Every team's members grouped by category, with codes." });
  if (role === "MAIN" || role === "TEAM MANAGER") cards.push({ id: "printCats", icon: "tag", title: "Program", body: role === "TEAM MANAGER" ? "Categories and programs — showing your team's members only." : "Categories with their members listed under each program." });
  if (role === "MAIN" || role === "MONITOR") cards.push({ id: "printReportCats", icon: "mail", title: "Reporting List", body: "Program-wise reporting sheets with signature columns." });
  return (
    <div>
      <PageHead title="Printouts" sub="Ready-to-print sheets. Preview first, then download the PDF." />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map((c, i) => (
          <button key={c.id} type="button" onClick={() => push({ id: c.id })}
            className="card hoverable p-5 text-left anim-in" style={{ animationDelay: i * 60 + "ms" }}>
            <span className="w-11 h-11 rounded-xl flex items-center justify-center mb-3.5" style={{ background: "var(--marigold-soft)", color: "var(--marigold)" }}>
              <Icon n={c.icon} s={20} />
            </span>
            <div className="font-d text-[15.5px] font-extrabold">{c.title}</div>
            <div className="text-[12.5px] font-semibold mt-1.5 leading-relaxed" style={{ color: "var(--mut)" }}>{c.body}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function PickerList<T extends { id: string; name: string }>({ items, onPick, icon, emptyTitle }: { items: T[]; onPick: (x: T) => void; icon: string; emptyTitle: string }) {
  if (items.length === 0) return <Empty icon={icon} title={emptyTitle} body="Nothing to print yet — add data in the matching section." />;
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map((t, i) => (
        <button key={t.id} type="button" onClick={() => onPick(t)} className="card hoverable p-4 text-left flex items-center gap-3 anim-in" style={{ animationDelay: i * 40 + "ms" }}>
          <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--acc-soft)", color: "var(--acc)" }}><Icon n="chevR" s={17} /></span>
          <span>
            <span className="font-d text-[14px] font-extrabold block">{t.name}</span>
            <span className="text-[11.5px] font-bold" style={{ color: "var(--mut)" }}>open sheet</span>
          </span>
        </button>
      ))}
    </div>
  );
}

/* ---------- team flow ---------- */
export function PrintTeams({ push }: P) {
  const { data, session } = useStore();
  if (!data || !session) return null;
  const teams = session.role === "TEAM MANAGER" ? data.teams.filter((t) => t.id === session.teamId) : data.teams;
  return (
    <div>
      <PageHead title="Printouts · Team" sub={session.role === "TEAM MANAGER" ? "Your team only." : "Pick a team to build its member sheet."} />
      <PickerList items={teams} icon="flag" emptyTitle="No teams yet" onPick={(t) => push({ id: "printTeam", params: { tid: t.id } })} />
    </div>
  );
}
export function PrintTeamPage({ params }: P) {
  const { data, fest } = useStore();
  const dl = useDownload();
  const team = data?.teams.find((t) => t.id === params?.tid);
  if (!data || !fest) return null;
  if (!team) return <Empty icon="flag" title="Team not found" />;
  const groups: Group[] = data.categories
    .map((c) => ({ heading: `${c.name} — ${c.type.toLowerCase()}`, rows: data.members.filter((m) => m.teamId === team.id && m.categoryId === c.id).map((m) => ({ name: m.name, code: m.code })) }))
    .filter((g) => g.rows.length > 0);
  const uncat = data.members.filter((m) => m.teamId === team.id && !data.categories.some((c) => c.id === m.categoryId));
  if (uncat.length) groups.push({ heading: "Unassigned category", rows: uncat.map((m) => ({ name: m.name, code: m.code })) });
  const title = `Team Sheet — ${team.name}`;
  const node = (
    <Sheet title={title} festName={fest.name}>
      <ExcelTableGrid groups={groups} />
      {groups.length === 0 && <p style={{ fontSize: 12 }} className="p-3">No members in this team.</p>}
    </Sheet>
  );
  return (
    <div className="max-w-[580px] mx-auto">
      <PageHead title={team.name} sub="Team sheet · members grouped by category">
        <Btn kind="gold" onClick={() => dl.flow(title, node, () => makePdf(title, fest.name, groups), () => makeExcel(title, fest.name, groups))}><Icon n="download" s={15} /> Download</Btn>
      </PageHead>
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--line)" }}>{node}</div>
      {dl.modal}
    </div>
  );
}

/* ---------- program-by-category flow ---------- */
export function PrintCats({ push }: P) {
  const { data } = useStore();
  if (!data) return null;
  return (
    <div>
      <PageHead title="Printouts · Program" sub="Pick a category — its members print under each program." />
      <PickerList items={data.categories} icon="tag" emptyTitle="No categories yet" onPick={(c) => push({ id: "printCat", params: { cid: c.id } })} />
    </div>
  );
}
export function PrintCatPage({ params }: P) {
  const { data, fest, session } = useStore();
  const dl = useDownload();
  const cat = data?.categories.find((c) => c.id === params?.cid);
  if (!data || !fest || !session) return null;
  if (!cat) return <Empty icon="tag" title="Category not found" />;
  const mineOnly = session.role === "TEAM MANAGER" ? session.teamId : null;
  // group programs (and everything in a General category) print as one combo row per entry, without codes
  const groups: Group[] = data.programs.filter((p) => p.categoryId === cat.id).map((p) => {
    const combo = p.kind === "GROUP" || cat.type === "GENERAL";
    if (combo) {
      return {
        heading: p.name,
        combo: true,
        rows: p.entries
          .filter((e) => !mineOnly || e.teamId === mineOnly)
          .map((e) => {
            const names = e.memberIds.map((id) => data.members.find((m) => m.id === id)?.name).filter(Boolean) as string[];
            const team = data.teams.find((t) => t.id === e.teamId)?.name || "—";
            return { name: `${names.join(" · ")}  (${team})`, code: "" };
          })
          .filter((r) => r.name.trim().length > 4),
      };
    }
    return {
      heading: p.name,
      rows: p.entries.flatMap((e) => e.memberIds.map((id) => data.members.find((m) => m.id === id)))
        .filter((x): x is Member => !!x && (!mineOnly || x.teamId === mineOnly))
        .map((m) => ({ name: m.name, code: m.code })),
    };
  });
  const title = `Program Sheet — ${cat.name}`;
  const node = (
    <Sheet title={title} festName={fest.name}>
      <ExcelTableGrid groups={groups} />
      {groups.length === 0 && <p style={{ fontSize: 12 }} className="p-3">No programs in this category.</p>}
    </Sheet>
  );
  return (
    <div className="max-w-[580px] mx-auto">
      <PageHead title={cat.name} sub={mineOnly ? "Category sheet · your team's members under each program" : "Category sheet · members under each program"}>
        <Btn kind="gold" onClick={() => dl.flow(title, node, () => makePdf(title, fest.name, groups), () => makeExcel(title, fest.name, groups))}><Icon n="download" s={15} /> Download</Btn>
      </PageHead>
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--line)" }}>{node}</div>
      {dl.modal}
    </div>
  );
}

/* ---------- reporting list flow ---------- */
/** every group program is gathered under one pseudo-category of its own */
const GROUP_CAT = "__group__";

export function PrintReportCats({ push }: P) {
  const { data } = useStore();
  if (!data) return null;
  const groupCount = data.programs.filter((p) => p.kind === "GROUP").length;
  // individual programs stay under their real category; group programs get their own bucket
  const items = [
    ...data.categories
      .filter((c) => data.programs.some((p) => p.categoryId === c.id && p.kind !== "GROUP"))
      .map((c) => ({ id: c.id, name: c.name })),
    ...(groupCount ? [{ id: GROUP_CAT, name: "Group Programs" }] : []),
  ];
  return (
    <div>
      <PageHead title="Printouts · Reporting List" sub="Pick a category, then a program, to print its reporting sheet. Group programs are listed together." />
      <PickerList items={items} icon="mail" emptyTitle="No categories yet" onPick={(c: { id: string }) => push({ id: "printReportProgs", params: { cid: c.id } })} />
    </div>
  );
}
export function PrintReportProgs({ params, push }: P) {
  const { data } = useStore();
  if (!data) return null;
  const isGroup = params?.cid === GROUP_CAT;
  const cat = data.categories.find((c) => c.id === params?.cid);
  if (!isGroup && !cat) return <Empty icon="mail" title="Category not found" />;
  const progs = isGroup
    ? data.programs.filter((p) => p.kind === "GROUP")
    : data.programs.filter((p) => p.categoryId === cat!.id && p.kind !== "GROUP");
  return (
    <div>
      <PageHead title={isGroup ? "Group Programs" : cat!.name} sub={isGroup ? "Every group program in the fest" : "Individual programs in this category"} />
      <PickerList items={progs} icon="list" emptyTitle="No programs here" onPick={(p: Program) => push({ id: "printReport", params: { pid: p.id } })} />
    </div>
  );
}
export function PrintReportPage({ params }: P) {
  const { data, fest } = useStore();
  const dl = useDownload();
  const p = data?.programs.find((x) => x.id === params?.pid);
  if (!data || !fest) return null;
  if (!p) return <Empty icon="mail" title="Program not found" />;
  const status = st(data, p.id);
  const teamName = (id: string) => data.teams.find((t) => t.id === id)?.name || "No team";
  const isGroup = p.kind === "GROUP";

  // Group programs: one row per group entry, listing that group's member names, team shown alongside.
  // Individual programs: one row per member, team shown alongside.
  // Member codes are deliberately left off the reporting sheet in both cases.
  const rows = isGroup
    ? p.entries.map((e) => {
        const names = e.memberIds.map((id) => data.members.find((m) => m.id === id)?.name).filter(Boolean) as string[];
        return { name: names.join(", "), code: teamName(e.teamId) };
      }).filter((r) => r.name)
    : p.entries
        .flatMap((e) => e.memberIds.map((id) => data.members.find((m) => m.id === id)))
        .filter((m): m is Member => !!m)
        .map((m) => ({ name: m.name, code: teamName(m.teamId) }));

  const groups: Group[] = [{ heading: `${p.name}  ·  ${status.toLowerCase().replace("_", " ")}`, rows, reportTeam: true }];
  const title = `Reporting List — ${p.name}`;
  const node = (
    <Sheet title={title} festName={fest.name}>
      <ExcelTableGrid groups={groups} />
      {rows.length === 0 && <p style={{ fontSize: 12 }} className="p-3">No members in this program.</p>}
    </Sheet>
  );
  return (
    <div className="max-w-[580px] mx-auto">
      <PageHead title={p.name} sub={isGroup ? "Reporting sheet · one row per group with its members and team · signature columns left blank" : "Reporting sheet · one row per member with their team · signature columns left blank"}>
        <Btn kind="gold" onClick={() => dl.flow(title, node, () => makePdf(title, fest.name, groups, true), () => makeExcel(title, fest.name, groups))}><Icon n="download" s={15} /> Download</Btn>
      </PageHead>
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--line)" }}>{node}</div>
      {dl.modal}
    </div>
  );
}
