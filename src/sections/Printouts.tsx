import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { ArrowRight, ChevronRight, Download, FileSpreadsheet, Medal, QrCode, Sparkles, Trophy } from "lucide-react";
import QRCode from "qrcode";
import { askToDownload, Button, DownloadPreview, Empty, PageHead, PrintLogo, SearchInput } from "../ui";
import {
  entryGrade,
  entryMark,
  getCategoryName,
  getMemberName,
  getTeamName,
  type FestData,
  type Program,
  type ProgramEntry,
} from "../types";
import { downloadNodePdf, rankedEntries, reportRows, type SectionProps } from "./common";
import { downloadNodePng, fileSlug } from "../lib/exporter";

type Tab = "Team" | "Program" | "Reporting List" | "Public Result" | "Team Register" | "Judging List" | "Awards";
type AwardId = "winner" | "runner" | "secondRunner";

const AWARDS: Array<{ id: AwardId; rank: 1 | 2 | 3; label: string; tagline: string; className: string }> = [
  { id: "winner", rank: 1, label: "Winners", tagline: "Every first place holder", className: "gold" },
  { id: "runner", rank: 2, label: "Runners", tagline: "Every second place holder", className: "silver" },
  { id: "secondRunner", rank: 3, label: "Second Runners", tagline: "Every third place holder", className: "bronze" },
];

function AwardIcon({ kind }: { kind: AwardId }) {
  if (kind === "winner") return <Trophy size={28} />;
  if (kind === "runner") return <Medal size={28} />;
  return <Sparkles size={28} />;
}

interface AwardHolder {
  key: string;
  program: Program;
  entry: ProgramEntry;
  label: string;
  team: string;
  mark: number | null;
  grade: string;
  points: number | null;
}

/** First/second/third place holders inside one category across finalised programs. */
function awardHolders(data: FestData, categoryId: string, rank: 1 | 2 | 3): AwardHolder[] {
  const out: AwardHolder[] = [];
  for (const program of data.programs) {
    if (program.categoryId !== categoryId || program.status < 4) continue;
    const podium = rankedEntries(program, data)
      .filter((entry) => entryMark(entry, program) !== null)
      .slice(0, 3);
    const entry = podium[rank - 1];
    if (!entry) continue;
    const label =
      program.format === "Group"
        ? entry.memberIds.map((memberId) => getMemberName(data, memberId)).join(" + ") || "Unknown group"
        : entry.memberIds.length
        ? getMemberName(data, entry.memberIds[0])
        : "Unknown member";
    const grade = entryGrade(entry, program, data);
    out.push({
      key: `${program.id}-${entry.id}`,
      program,
      entry,
      label,
      team: getTeamName(data, entry.teamId),
      mark: entryMark(entry, program),
      grade: grade?.name ?? "—",
      points: grade?.points ?? null,
    });
  }
  return out;
}
type Sheet = {
  title: string;
  subtitle: string;
  type: Tab;
  teamId?: string;
  categoryId?: string;
  programId?: string;
  /** Programs hand-picked for a whole-section print. Empty = include everything. */
  programIds?: string[];
  /** Awards sheets carry the podium rank they print. */
  awardRank?: 1 | 2 | 3;
  awardLabel?: string;
};

/** Choose which programs a whole-section printout should contain. */
function PrintSelectChips({
  items,
  selected,
  onToggle,
  onAll,
}: {
  items: { id: string; name: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  onAll: () => void;
}) {
  return (
    <div className="print-select-bar">
      <div>
        <span className="eyebrow">SELECT TO PRINT</span>
        <p className="muted small-text">
          Choose what goes into the printed pages — leave empty to print everything.
        </p>
      </div>
      <div className="print-select-chips">
        <button type="button" className={selected.length ? "" : "active"} onClick={onAll}>
          All programs
        </button>
        {items.map((item) => {
          const on = selected.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={on}
              className={on ? "active" : ""}
              onClick={() => onToggle(item.id)}
            >
              {item.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Multi-word, case-insensitive search. */
function matches(query: string, ...fields: string[]) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const haystack = fields.join(" ").toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

const SLIDE = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.2 },
} as const;

export function PrintoutsSection({ fest, user, notify }: SectionProps) {
  const data = fest.data;
  const manager = user.role === "TEAM MANAGER";
  const monitor = user.role === "MONITOR";
  const [tab, setTab] = useState<Tab>(monitor ? "Reporting List" : "Team");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [regTeamId, setRegTeamId] = useState<string | null>(null);
  const [judgeCatId, setJudgeCatId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [query, setQuery] = useState("");
  const [downloadSheet, setDownloadSheet] = useState<Sheet | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [awardId, setAwardId] = useState<AwardId | null>(null);
  const [awardCatId, setAwardCatId] = useState<string | null>(null);
  const [publicQr, setPublicQr] = useState("");
  const [qrError, setQrError] = useState(false);
  const [publicDownload, setPublicDownload] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const publicRef = useRef<HTMLDivElement>(null);

  const goBack = () => {
    if (sheet) setSheet(null);
    else if (categoryId) setCategoryId(null);
    else if (judgeCatId) setJudgeCatId(null);
    else if (regTeamId) setRegTeamId(null);
  };
  const makeSheet = (next: Sheet) => setSheet(next);
  const startDownload = (target: Sheet) => {
    if (askToDownload(`the "${target.title}" ${target.type.toLowerCase()} printout as a PDF`)) {
      setDownloadSheet(target);
    }
  };
  const confirmDownload = async (report: (message: string) => void) => {
    const node = previewRef.current;
    if (!node || !downloadSheet) throw new Error("The preview is not ready yet. Please try again.");
    // The fest logo is already at the top-right of the sheet preview, so the
    // downloaded PDF matches the preview without stamping a second copy.
    await downloadNodePdf(
      node,
      `festize-${fileSlug(downloadSheet.type)}-${fileSlug(downloadSheet.title)}.pdf`,
      210,
      297,
      report
    );
    notify("PDF downloaded");
  };

  const visiblePrograms = data.programs.filter(
    (program) => !manager || (Boolean(user.teamId) && program.entries.some((entry) => entry.teamId === user.teamId))
  );
  const reportingCategories = [
    ...data.categories.map((category) => ({ id: category.id, name: category.name })),
    { id: "group-special", name: "Group programs" },
  ];

  const publicUser = data.users.find((staff) => staff.role === "PUBLIC RESULT");
  const publicCredentials =
    data.publicResultCredentials ||
    (publicUser?.password ? { username: publicUser.name, password: publicUser.password } : undefined);
  const origin = typeof window === "undefined" ? "https://festize.app/" : `${window.location.origin}${window.location.pathname}`;
  const publicUrl = publicUser
    ? `${origin}?fest=${encodeURIComponent(fest.code)}&u=${encodeURIComponent(
        publicCredentials?.username || publicUser.name
      )}${publicCredentials?.password ? `&c=${encodeURIComponent(publicCredentials.password)}` : ""}`
    : "";

  // Guarded QR generation: never writes state after unmount or a URL change, and surfaces failures.
  useEffect(() => {
    if (!publicUrl) {
      setPublicQr("");
      setQrError(false);
      return;
    }
    let mounted = true;
    setQrError(false);
    void QRCode.toDataURL(publicUrl, {
      width: 720,
      margin: 2,
      errorCorrectionLevel: "H",
      color: { dark: "#111111", light: "#ffffff" },
    })
      .then((url) => {
        if (mounted) setPublicQr(url);
      })
      .catch(() => {
        if (mounted) {
          setPublicQr("");
          setQrError(true);
        }
      });
    return () => {
      mounted = false;
    };
  }, [publicUrl]);

  const startPublicDownload = () => {
    if (!publicUser) return notify("Create a PUBLIC RESULT user in Access Control first.");
    if (askToDownload("the Public Result login QR as a PNG image")) setPublicDownload(true);
  };
  const confirmPublicDownload = async (report: (message: string) => void) => {
    if (!publicRef.current) throw new Error("The QR preview is not ready yet.");
    report("Preparing fonts and QR pass…");
    await downloadNodePng(publicRef.current, `${fileSlug(fest.name)}-public-result-login.png`, 1400);
    report("Saving PNG…");
    notify("Public Result login image downloaded");
  };

  /**
   * Renders one printable sheet. `forExport` drops the on-screen scroll wrapper
   * so PDF capture always sees the full, unclipped A4 proportions.
   */
  function renderSheet(currentSheet: Sheet, forExport = false) {
    const wrap = (table: React.ReactNode) => (forExport ? table : <div className="sheet-scroll">{table}</div>);

    if (currentSheet.type === "Team") {
      const members = currentSheet.teamId ? data.members.filter((member) => member.teamId === currentSheet.teamId) : [];
      const knownCat = new Set(data.categories.map((category) => category.id));
      const uncategorised = members.filter((member) => !knownCat.has(member.categoryId));
      const memberRow = (member: (typeof members)[number], index: number, catLabel: string) => (
        <tr key={member.id}>
          <td>{index + 1}</td>
          <td>{member.name}</td>
          <td className="mono">{member.code}</td>
          <td>{catLabel}</td>
          <td>
            {visiblePrograms
              .filter((program) => program.entries.some((entry) => entry.memberIds.includes(member.id)))
              .map((program) => program.name)
              .join(", ") || "—"}
          </td>
        </tr>
      );
      return (
        <>
          <PrintLogo logo={data.festLogo} />
          <div className="excel-title">
            <span>FESTIZE / TEAM REGISTER</span>
            <h2>{currentSheet.title}</h2>
            <p>
              {fest.name} · {members.length} member{members.length === 1 ? "" : "s"}
            </p>
          </div>
          {wrap(
            <table className="excel-table">
              <thead>
                <tr>
                  <th>NO.</th>
                  <th>MEMBER NAME</th>
                  <th>MEMBER CODE</th>
                  <th>CATEGORY</th>
                  <th>PROGRAMS</th>
                </tr>
              </thead>
              <tbody>
                {data.categories.flatMap((category) => {
                  const group = members.filter((member) => member.categoryId === category.id);
                  if (!group.length) return [];
                  return [
                    <tr className="excel-section-row" key={`head-${category.id}`}>
                      <td colSpan={5}>{category.name.toUpperCase()}</td>
                    </tr>,
                    ...group.map((member, index) => memberRow(member, index, category.name)),
                  ];
                })}
                {uncategorised.length > 0 && [
                  <tr className="excel-section-row" key="head-other">
                    <td colSpan={5}>UNCATEGORISED</td>
                  </tr>,
                  ...uncategorised.map((member, index) => memberRow(member, index, "—")),
                ]}
                {!members.length && (
                  <tr>
                    <td colSpan={5}>No members in this team.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </>
      );
    }

    if (currentSheet.type === "Program") {
      const programs = currentSheet.categoryId
        ? visiblePrograms.filter((program) => program.categoryId === currentSheet.categoryId)
        : [];
      return (
        <>
          <PrintLogo logo={data.festLogo} />
          <div className="excel-title">
            <span>FESTIZE / PROGRAM REGISTER</span>
            <h2>{currentSheet.title}</h2>
            <p>
              {fest.name} · {programs.length} program{programs.length === 1 ? "" : "s"}{" "}
              {manager && user.teamId ? `· ${getTeamName(data, user.teamId)}` : ""}
            </p>
          </div>
          {wrap(
            <table className="excel-table">
              <thead>
                <tr>
                  <th>NO.</th>
                  <th>MEMBER / GROUP</th>
                  <th>TEAM</th>
                  <th>MEMBER CODE</th>
                  <th>FORMAT</th>
                </tr>
              </thead>
              <tbody>
                {programs.flatMap((program) => {
                  const entries = manager
                    ? program.entries.filter((entry) => entry.teamId === user.teamId)
                    : program.entries;
                  return [
                    <tr key={`head-${program.id}`} className="excel-section-row">
                      <td colSpan={5}>
                        {program.name.toUpperCase()} · {program.format.toUpperCase()}
                      </td>
                    </tr>,
                    ...entries.map((entry, index) => (
                      <tr key={entry.id}>
                        <td>{index + 1}</td>
                        <td>
                          {program.format === "Group"
                            ? entry.memberIds.map((memberId) => getMemberName(data, memberId)).join(" + ") || "—"
                            : entry.memberIds.length
                            ? getMemberName(data, entry.memberIds[0])
                            : "—"}
                        </td>
                        <td>{getTeamName(data, entry.teamId)}</td>
                        <td className="mono">
                          {program.format === "Group"
                            ? "—"
                            : data.members.find((member) => member.id === entry.memberIds[0])?.code || "—"}
                        </td>
                        <td>{program.format}</td>
                      </tr>
                    )),
                    ...(!entries.length
                      ? [
                          <tr key={`empty-${program.id}`}>
                            <td colSpan={5}>No entries yet.</td>
                          </tr>,
                        ]
                      : []),
                  ];
                })}
                {!programs.length && (
                  <tr>
                    <td colSpan={5}>No programs in this category.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </>
      );
    }

    if (currentSheet.type === "Team Register") {
      const teamName = currentSheet.teamId ? getTeamName(data, currentSheet.teamId) : "Team";
      const categoryName = currentSheet.categoryId ? getCategoryName(data, currentSheet.categoryId) : "Category";
      const members =
        currentSheet.teamId && currentSheet.categoryId
          ? data.members
              .filter((member) => member.teamId === currentSheet.teamId && member.categoryId === currentSheet.categoryId)
              .sort((a, b) => a.name.localeCompare(b.name))
          : [];
      const categoryPrograms = currentSheet.categoryId
        ? data.programs.filter((program) => program.categoryId === currentSheet.categoryId)
        : [];
      const stagePrograms = categoryPrograms.filter((program) => program.venue === "Stage");
      const offStagePrograms = categoryPrograms.filter((program) => program.venue !== "Stage");
      const colCount = 3 + Math.max(members.length, 1);
      let serial = 0;
      const programRow = (program: Program, venueSpan: { label: string; span: number }, firstOfVenue: boolean) => {
        serial += 1;
        return (
          <tr key={program.id}>
            <td>{serial}</td>
            {firstOfVenue && (
              <td rowSpan={venueSpan.span} className="venue-label-cell">
                <span className="vertical-text">{venueSpan.label}</span>
              </td>
            )}
            <td className="program-name-cell">{program.name}</td>
            {members.length ? (
              members.map((member) => <td key={member.id} className="register-tick-cell" />)
            ) : (
              <td className="register-tick-cell" />
            )}
          </tr>
        );
      };
      return (
        <>
          <PrintLogo logo={data.festLogo} />
          <div className="excel-title">
            <span>FESTIZE / TEAM REGISTER</span>
            <h2>{currentSheet.title}</h2>
            <p>
              {fest.name} · {members.length} member{members.length === 1 ? "" : "s"} · {categoryPrograms.length} program
              {categoryPrograms.length === 1 ? "" : "s"}
            </p>
          </div>
          {wrap(
            <table className="excel-table team-register-table">
              <thead>
                <tr className="team-register-teamrow">
                  <th colSpan={colCount}>{teamName.toUpperCase()}</th>
                </tr>
                <tr>
                  <th className="slno-head">SL.NO</th>
                  <th>VENUE</th>
                  <th>PROGRAM NAME</th>
                  {members.length ? (
                    members.map((member) => (
                      <th key={member.id} className="member-vertical-head">
                        <span className="vertical-text">{member.name}</span>
                      </th>
                    ))
                  ) : (
                    <th className="member-vertical-head">NO MEMBERS</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {stagePrograms.map((program, index) =>
                  programRow(program, { label: "STAGE", span: stagePrograms.length }, index === 0)
                )}
                {stagePrograms.length > 0 && offStagePrograms.length > 0 && (
                  <tr className="venue-divider">
                    <td colSpan={colCount}>OFF-STAGE PROGRAMS BELOW</td>
                  </tr>
                )}
                {offStagePrograms.map((program, index) =>
                  programRow(program, { label: "OFF-STAGE", span: offStagePrograms.length }, index === 0)
                )}
                {!categoryPrograms.length && (
                  <tr>
                    <td colSpan={colCount}>No programs in this category.</td>
                  </tr>
                )}
                <tr className="register-sign-row">
                  <td colSpan={3}>SIGN</td>
                  {members.length ? members.map((member) => <td key={member.id} />) : <td />}
                </tr>
              </tbody>
            </table>
          )}
          <p className="excel-note">
            {members.length
              ? `${categoryName} · tick each member against the programs they enter.`
              : `${categoryName} · register members in this team and category to fill the columns.`}
          </p>
        </>
      );
    }

    if (currentSheet.type === "Judging List") {
      const categoryName = currentSheet.categoryId ? getCategoryName(data, currentSheet.categoryId) : "Category";
      const listPrograms = currentSheet.programId
        ? data.programs.filter((item) => item.id === currentSheet.programId)
        : currentSheet.programIds?.length
        ? data.programs.filter((item) => currentSheet.programIds!.includes(item.id))
        : currentSheet.categoryId
        ? data.programs.filter((item) => item.categoryId === currentSheet.categoryId)
        : [];
      // Blank judging rows sized to the entries, so judges fill code letters by hand.
      const blankRows = (program: Program) => Math.max(program.entries.length, 3);
      const title = currentSheet.programId
        ? data.programs.find((item) => item.id === currentSheet.programId)?.name || currentSheet.title
        : `All programs · ${categoryName}`;
      return (
        <>
          <PrintLogo logo={data.festLogo} />
          <div className="excel-title">
            <span>FESTIZE / JUDGING LIST · {categoryName.toUpperCase()}</span>
            <h2>{title}</h2>
            <p>
              {fest.name} · {listPrograms.length} program{listPrograms.length === 1 ? "" : "s"}
            </p>
          </div>
          {listPrograms.length ? (
            listPrograms.map((program, pageIndex) =>
              wrap(
                <div className="sheet-page" key={`${program.id}-page`}>
                  {!currentSheet.programId && listPrograms.length > 1 && (
                    <div className="sheet-page-tag">
                      PAGE {Math.floor(pageIndex / 3) + 1} / {Math.ceil(listPrograms.length / 3)} ·{" "}
                      {pageIndex + 1} of {listPrograms.length}
                    </div>
                  )}
                  <table key={program.id} className="excel-table judging-table">
                  <thead>
                    <tr className="excel-section-row">
                      <td colSpan={3}>
                        {program.name.toUpperCase()} · {getCategoryName(data, program.categoryId).toUpperCase()}
                      </td>
                    </tr>
                    <tr>
                      <th className="judging-no">NO.</th>
                      <th className="judging-blank">CODE LETTER</th>
                      <th className="judging-blank">MARK</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: blankRows(program) }, (_, index) => (
                      <tr key={`${program.id}-${index}`}>
                        <td>{index + 1}</td>
                        <td className="judging-write" />
                        <td className="judging-write" />
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )
            )
          ) : (
            <table className="excel-table judging-table">
              <tbody>
                <tr>
                  <td>No programs in this category.</td>
                </tr>
              </tbody>
            </table>
          )}
        </>
      );
    }

    // ---- Awards: Winners / Runners / Second Runners ----
    if (currentSheet.type === "Awards") {
      const rank = currentSheet.awardRank ?? 1;
      const label = currentSheet.awardLabel ?? "Winners";
      const categories = currentSheet.categoryId
        ? data.categories.filter((item) => item.id === currentSheet.categoryId)
        : data.categories;
      const blocks = categories
        .map((category) => ({ category, holders: awardHolders(data, category.id, rank) }))
        .filter((block) => block.holders.length > 0);
      const total = blocks.reduce((sum, block) => sum + block.holders.length, 0);
      return (
        <>
          <PrintLogo logo={data.festLogo} />
          <div className="excel-title">
            <span>FESTIZE / AWARDS · {label.toUpperCase()}</span>
            <h2>{currentSheet.title}</h2>
            <p>
              {fest.name} · {total} place holder{total === 1 ? "" : "s"}
            </p>
          </div>
          {blocks.length ? (
            blocks.map((block) =>
              wrap(
                <table key={block.category.id} className="excel-table awards-table">
                  <thead>
                    <tr className="excel-section-row">
                      <td colSpan={7}>{block.category.name.toUpperCase()}</td>
                    </tr>
                    <tr>
                      <th>NO.</th>
                      <th>PLACE HOLDER</th>
                      <th>PROGRAM</th>
                      <th>TEAM</th>
                      <th>MARK</th>
                      <th>GRADE</th>
                      <th>POINTS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {block.holders.map((holder, index) => (
                      <tr key={holder.key}>
                        <td className="mono">{String(index + 1).padStart(2, "0")}</td>
                        <td>
                          <strong>{holder.label}</strong>
                        </td>
                        <td>{holder.program.name}</td>
                        <td>{holder.team}</td>
                        <td className="mono">{holder.mark ?? "—"}</td>
                        <td>{holder.grade}</td>
                        <td className="mono">{holder.points ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )
          ) : (
            <p>No place holders yet for this award.</p>
          )}
        </>
      );
    }

    // ---- Reporting List ----
    const reportingRows = (program: Program) =>
      program.format === "Group"
        ? program.entries.map((entry) => ({
            key: entry.id,
            label: entry.memberIds.map((memberId) => getMemberName(data, memberId)).join(" + ") || "Unknown group",
            team: getTeamName(data, entry.teamId),
          }))
        : reportRows(program, data).map((row) => ({ key: row.key, label: row.name, team: row.team }));

    const programsForSheet = currentSheet.programId
      ? data.programs.filter((item) => item.id === currentSheet.programId)
      : currentSheet.programIds?.length
      ? data.programs.filter((item) => currentSheet.programIds!.includes(item.id))
      : currentSheet.categoryId
      ? data.programs.filter((item) =>
          currentSheet.categoryId === "group-special"
            ? item.format === "Group"
            : item.categoryId === currentSheet.categoryId && item.format !== "Group"
        )
      : [];
    const single = programsForSheet.length === 1 && Boolean(currentSheet.programId);

    return (
      <>
        <PrintLogo logo={data.festLogo} />
        <div className="excel-title">
          <span>FESTIZE / REPORTING LIST</span>
          <h2>{currentSheet.title}</h2>
          <p>
            {fest.name} ·{" "}
            {single
              ? `${getCategoryName(data, programsForSheet[0].categoryId)} · ${programsForSheet[0].format} program`
              : `${programsForSheet.length} program${programsForSheet.length === 1 ? "" : "s"}`}
          </p>
        </div>
        {wrap(
          <table className="excel-table reporting-table">
            <thead>
              <tr>
                <th>NO.</th>
                <th>MEMBER / TEAM</th>
                <th>CODE LETTER</th>
                <th>REMARKS</th>
              </tr>
            </thead>
            <tbody>
              {programsForSheet.flatMap((program, pageIndex) => {
                const rows = reportingRows(program);
                return [
                  ...(single
                    ? []
                    : [
                        ...(pageIndex > 0 && pageIndex % 3 === 0
                          ? [
                              <tr key={`page-${program.id}`} className="excel-page-tag">
                                <td colSpan={4}>
                                  PAGE {Math.floor(pageIndex / 3) + 1} / {Math.ceil(programsForSheet.length / 3)}
                                </td>
                              </tr>,
                            ]
                          : []),
                        <tr key={`head-${program.id}`} className="excel-section-row">
                          <td colSpan={4}>
                            {program.name.toUpperCase()} · {program.format.toUpperCase()}
                          </td>
                        </tr>,
                      ]),
                  ...rows.map((row, index) => (
                    <tr key={row.key}>
                      <td>{index + 1}</td>
                      <td>
                        {row.label} <span className="excel-team">/ {row.team}</span>
                      </td>
                      <td />
                      <td />
                    </tr>
                  )),
                  ...(!rows.length
                    ? [
                        <tr key={`empty-${program.id}`}>
                          <td colSpan={4}>No entries yet.</td>
                        </tr>,
                      ]
                    : []),
                ];
              })}
              {!programsForSheet.length && (
                <tr>
                  <td colSpan={4}>No programs in this category.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </>
    );
  }

  const downloadModal = downloadSheet && (
    <DownloadPreview
      title="PDF preview"
      subtitle={`${downloadSheet.type} · ${downloadSheet.title}`}
      format="PDF · A4"
      onClose={() => setDownloadSheet(null)}
      onConfirm={confirmDownload}
    >
      <div className="pdf-preview-scroll">
        <div ref={previewRef} className="excel-sheet pdf-preview">
          {renderSheet(downloadSheet, true)}
        </div>
      </div>
    </DownloadPreview>
  );

  const tabs = (
    monitor
      ? ["Reporting List"]
      : ["Team", "Program", ...(!manager ? ["Reporting List", "Team Register", "Judging List", "Awards", "Public Result"] : [])]
  ) as Tab[];

  const switchTab = (next: Tab) => {
    setTab(next);
    setQuery("");
    setSelectedIds([]);
    setCategoryId(null);
    setRegTeamId(null);
    setJudgeCatId(null);
    setSheet(null);
    setAwardId(null);
    setAwardCatId(null);
  };

  const tabBar = (
    <div className="sub-tabs" role="tablist" aria-label="Printout type">
      {tabs.map((item) => (
        <button
          key={item}
          type="button"
          role="tab"
          aria-selected={tab === item}
          className={tab === item ? "active" : ""}
          onClick={() => switchTab(item)}
        >
          {tab === item && (
            <motion.span layoutId="print-tab-pill" className="sub-tab-pill" transition={{ type: "spring", stiffness: 450, damping: 36 }} />
          )}
          <span>{item}</span>
        </button>
      ))}
    </div>
  );

  const viewKey = sheet
    ? `sheet:${sheet.type}:${sheet.title}`
    : categoryId
    ? `rep:${categoryId}`
    : regTeamId
    ? `reg:${regTeamId}`
    : judgeCatId
    ? `judge:${judgeCatId}`
    : `tab:${tab}`;

  const renderContent = () => {
    // 1. Open sheet preview
    if (sheet) {
      return (
        <>
          <PageHead
            back={goBack}
            eyebrow={`PRINTOUTS / ${sheet.type.toUpperCase()}`}
            title={sheet.title}
            description="A clean, column-based register ready for paper."
            action={
              <Button variant="secondary" icon={<Download size={17} />} onClick={() => startDownload(sheet)}>
                Download PDF
              </Button>
            }
          />
          <div className="excel-sheet">{renderSheet(sheet)}</div>
        </>
      );
    }

    // 2. Reporting List → category drill-down
    if (categoryId) {
      const category = data.categories.find((item) => item.id === categoryId);
      const programs = data.programs.filter((program) =>
        categoryId === "group-special"
          ? program.format === "Group"
          : program.categoryId === categoryId && program.format !== "Group"
      );
      const categoryTitle = categoryId === "group-special" ? "Group programs" : category?.name || "Category";
      return (
        <>
          <PageHead
            back={goBack}
            eyebrow="PRINTOUTS / REPORTING LIST"
            title={categoryTitle}
            description="Download the whole category, or open a single program."
            action={
              <Button
                variant="secondary"
                icon={<Download size={17} />}
                disabled={!programs.length}
                onClick={() =>
                  startDownload({
                    title: categoryTitle,
                    subtitle: "Reporting List",
                    type: "Reporting List",
                    categoryId,
                    programIds: selectedIds.length ? selectedIds : undefined,
                  })
                }
              >
                {selectedIds.length ? `Download ${selectedIds.length} selected` : "Download category"}
              </Button>
            }
          />
          <PrintSelectChips
            items={programs.map((program) => ({ id: program.id, name: program.name }))}
            selected={selectedIds}
            onToggle={(programId) =>
              setSelectedIds((previous) =>
                previous.includes(programId)
                  ? previous.filter((value) => value !== programId)
                  : [...previous, programId]
              )
            }
            onAll={() => setSelectedIds([])}
          />
          <div className="click-list">
            {programs.map((program) => (
              <button
                type="button"
                key={program.id}
                onClick={() =>
                  makeSheet({
                    title: program.name,
                    subtitle: getCategoryName(data, program.categoryId),
                    type: "Reporting List",
                    programId: program.id,
                  })
                }
              >
                <div>
                  <span className="eyebrow">{getCategoryName(data, program.categoryId)}</span>
                  <h3>{program.name}</h3>
                  <p>
                    {program.entries.length} {program.format === "Group" ? "groups" : "candidates"}
                  </p>
                </div>
                <ChevronRight size={19} />
              </button>
            ))}
            {!programs.length && (
              <Empty title="No programs here yet" description="Programs in this category will appear as they are created." />
            )}
          </div>
        </>
      );
    }

    // 3. Team Register: teams → categories → grid
    if (tab === "Team Register" && !regTeamId) {
      const teams = (manager ? data.teams.filter((team) => team.id === user.teamId) : data.teams).filter((team) =>
        matches(query, team.name)
      );
      return (
        <>
          <PageHead
            eyebrow="DOCUMENTS / PRINT"
            title="Team Register"
            description="Pick a team, then a category, to open its member × program grid."
          />
          {tabBar}
          <div className="section-toolbar">
            <SearchInput value={query} onChange={setQuery} placeholder="Search teams" />
            <span className="toolbar-count">{teams.length} teams</span>
          </div>
          {teams.length ? (
            <div className="print-index">
              {teams.map((team) => (
                <button
                  type="button"
                  key={team.id}
                  onClick={() => {
                    setRegTeamId(team.id);
                    setQuery("");
                  }}
                >
                  <span className="print-icon"><FileSpreadsheet size={21} /></span>
                  <div>
                    <h3>{team.name}</h3>
                    <p>{data.members.filter((member) => member.teamId === team.id).length} members</p>
                  </div>
                  <span className="print-open">Open <ArrowRight size={17} /></span>
                </button>
              ))}
            </div>
          ) : (
            <Empty
              title={query.trim() && data.teams.length ? "No team matches that search" : "No teams yet"}
              description={query.trim() && data.teams.length ? "Check the spelling or clear the search." : "Add teams to build their registers."}
            />
          )}
        </>
      );
    }

    if (tab === "Team Register" && regTeamId) {
      const teamName = getTeamName(data, regTeamId);
      const categories = data.categories.filter((category) => matches(query, category.name));
      return (
        <>
          <PageHead back={goBack} eyebrow="PRINTOUTS / TEAM REGISTER" title={teamName} description="Choose a category to open that team's register grid." />
          <div className="section-toolbar">
            <SearchInput value={query} onChange={setQuery} placeholder="Search categories" />
            <span className="toolbar-count">{categories.length} categories</span>
          </div>
          {categories.length ? (
            <div className="print-index">
              {categories.map((category) => {
                const count = data.members.filter((member) => member.teamId === regTeamId && member.categoryId === category.id).length;
                return (
                  <button
                    type="button"
                    key={category.id}
                    onClick={() =>
                      makeSheet({
                        title: `${teamName} · ${category.name}`,
                        subtitle: "Team Register",
                        type: "Team Register",
                        teamId: regTeamId,
                        categoryId: category.id,
                      })
                    }
                  >
                    <span className="print-icon"><FileSpreadsheet size={21} /></span>
                    <div>
                      <h3>{category.name}</h3>
                      <p>
                        {count} members · {data.programs.filter((program) => program.categoryId === category.id).length} programs
                      </p>
                    </div>
                    <span className="print-open">Open sheet <ArrowRight size={17} /></span>
                  </button>
                );
              })}
            </div>
          ) : (
            <Empty
              title={query.trim() && data.categories.length ? "No category matches that search" : "No categories yet"}
              description={query.trim() && data.categories.length ? "Clear the search to see every category." : "Add categories to build team registers."}
            />
          )}
        </>
      );
    }

    // 4. Judging List: categories → programs + All
    if (tab === "Judging List" && !judgeCatId) {
      const categories = data.categories.filter((category) => matches(query, category.name));
      return (
        <>
          <PageHead eyebrow="DOCUMENTS / PRINT" title="Judging List" description="Blank judging sheets with wide code-letter and mark columns." />
          {tabBar}
          <div className="section-toolbar">
            <SearchInput value={query} onChange={setQuery} placeholder="Search categories" />
            <span className="toolbar-count">{categories.length} categories</span>
          </div>
          {categories.length ? (
            <div className="print-index">
              {categories.map((category) => (
                <button
                  type="button"
                  key={category.id}
                  onClick={() => {
                    setJudgeCatId(category.id);
                    setQuery("");
                  }}
                >
                  <span className="print-icon"><FileSpreadsheet size={21} /></span>
                  <div>
                    <h3>{category.name}</h3>
                    <p>{visiblePrograms.filter((program) => program.categoryId === category.id).length} programs</p>
                  </div>
                  <span className="print-open">Open <ArrowRight size={17} /></span>
                </button>
              ))}
            </div>
          ) : (
            <Empty
              title={query.trim() && data.categories.length ? "No category matches that search" : "No categories yet"}
              description={query.trim() && data.categories.length ? "Clear the search to see every category." : "Add categories to build judging lists."}
            />
          )}
        </>
      );
    }

    if (tab === "Judging List" && judgeCatId) {
      const categoryName = getCategoryName(data, judgeCatId);
      const programs = visiblePrograms.filter((program) => program.categoryId === judgeCatId);
      return (
        <>
          <PageHead
            back={goBack}
            eyebrow="PRINTOUTS / JUDGING LIST"
            title={categoryName}
            description="Open one program, or download every program in this category at once."
            action={
              <Button
                variant="secondary"
                icon={<Download size={17} />}
                disabled={!programs.length}
                onClick={() =>
                  startDownload({
                    title: `All programs · ${categoryName}`,
                    subtitle: "Judging List",
                    type: "Judging List",
                    categoryId: judgeCatId,
                    programIds: selectedIds.length ? selectedIds : undefined,
                  })
                }
              >
                {selectedIds.length ? `Download ${selectedIds.length} selected` : "Download all"}
              </Button>
            }
          />
          <PrintSelectChips
            items={programs.map((program) => ({ id: program.id, name: program.name }))}
            selected={selectedIds}
            onToggle={(programId) =>
              setSelectedIds((previous) =>
                previous.includes(programId)
                  ? previous.filter((value) => value !== programId)
                  : [...previous, programId]
              )
            }
            onAll={() => setSelectedIds([])}
          />
          <div className="click-list">
            {programs.map((program) => (
              <button
                type="button"
                key={program.id}
                onClick={() =>
                  makeSheet({
                    title: program.name,
                    subtitle: categoryName,
                    type: "Judging List",
                    categoryId: judgeCatId,
                    programId: program.id,
                  })
                }
              >
                <div>
                  <span className="eyebrow">{categoryName}</span>
                  <h3>{program.name}</h3>
                  <p>
                    {program.entries.length} candidates · {program.format}
                  </p>
                </div>
                <ChevronRight size={19} />
              </button>
            ))}
            {!programs.length && (
              <Empty title="No programs here yet" description="Programs in this category will appear as they are created." />
            )}
          </div>
        </>
      );
    }

    // 4b. Awards — Winners / Runners / Second Runners with their own print sheets
    if (tab === "Awards") {
      const award = awardId ? AWARDS.find((item) => item.id === awardId) : undefined;

      if (award && awardCatId) {
        const category = data.categories.find((item) => item.id === awardCatId);
        const holders = awardHolders(data, awardCatId, award.rank);
        return (
          <>
            <PageHead
              back={() => {
                setAwardCatId(null);
                setQuery("");
              }}
              eyebrow={`PRINTOUTS / AWARDS / ${award.label.toUpperCase()}`}
              title={category?.name ?? "Category"}
              description={`${award.label} of ${category?.name ?? "this category"}.`}
              action={
                <Button
                  variant="secondary"
                  icon={<Download size={17} />}
                  disabled={!holders.length}
                  onClick={() =>
                    startDownload({
                      title: `${award.label} · ${category?.name ?? "All categories"}`,
                      subtitle: "Awards",
                      type: "Awards",
                      categoryId: awardCatId,
                      awardRank: award.rank,
                      awardLabel: award.label,
                    })
                  }
                >
                  Download PDF
                </Button>
              }
            />
            {tabBar}
            {holders.length ? (
              <div className="award-holder-list">
                {holders.map((holder, index) => (
                  <div className="award-holder" key={holder.key}>
                    <span className={`award-place-badge ${award.className}`}>
                      {String(award.rank).padStart(2, "0")}
                    </span>
                    <div className="award-holder-main">
                      <strong>{holder.label}</strong>
                      <span>
                        {holder.program.name} · {holder.team}
                      </span>
                    </div>
                    <div className="award-holder-meta">
                      <span className="mono">{holder.mark ?? "—"}</span>
                      <span className="chip">{holder.grade}</span>
                      <span className="mono award-points">{holder.points ?? 0} pts</span>
                      <span className="mono muted">{String(index + 1).padStart(2, "0")}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty
                title={`No ${award.label.toLowerCase()} yet`}
                description={`Finalise a program in ${category?.name ?? "this category"} and its podium appears here.`}
              />
            )}
          </>
        );
      }

      if (award) {
        const rows = data.categories
          .map((category) => ({ category, holders: awardHolders(data, category.id, award.rank) }))
          .filter((row) => row.holders.length > 0)
          .filter((row) => matches(query, row.category.name));
        return (
          <>
            <PageHead
              back={() => {
                setAwardId(null);
                setQuery("");
              }}
              eyebrow={`PRINTOUTS / AWARDS / ${award.label.toUpperCase()}`}
              title={award.label}
              description={award.tagline}
              action={
                <Button
                  variant="secondary"
                  icon={<Download size={17} />}
                  disabled={!rows.length}
                  onClick={() =>
                    startDownload({
                      title: `${award.label} · All categories`,
                      subtitle: "Awards",
                      type: "Awards",
                      awardRank: award.rank,
                      awardLabel: award.label,
                    })
                  }
                >
                  Download all
                </Button>
              }
            />
            {tabBar}
            <div className="section-toolbar">
              <SearchInput value={query} onChange={setQuery} placeholder="Search categories" />
              <span className="toolbar-count">
                {rows.length} {rows.length === 1 ? "category" : "categories"}
              </span>
            </div>
            {rows.length ? (
              <div className="awards-categories">
                {rows.map((row) => (
                  <button
                    type="button"
                    key={row.category.id}
                    className="award-category-card"
                    onClick={() => {
                      setAwardCatId(row.category.id);
                      setQuery("");
                    }}
                  >
                    <div>
                      <strong>{row.category.name}</strong>
                      <small>
                        {row.holders.length} {row.holders.length === 1 ? "place holder" : "place holders"}
                      </small>
                    </div>
                    <ChevronRight size={18} />
                  </button>
                ))}
              </div>
            ) : (
              <Empty
                title="No categories match"
                description="Finalise programs so their podiums appear here, or clear the search."
              />
            )}
          </>
        );
      }

      return (
        <>
          <PageHead
            eyebrow="PRINTOUTS / AWARDS"
            title="Awards"
            description="Winners, runners and second runners — downloadable just like every other sheet."
          />
          {tabBar}
          <div className="awards-grid">
            {AWARDS.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`award-card ${item.className}`}
                onClick={() => {
                  setAwardId(item.id);
                  setAwardCatId(null);
                  setQuery("");
                }}
              >
                <span className="award-icon">
                  <AwardIcon kind={item.id} />
                </span>
                <span className="award-copy">
                  <strong>{item.label}</strong>
                  <small>{item.tagline}</small>
                </span>
                <ChevronRight size={19} className="award-chevron" />
              </button>
            ))}
          </div>
        </>
      );
    }

    // 5. Team, Program, Reporting List and Public Result
    const indexItems =
      tab === "Team"
        ? (manager ? data.teams.filter((team) => team.id === user.teamId) : data.teams).map((team) => ({
            id: team.id,
            name: team.name,
            detail: `${data.members.filter((member) => member.teamId === team.id).length} members`,
          }))
        : tab === "Program"
        ? data.categories.map((category) => ({
            id: category.id,
            name: category.name,
            detail: `${visiblePrograms.filter((program) => program.categoryId === category.id).length} programs`,
          }))
        : reportingCategories.map((category) => ({
            id: category.id,
            name: category.name,
            detail: `${
              data.programs.filter((program) =>
                category.id === "group-special"
                  ? program.format === "Group"
                  : program.categoryId === category.id && program.format !== "Group"
              ).length
            } programs`,
          }));
    const filtered = indexItems.filter((item) => matches(query, item.name));

    const qrPass = (ref?: typeof publicRef) => (
      <div ref={ref} className="public-result-pass">
        {data.festLogo && <img className="public-pass-watermark" src={data.festLogo} alt="" />}
        <PrintLogo logo={data.festLogo} />
        <span className="public-pass-kicker">SCAN TO OPEN</span>
        <h2>
          Public Results
          <br />&amp; Highlights
        </h2>
        <p>{fest.name}</p>
        {publicQr ? (
          <img className="public-pass-qr" src={publicQr} alt="Public Result login QR code" />
        ) : (
          <div className="public-pass-empty">
            <QrCode size={52} />
            <span>
              {qrError
                ? "Could not generate the QR code"
                : publicUser
                ? "Preparing QR code…"
                : "Create a PUBLIC RESULT user first"}
            </span>
          </div>
        )}
        <small>{publicUser?.name || "PUBLIC RESULT ACCESS"}</small>
        <code className="public-pass-url">{publicUrl}</code>
      </div>
    );

    return (
      <>
        <PageHead
          eyebrow="DOCUMENTS / PRINT"
          title={monitor ? "Reporting List" : "Printouts"}
          description="Tidy, spreadsheet-style records for the moments that need a paper trail."
        />
        {tabBar}

        {tab === "Public Result" ? (
          <>
            <div className="public-result-print">
              {qrPass(publicRef)}
              <div className="public-result-print-copy">
                <span className="eyebrow">PUBLIC ACCESS</span>
                <h2>One scan. No menu clutter.</h2>
                <p>
                  Print or share this image. It opens the dedicated Public Result user with only Results and
                  Highlights at the bottom.
                </p>
                <Button onClick={startPublicDownload} disabled={!publicUser || !publicQr} icon={<Download size={16} />}>
                  Download image
                </Button>
                {publicUser && !publicCredentials?.password && (
                  <p className="warn-text">
                    Cloud password is hidden after reload. Recreate the PUBLIC RESULT account to issue a
                    direct-login QR; this QR will still prefill the username.
                  </p>
                )}
              </div>
            </div>
            {publicDownload && (
              <DownloadPreview
                title="Public Result login"
                subtitle={`${fest.name} · PNG image`}
                format="PNG · QR LOGIN"
                onClose={() => setPublicDownload(false)}
                onConfirm={confirmPublicDownload}
              >
                <div className="public-download-preview">{qrPass()}</div>
              </DownloadPreview>
            )}
          </>
        ) : (
          <>
            <div className="section-toolbar">
              <SearchInput value={query} onChange={setQuery} placeholder={`Search ${tab.toLowerCase()}`} />
              <span className="toolbar-count">
                {filtered.length} {tab === "Team" ? "teams" : "categories"}
              </span>
            </div>
            {filtered.length ? (
              <div className="print-index">
                {filtered.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => {
                      if (tab === "Reporting List") {
                        setCategoryId(item.id);
                        setQuery("");
                      } else {
                        makeSheet({
                          title: item.name,
                          subtitle: tab,
                          type: tab,
                          teamId: tab === "Team" ? item.id : undefined,
                          categoryId: tab === "Program" ? item.id : undefined,
                        });
                      }
                    }}
                  >
                    <span className="print-icon"><FileSpreadsheet size={21} /></span>
                    <div>
                      <h3>{item.name}</h3>
                      <p>{item.detail}</p>
                    </div>
                    <span className="print-open">
                      {tab === "Reporting List" ? "Open" : "Open sheet"} <ArrowRight size={17} />
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <Empty
                title={query.trim() && indexItems.length ? "Nothing matches that search" : "Nothing to print yet"}
                description={
                  query.trim() && indexItems.length
                    ? "Check the spelling or clear the search."
                    : "Add teams, categories and programs to make their printouts available."
                }
              />
            )}
          </>
        )}
      </>
    );
  };

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={viewKey} className="printouts-view" {...SLIDE}>
          {renderContent()}
        </motion.div>
      </AnimatePresence>
      {downloadModal}
    </MotionConfig>
  );
}
