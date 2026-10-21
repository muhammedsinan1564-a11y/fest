import { useEffect, useMemo, useState } from "react";
import { Check, ExternalLink, Play, Radio, Video } from "lucide-react";
import { Button, Empty, Field, Modal, PageHead, SearchInput } from "../ui";
import { entryGrade, getCategoryName, getMemberName, getTeamName, type Program } from "../types";
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

export function HighlightsSection({ fest, user, onChange, notify }: SectionProps) {
  const data = fest.data;
  const media = user.role === "MEDIA";
  const highlights = data.highlights || { programUrls: {} };
  const [query, setQuery] = useState("");
  const [liveOpen, setLiveOpen] = useState(false);
  const [liveDraft, setLiveDraft] = useState(highlights.liveUrl || "");
  const [drafts, setDrafts] = useState<Record<string, string>>({ ...highlights.programUrls });
  const [programId, setProgramId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState("");

  useEffect(() => {
    setLiveDraft(highlights.liveUrl || "");
    setDrafts({ ...highlights.programUrls });
  }, [highlights.liveUrl, highlights.programUrls]);

  const allStagePrograms = useMemo(() => data.programs.filter(program => program.venue === "Stage" && `${program.name} ${getCategoryName(data, program.categoryId)}`.toLowerCase().includes(query.toLowerCase())), [data.programs, data.categories, query]);
  const visiblePrograms = media ? allStagePrograms : allStagePrograms.filter(program => Boolean(highlights.programUrls[program.id]));
  const selected = data.programs.find(program => program.id === programId);

  const winners = (program: Program) => rankedEntries(program, data).filter(entry => entryGrade(entry, program, data)?.points != null).slice(0, 3);
  const saveLive = () => {
    const value = liveDraft.trim();
    if (value && !isValidLink(value)) return notify("Enter a valid YouTube or video link.");
    onChange(current => ({ ...current, highlights: { ...(current.highlights || { programUrls: {} }), liveUrl: value || undefined, programUrls: { ...(current.highlights?.programUrls || {}) } } }), value ? "Updated the live highlight link" : "Removed the live highlight link");
    notify(value ? "Live link submitted" : "Live link removed");
  };
  const saveProgram = (program: Program) => {
    const value = (drafts[program.id] || "").trim();
    if (value && !isValidLink(value)) return notify("Enter a valid YouTube or video link.");
    onChange(current => {
      const urls = { ...(current.highlights?.programUrls || {}) };
      if (value) urls[program.id] = value; else delete urls[program.id];
      return { ...current, highlights: { ...(current.highlights || {}), programUrls: urls } };
    }, `${value ? "Submitted" : "Removed"} highlight for ${program.name}`);
    notify(value ? `${program.name} video submitted` : `${program.name} video removed`);
  };

  const openVideo = (url: string) => { if (url) setVideoUrl(url); };

  return <>
    <PageHead eyebrow="MEDIA / MOMENTS" title="Highlights" description={media ? "Submit the live broadcast and stage-program videos. Members see only the links you publish." : "Watch the live broadcast and published stage highlights."} />
    {media && <div className="section-toolbar"><SearchInput value={query} onChange={setQuery} placeholder="Search stage programs" /><span className="toolbar-count">{allStagePrograms.length} stage programs</span></div>}

    <section className="highlight-live">
      <button className="highlight-live-bar" onClick={() => media ? setLiveOpen(!liveOpen) : highlights.liveUrl && openVideo(highlights.liveUrl)} disabled={!media && !highlights.liveUrl}>
        <span className="highlight-live-icon"><Radio size={18} /><i /></span>
        <span><strong>Live</strong><small>{highlights.liveUrl ? media ? "Link submitted · click to edit" : "Watch the festival live" : media ? "Add the YouTube live link" : "Live stream has not started"}</small></span>
        {highlights.liveUrl && <Play size={18} />}
      </button>
      {media && liveOpen && <div className="highlight-link-form"><Field label="YouTube live link"><input autoFocus value={liveDraft} onChange={event => setLiveDraft(event.target.value)} placeholder="https://youtube.com/watch?v=..." /></Field><Button onClick={saveLive}><Check size={16} /> Submit</Button></div>}
    </section>

    <div className="section-minihead highlight-program-head"><div><span className="eyebrow">STAGE PROGRAMS</span><h2>{media ? "Program highlights" : "Watch the winners"}</h2></div></div>
    {visiblePrograms.length ? <div className="highlight-grid">{visiblePrograms.map(program => {
      const top = winners(program);
      const published = highlights.programUrls[program.id];
      return <article className="highlight-program" key={program.id}>
        <button className="highlight-program-head" onClick={() => !media && published ? setProgramId(program.id) : undefined}>
          <span><small>{getCategoryName(data, program.categoryId)}</small><strong>{program.name}</strong></span>
          {published ? <span className="video-ready"><Video size={14} /> Video</span> : <span className="muted">No video</span>}
        </button>
        <ol>{top.length ? top.map((entry, index) => <li key={entry.id}><span>{index + 1}</span><div><strong>{program.format === "Group" ? entry.memberIds.map(id => getMemberName(data, id)).join(" + ") : getMemberName(data, entry.memberIds[0])}</strong><small>{getTeamName(data, entry.teamId)} · Grade {entryGrade(entry, program, data)?.name || "—"}</small></div></li>) : <li className="highlight-empty">Results will appear after judging.</li>}</ol>
        {media && <div className="highlight-link-form compact"><Field label="YouTube video link"><input value={drafts[program.id] || ""} onChange={event => setDrafts({ ...drafts, [program.id]: event.target.value })} placeholder="https://youtube.com/watch?v=..." /></Field><Button onClick={() => saveProgram(program)}><Check size={15} /> Submit</Button></div>}
      </article>;
    })}</div> : <Empty title={media ? "No stage programs yet" : "No highlights published yet"} description={media ? "Stage programs appear here when they are created." : "The media team will publish the live stream and program videos here."} />}

    {selected && <Modal title={selected.name} subtitle={`${getCategoryName(data, selected.categoryId)} · click a candidate to watch`} onClose={() => setProgramId(null)}><div className="highlight-candidates">{winners(selected).map((entry, index) => <button key={entry.id} onClick={() => openVideo(highlights.programUrls[selected.id])}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{selected.format === "Group" ? entry.memberIds.map(id => getMemberName(data, id)).join(" + ") : getMemberName(data, entry.memberIds[0])}</strong><small>{getTeamName(data, entry.teamId)}</small></div><Play size={16} /></button>)}</div></Modal>}
    {videoUrl && <Modal title="Video highlight" subtitle="YouTube / live player" onClose={() => setVideoUrl("")} wide><div className="video-popup"><iframe src={embedUrl(videoUrl)} title="Festival highlight" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /><a href={videoUrl} target="_blank" rel="noreferrer">Open on YouTube <ExternalLink size={14} /></a></div></Modal>}
  </>;
}