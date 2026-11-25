import { useEffect, useMemo, useState } from "react";
import { Check, ExternalLink, Play, Radio, Video } from "lucide-react";
import { Button, Empty, Field, Modal, PageHead, SearchInput } from "../ui";
import {
  entryGrade,
  getCategoryName,
  getMemberName,
  getTeamName,
  type HighlightPlace,
  type Program,
  type ProgramEntry,
} from "../types";
import { rankedEntries, type SectionProps } from "./common";

/** Turns a YouTube watch / youtu.be / live / shorts link into an autoplay embed URL. */
export function embedUrl(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\.|^m\./, "");
    let videoId = "";
    if (host === "youtu.be") videoId = url.pathname.slice(1).split("/")[0];
    else if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (url.pathname === "/watch") videoId = url.searchParams.get("v") || "";
      else {
        const [, kind, id] = url.pathname.split("/");
        if (["embed", "live", "shorts", "v"].includes(kind)) videoId = id || "";
      }
    }
    if (videoId) return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0`;
    return value;
  } catch {
    return value;
  }
}

/** True for absolute http(s) URLs only. */
export function isValidLink(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

const PLACES: { key: HighlightPlace; label: string; rank: number }[] = [
  { key: "winner", label: "Winner", rank: 1 },
  { key: "runner", label: "Runner", rank: 2 },
  { key: "secondRunner", label: "Second Runner", rank: 3 },
];

interface PlayerState {
  title: string;
  subtitle: string;
  url: string;
}

export function HighlightsSection({ fest, user, onChange, notify }: SectionProps) {
  const data = fest.data;
  const highlights = data.highlights;
  const media = user.role === "MEDIA" || user.role === "MAIN";

  const [liveOpen, setLiveOpen] = useState(false);
  const [liveDraft, setLiveDraft] = useState(highlights.liveUrl ?? "");
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Partial<Record<HighlightPlace, string>>>>({});
  const [choosing, setChoosing] = useState<Program | null>(null);
  const [player, setPlayer] = useState<PlayerState | null>(null);

  useEffect(() => setLiveDraft(highlights.liveUrl ?? ""), [highlights.liveUrl]);

  const stagePrograms = useMemo(
    () => data.programs.filter((program) => program.venue === "Stage"),
    [data.programs]
  );

  const hasVideos = (program: Program) =>
    PLACES.some((place) => Boolean(highlights.programWinnerUrls[program.id]?.[place.key]));

  const visiblePrograms = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return stagePrograms
      .filter((program) => (media ? true : hasVideos(program)))
      .filter((program) =>
        !needle
          ? true
          : `${program.name} ${getCategoryName(data, program.categoryId)}`.toLowerCase().includes(needle)
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stagePrograms, query, media, highlights.programWinnerUrls, data]);

  const candidateName = (program: Program, entry?: ProgramEntry) => {
    if (!entry) return "Not yet decided";
    const lead = getMemberName(data, entry.memberIds[0]);
    const extra = program.format === "Group" && entry.memberIds.length > 1 ? ` + ${entry.memberIds.length - 1}` : "";
    return `${lead}${extra} · ${getTeamName(data, entry.teamId)}`;
  };

  const saveLive = (value: string | undefined) => {
    if (value && !isValidLink(value)) return notify("Enter a full link starting with https://");
    onChange(
      (next) => ({ ...next, highlights: { ...next.highlights, liveUrl: value || undefined } }),
      value ? "Updated the live broadcast link" : "Removed the live broadcast link"
    );
    setLiveOpen(false);
    notify(value ? "Live broadcast link saved" : "Live broadcast link removed");
  };

  const draftFor = (programId: string, place: HighlightPlace) =>
    drafts[programId]?.[place] ?? highlights.programWinnerUrls[programId]?.[place] ?? "";

  const savePlace = (program: Program, place: HighlightPlace) => {
    const value = draftFor(program.id, place).trim();
    if (value && !isValidLink(value)) return notify("Enter a full link starting with https://");
    onChange((next) => {
      const current = { ...(next.highlights.programWinnerUrls[program.id] ?? {}) };
      if (value) current[place] = value;
      else delete current[place];
      return {
        ...next,
        highlights: {
          ...next.highlights,
          programWinnerUrls: { ...next.highlights.programWinnerUrls, [program.id]: current },
        },
      };
    }, `Updated ${place} highlight for ${program.name}`);
    setDrafts((prev) => ({ ...prev, [program.id]: { ...prev[program.id], [place]: undefined } }));
    notify(value ? "Highlight video saved" : "Highlight video removed");
  };

  const openVideo = (program: Program, place: (typeof PLACES)[number]) => {
    const url = highlights.programWinnerUrls[program.id]?.[place.key];
    if (!url) return;
    const entry = rankedEntries(program, data)[place.rank - 1];
    setChoosing(null);
    setPlayer({ title: `${program.name} · ${place.label}`, subtitle: candidateName(program, entry), url });
  };

  return (
    <>
      <PageHead
        eyebrow="LIVE FEST"
        title="Highlights"
        description={
          media
            ? "Share the live stream and attach winner videos to every stage program."
            : "Watch the live stage and relive every winning performance."
        }
      />

      {/* ---------- Live broadcast ---------- */}
      <section className={`highlight-live ${highlights.liveUrl ? "is-on" : ""}`}>
        <div className="highlight-live-head">
          <span className="highlight-live-icon"><Radio size={20} /></span>
          <div>
            <span className="eyebrow">{highlights.liveUrl ? "ON AIR" : "LIVE BROADCAST"}</span>
            <h2>{highlights.liveUrl ? "The stage is live right now" : "No live broadcast yet"}</h2>
            <p className="muted">
              {highlights.liveUrl
                ? "Tune in to the main stage from anywhere."
                : media
                ? "Paste your YouTube live link so everyone can watch."
                : "The media team will share the stream here once it starts."}
            </p>
          </div>
          <div className="highlight-live-actions">
            {highlights.liveUrl && (
              <Button
                icon={<Play size={16} />}
                onClick={() =>
                  setPlayer({ title: "Live broadcast", subtitle: fest.name, url: highlights.liveUrl! })
                }
              >
                Watch live
              </Button>
            )}
            {media && (
              <Button variant="secondary" onClick={() => setLiveOpen((open) => !open)}>
                {highlights.liveUrl ? "Update link" : "Add live link"}
              </Button>
            )}
          </div>
        </div>

        {media && liveOpen && (
          <form
            className="highlight-live-form"
            onSubmit={(event) => {
              event.preventDefault();
              saveLive(liveDraft.trim());
            }}
          >
            <Field label="YouTube live link" hint="e.g. https://youtube.com/live/… or https://youtu.be/…">
              <input
                autoFocus
                value={liveDraft}
                onChange={(event) => setLiveDraft(event.target.value)}
                placeholder="https://"
              />
            </Field>
            <div className="form-actions">
              {highlights.liveUrl && (
                <Button variant="danger" onClick={() => saveLive(undefined)}>Remove</Button>
              )}
              <Button variant="secondary" onClick={() => setLiveOpen(false)}>Cancel</Button>
              <Button type="submit" icon={<Check size={15} />}>Save link</Button>
            </div>
          </form>
        )}
      </section>

      {/* ---------- Stage programs ---------- */}
      <div className="highlight-toolbar">
        <div>
          <h2 className="panel-title">Stage programs</h2>
          <p className="panel-sub">
            {media
              ? `${stagePrograms.length} stage programs · add a video for each podium place`
              : `${visiblePrograms.length} programs with highlight videos`}
          </p>
        </div>
        {media && <SearchInput value={query} onChange={setQuery} placeholder="Search stage programs" />}
      </div>

      {visiblePrograms.length === 0 ? (
        <Empty
          title={media ? "No stage programs found" : "No highlights yet"}
          description={
            media
              ? query
                ? "Nothing matches that search."
                : "Create stage programs first, then attach winner videos here."
              : "Winning performances appear here as soon as the media team uploads them."
          }
        />
      ) : (
        <div className="highlight-grid">
          {visiblePrograms.map((program) => {
            const ranked = rankedEntries(program, data);
            const links = highlights.programWinnerUrls[program.id] ?? {};
            const count = PLACES.filter((place) => links[place.key]).length;

            if (!media)
              return (
                <button
                  key={program.id}
                  type="button"
                  className="highlight-program viewer"
                  onClick={() => setChoosing(program)}
                >
                  <span className="highlight-thumb"><Play size={22} /></span>
                  <div className="highlight-program-copy">
                    <strong>{program.name}</strong>
                    <span className="muted">
                      {getCategoryName(data, program.categoryId)} · {count} video{count === 1 ? "" : "s"}
                    </span>
                  </div>
                </button>
              );

            return (
              <article key={program.id} className="highlight-program">
                <div className="highlight-program-head">
                  <span className="highlight-thumb small"><Video size={17} /></span>
                  <div className="highlight-program-copy">
                    <strong>{program.name}</strong>
                    <span className="muted">
                      {getCategoryName(data, program.categoryId)} · {program.format}
                    </span>
                  </div>
                  <span className={`chip ${count === 3 ? "on" : ""}`}>{count}/3</span>
                </div>

                {PLACES.map((place) => {
                  const entry = ranked[place.rank - 1];
                  const saved = links[place.key] ?? "";
                  const draft = draftFor(program.id, place.key);
                  return (
                    <div key={place.key} className="highlight-place">
                      <div className="highlight-place-label">
                        <span className={`place-dot place-${place.rank}`}>{place.rank}</span>
                        <div>
                          <strong>{place.label}</strong>
                          <span className="muted">{candidateName(program, entry)}</span>
                        </div>
                      </div>
                      <div className="highlight-place-input">
                        <input
                          value={draft}
                          placeholder="YouTube link"
                          onChange={(event) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [program.id]: { ...prev[program.id], [place.key]: event.target.value },
                            }))
                          }
                        />
                        <Button
                          size="sm"
                          variant={draft.trim() === saved ? "secondary" : "primary"}
                          disabled={draft.trim() === saved}
                          onClick={() => savePlace(program, place.key)}
                        >
                          {draft.trim() || !saved ? "Save" : "Remove"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </article>
            );
          })}
        </div>
      )}

      {/* ---------- Candidate chooser ---------- */}
      {choosing && (
        <Modal
          title={choosing.name}
          subtitle="Choose whose performance you'd like to watch."
          onClose={() => setChoosing(null)}
        >
          <div className="highlight-choices">
            {PLACES.map((place) => {
              const entry = rankedEntries(choosing, data)[place.rank - 1];
              const url = highlights.programWinnerUrls[choosing.id]?.[place.key];
              const grade = entry ? entryGrade(entry, choosing, data) : null;
              return (
                <button
                  key={place.key}
                  type="button"
                  className="highlight-choice"
                  disabled={!url}
                  onClick={() => openVideo(choosing, place)}
                >
                  <span className={`place-dot place-${place.rank}`}>{place.rank}</span>
                  <div>
                    <strong>{place.label}</strong>
                    <span className="muted">{candidateName(choosing, entry)}</span>
                  </div>
                  {grade && <span className="chip">{grade.name}</span>}
                  {url ? <Play size={17} /> : <span className="muted">No video</span>}
                </button>
              );
            })}
          </div>
        </Modal>
      )}

      {/* ---------- Player ---------- */}
      {player && (
        <Modal
          title={player.title}
          subtitle={player.subtitle}
          onClose={() => setPlayer(null)}
          wide
          footer={
            <div className="form-actions">
              <a className="btn btn-secondary btn-md" href={player.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={15} /> Open on YouTube
              </a>
              <Button onClick={() => setPlayer(null)}>Close</Button>
            </div>
          }
        >
          <div className="highlight-player">
            <iframe
              src={embedUrl(player.url)}
              title={player.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </Modal>
      )}
    </>
  );
}
