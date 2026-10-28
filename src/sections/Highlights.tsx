import { useEffect, useMemo, useState } from "react";
import { Check, ExternalLink, Play, Radio, Video } from "lucide-react";
import { Button, Empty, Field, Modal, PageHead, SearchInput } from "../ui";
import { entryGrade, getCategoryName, getMemberName, getTeamName, type HighlightPlace, type Program, type ProgramEntry } from "../types";
import { rankedEntries, type SectionProps } from "./common";

function embedUrl(raw: string) {
  const value = raw.trim();
  if (!value) return "";
  try {
    const url = new URL(value);
    if (url.hostname.includes("youtu.be")) return `https://www.youtube.com/embed/${url.pathname.slice(1).split("?")[0]}?autoplay=1`;
    if (url.hostname.includes("youtube.com")) {
      const id = url.searchParams.get("v") || url.pathname.split("/").filter(Boolean).pop();
      if (id) return `https://www.youtube.com/embed/${id}?autoplay=1`;
    }
    return value;
  } catch { return value; }
}

function isValidLink(value: string) {
  try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:"; }
  catch { return false; }
}

const PLACES: { key: HighlightPlace; label: string; index: number }[] = [
  { key: "winner", label: "Winner video", index: 0 },
  { key: "runner", label: "Runner video", index: 1 },
  { key: "secondRunner", label: "Second runner video", index: 2 },
];

export function HighlightsSection({ fest, user, onChange, notify }: SectionProps) {
  const data = fest.data;
  const media = user.role === "MEDIA";
  const highlights = data.highlights || { programUrls: {}, programWinnerUrls: {} };
  const winnerUrls = highlights.programWinnerUrls || {};
  const [query, setQuery] = useState("");
  const [liveOpen, setLiveOpen] = useState(false);
  const [liveDraft, setLiveDraft] = useState(highlights.liveUrl || "");
  const [drafts, setDrafts] = useState<Record<string, Partial<Record<HighlightPlace, string>>>>({ ...winnerUrls });
  const [programId, setProgramId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoTitle, setVideoTitle] = useState("");

  useEffect(() => {
    setLiveDraft(highlights.liveUrl || "");
    setDrafts({ ...(highlights.programWinnerUrls || {}) });
  }, [highlights.liveUrl, highlights.programWinnerUrls]);

  const allStagePrograms = useMemo(() => data.programs.filter(program => program.venue === "Stage" && `${program.name} ${getCategoryName(data, program.categoryId)}`.toLowerCase().includes(query.toLowerCase())), [data.programs, data.categories, query]);
  const programVideoCount = (program: Program) =>
    (winnerUrls[program.id] ? PLACES.filter(place => winnerUrls[program.id][place.key]?.trim()).length : 0)
    || (highlights.programUrls[program.id] ? 1 : 0);
  const visiblePrograms = media ? allStagePrograms : allStagePrograms.filter(program => programVideoCount(program) > 0);
  const selected = data.programs.find(program => program.id === programId);

  const winners = (program: Program) => rankedEntries(program, data).filter(entry => entryGrade(entry, program, data)?.points != null).slice(0, 3);
  const placeVideo = (program: Program, place: HighlightPlace) =>
    winnerUrls[program.id]?.[place]?.trim() || highlights.programUrls[program.id] || "";
  const placeLabel = (program: Program, entry: ProgramEntry) =>
    program.format === "Group" ? entry.memberIds.map(memberId => getMemberName(data, memberId)).join(" + ") : getMemberName(data, entry.memberIds[0]);

  const saveLive = () => {
    const value = liveDraft.trim();
    if (value && !isValidLink(value)) return notify("Enter a valid YouTube or video link.");
    onChange(current => ({ ...current, highlights: { ...(current.highlights || { programUrls: {}, programWinnerUrls: {} }), liveUrl: value || undefined, programUrls: { ...(current.highlights?.programUrls || {}) }, programWinnerUrls: { ...(current.highlights?.programWinnerUrls || {}) } } }), value ? "Updated the live highlight link" : "Removed the live highlight link");
    notify(value ? "Live link submitted" : "Live link removed");
  };
  const saveProgram = (program: Program) => {
    const draft = drafts[program.id] || {};
    for (const place of PLACES) {
      const value = (draft[place.key] || "").trim();
      if (value && !isValidLink(value)) return notify(`Enter a valid link for the ${place.label.toLowerCase()} (or leave it empty).`);
    }
    onChange(current => {
      const urls = { ...(current.highlights?.programWinnerUrls || {}) };
      const cleaned: Partial<Record<HighlightPlace, string>> = {};
      for (const place of PLACES) {
        const value = (draft[place.key] || "").trim();
        if (value) cleaned[place.key] = value;
      }
      if (Object.keys(cleaned).length) urls[program.id] = cleaned; else delete urls[program.id];
      return { ...current, highlights: { ...(current.highlights || { programUrls: {} }), programUrls: { ...(current.highlights?.programUrls || {}) }, programWinnerUrls: urls } };
    }, `Submitted highlight videos for ${program.name}`);
    notify("Highlight videos submitted");
  };

  const openVideo = (url: string, title: string) => { if (url) { setVideoUrl(url); setVideoTitle(title); } };

  return <>
    <PageHead eyebrow="MEDIA / MOMENTS" title="Highlights" description={media ? "Submit the live broadcast and a separate video for each winner, runner and second runner." : "Watch the live broadcast and published stage highlights."} />
    {media && <div className="section-toolbar"><SearchInput value={query} onChange={setQuery} placeholder="Search stage programs" /><span className="toolbar-count">{allStagePrograms.length} stage programs</span></div>}

    <section className="highlight-live">
      <button className="highlight-live-bar" onClick={() => media ? setLiveOpen(!liveOpen) : highlights.liveUrl && openVideo(highlights.liveUrl, "Live broadcast")} disabled={!media && !highlights.liveUrl}>
        <span className="highlight-live-icon"><Radio size={18} /><i /></span>
        <span><strong>Live</strong><small>{highlights.liveUrl ? media ? "Link submitted · click to edit" : "Watch the festival live" : media ? "Add the YouTube live link" : "Live stream has not started"}</small></span>
        {highlights.liveUrl && <Play size={18} />}
      </button>
      {media && liveOpen && <div className="highlight-link-form"><Field label="YouTube live link"><input autoFocus value={liveDraft} onChange={event => setLiveDraft(event.target.value)} placeholder="https://youtube.com/watch?v=..." /></Field><Button onClick={saveLive}><Check size={16} /> Submit</Button></div>}
    </section>

    <div className="section-minihead highlight-program-head"><div><span className="eyebrow">STAGE PROGRAMS</span><h2>{media ? "Program highlights" : "Watch the winners"}</h2></div></div>
    {visiblePrograms.length ? <div className="highlight-grid">{visiblePrograms.map(program => {
      const top = winners(program);
      const count = programVideoCount(program);
      return <article className="highlight-program" key={program.id}>
        <button className="highlight-program-head" onClick={() => !media && count > 0 ? setProgramId(program.id) : undefined}>
          <span><small>{getCategoryName(data, program.categoryId)}</small><strong>{program.name}</strong></span>
          {count > 0 ? <span className="video-ready"><Video size={14} /> {count} video{count === 1 ? "" : "s"}</span> : <span className="muted">No video</span>}
        </button>
        <ol>{top.length ? top.map((entry, index) => <li key={entry.id}><span>{index + 1}</span><div><strong>{placeLabel(program, entry)}</strong><small>{getTeamName(data, entry.teamId)} · Grade {entryGrade(entry, program, data)?.name || "—"}</small></div></li>) : <li className="highlight-empty">Results will appear after judging.</li>}</ol>
        {media && <div className="highlight-place-forms">{PLACES.map(place => <Field key={place.key} label={place.label}><input value={drafts[program.id]?.[place.key] || ""} onChange={event => setDrafts(previous => ({ ...previous, [program.id]: { ...previous[program.id], [place.key]: event.target.value } }))} placeholder="https://youtube.com/watch?v=..." /></Field>)}<Button onClick={() => saveProgram(program)}><Check size={15} /> Submit videos</Button></div>}
      </article>;
    })}</div> : <Empty title={media ? "No stage programs yet" : "No highlights published yet"} description={media ? "Stage programs appear here when they are created." : "The media team will publish the live stream and program videos here."} />}

    {selected && <Modal title={selected.name} subtitle={`${getCategoryName(data, selected.categoryId)} · click a candidate to watch`} onClose={() => setProgramId(null)}><div className="highlight-candidates">{winners(selected).map((entry, index) => { const url = placeVideo(selected, PLACES[index].key); return <button key={entry.id} onClick={() => openVideo(url, `${selected.name} · ${placeLabel(selected, entry)}`)} disabled={!url}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{placeLabel(selected, entry)}</strong><small>{getTeamName(data, entry.teamId)}{url ? "" : " · no video yet"}</small></div><Play size={16} /></button>; })}</div></Modal>}
    {videoUrl && <Modal title="Video highlight" subtitle={videoTitle || "YouTube / live player"} onClose={() => setVideoUrl("")} wide><div className="video-popup"><iframe src={embedUrl(videoUrl)} title="Festival highlight" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /><a href={videoUrl} target="_blank" rel="noreferrer">Open on YouTube <ExternalLink size={14} /></a></div></Modal>}
  </>;
}
