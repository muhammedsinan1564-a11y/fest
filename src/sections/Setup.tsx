import { useState, type FormEvent } from "react";
import { ArrowRight, Copy, Download, Eye, ImagePlus, Plus, Upload, Users, X } from "lucide-react";
import * as XLSX from "xlsx";
import { AddButton, askToDownload, Button, Empty, Field, IconButton, Modal, PageHead, RowActions, SearchInput, useViewPref, ViewToggle } from "../ui";
import { getCategoryName, getTeamName, id, memberCode, randomPassword, type Category, type GradeRange, type GradeScale, type Member, type Role, type Stage, type Team, type UserRecord } from "../types";
import { canAdd, canManage, confirmDelete, isTeamManager, limitMessage, readImage, type SectionProps } from "./common";

const matches = (query: string, ...values: string[]) => values.join(" ").toLowerCase().includes(query.toLowerCase());

export function TeamsSection({ fest, user, onChange, notify }: SectionProps) {
  const [query, setQuery] = useState(""); const [editing, setEditing] = useState<Team | null>(null); const [viewing, setViewing] = useState<Team | null>(null); const [open, setOpen] = useState(false); const [name, setName] = useState("");
  const data = fest.data;
  const save = (event: FormEvent) => {
    event.preventDefault(); const value = name.trim(); if (!value) return;
    if (!editing && !canAdd(fest, "teams")) return notify(limitMessage("teams"));
    if (data.teams.some(team => team.name.toLowerCase() === value.toLowerCase() && team.id !== editing?.id)) return notify("A team with this name already exists.");
    onChange(next => ({ ...next, teams: editing ? next.teams.map(team => team.id === editing.id ? { ...team, name: value } : team) : [...next.teams, { id: id(), name: value, createdBy: user.id }] }), `${editing ? "Updated" : "Added"} team ${value}`);
    setOpen(false); setEditing(null); setName(""); notify("Team saved");
  };
  const remove = (team: Team) => {
    if (data.members.some(member => member.teamId === team.id)) return notify("Move or remove this team's members before deleting it.");
    if (!confirmDelete(team.name)) return;
    onChange(next => ({ ...next, teams: next.teams.filter(item => item.id !== team.id) }), `Deleted team ${team.name}`); notify("Team deleted");
  };
  const [entryFilter, setEntryFilter] = useState(""); const [view, setView] = useViewPref(`teams:${fest.id}:${user.id}`);
  const teamEntries = (teamId: string) => data.programs.filter(program => program.entries.some(entry => entry.teamId === teamId)).length;
  const filteredTeams = data.teams.filter(team => matches(query, team.name) && (entryFilter === "" || (entryFilter === "with") === teamEntries(team.id) > 0));
  return <><PageHead eyebrow="SETUP / 01" title="Teams" description="Give every participant a place to belong." action={<AddButton onClick={() => { setEditing(null); setName(""); setOpen(true); }}>Add team</AddButton>} /><div className="section-toolbar"><SearchInput value={query} onChange={setQuery} placeholder="Search teams" /><ViewToggle mode={view} onChange={setView} /><select aria-label="Filter by program entries" value={entryFilter} onChange={event => setEntryFilter(event.target.value)}><option value="">All teams</option><option value="with">With program entries</option><option value="none">No program entries</option></select><span className="toolbar-count">{filteredTeams.length} teams</span></div>
    {filteredTeams.length ? view === "box"
      ? <div className="card-grid">{filteredTeams.map(team => <div className="mini-card" key={team.id}>
          <div className="mini-card-head"><div className="mini-card-title"><strong>{team.name}</strong><small>{data.members.filter(member => member.teamId === team.id).length} members</small></div></div>
          <div className="mini-card-meta"><span>{teamEntries(team.id)} programs entered</span><span>{data.members.length ? `${Math.round(teamEntries(team.id) / Math.max(1, data.programs.length) * 100)}% of programs` : "—"}</span></div>
          <div className="mini-card-actions"><RowActions onView={() => setViewing(team)} onEdit={() => { setEditing(team); setName(team.name); setOpen(true); }} onDelete={() => remove(team)} /></div>
        </div>)}</div>
      : <div className="table-wrap"><table className="data-table"><thead><tr><th>TEAM NAME</th><th>MEMBERS</th><th>POINTS OF PRIDE</th><th className="align-right">ACTIONS</th></tr></thead><tbody>{filteredTeams.map(team => <tr key={team.id}><td><strong>{team.name}</strong></td><td>{data.members.filter(member => member.teamId === team.id).length}</td><td>{teamEntries(team.id)} programs entered</td><td><RowActions onView={() => setViewing(team)} onEdit={() => { setEditing(team); setName(team.name); setOpen(true); }} onDelete={() => remove(team)} /></td></tr>)}</tbody></table></div>
      : <Empty title="No teams yet" description="Create your first team to start building the lineup." action={<AddButton onClick={() => setOpen(true)}>Add team</AddButton>} />}
    {open && <Modal title={editing ? "Edit team" : "Add a team"} onClose={() => setOpen(false)}><form className="form-stack" onSubmit={save}><Field label="Team name"><input autoFocus required value={name} onChange={event => setName(event.target.value)} placeholder="e.g. North House" /></Field><div className="form-actions"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit">Confirm <ArrowRight size={16} /></Button></div></form></Modal>}
    {viewing && <Modal title={viewing.name} subtitle="Team details" onClose={() => setViewing(null)}><div className="detail-list"><div><span>Members</span><strong>{data.members.filter(member => member.teamId === viewing.id).length}</strong></div><div><span>Program entries</span><strong>{data.programs.flatMap(program => program.entries).filter(entry => entry.teamId === viewing.id).length}</strong></div></div></Modal>}
  </>;
}

export function CategoriesSection({ fest, user, onChange, notify }: SectionProps) {
  const [query, setQuery] = useState(""); const [editing, setEditing] = useState<Category | null>(null); const [viewing, setViewing] = useState<Category | null>(null); const [open, setOpen] = useState(false); const [name, setName] = useState(""); const [type, setType] = useState<Category["type"]>("REGULAR");
  const data = fest.data;
  const save = (event: FormEvent) => {
    event.preventDefault(); if (!name.trim()) return;
    if (!editing && !canAdd(fest, "categories")) return notify(limitMessage("categories"));
    if (data.categories.some(category => category.name.toLowerCase() === name.trim().toLowerCase() && category.id !== editing?.id)) return notify("That category already exists.");
    onChange(next => ({ ...next, categories: editing ? next.categories.map(category => category.id === editing.id ? { ...category, name: name.trim(), type } : category) : [...next.categories, { id: id(), name: name.trim(), type, createdBy: user.id }] }), `${editing ? "Updated" : "Added"} category ${name.trim()}`);
    setOpen(false); setEditing(null); setName(""); notify("Category saved");
  };
  const remove = (category: Category) => {
    if (data.members.some(member => member.categoryId === category.id) || data.programs.some(program => program.categoryId === category.id)) return notify("This category is in use. Remove its members and programs first.");
    if (!confirmDelete(category.name)) return;
    onChange(next => ({ ...next, categories: next.categories.filter(item => item.id !== category.id) }), `Deleted category ${category.name}`); notify("Category deleted");
  };
  const [typeFilter, setTypeFilter] = useState(""); const [view, setView] = useViewPref(`categories:${fest.id}:${user.id}`);
  const filteredCategories = data.categories.filter(item => matches(query, item.name, item.type) && (!typeFilter || item.type === typeFilter));
  return <><PageHead eyebrow="SETUP / 02" title="Categories" description="Set the divisions your fest will celebrate." action={<AddButton onClick={() => { setEditing(null); setName(""); setType("REGULAR"); setOpen(true); }}>Add category</AddButton>} /><div className="section-toolbar"><SearchInput value={query} onChange={setQuery} placeholder="Search categories" /><ViewToggle mode={view} onChange={setView} /><select aria-label="Filter by type" value={typeFilter} onChange={event => setTypeFilter(event.target.value)}><option value="">All types</option><option value="REGULAR">Regular</option><option value="GENERAL">General</option></select><span className="toolbar-count">{filteredCategories.length} categories</span></div>
    {filteredCategories.length ? view === "box"
      ? <div className="card-grid">{filteredCategories.map(category => <div className="mini-card" key={category.id}>
          <div className="mini-card-head"><div className="mini-card-title"><strong>{category.name}</strong><small>{category.type === "GENERAL" ? "Open to every category" : "Regular division"}</small></div><span className="soft-tag">{category.type === "GENERAL" ? "General" : "Regular"}</span></div>
          <div className="mini-card-meta"><span>{data.members.filter(member => member.categoryId === category.id).length} members</span><span>{data.programs.filter(program => program.categoryId === category.id).length} programs</span></div>
          <div className="mini-card-actions"><RowActions onView={() => setViewing(category)} onEdit={() => { setEditing(category); setName(category.name); setType(category.type); setOpen(true); }} onDelete={() => remove(category)} /></div>
        </div>)}</div>
      : <div className="table-wrap"><table className="data-table"><thead><tr><th>CATEGORY</th><th>TYPE</th><th>MEMBERS</th><th>PROGRAMS</th><th className="align-right">ACTIONS</th></tr></thead><tbody>{filteredCategories.map(category => <tr key={category.id}><td><strong>{category.name}</strong></td><td><span className="soft-tag">{category.type === "GENERAL" ? "General · all members" : "Regular"}</span></td><td>{data.members.filter(member => member.categoryId === category.id).length}</td><td>{data.programs.filter(program => program.categoryId === category.id).length}</td><td><RowActions onView={() => setViewing(category)} onEdit={() => { setEditing(category); setName(category.name); setType(category.type); setOpen(true); }} onDelete={() => remove(category)} /></td></tr>)}</tbody></table></div>
      : <Empty title="No categories yet" description="Start with a category to organize your members and programs." action={<AddButton onClick={() => setOpen(true)}>Add category</AddButton>} />}
    {open && <Modal title={editing ? "Edit category" : "Add a category"} onClose={() => setOpen(false)}><form className="form-stack" onSubmit={save}><Field label="Category name"><input autoFocus required value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Junior" /></Field><Field label="Category type"><select value={type} onChange={event => setType(event.target.value as Category["type"])}><option value="REGULAR">Regular</option><option value="GENERAL">General (members from any category)</option></select></Field><div className="form-actions"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit">Confirm <ArrowRight size={16} /></Button></div></form></Modal>}
    {viewing && <Modal title={viewing.name} subtitle={viewing.type === "GENERAL" ? "General category" : "Regular category"} onClose={() => setViewing(null)}><p className="muted">{viewing.type === "GENERAL" ? "Programs in this category can welcome members from any category." : "Programs here are open to members in this category only."}</p></Modal>}
  </>;
}

const blankMember = { name: "", categoryId: "", teamId: "", mobile: "", place: "", photo: "", photoZoom: 1 };
export function MembersSection({ fest, user, onChange, onProvision, notify }: SectionProps) {
  const data = fest.data; const manager = isTeamManager(user);
  const visible = manager ? data.members.filter(member => member.teamId === user.teamId) : data.members;
  const [query, setQuery] = useState(""); const [categoryFilter, setCategoryFilter] = useState(""); const [teamFilter, setTeamFilter] = useState("");
  const [view, setView] = useViewPref(`members:${fest.id}:${user.id}`);
  const filtered = visible.filter(member => (!categoryFilter || member.categoryId === categoryFilter) && (!teamFilter || member.teamId === teamFilter) && matches(query, member.name, member.code));
  const [open, setOpen] = useState(false); const [bulkOpen, setBulkOpen] = useState(false); const [editing, setEditing] = useState<Member | null>(null); const [viewing, setViewing] = useState<Member | null>(null);
  const [form, setForm] = useState(blankMember); const [bulkRows, setBulkRows] = useState<Record<string, string>[]>([]);
  const startAdd = () => { setEditing(null); setForm({ ...blankMember, categoryId: data.categories[0]?.id || "", teamId: manager ? user.teamId || "" : data.teams[0]?.id || "" }); setOpen(true); };
  const save = (event: FormEvent) => {
    event.preventDefault(); if (!form.name.trim() || !form.categoryId || !form.teamId) return notify("Name, category and team are required.");
    if (manager && form.teamId !== user.teamId) return notify("You can only add members to your team.");
    if (!editing && !canAdd(fest, "members")) return notify(limitMessage("members"));
    if ([...data.members, ...data.users, ...fest.mainUsers].some(person => person.name.toLowerCase() === form.name.trim().toLowerCase() && person.id !== editing?.id)) return notify("That login name is already in use. Choose a distinct member name.");
    const member: Member = { id: editing?.id || id(), name: form.name.trim(), teamId: form.teamId, categoryId: form.categoryId, code: editing?.code || memberCode(), mobile: form.mobile.trim(), place: form.place.trim(), photo: form.photo || undefined, photoZoom: form.photoZoom, createdBy: editing?.createdBy || user.id };
    onChange(next => ({ ...next, members: editing ? next.members.map(item => item.id === editing.id ? member : item) : [...next.members, member] }), `${editing ? "Updated" : "Added"} member ${member.name}`);
    void onProvision({ id: member.id, name: member.name, password: member.code, role: "MEMBER", memberId: member.id, teamId: member.teamId }, editing ? "update" : "create");
    setOpen(false); setEditing(null); notify(`${member.name} ${editing ? "updated" : "added"}`);
  };
  const remove = (member: Member) => {
    if (data.programs.some(program => program.entries.some(entry => entry.memberIds.includes(member.id)))) return notify("Remove this member from their programs before deleting.");
    if (!confirmDelete(member.name)) return;
    onChange(next => ({ ...next, members: next.members.filter(item => item.id !== member.id) }), `Deleted member ${member.name}`); notify("Member deleted");
    void onProvision({ id: member.id, name: member.name, password: "", role: "MEMBER", memberId: member.id, teamId: member.teamId }, "revoke");
  };
  const handlePhoto = async (file?: File) => { if (!file) return; if (!file.type.startsWith("image/")) return notify("Choose an image file."); const photo = await readImage(file); setForm(previous => ({ ...previous, photo, photoZoom: 1 })); };
  const parseSheet = async (file?: File) => {
    if (!file) return;
    try {
      const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(book.Sheets[book.SheetNames[0]], { defval: "" });
      setBulkRows(rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key.toLowerCase().trim(), String(value).trim()]))));
      notify(`${rows.length} spreadsheet rows ready to review`);
    } catch { notify("Could not read that spreadsheet. Try an .xlsx or .csv file."); }
  };
  const importRows = () => {
    const available = fest.demo ? Math.max(0, 20 - data.members.length) : Infinity;
    const seen = new Set(data.members.map(member => member.name.toLowerCase()));
    const valid: Member[] = bulkRows.slice(0, available).flatMap(row => {
      const category = data.categories.find(item => item.name.toLowerCase() === (row.category || "").toLowerCase());
      const team = manager ? data.teams.find(item => item.id === user.teamId) : data.teams.find(item => item.name.toLowerCase() === (row.team || "").toLowerCase());
      if (!row.name || !category || !team || seen.has(row.name.toLowerCase()) || data.users.some(staff => staff.name.toLowerCase() === row.name.toLowerCase()) || fest.mainUsers.some(staff => staff.name.toLowerCase() === row.name.toLowerCase())) return [];
      seen.add(row.name.toLowerCase());
      return [{ id: id(), name: row.name, categoryId: category.id, teamId: team.id, code: memberCode(), mobile: row.mobile || "", place: row.place || "", createdBy: user.id }];
    });
    if (!valid.length) return notify("No valid rows found. Use Name, Category, Team, Mobile, Place headers and existing category/team names.");
    onChange(next => ({ ...next, members: [...next.members, ...valid] }), `Imported ${valid.length} members`);
    valid.forEach(member => { void onProvision({ id: member.id, name: member.name, password: member.code, role: "MEMBER", memberId: member.id, teamId: member.teamId }); });
    setBulkOpen(false); setBulkRows([]); notify(`${valid.length} members imported`);
  };
  // Same three steps as every other download: ask, preview, confirm.
  const sampleRow = { Name: "Sample Member", Category: data.categories[0]?.name || "Junior", Team: manager ? data.teams.find(team => team.id === user.teamId)?.name || "Your team" : data.teams[0]?.name || "North House", Mobile: "", Place: "" };
  const [samplePreview, setSamplePreview] = useState(false);
  const downloadSample = () => { if (askToDownload("the sample member sheet (Excel)")) setSamplePreview(true); };
  const confirmSample = () => {
    try {
      const sheet = XLSX.utils.json_to_sheet([sampleRow]);
      const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, "Members"); XLSX.writeFile(book, "festize-members-template.xlsx");
      setSamplePreview(false); notify("Sample sheet downloaded");
    } catch { notify("The sample sheet could not be created. Please try again."); }
  };
  return <><PageHead eyebrow="SETUP / 03" title="Members" description={manager ? "The people who make your team." : "Every name behind every moment."} action={<div className="button-row"><Button variant="secondary" icon={<Upload size={17} />} onClick={() => setBulkOpen(true)}>Import sheet</Button><AddButton onClick={startAdd}>Add member</AddButton></div>} /><div className="section-toolbar"><SearchInput value={query} onChange={setQuery} placeholder="Search members or codes" /><ViewToggle mode={view} onChange={setView} /><select aria-label="Filter by category" value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}><option value="">All categories</option>{data.categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select>{!manager && <select aria-label="Filter by team" value={teamFilter} onChange={event => setTeamFilter(event.target.value)}><option value="">All teams</option>{data.teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select>}<span className="toolbar-count">{filtered.length} members</span></div>
    {filtered.length ? view === "box"
      ? <div className="card-grid">{filtered.map(member => <div className="mini-card" key={member.id}>
          <div className="mini-card-head"><div className="person-avatar sm">{member.photo ? <img src={member.photo} alt="" /> : member.name.slice(0, 1)}</div><div><strong>{member.name}</strong><small>{member.code}</small></div></div>
          <div className="mini-card-meta"><span className="soft-tag">{getCategoryName(data, member.categoryId)}</span><span>{getTeamName(data, member.teamId)}</span><span>{data.programs.filter(program => program.entries.some(entry => entry.memberIds.includes(member.id))).length} programs</span></div>
          <div className="mini-card-actions"><RowActions onView={() => setViewing(member)} onEdit={() => { setEditing(member); setForm({ ...blankMember, ...member, photo: member.photo || "", photoZoom: member.photoZoom || 1 }); setOpen(true); }} onDelete={() => remove(member)} /></div>
        </div>)}</div>
      : <div className="table-wrap"><table className="data-table"><thead><tr><th>MEMBER</th><th>CATEGORY</th><th>TEAM</th><th>PROGRAMS</th><th className="align-right">ACTIONS</th></tr></thead><tbody>{filtered.map(member => <tr key={member.id}><td><div className="person-cell"><div className="person-avatar">{member.photo ? <img src={member.photo} alt="" /> : member.name.slice(0, 1)}</div><div><strong>{member.name}</strong><small>{member.code}</small></div></div></td><td>{getCategoryName(data, member.categoryId)}</td><td>{getTeamName(data, member.teamId)}</td><td>{data.programs.filter(program => program.entries.some(entry => entry.memberIds.includes(member.id))).length}</td><td><RowActions onView={() => setViewing(member)} onEdit={() => { setEditing(member); setForm({ ...blankMember, ...member, photo: member.photo || "", photoZoom: member.photoZoom || 1 }); setOpen(true); }} onDelete={() => remove(member)} /></td></tr>)}</tbody></table></div>
      : <Empty title="No members yet" description="Add your first participant, or import a spreadsheet to get started." action={<AddButton onClick={startAdd}>Add member</AddButton>} />}
    {open && <Modal title={editing ? "Edit member" : "Add a member"} subtitle="Only the name, category and team are required." onClose={() => setOpen(false)} wide><form className="form-stack" onSubmit={save}><div className="form-grid"><Field label="Member name"><input autoFocus required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Full name" /></Field><Field label="Category"><select required value={form.categoryId} onChange={event => setForm({ ...form, categoryId: event.target.value })}><option value="">Select category</option>{data.categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field>{!manager && <Field label="Team"><select required value={form.teamId} onChange={event => setForm({ ...form, teamId: event.target.value })}><option value="">Select team</option>{data.teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select></Field>}<Field label="Mobile number (optional)"><input type="tel" value={form.mobile} onChange={event => setForm({ ...form, mobile: event.target.value })} placeholder="Phone number" /></Field><Field label="Place (optional)"><input value={form.place} onChange={event => setForm({ ...form, place: event.target.value })} placeholder="Hometown or campus" /></Field></div><div className="photo-upload-row"><label className="photo-pick"><input type="file" accept="image/*" onChange={event => void handlePhoto(event.target.files?.[0])} hidden />{form.photo ? <div className="photo-preview" onWheel={event => { event.preventDefault(); setForm(previous => ({ ...previous, photoZoom: Math.min(3, Math.max(1, previous.photoZoom + (event.deltaY < 0 ? .1 : -.1))) })); }}><img src={form.photo} alt="Member preview" style={{ transform: `scale(${form.photoZoom})` }} /></div> : <ImagePlus size={22} />}<span>{form.photo ? "Change photo · scroll to zoom" : "Add photo (optional)"}</span></label>{form.photo && <button type="button" className="subtle-link" onClick={() => setForm({ ...form, photo: "" })}>Remove photo</button>}</div><div className="form-actions"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit">Confirm <ArrowRight size={16} /></Button></div></form></Modal>}
    {viewing && <Modal title={viewing.name} subtitle="Member details" onClose={() => setViewing(null)}><div className="member-detail">{viewing.photo && <img src={viewing.photo} alt={viewing.name} />}<div className="detail-list"><div><span>Member code / password</span><strong>{viewing.code}</strong></div><div><span>Category</span><strong>{getCategoryName(data, viewing.categoryId)}</strong></div><div><span>Team</span><strong>{getTeamName(data, viewing.teamId)}</strong></div><div><span>Mobile</span><strong>{viewing.mobile || "Not provided"}</strong></div><div><span>Place</span><strong>{viewing.place || "Not provided"}</strong></div></div></div></Modal>}
    {bulkOpen && <Modal title="Import members" subtitle="Bring your existing Excel sheet into Festize." onClose={() => { setBulkOpen(false); setBulkRows([]); setSamplePreview(false); }}><div className="form-stack"><p className="muted">Use column headers <strong>Name, Category, Team, Mobile, Place</strong>. Category and team names should already exist. {manager && "All rows will be added to your team."}</p>{samplePreview
      ? <div className="inline-download"><div className="download-preview-meta"><span className="download-format">XLSX</span><span>Preview · this is exactly what will be saved</span></div><div className="excel-sheet"><table className="excel-table"><thead><tr>{Object.keys(sampleRow).map(column => <th key={column}>{column.toUpperCase()}</th>)}</tr></thead><tbody><tr>{Object.values(sampleRow).map((value, index) => <td key={index}>{value || "—"}</td>)}</tr></tbody></table></div><div className="form-actions"><Button variant="secondary" onClick={() => setSamplePreview(false)}>Back</Button><Button onClick={confirmSample}><Download size={16} /> Confirm download</Button></div></div>
      : <Button variant="secondary" icon={<Download size={16} />} onClick={downloadSample}>Download sample sheet</Button>}<Field label="Excel or CSV file"><input type="file" accept=".xlsx,.xls,.csv" onChange={event => void parseSheet(event.target.files?.[0])} /></Field>{bulkRows.length > 0 && <div className="import-preview"><strong>{bulkRows.length} rows found</strong><span>{bulkRows.slice(0, 3).map(row => row.name || "Unnamed").join(" · ")}{bulkRows.length > 3 ? " ..." : ""}</span></div>}<div className="form-actions"><Button variant="secondary" onClick={() => setBulkOpen(false)}>Cancel</Button><Button disabled={!bulkRows.length} onClick={importRows}>Import members <ArrowRight size={16} /></Button></div></div></Modal>}
  </>;
}

const staffRoles: Role[] = ["JUDGE", "MEDIA", "TEAM MANAGER", "MONITOR", "STAGE MANAGER", "PUBLIC RESULT", "QUIZ MASTER"];
export function AccessSection({ fest, user, onChange, onProvision, notify }: SectionProps) {
  const data = fest.data; const [query, setQuery] = useState(""); const [open, setOpen] = useState(false); const [editing, setEditing] = useState<UserRecord | null>(null); const [viewing, setViewing] = useState<UserRecord | null>(null); const [name, setName] = useState(""); const [role, setRole] = useState<Role>("JUDGE"); const [teamId, setTeamId] = useState(""); const [showPassword, setShowPassword] = useState<string | null>(null);
  const save = (event: FormEvent) => {
    event.preventDefault(); if (!name.trim()) return;
    if (!editing && !canAdd(fest, "users")) return notify(limitMessage("users"));
    if ([...data.users, ...fest.mainUsers, ...data.members].some(item => item.name.toLowerCase() === name.trim().toLowerCase() && item.id !== editing?.id)) return notify("That username is already taken.");
    if (role === "TEAM MANAGER" && !teamId) return notify("Select a team for the team manager.");
    const existingPublicPassword = editing?.role === "PUBLIC RESULT" ? data.publicResultCredentials?.password : undefined;
    const staff: UserRecord = { id: editing?.id || id(), name: name.trim(), role, teamId: role === "TEAM MANAGER" ? teamId : undefined, password: editing ? editing.password || existingPublicPassword || "" : randomPassword(), createdBy: user.id };
    onChange(next => ({ ...next, users: editing ? next.users.map(item => item.id === editing.id ? staff : item) : [...next.users, staff], publicResultCredentials: role === "PUBLIC RESULT" && staff.password ? { username: staff.name, password: staff.password } : next.publicResultCredentials }), `${editing ? "Updated" : "Added"} user ${staff.name}`);
    void onProvision(staff, editing ? "update" : "create");
    setOpen(false); setEditing(null); setShowPassword(staff.id); notify("User saved. Share their credentials securely.");
  };
  const remove = (staff: UserRecord) => {
    if (!confirmDelete(staff.name)) return;
    onChange(next => ({ ...next, users: next.users.filter(item => item.id !== staff.id), programs: next.programs.map(program => ({ ...program, judgeIds: program.judgeIds.filter(judgeId => judgeId !== staff.id) })), publicResultCredentials: staff.role === "PUBLIC RESULT" ? undefined : next.publicResultCredentials }), `Deleted user ${staff.name}`); notify("User deleted");
    void onProvision(staff, "revoke");
  };
  return <><PageHead eyebrow="PEOPLE / ACCESS" title="Access Control" description="The right people, the right part of the fest." action={<AddButton onClick={() => { setEditing(null); setName(""); setRole("JUDGE"); setTeamId(""); setOpen(true); }}>Add user</AddButton>} /><div className="section-toolbar"><SearchInput value={query} onChange={setQuery} placeholder="Search users" /><span className="toolbar-count">{data.users.length} staff accounts</span></div>
    {data.users.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>USERNAME</th><th>ROLE</th><th>TEAM</th><th>PASSWORD</th><th className="align-right">ACTIONS</th></tr></thead><tbody>{data.users.filter(item => matches(query, item.name, item.role)).map(staff => <tr key={staff.id}><td><strong>{staff.name}</strong></td><td><span className="soft-tag">{staff.role}</span></td><td>{staff.teamId ? getTeamName(data, staff.teamId) : "—"}</td><td><div className="password-cell"><span>{showPassword === staff.id && staff.password ? staff.password : "••••••••"}</span><button title="Show password" aria-label={`Show password for ${staff.name}`} onClick={() => setShowPassword(showPassword === staff.id ? null : staff.id)}><Eye size={15} /></button><button title="Copy password" aria-label={`Copy password for ${staff.name}`} onClick={() => { if (!staff.password) return notify("Passwords are only shown when created in cloud mode."); void navigator.clipboard.writeText(staff.password); notify("Password copied"); }}><Copy size={15} /></button></div></td><td><RowActions onView={() => setViewing(staff)} onEdit={() => { setEditing(staff); setName(staff.name); setRole(staff.role); setTeamId(staff.teamId || ""); setOpen(true); }} onDelete={() => remove(staff)} /></td></tr>)}</tbody></table></div> : <Empty title="Build your crew" description="Add judges, team managers, monitors and media staff here." action={<AddButton onClick={() => setOpen(true)}>Add user</AddButton>} />}
    {open && <Modal title={editing ? "Edit staff access" : "Add a user"} onClose={() => setOpen(false)}><form className="form-stack" onSubmit={save}><Field label="Username"><input autoFocus required value={name} onChange={event => setName(event.target.value)} placeholder="Name of the user" /></Field><Field label="Role"><select value={role} onChange={event => setRole(event.target.value as Role)}>{staffRoles.map(item => <option key={item} value={item}>{item}</option>)}</select></Field>{role === "TEAM MANAGER" && <Field label="Their team"><select required value={teamId} onChange={event => setTeamId(event.target.value)}><option value="">Select team</option>{data.teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select></Field>}<div className="form-actions"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit">Confirm <ArrowRight size={16} /></Button></div></form></Modal>}
    {viewing && <Modal title={viewing.name} subtitle="User details" onClose={() => setViewing(null)}><div className="detail-list"><div><span>Role</span><strong>{viewing.role}</strong></div>{viewing.teamId && <div><span>Team</span><strong>{getTeamName(data, viewing.teamId)}</strong></div>}<div><span>Assigned programs</span><strong>{data.programs.filter(program => program.judgeIds.includes(viewing.id)).length}</strong></div></div></Modal>}
  </>;
}

function defaultRange(): GradeRange { return { id: id(), name: "", min: 0, max: 100, points: 0 }; }
export function GradePointsSection({ fest, user, onChange, notify }: SectionProps) {
  const data = fest.data; const [query, setQuery] = useState(""); const [open, setOpen] = useState(false); const [editing, setEditing] = useState<GradeScale | null>(null); const [viewing, setViewing] = useState<GradeScale | null>(null); const [name, setName] = useState(""); const [ranges, setRanges] = useState<GradeRange[]>([defaultRange()]);
  const start = (scale?: GradeScale) => { setEditing(scale || null); setName(scale?.name || ""); setRanges(scale ? structuredClone(scale.ranges) : [defaultRange()]); setOpen(true); };
  const updateRange = (rangeId: string, patch: Partial<GradeRange>) => setRanges(previous => previous.map(range => range.id === rangeId ? { ...range, ...patch } : range));
  const save = (event: FormEvent) => {
    event.preventDefault(); if (!name.trim() || !ranges.length || ranges.some(range => !range.name.trim() || range.min < 0 || range.max > 100 || range.min > range.max)) return notify("Add a name and valid 0–100 mark range for every grade.");
    const sorted = [...ranges].sort((a, b) => b.min - a.min);
    if (sorted.some((range, index) => index > 0 && range.max >= sorted[index - 1].min)) return notify("Grade mark ranges cannot overlap.");
    const scale: GradeScale = { id: editing?.id || id(), name: name.trim(), ranges: sorted, createdBy: user.id };
    onChange(next => ({ ...next, scales: editing ? next.scales.map(item => item.id === editing.id ? scale : item) : [...next.scales, scale] }), `${editing ? "Updated" : "Added"} grade scale ${scale.name}`);
    setOpen(false); notify("Grade scale saved");
  };
  const remove = (scale: GradeScale) => {
    if (data.programs.some(program => program.scaleId === scale.id)) return notify("A program uses this scale. Reassign it before deleting.");
    if (!confirmDelete(scale.name)) return;
    onChange(next => ({ ...next, scales: next.scales.filter(item => item.id !== scale.id) }), `Deleted grade scale ${scale.name}`); notify("Grade scale deleted");
  };
  return <><PageHead eyebrow="EVALUATION / SCALES" title="Grade Points" description="Create the grading systems that fit your events." action={<AddButton onClick={() => start()}>Add grade scale</AddButton>} /><div className="section-toolbar"><SearchInput value={query} onChange={setQuery} placeholder="Search grade scales" /><span className="toolbar-count">{data.scales.length} scales</span></div><div className="scale-grid">{data.scales.filter(scale => matches(query, scale.name)).map(scale => <div className="scale-item" key={scale.id}><div className="scale-head"><div><span className="eyebrow">GRADING SYSTEM</span><h3>{scale.name}</h3></div><RowActions onView={() => setViewing(scale)} onEdit={() => start(scale)} onDelete={() => remove(scale)} /></div><div className="scale-ranges">{scale.ranges.map(range => <div key={range.id}><strong>{range.name}</strong><span>{range.min}–{range.max}</span><b>{range.points === null ? "No grade" : `${range.points} pts`}</b></div>)}</div></div>)}</div>
    {open && <Modal title={editing ? "Edit grade scale" : "New grade scale"} subtitle="Marks determine a grade and the points awarded. Ranges cannot overlap." onClose={() => setOpen(false)} wide><form className="form-stack" onSubmit={save}><Field label="Scale name"><input autoFocus required value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Standard 10-point" /></Field><div className="range-heading"><span>GRADE</span><span>MIN MARK</span><span>MAX MARK</span><span>POINTS</span></div>{ranges.map(range => <div className="range-row" key={range.id}><input aria-label="Grade name" required value={range.name} onChange={event => updateRange(range.id, { name: event.target.value })} placeholder="A+" /><input aria-label="Minimum mark" required type="number" min="0" max="100" step="0.01" value={range.min} onChange={event => updateRange(range.id, { min: Number(event.target.value) })} /><input aria-label="Maximum mark" required type="number" min="0" max="100" step="0.01" value={range.max} onChange={event => updateRange(range.id, { max: Number(event.target.value) })} /><input aria-label="Grade points" type="number" min="0" step="0.1" value={range.points ?? ""} placeholder="No grade" onChange={event => updateRange(range.id, { points: event.target.value === "" ? null : Number(event.target.value) })} /><IconButton label="Remove grade" onClick={() => setRanges(ranges.filter(item => item.id !== range.id))}><X size={17} /></IconButton></div>)}<button type="button" className="add-inline" onClick={() => setRanges([...ranges, defaultRange()])}><Plus size={16} /> Add grade</button><div className="form-actions"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit">Save scale <ArrowRight size={16} /></Button></div></form></Modal>}
    {viewing && <Modal title={viewing.name} subtitle="Grade point scale" onClose={() => setViewing(null)}><div className="detail-list">{viewing.ranges.map(range => <div key={range.id}><span>{range.name} · marks {range.min}–{range.max}</span><strong>{range.points === null ? "No grade" : `${range.points} points`}</strong></div>)}</div></Modal>}
  </>;
}

export function StagesSection({ fest, user, onChange, notify }: SectionProps) {
  const data = fest.data; const [query, setQuery] = useState(""); const [open, setOpen] = useState(false); const [editing, setEditing] = useState<Stage | null>(null); const [viewing, setViewing] = useState<Stage | null>(null); const [name, setName] = useState(""); const [details, setDetails] = useState(""); const [image, setImage] = useState("");
  const start = (stage?: Stage) => { setEditing(stage || null); setName(stage?.name || ""); setDetails(stage?.details || ""); setImage(stage?.image || ""); setOpen(true); };
  const save = (event: FormEvent) => {
    event.preventDefault(); if (!name.trim() || !details.trim()) return notify("Add a name and place details for the stage.");
    const stage: Stage = { id: editing?.id || id(), name: name.trim(), details: details.trim(), image: image || undefined, createdBy: user.id };
    onChange(next => ({ ...next, stages: editing ? next.stages.map(item => item.id === editing.id ? stage : item) : [...next.stages, stage] }), `${editing ? "Updated" : "Added"} stage ${stage.name}`);
    setOpen(false); notify("Stage saved");
  };
  const remove = (stage: Stage) => {
    if (!confirmDelete(stage.name)) return;
    onChange(next => ({ ...next, stages: next.stages.filter(item => item.id !== stage.id), schedule: next.schedule.filter(cell => cell.stageId !== stage.id) }), `Deleted stage ${stage.name}`); notify("Stage deleted");
  };
  return <><PageHead eyebrow="LIVE / SPACES" title="Stages" description="Every performance deserves its own place." action={canManage(user) ? <AddButton onClick={() => start()}>Add stage</AddButton> : undefined} /><div className="section-toolbar"><SearchInput value={query} onChange={setQuery} placeholder="Search stages" /><span className="toolbar-count">{data.stages.length} stages</span></div>{data.stages.length ? <div className="stage-list">{data.stages.filter(stage => matches(query, stage.name, stage.details)).map(stage => <div key={stage.id} className="stage-line"><div className="stage-icon"><Users size={21} /></div><div><h3>{stage.name}</h3><p>{stage.details}</p></div><RowActions onView={() => setViewing(stage)} onEdit={canManage(user) ? () => start(stage) : undefined} onDelete={canManage(user) ? () => remove(stage) : undefined} /></div>)}</div> : <Empty title="No stages yet" description="Add a stage or venue to build your schedule." action={canManage(user) ? <AddButton onClick={() => start()}>Add stage</AddButton> : undefined} />}
    {open && <Modal title={editing ? "Edit stage" : "Add a stage"} onClose={() => setOpen(false)}><form className="form-stack" onSubmit={save}><Field label="Stage name"><input required autoFocus value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Main Stage" /></Field><Field label="Place details"><textarea required rows={3} value={details} onChange={event => setDetails(event.target.value)} placeholder="Where can we find it?" /></Field><Field label="Place image (optional)"><input type="file" accept="image/*" onChange={event => { const file = event.target.files?.[0]; if (file) void readImage(file).then(setImage); }} /></Field>{image && <img className="stage-upload-preview" src={image} alt="Stage preview" />}<div className="form-actions"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit">Confirm <ArrowRight size={16} /></Button></div></form></Modal>}
    {viewing && <Modal title={viewing.name} subtitle={viewing.details} onClose={() => setViewing(null)} wide>{viewing.image ? <img className="stage-view-image" src={viewing.image} alt={viewing.name} /> : <p className="muted">No image has been added for this stage.</p>}</Modal>}
  </>;
}