import { useRef, useState } from "react";
import { ArrowRight, ChevronRight, Download, FileSpreadsheet } from "lucide-react";
import { Button, Empty, Modal, PageHead, SearchInput } from "../ui";
import { getCategoryName, getMemberName, getTeamName, type Program } from "../types";
import { downloadNodePdf, reportRows, type SectionProps } from "./common";

type Tab = "Team" | "Program" | "Reporting List";
type Sheet = { title: string; subtitle: string; type: Tab; teamId?: string; categoryId?: string; programId?: string };

export function PrintoutsSection({ fest, user, notify }: SectionProps) {
  const data = fest.data; const manager = user.role === "TEAM MANAGER"; const monitor = user.role === "MONITOR"; const [tab, setTab] = useState<Tab>(monitor ? "Reporting List" : "Team");
  const [categoryId, setCategoryId] = useState<string | null>(null); const [sheet, setSheet] = useState<Sheet | null>(null); const [query, setQuery] = useState(""); const [preview, setPreview] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null); const previewRef = useRef<HTMLDivElement>(null);
  const goBack = () => { if (sheet) { setSheet(null); setPreview(false); } else if (categoryId) setCategoryId(null); };
  const makeSheet = (next: Sheet) => { setSheet(next); setPreview(false); };
  const download = async () => {
    const node = previewRef.current || sheetRef.current;
    if (!node || !sheet) return;
    try { await downloadNodePdf(node, `festize-${sheet.type.toLowerCase().replace(/\s+/g, "-")}-${sheet.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`); notify("PDF downloaded"); setPreview(false); }
    catch { notify("PDF export failed. Try again after images have loaded."); }
  };
  const visiblePrograms = data.programs.filter(program => !manager || program.entries.some(entry => entry.teamId === user.teamId));
  const reportingCategories = [...data.categories.map(category => ({ id: category.id, name: category.name })), { id: "group-special", name: "Group programs" }];

  const renderSheet = () => {
    if (!sheet) return null;
    if (sheet.type === "Team") {
      const members = data.members.filter(member => member.teamId === sheet.teamId);
      return <><div className="excel-title"><span>FESTIZE / TEAM REGISTER</span><h2>{sheet.title}</h2><p>{fest.name} · {members.length} members</p></div><table className="excel-table"><thead><tr><th>NO.</th><th>MEMBER NAME</th><th>MEMBER CODE</th><th>CATEGORY</th><th>PROGRAMS</th></tr></thead><tbody>{data.categories.flatMap(category => { const group = members.filter(member => member.categoryId === category.id); if (!group.length) return []; return [<tr className="excel-section-row" key={`head-${category.id}`}><td colSpan={5}>{category.name.toUpperCase()}</td></tr>, ...group.map((member, index) => <tr key={member.id}><td>{index + 1}</td><td>{member.name}</td><td>{member.code}</td><td>{category.name}</td><td>{visiblePrograms.filter(program => program.entries.some(entry => entry.memberIds.includes(member.id))).map(program => program.name).join(", ") || "—"}</td></tr>)]; })}{!members.length && <tr><td colSpan={5}>No members in this team.</td></tr>}</tbody></table></>;
    }
    if (sheet.type === "Program") {
      const programs = visiblePrograms.filter(program => program.categoryId === sheet.categoryId);
      return <><div className="excel-title"><span>FESTIZE / PROGRAM REGISTER</span><h2>{sheet.title}</h2><p>{fest.name} · {programs.length} programs {manager ? `· ${getTeamName(data, user.teamId || "")}` : ""}</p></div><table className="excel-table"><thead><tr><th>NO.</th><th>MEMBER / GROUP</th><th>TEAM</th><th>MEMBER CODE</th><th>FORMAT</th></tr></thead><tbody>{programs.flatMap(program => { const entries = manager ? program.entries.filter(entry => entry.teamId === user.teamId) : program.entries; return [<tr key={`head-${program.id}`} className="excel-section-row"><td colSpan={5}>{program.name.toUpperCase()} · {program.format.toUpperCase()}</td></tr>, ...entries.map((entry, index) => <tr key={entry.id}><td>{index + 1}</td><td>{program.format === "Group" ? entry.memberIds.map(memberId => getMemberName(data, memberId)).join(" + ") : getMemberName(data, entry.memberIds[0])}</td><td>{getTeamName(data, entry.teamId)}</td><td>{program.format === "Group" ? "—" : data.members.find(member => member.id === entry.memberIds[0])?.code || "—"}</td><td>{program.format}</td></tr>)]; })}{!programs.length && <tr><td colSpan={5}>No programs in this category.</td></tr>}</tbody></table></>;
    }
    const reportingRows = (program: Program) => program.format === "Group"
      ? program.entries.map(entry => ({ key: entry.id, label: entry.memberIds.map(memberId => getMemberName(data, memberId)).join(" + "), team: getTeamName(data, entry.teamId) }))
      : reportRows(program, data).map(row => ({ key: row.key, label: row.name, team: row.team }));
    const programsForSheet = sheet.programId
      ? data.programs.filter(item => item.id === sheet.programId)
      : data.programs.filter(item => sheet.categoryId === "group-special" ? item.format === "Group" : item.categoryId === sheet.categoryId && item.format !== "Group");
    const single = programsForSheet.length === 1 && Boolean(sheet.programId);
    return <><div className="excel-title"><span>FESTIZE / REPORTING LIST</span><h2>{sheet.title}</h2><p>{fest.name} · {single ? `${getCategoryName(data, programsForSheet[0].categoryId)} · ${programsForSheet[0].format} program` : `${programsForSheet.length} program${programsForSheet.length === 1 ? "" : "s"}`}</p></div><table className="excel-table reporting-table"><thead><tr><th>NO.</th><th>MEMBER / TEAM</th><th>CODE LETTER</th><th>REMARKS</th></tr></thead><tbody>{programsForSheet.flatMap(program => {
      const rows = reportingRows(program);
      return [...(single ? [] : [<tr key={`head-${program.id}`} className="excel-section-row"><td colSpan={4}>{program.name.toUpperCase()} · {program.format.toUpperCase()}</td></tr>]),
        ...rows.map((row, index) => <tr key={row.key}><td>{index + 1}</td><td>{row.label} <span className="excel-team">/ {row.team}</span></td><td></td><td></td></tr>),
        ...(rows.length ? [] : [<tr key={`empty-${program.id}`}><td colSpan={4}>No entries yet.</td></tr>])];
    })}{!programsForSheet.length && <tr><td colSpan={4}>No programs in this category.</td></tr>}</tbody></table></>;
  };

  if (sheet) return <><PageHead back={goBack} eyebrow={`PRINTOUTS / ${sheet.type.toUpperCase()}`} title={sheet.title} description="A clean, column-based register ready for paper." action={<Button variant="secondary" icon={<Download size={17} />} onClick={() => { if (window.confirm("Open a PDF preview for this printout?")) setPreview(true); }}>Download PDF</Button>} /><div ref={sheetRef} className="excel-sheet">{renderSheet()}</div>{preview && <Modal title="PDF preview" subtitle="This is the sheet that will be downloaded." onClose={() => setPreview(false)} wide><div ref={previewRef} className="excel-sheet pdf-preview">{renderSheet()}</div><div className="form-actions"><Button variant="secondary" onClick={() => setPreview(false)}>Back</Button><Button onClick={() => void download()}><Download size={16} /> Confirm download</Button></div></Modal>}</>;
  if (categoryId) {
    const category = data.categories.find(item => item.id === categoryId);
    const programs = data.programs.filter(program => categoryId === "group-special" ? program.format === "Group" : program.categoryId === categoryId && program.format !== "Group");
    const categoryTitle = categoryId === "group-special" ? "Group programs" : category?.name || "Category";
    return <><PageHead back={goBack} eyebrow="PRINTOUTS / REPORTING LIST" title={categoryTitle} description="Download the whole category, or open a single program." action={<Button variant="secondary" icon={<Download size={17} />} disabled={!programs.length} onClick={() => makeSheet({ title: categoryTitle, subtitle: "Reporting List", type: "Reporting List", categoryId })}>Download category</Button>} /><div className="click-list">{programs.map(program => <button key={program.id} onClick={() => makeSheet({ title: program.name, subtitle: getCategoryName(data, program.categoryId), type: "Reporting List", programId: program.id })}><div><span className="eyebrow">{getCategoryName(data, program.categoryId)}</span><h3>{program.name}</h3><p>{program.entries.length} {program.format === "Group" ? "groups" : "candidates"}</p></div><ChevronRight size={19} /></button>)}{!programs.length && <Empty title="No programs here yet" description="Programs in this category will appear as they are created." />}</div></>;
  }
  const indexItems = tab === "Team" ? (manager ? data.teams.filter(team => team.id === user.teamId) : data.teams).map(team => ({ id: team.id, name: team.name, detail: `${data.members.filter(member => member.teamId === team.id).length} members` })) : tab === "Program" ? data.categories.map(category => ({ id: category.id, name: category.name, detail: `${visiblePrograms.filter(program => program.categoryId === category.id).length} programs` })) : reportingCategories.map(category => ({ id: category.id, name: category.name, detail: `${data.programs.filter(program => category.id === "group-special" ? program.format === "Group" : program.categoryId === category.id && program.format !== "Group").length} programs` }));
  return <><PageHead eyebrow="DOCUMENTS / PRINT" title={monitor ? "Reporting List" : "Printouts"} description="Tidy, spreadsheet-style records for the moments that need a paper trail." /><div className="sub-tabs">{((monitor ? ["Reporting List"] : ["Team", "Program", ...(!manager ? ["Reporting List"] : [])]) as Tab[]).map(item => <button key={item} className={tab === item ? "active" : ""} onClick={() => { setTab(item); setQuery(""); }}>{item}</button>)}</div><div className="section-toolbar"><SearchInput value={query} onChange={setQuery} placeholder={`Search ${tab.toLowerCase()}`} /><span className="toolbar-count">{indexItems.length} {tab === "Team" ? "teams" : "categories"}</span></div>{indexItems.length ? <div className="print-index">{indexItems.filter(item => item.name.toLowerCase().includes(query.toLowerCase())).map(item => <button key={item.id} onClick={() => { if (tab === "Reporting List") setCategoryId(item.id); else makeSheet({ title: item.name, subtitle: tab, type: tab, teamId: tab === "Team" ? item.id : undefined, categoryId: tab === "Program" ? item.id : undefined }); }}><span className="print-icon"><FileSpreadsheet size={21} /></span><div><h3>{item.name}</h3><p>{item.detail}</p></div><span>Open sheet <ArrowRight size={17} /></span></button>)}</div> : <Empty title="Nothing to print yet" description="Add teams, categories and programs to make their printouts available." />}</>;
}