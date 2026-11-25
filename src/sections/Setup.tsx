import { useState, type FormEvent } from "react";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import {
  ArrowRight,
  Copy,
  Download,
  Eye,
  EyeOff,
  ImagePlus,
  Plus,
  Upload,
  Users,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  AddButton,
  askToDownload,
  Button,
  Empty,
  Field,
  IconButton,
  Modal,
  PageHead,
  RowActions,
  SearchInput,
  useViewPref,
  ViewToggle,
} from "../ui";
import {
  getCategoryName,
  getTeamName,
  id,
  memberCode,
  randomPassword,
  type Category,
  type GradeRange,
  type GradeScale,
  type Member,
  type Role,
  type Stage,
  type Team,
  type UserRecord,
} from "../types";
import {
  canAdd,
  canManage,
  confirmDelete,
  isTeamManager,
  limitMessage,
  readImage,
  type SectionProps,
} from "./common";

/** Multi-word, case-insensitive search. */
const matches = (query: string, ...values: Array<string | undefined>) => {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const haystack = values.filter(Boolean).join(" ").toLowerCase();
  return terms.every((term) => haystack.includes(term));
};

const VIEW_SWAP = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.18 },
} as const;

/* ============================================================================
   01. TEAMS SECTION
   ============================================================================ */
export function TeamsSection({ fest, user, onChange, notify }: SectionProps) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Team | null>(null);
  const [viewing, setViewing] = useState<Team | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const data = fest.data;

  const save = (event: FormEvent) => {
    event.preventDefault();
    const value = name.trim();
    if (!value) return notify("Enter a team name.");
    if (!editing && !canAdd(fest, "teams")) return notify(limitMessage("teams"));
    if (data.teams.some((team) => team.name.toLowerCase() === value.toLowerCase() && team.id !== editing?.id)) {
      return notify("A team with this name already exists.");
    }
    onChange(
      (next) => ({
        ...next,
        teams: editing
          ? next.teams.map((team) => (team.id === editing.id ? { ...team, name: value } : team))
          : [...next.teams, { id: id(), name: value, createdBy: user.id }],
      }),
      `${editing ? "Updated" : "Added"} team ${value}`
    );
    setOpen(false);
    setEditing(null);
    setName("");
    notify("Team saved");
  };

  const remove = (team: Team) => {
    if (data.members.some((member) => member.teamId === team.id)) {
      return notify("Move or remove this team's members before deleting it.");
    }
    if (data.programs.some((program) => program.entries.some((entry) => entry.teamId === team.id))) {
      return notify("Remove this team's program entries before deleting it.");
    }
    if (data.users.some((staff) => staff.role === "TEAM MANAGER" && staff.teamId === team.id)) {
      return notify("Reassign or remove the Team Manager assigned to this team first.");
    }
    if (!confirmDelete(team.name)) return;
    onChange(
      (next) => ({ ...next, teams: next.teams.filter((item) => item.id !== team.id) }),
      `Deleted team ${team.name}`
    );
    notify("Team deleted");
  };

  const [entryFilter, setEntryFilter] = useState("");
  const [view, setView] = useViewPref(`teams:${fest.id}:${user.id}`);
  const teamEntries = (teamId: string) =>
    data.programs.filter((program) => program.entries.some((entry) => entry.teamId === teamId)).length;
  const filteredTeams = data.teams.filter(
    (team) =>
      matches(query, team.name) &&
      (entryFilter === "" || (entryFilter === "with") === (teamEntries(team.id) > 0))
  );

  const openAdd = () => {
    setEditing(null);
    setName("");
    setOpen(true);
  };

  return (
    <MotionConfig reducedMotion="user">
      <PageHead
        eyebrow="SETUP / 01"
        title="Teams"
        description="Give every participant a place to belong."
        action={<AddButton onClick={openAdd}>Add team</AddButton>}
      />
      <div className="section-toolbar">
        <SearchInput value={query} onChange={setQuery} placeholder="Search teams" />
        <ViewToggle mode={view} onChange={setView} />
        <select
          aria-label="Filter by program entries"
          value={entryFilter}
          onChange={(event) => setEntryFilter(event.target.value)}
        >
          <option value="">All teams</option>
          <option value="with">With program entries</option>
          <option value="none">No program entries</option>
        </select>
        <span className="toolbar-count">
          {filteredTeams.length} {filteredTeams.length === 1 ? "team" : "teams"}
        </span>
      </div>

      {filteredTeams.length ? (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={view} {...VIEW_SWAP}>
            {view === "box" ? (
              <div className="card-grid">
                <AnimatePresence initial={false}>
                  {filteredTeams.map((team) => {
                    const memberTotal = data.members.filter((member) => member.teamId === team.id).length;
                    const entered = teamEntries(team.id);
                    return (
                      <motion.div
                        className="mini-card"
                        key={team.id}
                        layout
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ duration: 0.18 }}
                      >
                        <div className="mini-card-head">
                          <div className="mini-card-title">
                            <strong>{team.name}</strong>
                            <small>
                              {memberTotal} {memberTotal === 1 ? "member" : "members"}
                            </small>
                          </div>
                        </div>
                        <div className="mini-card-meta">
                          <span>
                            {entered} {entered === 1 ? "program" : "programs"} entered
                          </span>
                          <span>
                            {data.programs.length
                              ? `${Math.round((entered / Math.max(1, data.programs.length)) * 100)}% of programs`
                              : "—"}
                          </span>
                        </div>
                        <div className="mini-card-actions">
                          <RowActions
                            onView={() => setViewing(team)}
                            onEdit={() => {
                              setEditing(team);
                              setName(team.name);
                              setOpen(true);
                            }}
                            onDelete={() => remove(team)}
                          />
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>TEAM NAME</th>
                      <th>MEMBERS</th>
                      <th>POINTS OF PRIDE</th>
                      <th className="align-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTeams.map((team) => (
                      <tr key={team.id}>
                        <td>
                          <strong>{team.name}</strong>
                        </td>
                        <td className="mono">{data.members.filter((member) => member.teamId === team.id).length}</td>
                        <td>{teamEntries(team.id)} programs entered</td>
                        <td className="align-right">
                          <RowActions
                            onView={() => setViewing(team)}
                            onEdit={() => {
                              setEditing(team);
                              setName(team.name);
                              setOpen(true);
                            }}
                            onDelete={() => remove(team)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      ) : (
        <Empty
          title={data.teams.length ? "No matching teams" : "No teams yet"}
          description={
            data.teams.length
              ? "Try clearing the search or entry filter."
              : "Create your first team to start building the lineup."
          }
          action={!data.teams.length ? <AddButton onClick={openAdd}>Add team</AddButton> : undefined}
        />
      )}

      <AnimatePresence>
        {open && (
          <Modal key="team-form" title={editing ? "Edit team" : "Add a team"} onClose={() => setOpen(false)}>
            <form className="form-stack" onSubmit={save}>
              <Field label="Team name">
                <input
                  autoFocus
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. North House"
                />
              </Field>
              <div className="form-actions">
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Confirm <ArrowRight size={16} />
                </Button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewing && (
          <Modal key="team-view" title={viewing.name} subtitle="Team details" onClose={() => setViewing(null)}>
            <div className="detail-list">
              <div>
                <span>Members</span>
                <strong>{data.members.filter((member) => member.teamId === viewing.id).length}</strong>
              </div>
              <div>
                <span>Program entries</span>
                <strong>
                  {data.programs.flatMap((program) => program.entries).filter((entry) => entry.teamId === viewing.id).length}
                </strong>
              </div>
              <div>
                <span>Team managers</span>
                <strong>
                  {data.users
                    .filter((staff) => staff.role === "TEAM MANAGER" && staff.teamId === viewing.id)
                    .map((staff) => staff.name)
                    .join(", ") || "None assigned"}
                </strong>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}

/* ============================================================================
   02. CATEGORIES SECTION
   ============================================================================ */
export function CategoriesSection({ fest, user, onChange, notify }: SectionProps) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Category | null>(null);
  const [viewing, setViewing] = useState<Category | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<Category["type"]>("REGULAR");
  const data = fest.data;

  const save = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return notify("Enter a category name.");
    if (!editing && !canAdd(fest, "categories")) return notify(limitMessage("categories"));
    if (
      data.categories.some(
        (category) => category.name.toLowerCase() === trimmed.toLowerCase() && category.id !== editing?.id
      )
    ) {
      return notify("That category already exists.");
    }
    onChange(
      (next) => ({
        ...next,
        categories: editing
          ? next.categories.map((category) =>
              category.id === editing.id ? { ...category, name: trimmed, type } : category
            )
          : [...next.categories, { id: id(), name: trimmed, type, createdBy: user.id }],
      }),
      `${editing ? "Updated" : "Added"} category ${trimmed}`
    );
    setOpen(false);
    setEditing(null);
    setName("");
    notify("Category saved");
  };

  const remove = (category: Category) => {
    if (
      data.members.some((member) => member.categoryId === category.id) ||
      data.programs.some((program) => program.categoryId === category.id)
    ) {
      return notify("This category is in use. Remove its members and programs first.");
    }
    if (!confirmDelete(category.name)) return;
    onChange(
      (next) => ({ ...next, categories: next.categories.filter((item) => item.id !== category.id) }),
      `Deleted category ${category.name}`
    );
    notify("Category deleted");
  };

  const [typeFilter, setTypeFilter] = useState("");
  const [view, setView] = useViewPref(`categories:${fest.id}:${user.id}`);
  const filteredCategories = data.categories.filter(
    (item) => matches(query, item.name, item.type) && (!typeFilter || item.type === typeFilter)
  );

  const openAdd = () => {
    setEditing(null);
    setName("");
    setType("REGULAR");
    setOpen(true);
  };

  return (
    <MotionConfig reducedMotion="user">
      <PageHead
        eyebrow="SETUP / 02"
        title="Categories"
        description="Set the divisions your fest will celebrate."
        action={<AddButton onClick={openAdd}>Add category</AddButton>}
      />
      <div className="section-toolbar">
        <SearchInput value={query} onChange={setQuery} placeholder="Search categories" />
        <ViewToggle mode={view} onChange={setView} />
        <select aria-label="Filter by type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
          <option value="">All types</option>
          <option value="REGULAR">Regular</option>
          <option value="GENERAL">General</option>
        </select>
        <span className="toolbar-count">
          {filteredCategories.length} {filteredCategories.length === 1 ? "category" : "categories"}
        </span>
      </div>

      {filteredCategories.length ? (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={view} {...VIEW_SWAP}>
            {view === "box" ? (
              <div className="card-grid">
                <AnimatePresence initial={false}>
                  {filteredCategories.map((category) => (
                    <motion.div
                      className="mini-card"
                      key={category.id}
                      layout
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ duration: 0.18 }}
                    >
                      <div className="mini-card-head">
                        <div className="mini-card-title">
                          <strong>{category.name}</strong>
                          <small>{category.type === "GENERAL" ? "Open to every category" : "Regular division"}</small>
                        </div>
                        <span className="soft-tag">{category.type === "GENERAL" ? "General" : "Regular"}</span>
                      </div>
                      <div className="mini-card-meta">
                        <span>{data.members.filter((member) => member.categoryId === category.id).length} members</span>
                        <span>{data.programs.filter((program) => program.categoryId === category.id).length} programs</span>
                      </div>
                      <div className="mini-card-actions">
                        <RowActions
                          onView={() => setViewing(category)}
                          onEdit={() => {
                            setEditing(category);
                            setName(category.name);
                            setType(category.type);
                            setOpen(true);
                          }}
                          onDelete={() => remove(category)}
                        />
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>CATEGORY</th>
                      <th>TYPE</th>
                      <th>MEMBERS</th>
                      <th>PROGRAMS</th>
                      <th className="align-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCategories.map((category) => (
                      <tr key={category.id}>
                        <td>
                          <strong>{category.name}</strong>
                        </td>
                        <td>
                          <span className="soft-tag">{category.type === "GENERAL" ? "General · all members" : "Regular"}</span>
                        </td>
                        <td className="mono">{data.members.filter((member) => member.categoryId === category.id).length}</td>
                        <td className="mono">{data.programs.filter((program) => program.categoryId === category.id).length}</td>
                        <td className="align-right">
                          <RowActions
                            onView={() => setViewing(category)}
                            onEdit={() => {
                              setEditing(category);
                              setName(category.name);
                              setType(category.type);
                              setOpen(true);
                            }}
                            onDelete={() => remove(category)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      ) : (
        <Empty
          title={data.categories.length ? "No matching categories" : "No categories yet"}
          description={
            data.categories.length
              ? "Try clearing the search or type filter."
              : "Start with a category to organize your members and programs."
          }
          action={!data.categories.length ? <AddButton onClick={openAdd}>Add category</AddButton> : undefined}
        />
      )}

      <AnimatePresence>
        {open && (
          <Modal key="cat-form" title={editing ? "Edit category" : "Add a category"} onClose={() => setOpen(false)}>
            <form className="form-stack" onSubmit={save}>
              <Field label="Category name">
                <input
                  autoFocus
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Junior"
                />
              </Field>
              <Field label="Category type">
                <select value={type} onChange={(event) => setType(event.target.value as Category["type"])}>
                  <option value="REGULAR">Regular</option>
                  <option value="GENERAL">General (members from any category)</option>
                </select>
              </Field>
              <div className="form-actions">
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Confirm <ArrowRight size={16} />
                </Button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewing && (
          <Modal
            key="cat-view"
            title={viewing.name}
            subtitle={viewing.type === "GENERAL" ? "General category" : "Regular category"}
            onClose={() => setViewing(null)}
          >
            <p className="muted">
              {viewing.type === "GENERAL"
                ? "Programs in this category can welcome members from any category."
                : "Programs here are open to members in this category only."}
            </p>
          </Modal>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}

/* ============================================================================
   03. MEMBERS SECTION
   ============================================================================ */
const blankMember = { name: "", categoryId: "", teamId: "", mobile: "", place: "", photo: "", photoZoom: 1 };

export function MembersSection({ fest, user, onChange, onProvision, notify }: SectionProps) {
  const data = fest.data;
  const manager = isTeamManager(user);
  const visible = manager ? data.members.filter((member) => member.teamId === user.teamId) : data.members;
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [view, setView] = useViewPref(`members:${fest.id}:${user.id}`);
  const filtered = visible.filter(
    (member) =>
      (!categoryFilter || member.categoryId === categoryFilter) &&
      (!teamFilter || member.teamId === teamFilter) &&
      matches(query, member.name, member.code, member.place, getTeamName(data, member.teamId))
  );
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [viewing, setViewing] = useState<Member | null>(null);
  const [form, setForm] = useState(blankMember);
  const [bulkRows, setBulkRows] = useState<Record<string, string>[]>([]);
  const [bulkAddOpen, setBulkAddOpen] = useState(false);
  const [bulkAddCategoryId, setBulkAddCategoryId] = useState("");
  const [bulkAddTeamId, setBulkAddTeamId] = useState("");
  const [bulkAddRows, setBulkAddRows] = useState<{ name: string; mobile: string; place: string }[]>([
    { name: "", mobile: "", place: "" },
  ]);

  const startAdd = () => {
    if (!data.categories.length || !data.teams.length) {
      return notify(!data.categories.length ? "Add a category first." : "Add a team first.");
    }
    setEditing(null);
    setForm({
      ...blankMember,
      categoryId: data.categories[0]?.id || "",
      teamId: manager ? user.teamId || "" : data.teams[0]?.id || "",
    });
    setOpen(true);
  };

  const startBulkAdd = () => {
    if (!data.categories.length || !data.teams.length) {
      return notify(!data.categories.length ? "Add a category first." : "Add a team first.");
    }
    setBulkAddCategoryId(data.categories[0]?.id || "");
    setBulkAddTeamId(manager ? user.teamId || "" : data.teams[0]?.id || "");
    setBulkAddRows([{ name: "", mobile: "", place: "" }]);
    setBulkAddOpen(true);
  };

  const updateBulkAddRow = (index: number, field: "name" | "mobile" | "place", value: string) => {
    setBulkAddRows((previous) => previous.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)));
  };

  const confirmBulkAdd = (event: FormEvent) => {
    event.preventDefault();
    if (!bulkAddCategoryId || !bulkAddTeamId) return notify("Select a category and a team first.");
    if (manager && bulkAddTeamId !== user.teamId) return notify("You can only add members to your team.");
    const entered = bulkAddRows
      .map((row) => ({ name: row.name.trim(), mobile: row.mobile.trim(), place: row.place.trim() }))
      .filter((row) => row.name || row.mobile || row.place);
    if (!entered.length) return notify("Add at least one member name.");
    if (entered.some((row) => !row.name)) {
      return notify("Every filled row needs a member name. Remove empty rows or complete them.");
    }
    const available = fest.demo ? Math.max(0, 20 - data.members.length) : Infinity;
    if (entered.length > available) {
      return notify(
        `Explore mode can hold ${available} more member${available === 1 ? "" : "s"}. Remove ${entered.length - available} row${
          entered.length - available === 1 ? "" : "s"
        } or create a full fest.`
      );
    }
    const created: Member[] = entered.map((row) => ({
      id: id(),
      name: row.name,
      categoryId: bulkAddCategoryId,
      teamId: bulkAddTeamId,
      code: memberCode(),
      mobile: row.mobile,
      place: row.place,
      createdBy: user.id,
    }));
    onChange((next) => ({ ...next, members: [...next.members, ...created] }), `Bulk added ${created.length} members`);
    created.forEach((member) => {
      void onProvision({
        id: member.id,
        name: member.name,
        password: member.code,
        role: "MEMBER",
        memberId: member.id,
        teamId: member.teamId,
      });
    });
    setBulkAddOpen(false);
    setBulkAddRows([{ name: "", mobile: "", place: "" }]);
    notify(`${created.length} member${created.length === 1 ? "" : "s"} added`);
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || !form.categoryId || !form.teamId) return notify("Name, category and team are required.");
    if (manager && form.teamId !== user.teamId) return notify("You can only add members to your team.");
    if (!editing && !canAdd(fest, "members")) return notify(limitMessage("members"));
    const member: Member = {
      id: editing?.id || id(),
      name: form.name.trim(),
      teamId: form.teamId,
      categoryId: form.categoryId,
      code: editing?.code || memberCode(),
      mobile: form.mobile.trim(),
      place: form.place.trim(),
      photo: form.photo || undefined,
      photoZoom: form.photoZoom,
      createdBy: editing?.createdBy || user.id,
    };
    onChange(
      (next) => ({
        ...next,
        members: editing ? next.members.map((item) => (item.id === editing.id ? member : item)) : [...next.members, member],
      }),
      `${editing ? "Updated" : "Added"} member ${member.name}`
    );
    void onProvision(
      { id: member.id, name: member.name, password: member.code, role: "MEMBER", memberId: member.id, teamId: member.teamId },
      editing ? "update" : "create"
    );
    setOpen(false);
    setEditing(null);
    notify(`${member.name} ${editing ? "updated" : "added"}`);
  };

  const remove = (member: Member) => {
    if (data.programs.some((program) => program.entries.some((entry) => entry.memberIds.includes(member.id)))) {
      return notify("Remove this member from their programs before deleting.");
    }
    if (!confirmDelete(member.name)) return;
    onChange(
      (next) => ({ ...next, members: next.members.filter((item) => item.id !== member.id) }),
      `Deleted member ${member.name}`
    );
    notify("Member deleted");
    void onProvision(
      { id: member.id, name: member.name, password: "", role: "MEMBER", memberId: member.id, teamId: member.teamId },
      "revoke"
    );
  };

  const handlePhoto = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return notify("Choose an image file.");
    try {
      const photo = await readImage(file);
      setForm((previous) => ({ ...previous, photo, photoZoom: 1 }));
    } catch {
      notify("Could not read that image. Please try another file.");
    }
  };

  const parseSheet = async (file?: File) => {
    if (!file) return;
    try {
      const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const firstName = book.SheetNames[0];
      if (!firstName) return notify("That spreadsheet has no worksheets.");
      const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(book.Sheets[firstName], { defval: "" });
      setBulkRows(
        rows.map((row) =>
          Object.fromEntries(Object.entries(row).map(([key, value]) => [key.toLowerCase().trim(), String(value).trim()]))
        )
      );
      notify(`${rows.length} spreadsheet rows ready to review`);
    } catch {
      notify("Could not read that spreadsheet. Try an .xlsx or .csv file.");
    }
  };

  const importRows = () => {
    const available = fest.demo ? Math.max(0, 20 - data.members.length) : Infinity;
    const seen = new Set(data.members.map((member) => member.name.toLowerCase()));
    const valid: Member[] = bulkRows.slice(0, available).flatMap((row) => {
      const category = data.categories.find((item) => item.name.toLowerCase() === (row.category || "").toLowerCase());
      const team = manager
        ? data.teams.find((item) => item.id === user.teamId)
        : data.teams.find((item) => item.name.toLowerCase() === (row.team || "").toLowerCase());
      if (
        !row.name ||
        !category ||
        !team ||
        seen.has(row.name.toLowerCase()) ||
        data.users.some((staff) => staff.name.toLowerCase() === row.name.toLowerCase()) ||
        fest.mainUsers.some((staff) => staff.name.toLowerCase() === row.name.toLowerCase())
      ) {
        return [];
      }
      seen.add(row.name.toLowerCase());
      return [
        {
          id: id(),
          name: row.name,
          categoryId: category.id,
          teamId: team.id,
          code: memberCode(),
          mobile: row.mobile || "",
          place: row.place || "",
          createdBy: user.id,
        },
      ];
    });
    if (!valid.length) {
      return notify("No valid rows found. Use Name, Category, Team, Mobile, Place headers and existing category/team names.");
    }
    onChange((next) => ({ ...next, members: [...next.members, ...valid] }), `Imported ${valid.length} members`);
    valid.forEach((member) => {
      void onProvision({
        id: member.id,
        name: member.name,
        password: member.code,
        role: "MEMBER",
        memberId: member.id,
        teamId: member.teamId,
      });
    });
    setBulkOpen(false);
    setBulkRows([]);
    notify(`${valid.length} members imported`);
  };

  const sampleRow = {
    Name: "Sample Member",
    Category: data.categories[0]?.name || "Junior",
    Team: manager
      ? data.teams.find((team) => team.id === user.teamId)?.name || "Your team"
      : data.teams[0]?.name || "North House",
    Mobile: "",
    Place: "",
  };
  const [samplePreview, setSamplePreview] = useState(false);
  const downloadSample = () => {
    if (askToDownload("the sample member sheet (Excel)")) setSamplePreview(true);
  };
  const confirmSample = () => {
    try {
      const sheet = XLSX.utils.json_to_sheet([sampleRow]);
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, "Members");
      XLSX.writeFile(book, "festize-members-template.xlsx");
      setSamplePreview(false);
      notify("Sample sheet downloaded");
    } catch {
      notify("The sample sheet could not be created. Please try again.");
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <PageHead
        eyebrow="SETUP / 03"
        title="Members"
        description={manager ? "The people who make your team." : "Every name behind every moment."}
        action={
          <div className="button-row">
            <Button variant="secondary" icon={<Upload size={17} />} onClick={() => setBulkOpen(true)}>
              Import sheet
            </Button>
            <Button variant="secondary" icon={<Users size={17} />} onClick={startBulkAdd}>
              Add as bulk
            </Button>
            <AddButton onClick={startAdd}>Add member</AddButton>
          </div>
        }
      />
      <div className="section-toolbar">
        <SearchInput value={query} onChange={setQuery} placeholder="Search members or codes" />
        <ViewToggle mode={view} onChange={setView} />
        <select
          aria-label="Filter by category"
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
        >
          <option value="">All categories</option>
          {data.categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        {!manager && (
          <select aria-label="Filter by team" value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)}>
            <option value="">All teams</option>
            {data.teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        )}
        <span className="toolbar-count">
          {filtered.length} {filtered.length === 1 ? "member" : "members"}
        </span>
      </div>

      {filtered.length ? (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={view} {...VIEW_SWAP}>
            {view === "box" ? (
              <div className="card-grid">
                <AnimatePresence initial={false}>
                  {filtered.map((member) => (
                    <motion.div
                      className="mini-card"
                      key={member.id}
                      layout
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ duration: 0.18 }}
                    >
                      <div className="mini-card-head">
                        <div className="person-cell">
                          <div className="person-avatar sm">
                            {member.photo ? <img src={member.photo} alt="" /> : member.name.slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <strong>{member.name}</strong>
                            <small className="mono">{member.code}</small>
                          </div>
                        </div>
                      </div>
                      <div className="mini-card-meta">
                        <span className="soft-tag">{getCategoryName(data, member.categoryId)}</span>
                        <span>{getTeamName(data, member.teamId)}</span>
                        <span>
                          {data.programs.filter((program) => program.entries.some((entry) => entry.memberIds.includes(member.id))).length}{" "}
                          programs
                        </span>
                      </div>
                      <div className="mini-card-actions">
                        <RowActions
                          onView={() => setViewing(member)}
                          onEdit={() => {
                            setEditing(member);
                            setForm({
                              ...blankMember,
                              ...member,
                              mobile: member.mobile || "",
                              place: member.place || "",
                              photo: member.photo || "",
                              photoZoom: member.photoZoom || 1,
                            });
                            setOpen(true);
                          }}
                          onDelete={() => remove(member)}
                        />
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>MEMBER</th>
                      <th>CATEGORY</th>
                      <th>TEAM</th>
                      <th>PROGRAMS</th>
                      <th className="align-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((member) => (
                      <tr key={member.id}>
                        <td>
                          <div className="person-cell">
                            <div className="person-avatar">
                              {member.photo ? <img src={member.photo} alt="" /> : member.name.slice(0, 1).toUpperCase()}
                            </div>
                            <div>
                              <strong>{member.name}</strong>
                              <small className="mono">{member.code}</small>
                            </div>
                          </div>
                        </td>
                        <td>{getCategoryName(data, member.categoryId)}</td>
                        <td>{getTeamName(data, member.teamId)}</td>
                        <td className="mono">
                          {data.programs.filter((program) => program.entries.some((entry) => entry.memberIds.includes(member.id))).length}
                        </td>
                        <td className="align-right">
                          <RowActions
                            onView={() => setViewing(member)}
                            onEdit={() => {
                              setEditing(member);
                              setForm({
                                ...blankMember,
                                ...member,
                                mobile: member.mobile || "",
                                place: member.place || "",
                                photo: member.photo || "",
                                photoZoom: member.photoZoom || 1,
                              });
                              setOpen(true);
                            }}
                            onDelete={() => remove(member)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      ) : (
        <Empty
          title={visible.length ? "No matching members" : "No members yet"}
          description={
            visible.length
              ? "Try clearing the search or filters."
              : "Add your first participant, or import a spreadsheet to get started."
          }
          action={!visible.length ? <AddButton onClick={startAdd}>Add member</AddButton> : undefined}
        />
      )}

      <AnimatePresence>
        {open && (
          <Modal
            key="member-form"
            title={editing ? "Edit member" : "Add a member"}
            subtitle="Only the name, category and team are required."
            onClose={() => setOpen(false)}
            wide
          >
            <form className="form-stack" onSubmit={save}>
              <div className="form-grid">
                <Field label="Member name">
                  <input
                    autoFocus
                    required
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    placeholder="Full name"
                  />
                </Field>
                <Field label="Category">
                  <select
                    required
                    value={form.categoryId}
                    onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
                  >
                    <option value="">Select category</option>
                    {data.categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </Field>
                {!manager && (
                  <Field label="Team">
                    <select required value={form.teamId} onChange={(event) => setForm({ ...form, teamId: event.target.value })}>
                      <option value="">Select team</option>
                      {data.teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                <Field label="Mobile number (optional)">
                  <input
                    type="tel"
                    value={form.mobile}
                    onChange={(event) => setForm({ ...form, mobile: event.target.value })}
                    placeholder="Phone number"
                  />
                </Field>
                <Field label="Place (optional)">
                  <input
                    value={form.place}
                    onChange={(event) => setForm({ ...form, place: event.target.value })}
                    placeholder="Hometown or campus"
                  />
                </Field>
              </div>
              <div className="photo-upload-row">
                <label className="photo-pick">
                  <input type="file" accept="image/*" onChange={(event) => void handlePhoto(event.target.files?.[0])} hidden />
                  {form.photo ? (
                    <div
                      className="photo-preview"
                      onWheel={(event) => {
                        event.preventDefault();
                        setForm((previous) => ({
                          ...previous,
                          photoZoom: Math.min(3, Math.max(1, previous.photoZoom + (event.deltaY < 0 ? 0.1 : -0.1))),
                        }));
                      }}
                    >
                      <img src={form.photo} alt="Member preview" style={{ transform: `scale(${form.photoZoom})` }} />
                    </div>
                  ) : (
                    <ImagePlus size={22} />
                  )}
                  <span>{form.photo ? "Change photo · scroll to zoom" : "Add photo (optional)"}</span>
                </label>
                {form.photo && (
                  <button type="button" className="subtle-link" onClick={() => setForm({ ...form, photo: "" })}>
                    Remove photo
                  </button>
                )}
              </div>
              <div className="form-actions">
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Confirm <ArrowRight size={16} />
                </Button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewing && (
          <Modal key="member-view" title={viewing.name} subtitle="Member details" onClose={() => setViewing(null)}>
            <div className="member-detail">
              {viewing.photo && <img src={viewing.photo} alt={viewing.name} />}
              <div className="detail-list">
                <div>
                  <span>Member code / password</span>
                  <strong className="mono">{viewing.code}</strong>
                </div>
                <div>
                  <span>Category</span>
                  <strong>{getCategoryName(data, viewing.categoryId)}</strong>
                </div>
                <div>
                  <span>Team</span>
                  <strong>{getTeamName(data, viewing.teamId)}</strong>
                </div>
                <div>
                  <span>Mobile</span>
                  <strong>{viewing.mobile || "Not provided"}</strong>
                </div>
                <div>
                  <span>Place</span>
                  <strong>{viewing.place || "Not provided"}</strong>
                </div>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>


      <AnimatePresence>
        {bulkAddOpen && (
          <Modal
            key="member-bulk-add"
            title="Add as bulk"
            subtitle="Choose one category and team, then add as many members as you need."
            onClose={() => setBulkAddOpen(false)}
            wide
          >
            <form className="form-stack" onSubmit={confirmBulkAdd}>
              <div className="form-grid">
                <Field label="Category">
                  <select required value={bulkAddCategoryId} onChange={(event) => setBulkAddCategoryId(event.target.value)}>
                    <option value="">Select category</option>
                    {data.categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Team">
                  <select
                    required
                    value={bulkAddTeamId}
                    disabled={manager}
                    onChange={(event) => setBulkAddTeamId(event.target.value)}
                  >
                    <option value="">Select team</option>
                    {data.teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="bulk-member-rows">
                <AnimatePresence initial={false}>
                  {bulkAddRows.map((row, index) => (
                    <motion.div
                      className="bulk-member-row"
                      key={index}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.16 }}
                    >
                      <span className="bulk-row-number">{index + 1}</span>
                      <Field label="Member name">
                        <input
                          autoFocus={index === 0}
                          value={row.name}
                          onChange={(event) => updateBulkAddRow(index, "name", event.target.value)}
                          placeholder="Member name"
                        />
                      </Field>
                      <Field label="Mobile number">
                        <input
                          type="tel"
                          value={row.mobile}
                          onChange={(event) => updateBulkAddRow(index, "mobile", event.target.value)}
                          placeholder="Mobile number"
                        />
                      </Field>
                      <Field label="Place">
                        <input
                          value={row.place}
                          onChange={(event) => updateBulkAddRow(index, "place", event.target.value)}
                          placeholder="Place"
                        />
                      </Field>
                      {bulkAddRows.length > 1 && (
                        <IconButton
                          label={`Remove member row ${index + 1}`}
                          onClick={() =>
                            setBulkAddRows((previous) => previous.filter((_, rowIndex) => rowIndex !== index))
                          }
                        >
                          <X size={16} />
                        </IconButton>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              <button
                type="button"
                className="bulk-add-row-btn"
                onClick={() => setBulkAddRows((previous) => [...previous, { name: "", mobile: "", place: "" }])}
              >
                <Plus size={18} /> Add another member
              </button>

              <div className="form-actions">
                <Button type="button" variant="secondary" onClick={() => setBulkAddOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Save all members <ArrowRight size={16} />
                </Button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {bulkOpen && (
          <Modal
            key="member-import"
            title="Import members from spreadsheet"
            subtitle="Upload an Excel or CSV file containing member details."
            onClose={() => setBulkOpen(false)}
            wide
          >
            <div className="form-stack">
              <div className="import-instructions">
                <p>
                  Your spreadsheet should include headers: <strong>Name</strong>, <strong>Category</strong>,{" "}
                  <strong>Team</strong>, <strong>Mobile</strong>, <strong>Place</strong>.
                </p>
                <Button variant="secondary" icon={<Download size={15} />} onClick={downloadSample}>
                  Download sample template
                </Button>
              </div>
              <Field label="Upload file">
                <input type="file" accept=".xlsx, .csv" onChange={(e) => void parseSheet(e.target.files?.[0])} />
              </Field>
              {bulkRows.length > 0 && (
                <div className="import-preview-count">
                  <p>
                    <strong>{bulkRows.length}</strong> rows detected ready for import.
                  </p>
                </div>
              )}
              <div className="form-actions">
                <Button type="button" variant="secondary" onClick={() => setBulkOpen(false)}>
                  Cancel
                </Button>
                <Button disabled={!bulkRows.length} onClick={importRows}>
                  Import members <ArrowRight size={16} />
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {samplePreview && (
          <Modal
            key="member-sample"
            title="Sample member sheet"
            subtitle="Preview of festize-members-template.xlsx"
            onClose={() => setSamplePreview(false)}
          >
            <div className="form-stack">
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Category</th>
                      <th>Team</th>
                      <th>Mobile</th>
                      <th>Place</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{sampleRow.Name}</td>
                      <td>{sampleRow.Category}</td>
                      <td>{sampleRow.Team}</td>
                      <td>{sampleRow.Mobile || "—"}</td>
                      <td>{sampleRow.Place || "—"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="form-actions">
                <Button type="button" variant="secondary" onClick={() => setSamplePreview(false)}>
                  Cancel
                </Button>
                <Button onClick={confirmSample}>
                  <Download size={16} /> Download Excel
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}

/* ============================================================================
   04. STAGES SECTION
   ============================================================================ */
export function StagesSection({ fest, user, onChange, notify }: SectionProps) {
  const data = fest.data;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Stage | null>(null);
  const [viewing, setViewing] = useState<Stage | null>(null);
  const [name, setName] = useState("");
  const [details, setDetails] = useState("");
  const [view, setView] = useViewPref(`stages:${fest.id}:${user.id}`);

  const filteredStages = data.stages.filter((stage) => matches(query, stage.name, stage.details || ""));

  const save = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return notify("Enter a stage name.");
    if (!editing && !canAdd(fest, "stages")) return notify(limitMessage("stages"));
    if (data.stages.some((stage) => stage.name.toLowerCase() === trimmed.toLowerCase() && stage.id !== editing?.id)) {
      return notify("A stage with this name already exists.");
    }
    const nextStage: Stage = {
      id: editing?.id || id(),
      name: trimmed,
      details: details.trim(),
      image: editing?.image,
      createdBy: editing?.createdBy || user.id,
    };
    onChange(
      (next) => ({
        ...next,
        stages: editing
          ? next.stages.map((item) => (item.id === editing.id ? nextStage : item))
          : [...next.stages, nextStage],
      }),
      `${editing ? "Updated" : "Added"} stage ${trimmed}`
    );
    setOpen(false);
    setEditing(null);
    setName("");
    setDetails("");
    notify("Stage saved");
  };

  const remove = (stage: Stage) => {
    if (data.schedule.some((cell) => cell.stageId === stage.id)) {
      return notify("Remove scheduled programs from this stage before deleting it.");
    }
    if (!confirmDelete(stage.name)) return;
    onChange(
      (next) => ({ ...next, stages: next.stages.filter((item) => item.id !== stage.id) }),
      `Deleted stage ${stage.name}`
    );
    notify("Stage deleted");
  };

  const openAdd = () => {
    setEditing(null);
    setName("");
    setDetails("");
    setOpen(true);
  };

  return (
    <MotionConfig reducedMotion="user">
      <PageHead
        eyebrow="SETUP / 04"
        title="Stages"
        description="Define the venues and performance spaces for your fest."
        action={<AddButton onClick={openAdd}>Add stage</AddButton>}
      />
      <div className="section-toolbar">
        <SearchInput value={query} onChange={setQuery} placeholder="Search stages" />
        <ViewToggle mode={view} onChange={setView} />
        <span className="toolbar-count">
          {filteredStages.length} {filteredStages.length === 1 ? "stage" : "stages"}
        </span>
      </div>

      {filteredStages.length ? (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={view} {...VIEW_SWAP}>
            {view === "box" ? (
              <div className="card-grid">
                <AnimatePresence initial={false}>
                  {filteredStages.map((stage) => (
                    <motion.div
                      className="mini-card"
                      key={stage.id}
                      layout
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ duration: 0.18 }}
                    >
                      <div className="mini-card-head">
                        <div className="mini-card-title">
                          <strong>{stage.name}</strong>
                          <small>{stage.details || "Main performance venue"}</small>
                        </div>
                      </div>
                      <div className="mini-card-meta">
                        <span>{data.schedule.filter((cell) => cell.stageId === stage.id).length} scheduled slots</span>
                      </div>
                      <div className="mini-card-actions">
                        <RowActions
                          onView={() => setViewing(stage)}
                          onEdit={() => {
                            setEditing(stage);
                            setName(stage.name);
                            setDetails(stage.details || "");
                            setOpen(true);
                          }}
                          onDelete={() => remove(stage)}
                        />
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>STAGE NAME</th>
                      <th>LOCATION / DETAILS</th>
                      <th>SCHEDULED EVENTS</th>
                      <th className="align-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStages.map((stage) => (
                      <tr key={stage.id}>
                        <td>
                          <strong>{stage.name}</strong>
                        </td>
                        <td>{stage.details || "—"}</td>
                        <td className="mono">{data.schedule.filter((cell) => cell.stageId === stage.id).length}</td>
                        <td className="align-right">
                          <RowActions
                            onView={() => setViewing(stage)}
                            onEdit={() => {
                              setEditing(stage);
                              setName(stage.name);
                              setDetails(stage.details || "");
                              setOpen(true);
                            }}
                            onDelete={() => remove(stage)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      ) : (
        <Empty
          title={data.stages.length ? "No matching stages" : "No stages yet"}
          description={
            data.stages.length
              ? "Try clearing the search."
              : "Add stages or halls where your programs will take place."
          }
          action={!data.stages.length ? <AddButton onClick={openAdd}>Add stage</AddButton> : undefined}
        />
      )}

      <AnimatePresence>
        {open && (
          <Modal key="stage-form" title={editing ? "Edit stage" : "Add a stage"} onClose={() => setOpen(false)}>
            <form className="form-stack" onSubmit={save}>
              <Field label="Stage name">
                <input
                  autoFocus
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Stage 1 · Main Auditorium"
                />
              </Field>
              <Field label="Location / details (optional)">
                <input
                  value={details}
                  onChange={(event) => setDetails(event.target.value)}
                  placeholder="e.g. Ground Floor, Open Air"
                />
              </Field>
              <div className="form-actions">
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Confirm <ArrowRight size={16} />
                </Button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewing && (
          <Modal key="stage-view" title={viewing.name} subtitle="Stage details" onClose={() => setViewing(null)}>
            <div className="detail-list">
              <div>
                <span>Details</span>
                <strong>{viewing.details || "No extra details"}</strong>
              </div>
              <div>
                <span>Scheduled programs</span>
                <strong>{data.schedule.filter((cell) => cell.stageId === viewing.id).length}</strong>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}

/* ============================================================================
   05. GRADE SCALES SECTION
   ============================================================================ */
const defaultRanges = (): GradeRange[] => [
  { id: id(), name: "A", min: 80, max: 100, points: 5 },
  { id: id(), name: "B", min: 60, max: 79.9, points: 3 },
  { id: id(), name: "C", min: 40, max: 59.9, points: 1 },
];

export function ScalesSection({ fest, user, onChange, notify }: SectionProps) {
  const data = fest.data;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<GradeScale | null>(null);
  const [viewing, setViewing] = useState<GradeScale | null>(null);
  const [name, setName] = useState("");
  const [ranges, setRanges] = useState<GradeRange[]>(defaultRanges);
  const [view, setView] = useViewPref(`scales:${fest.id}:${user.id}`);

  const filteredScales = data.scales.filter((scale) => matches(query, scale.name));

  const startCreate = () => {
    setEditing(null);
    setName("");
    setRanges(defaultRanges());
    setOpen(true);
  };

  const startEdit = (scale: GradeScale) => {
    setEditing(scale);
    setName(scale.name);
    setRanges(scale.ranges.map((r) => ({ ...r })));
    setOpen(true);
  };

  const updateRange = (index: number, patch: Partial<GradeRange>) => {
    setRanges((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return notify("Enter a grade scale name.");
    if (!editing && !canAdd(fest, "scales")) return notify(limitMessage("scales"));
    if (data.scales.some((s) => s.name.toLowerCase() === trimmed.toLowerCase() && s.id !== editing?.id)) {
      return notify("A grade scale with this name already exists.");
    }
    if (!ranges.length) return notify("Add at least one grade band.");
    if (
      ranges.some(
        (r) =>
          !r.name.trim() ||
          !Number.isFinite(r.min) ||
          !Number.isFinite(r.max) ||
          r.min < 0 ||
          r.max > 100 ||
          r.min > r.max
      )
    ) {
      return notify("Check grade names and ensure min/max marks are valid (0–100, min ≤ max).");
    }
    const cleanNames = ranges.map((r) => r.name.trim().toUpperCase());
    if (new Set(cleanNames).size !== cleanNames.length) {
      return notify("Each grade band must have a unique name.");
    }
    // Check for overlapping mark intervals across bands.
    const sorted = [...ranges].sort((a, b) => a.min - b.min);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].min <= sorted[i - 1].max) {
        return notify(
          `Grade bands "${sorted[i - 1].name.trim()}" (${sorted[i - 1].min}–${sorted[i - 1].max}) and "${sorted[i].name.trim()}" (${sorted[i].min}–${sorted[i].max}) overlap.`
        );
      }
    }
    const scale: GradeScale = {
      id: editing?.id || id(),
      name: trimmed,
      ranges: ranges.map((r) => ({
        ...r,
        name: r.name.trim().toUpperCase(),
        points: r.points === null || !Number.isFinite(Number(r.points)) ? null : Math.max(0, Number(r.points)),
      })),
      createdBy: editing?.createdBy || user.id,
    };
    onChange(
      (next) => ({
        ...next,
        scales: editing
          ? next.scales.map((item) => (item.id === editing.id ? scale : item))
          : [...next.scales, scale],
      }),
      `${editing ? "Updated" : "Added"} grade scale ${trimmed}`
    );
    setOpen(false);
    setEditing(null);
    notify("Grade scale saved");
  };

  const remove = (scale: GradeScale) => {
    if (data.programs.some((program) => program.scaleId === scale.id)) {
      return notify("This grade scale is assigned to programs. Reassign them first.");
    }
    if (data.scales.length <= 1) {
      return notify("Keep at least one grade scale in the fest.");
    }
    if (!confirmDelete(scale.name)) return;
    onChange(
      (next) => ({ ...next, scales: next.scales.filter((item) => item.id !== scale.id) }),
      `Deleted scale ${scale.name}`
    );
    notify("Grade scale deleted");
  };

  const formatBandPoints = (pts: number | null) => (pts === null ? "0pt" : `${pts}pt`);

  return (
    <MotionConfig reducedMotion="user">
      <PageHead
        eyebrow="SETUP / 05"
        title="Grade Scales"
        description="Define how judges' marks translate into grades and team points."
        action={<AddButton onClick={startCreate}>Add grade scale</AddButton>}
      />
      <div className="section-toolbar">
        <SearchInput value={query} onChange={setQuery} placeholder="Search grade scales" />
        <ViewToggle mode={view} onChange={setView} />
        <span className="toolbar-count">
          {filteredScales.length} {filteredScales.length === 1 ? "scale" : "scales"}
        </span>
      </div>

      {filteredScales.length ? (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={view} {...VIEW_SWAP}>
            {view === "box" ? (
              <div className="card-grid">
                <AnimatePresence initial={false}>
                  {filteredScales.map((scale) => (
                    <motion.div
                      className="mini-card"
                      key={scale.id}
                      layout
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ duration: 0.18 }}
                    >
                      <div className="mini-card-head">
                        <div className="mini-card-title">
                          <strong>{scale.name}</strong>
                          <small>{scale.ranges.length} grade bands</small>
                        </div>
                      </div>
                      <div className="mini-card-meta">
                        <span>{scale.ranges.map((r) => `${r.name} (${formatBandPoints(r.points)})`).join(" · ")}</span>
                      </div>
                      <div className="mini-card-actions">
                        <RowActions
                          onView={() => setViewing(scale)}
                          onEdit={() => startEdit(scale)}
                          onDelete={() => remove(scale)}
                        />
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>SCALE NAME</th>
                      <th>GRADE BANDS</th>
                      <th>PROGRAMS USING</th>
                      <th className="align-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredScales.map((scale) => (
                      <tr key={scale.id}>
                        <td>
                          <strong>{scale.name}</strong>
                        </td>
                        <td>
                          {scale.ranges
                            .map((r) => `${r.name}: ${r.min}–${r.max} (${r.points ?? 0} pts)`)
                            .join(" · ")}
                        </td>
                        <td className="mono">{data.programs.filter((p) => p.scaleId === scale.id).length}</td>
                        <td className="align-right">
                          <RowActions
                            onView={() => setViewing(scale)}
                            onEdit={() => startEdit(scale)}
                            onDelete={() => remove(scale)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      ) : (
        <Empty
          title={data.scales.length ? "No matching grade scales" : "No grade scales yet"}
          description={
            data.scales.length
              ? "Try clearing the search."
              : "Create a grade scale to convert marks out of 100 into team points."
          }
          action={!data.scales.length ? <AddButton onClick={startCreate}>Add grade scale</AddButton> : undefined}
        />
      )}

      <AnimatePresence>
        {open && (
          <Modal
            key="scale-form"
            title={editing ? "Edit grade scale" : "Create grade scale"}
            onClose={() => setOpen(false)}
            wide
          >
            <form className="form-stack" onSubmit={save}>
              <Field label="Scale name">
                <input
                  autoFocus
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Standard Individual Scale"
                />
              </Field>
              <div className="bulk-member-rows">
                <AnimatePresence initial={false}>
                  {ranges.map((range, index) => (
                    <motion.div
                      className="bulk-member-row grade-range-row"
                      key={range.id}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.16 }}
                    >
                      <span className="bulk-row-number">{index + 1}</span>
                      <Field label="Grade">
                        <input
                          required
                          value={range.name}
                          onChange={(event) => updateRange(index, { name: event.target.value })}
                          placeholder="A"
                        />
                      </Field>
                      <Field label="Min mark">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          required
                          value={range.min}
                          onChange={(event) => updateRange(index, { min: Number(event.target.value) })}
                        />
                      </Field>
                      <Field label="Max mark">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          required
                          value={range.max}
                          onChange={(event) => updateRange(index, { max: Number(event.target.value) })}
                        />
                      </Field>
                      <Field label="Points">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={range.points ?? ""}
                          placeholder="0"
                          onChange={(event) =>
                            updateRange(index, {
                              points: event.target.value === "" ? null : Number(event.target.value),
                            })
                          }
                        />
                      </Field>
                      {ranges.length > 1 && (
                        <IconButton
                          label="Remove grade band"
                          onClick={() => setRanges((prev) => prev.filter((_, i) => i !== index))}
                        >
                          <X size={16} />
                        </IconButton>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
              <button
                type="button"
                className="bulk-add-row-btn"
                onClick={() =>
                  setRanges((prev) => [...prev, { id: id(), name: "", min: 0, max: 39.9, points: 0 }])
                }
              >
                <Plus size={16} /> Add grade band
              </button>
              <div className="form-actions">
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Confirm <ArrowRight size={16} />
                </Button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewing && (
          <Modal key="scale-view" title={viewing.name} subtitle="Grade scale breakdown" onClose={() => setViewing(null)}>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>GRADE</th>
                    <th>MARK RANGE</th>
                    <th>POINTS</th>
                  </tr>
                </thead>
                <tbody>
                  {viewing.ranges.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.name}</strong>
                      </td>
                      <td className="mono">
                        {r.min} – {r.max}
                      </td>
                      <td className="mono">{r.points ?? 0} pts</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}

/* ============================================================================
   06. USERS / ACCESS CONTROL SECTION
   ============================================================================ */
const STAFF_ROLES: Role[] = [
  "JUDGE",
  "STAGE MANAGER",
  "MONITOR",
  "TEAM MANAGER",
  "QUIZ MASTER",
  "MEDIA",
  "PUBLIC RESULT",
];

export function UsersSection({ fest, user, onChange, onProvision, notify }: SectionProps) {
  const data = fest.data;
  const manager = canManage(user);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserRecord | null>(null);
  const [viewing, setViewing] = useState<UserRecord | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("JUDGE");
  const [teamId, setTeamId] = useState("");
  const [password, setPassword] = useState("");
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [view, setView] = useViewPref(`users:${fest.id}:${user.id}`);

  const filteredUsers = data.users.filter(
    (staff) => (!roleFilter || staff.role === roleFilter) && matches(query, staff.name, staff.role)
  );

  const startCreate = () => {
    setEditing(null);
    setName("");
    setRole("JUDGE");
    setTeamId(data.teams[0]?.id || "");
    setPassword(randomPassword());
    setOpen(true);
  };

  const startEdit = (staff: UserRecord) => {
    setEditing(staff);
    setName(staff.name);
    setRole(staff.role);
    setTeamId(staff.teamId || data.teams[0]?.id || "");
    setPassword(staff.password || randomPassword());
    setOpen(true);
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    const pass = password.trim();
    if (!trimmed || !pass) return notify("Username and password are required.");
    if (!editing && !canAdd(fest, "users")) return notify(limitMessage("users"));
    if (role === "TEAM MANAGER") {
      if (!data.teams.length) return notify("Create a team before adding a Team Manager.");
      if (!teamId || !data.teams.some((t) => t.id === teamId)) return notify("Select a valid team for the Team Manager.");
    }
    if (
      data.users.some((staff) => staff.name.toLowerCase() === trimmed.toLowerCase() && staff.id !== editing?.id) ||
      fest.mainUsers.some((staff) => staff.name.toLowerCase() === trimmed.toLowerCase()) ||
      data.members.some((member) => member.name.toLowerCase() === trimmed.toLowerCase())
    ) {
      return notify("An account or member with this username already exists.");
    }

    const record: UserRecord = {
      id: editing?.id || id(),
      name: trimmed,
      role,
      password: pass,
      teamId: role === "TEAM MANAGER" ? teamId : undefined,
      createdBy: editing?.createdBy || user.id,
    };

    onChange((next) => {
      const nextUsers = editing
        ? next.users.map((item) => (item.id === editing.id ? record : item))
        : [...next.users, record];
      const nextPublicCreds =
        role === "PUBLIC RESULT" ? { username: record.name, password: pass } : next.publicResultCredentials;
      return { ...next, users: nextUsers, publicResultCredentials: nextPublicCreds };
    }, `${editing ? "Updated" : "Created"} ${role} account ${trimmed}`);

    void onProvision(
      { id: record.id, name: record.name, password: pass, role: record.role, teamId: record.teamId },
      editing ? "update" : "create"
    );
    setOpen(false);
    setEditing(null);
    notify("Staff account saved");
  };

  const remove = (staff: UserRecord) => {
    const judgingPrograms = data.programs.filter((program) => program.judgeIds.includes(staff.id));
    if (judgingPrograms.some((program) => program.entries.some((entry) => typeof entry.marks[staff.id] === "number"))) {
      return notify(
        `${staff.name} has already submitted marks for ${judgingPrograms[0].name}. Clear or finalise those marks before removing this judge.`
      );
    }
    if (
      judgingPrograms.length > 0 &&
      !window.confirm(
        `${staff.name} is assigned to ${judgingPrograms.length} program${judgingPrograms.length === 1 ? "" : "s"}. Remove them from those panels and delete the account?`
      )
    ) {
      return;
    }
    if (!judgingPrograms.length && !confirmDelete(`${staff.name} (${staff.role})`)) return;
    onChange(
      (next) => ({
        ...next,
        users: next.users.filter((item) => item.id !== staff.id),
        programs: next.programs.map((program) => ({
          ...program,
          judgeIds: program.judgeIds.filter((jId) => jId !== staff.id),
          stageManagerIds: (program.stageManagerIds || []).filter((smId) => smId !== staff.id),
        })),
      }),
      `Removed ${staff.role} ${staff.name}`
    );
    void onProvision({ id: staff.id, name: staff.name, password: "", role: staff.role }, "revoke");
    notify("Staff account removed");
  };

  const copyPass = (text?: string) => {
    if (!text) return notify("Password is hidden after cloud reload. Edit the user to set a new one.");
    void navigator.clipboard?.writeText(text);
    notify("Password copied");
  };

  return (
    <MotionConfig reducedMotion="user">
      <PageHead
        eyebrow="SETUP / 06"
        title="Access Control"
        description="Issue role-based logins for judges, stage managers, monitors, team managers and media."
        action={manager ? <AddButton onClick={startCreate}>Add staff user</AddButton> : undefined}
      />
      <div className="section-toolbar">
        <SearchInput value={query} onChange={setQuery} placeholder="Search staff or roles" />
        <ViewToggle mode={view} onChange={setView} />
        <select aria-label="Filter by role" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
          <option value="">All roles</option>
          {STAFF_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <span className="toolbar-count">
          {filteredUsers.length} {filteredUsers.length === 1 ? "account" : "accounts"}
        </span>
      </div>

      {filteredUsers.length ? (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={view} {...VIEW_SWAP}>
            {view === "box" ? (
              <div className="card-grid">
                <AnimatePresence initial={false}>
                  {filteredUsers.map((staff) => (
                    <motion.div
                      className="mini-card"
                      key={staff.id}
                      layout
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ duration: 0.18 }}
                    >
                      <div className="mini-card-head">
                        <div className="mini-card-title">
                          <strong>{staff.name}</strong>
                          <small>
                            {staff.role === "TEAM MANAGER" ? getTeamName(data, staff.teamId || "") : staff.role}
                          </small>
                        </div>
                        <span className="soft-tag">{staff.role}</span>
                      </div>
                      <div className="mini-card-meta">
                        <span className="mono">
                          Pass:{" "}
                          {staff.password
                            ? revealedIds[staff.id]
                              ? staff.password
                              : "••••••"
                            : "Encrypted"}
                        </span>
                        {staff.password && (
                          <button
                            type="button"
                            className="subtle-link"
                            aria-label={revealedIds[staff.id] ? "Hide password" : "Show password"}
                            onClick={() => setRevealedIds((prev) => ({ ...prev, [staff.id]: !prev[staff.id] }))}
                          >
                            {revealedIds[staff.id] ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                        )}
                        <button
                          type="button"
                          className="subtle-link"
                          aria-label={`Copy password for ${staff.name}`}
                          onClick={() => copyPass(staff.password)}
                        >
                          <Copy size={13} />
                        </button>
                      </div>
                      <div className="mini-card-actions">
                        <RowActions
                          onView={() => setViewing(staff)}
                          onEdit={manager ? () => startEdit(staff) : undefined}
                          onDelete={manager ? () => remove(staff) : undefined}
                        />
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>USERNAME</th>
                      <th>ROLE</th>
                      <th>TEAM / SCOPE</th>
                      <th>PASSWORD</th>
                      <th className="align-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((staff) => (
                      <tr key={staff.id}>
                        <td>
                          <strong>{staff.name}</strong>
                        </td>
                        <td>
                          <span className="soft-tag">{staff.role}</span>
                        </td>
                        <td>{staff.role === "TEAM MANAGER" ? getTeamName(data, staff.teamId || "") : "All festival"}</td>
                        <td>
                          <div className="button-row">
                            <span className="mono">
                              {staff.password
                                ? revealedIds[staff.id]
                                  ? staff.password
                                  : "••••••"
                                : "Hidden"}
                            </span>
                            {staff.password && (
                              <IconButton
                                label={revealedIds[staff.id] ? "Hide password" : "Show password"}
                                onClick={() => setRevealedIds((prev) => ({ ...prev, [staff.id]: !prev[staff.id] }))}
                              >
                                {revealedIds[staff.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                              </IconButton>
                            )}
                            <IconButton label="Copy password" onClick={() => copyPass(staff.password)}>
                              <Copy size={14} />
                            </IconButton>
                          </div>
                        </td>
                        <td className="align-right">
                          <RowActions
                            onView={() => setViewing(staff)}
                            onEdit={manager ? () => startEdit(staff) : undefined}
                            onDelete={manager ? () => remove(staff) : undefined}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      ) : (
        <Empty
          title={data.users.length ? "No matching staff accounts" : "No staff accounts yet"}
          description={
            data.users.length
              ? "Try clearing the search or role filter."
              : "Create accounts for judges, stage managers, monitors, or team managers."
          }
          action={manager && !data.users.length ? <AddButton onClick={startCreate}>Add staff user</AddButton> : undefined}
        />
      )}

      <AnimatePresence>
        {open && (
          <Modal
            key="staff-form"
            title={editing ? "Edit staff user" : "Add staff user"}
            onClose={() => setOpen(false)}
          >
            <form className="form-stack" onSubmit={save}>
              <Field label="Username">
                <input
                  autoFocus
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. JUDGE21"
                />
              </Field>
              <Field label="Role">
                <select
                  value={role}
                  onChange={(event) => {
                    const nextRole = event.target.value as Role;
                    setRole(nextRole);
                    if (nextRole === "TEAM MANAGER" && !teamId) {
                      setTeamId(data.teams[0]?.id || "");
                    }
                  }}
                >
                  {STAFF_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </Field>
              {role === "TEAM MANAGER" && (
                <Field label="Assigned team">
                  <select required value={teamId} onChange={(event) => setTeamId(event.target.value)}>
                    <option value="">Select team</option>
                    {data.teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label="Password">
                <div className="button-row">
                  <input required value={password} onChange={(event) => setPassword(event.target.value)} />
                  <Button type="button" variant="secondary" onClick={() => setPassword(randomPassword())}>
                    Generate
                  </Button>
                </div>
              </Field>
              <div className="form-actions">
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Confirm <ArrowRight size={16} />
                </Button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewing && (
          <Modal key="staff-view" title={viewing.name} subtitle={viewing.role} onClose={() => setViewing(null)}>
            <div className="detail-list">
              <div>
                <span>Role</span>
                <strong>{viewing.role}</strong>
              </div>
              {viewing.role === "TEAM MANAGER" && (
                <div>
                  <span>Team</span>
                  <strong>{getTeamName(data, viewing.teamId || "")}</strong>
                </div>
              )}
              <div>
                <span>Password</span>
                <strong className="mono">{viewing.password || "Hidden after reload (edit to reset)"}</strong>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}

/* Compatibility aliases imported by Workspace.tsx */
export { ScalesSection as GradePointsSection, UsersSection as AccessSection };
