import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, Clock3, Sparkles, Trophy, Users } from "lucide-react";
import { Button, Empty, Field, Modal, PageHead } from "../ui";
import { getCategoryName } from "../types";
import type { SectionProps } from "./common";

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

/** Reads prediction data safely, so a missing object can never crash the UI. */
function predictionOf(data: {
  prediction?: { active?: boolean; startedAt?: string; closesAt?: string; responses?: Record<string, string> };
}) {
  const source = data.prediction;
  return {
    active: source?.active === true,
    closesAt: source?.closesAt,
    startedAt: source?.startedAt,
    responses: source?.responses ?? {},
  };
}

/** Milliseconds left until the deadline; 0 when it has passed or never ends. */
function remaining(closesAt: string | undefined, now: number) {
  if (!closesAt) return 0;
  const deadline = new Date(closesAt).getTime();
  return Number.isNaN(deadline) ? 0 : Math.max(0, deadline - now);
}

/** Ticks once a second while the component is mounted. */
function useClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function clock(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor(seconds / 60) % 60;
  const s = seconds % 60;
  return h
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Timer duration from the minutes and seconds boxes.
 * Whitespace, negatives and non-numbers are ignored; NaN becomes 0.
 */
function durationSeconds(minutes: string, seconds: string) {
  const read = (raw: string, max: number) => {
    const trimmed = raw.trim();
    if (!trimmed) return 0;
    const value = Number(trimmed);
    if (!Number.isFinite(value) || value <= 0) return 0;
    return Math.min(max, Math.floor(value));
  };
  return read(minutes, 24 * 60) * 60 + read(seconds, 59);
}

const SPRING = { type: "spring" as const, stiffness: 420, damping: 34 };

/** Tally bar that grows with the vote share and settles smoothly. */
function TallyRow({ rank, name, count, share, leading }: { rank: number; name: string; count: number; share: number; leading: boolean }) {
  return (
    <motion.div
      layout
      transition={SPRING}
      className={`prediction-row ${leading ? "leading" : ""}`}
      data-rank={rank}
    >
      <span className="prediction-rank">{String(rank).padStart(2, "0")}</span>
      <div className="prediction-row-main">
        <strong>{name}</strong>
        <div className="prediction-bar">
          <motion.span
            initial={{ width: 0 }}
            animate={{ width: `${share}%` }}
            transition={{ type: "spring", stiffness: 140, damping: 24 }}
          />
        </div>
        <small>{count === 1 ? "1 prediction" : `${count} predictions`}</small>
      </div>
      <motion.b layout transition={SPRING} key={count}>
        {count}
      </motion.b>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Main admin view                                                     */
/* ------------------------------------------------------------------ */

export function PredictionSection({ fest, onChange, notify }: SectionProps) {
  const data = fest.data;
  const prediction = predictionOf(data);
  const [minutes, setMinutes] = useState("30");
  const [seconds, setSeconds] = useState("0");
  const [responseTeam, setResponseTeam] = useState("");
  const [responseCategory, setResponseCategory] = useState("");
  const now = useClock();

  const left = remaining(prediction.closesAt, now);
  const open = prediction.active && left > 0;

  /** One entry per vote, with the member and team looked up safely. */
  const responses = useMemo(
    () =>
      Object.entries(prediction.responses)
        .map(([memberId, teamId]) => ({
          memberId,
          member: data.members.find((item) => item.id === memberId),
          team: data.teams.find((item) => item.id === teamId),
        }))
        .filter((row) => row.member && row.team),
    [prediction.responses, data.members, data.teams]
  );

  const totals = useMemo(
    () =>
      data.teams
        .map((team) => ({
          team,
          count: responses.filter((row) => row.team?.id === team.id).length,
        }))
        .sort((a, b) => b.count - a.count || a.team.name.localeCompare(b.team.name)),
    [data.teams, responses]
  );
  const totalVotes = responses.length;
  // Filters for "who predicted what": members can be narrowed by team or category.
  const filteredResponses = responses.filter(
    (row) =>
      (!responseTeam || row.member?.teamId === responseTeam) &&
      (!responseCategory || row.member?.categoryId === responseCategory)
  );

  const start = () => {
    const duration = durationSeconds(minutes, seconds);
    if (duration < 1) return notify("Set a timer of at least one second.");
    const startedAt = new Date();
    const closesAt = new Date(startedAt.getTime() + duration * 1000);
    onChange(
      (current) => ({
        ...current,
        prediction: {
          active: true,
          startedAt: startedAt.toISOString(),
          closesAt: closesAt.toISOString(),
          responses: {},
        },
      }),
      "Started a fest winner prediction"
    );
    notify(`Prediction opened for ${Math.floor(duration / 60)}m ${duration % 60}s`);
  };

  const close = () => {
    onChange(
      (current) => ({ ...current, prediction: { ...current.prediction, active: false } }),
      "Closed the fest winner prediction"
    );
    notify("Prediction closed");
  };

  const countdown = clock(left);
  const closingSoon = open && left <= 10_000;
  const heading =
    open ? countdown : prediction.active ? "Time ended" : data.teams.length ? "Who will win?" : "No teams yet";

  return (
    <>
      <PageHead
        eyebrow="ENGAGEMENT / MEMBERS"
        title="Prediction"
        description="Open a timed vote for members to predict which team will win the fest."
      />

      <motion.section
        className={`prediction-control ${open ? "is-live" : ""}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        role="status"
        aria-live="polite"
      >
        <div className="prediction-control-copy">
          <span className="eyebrow">
            {open ? (closingSoon ? "CLOSING NOW" : "PREDICTION LIVE") : prediction.active ? "TIME ENDED" : "SET THE TIMER"}
          </span>
          <motion.h2 key={heading} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            {heading}
          </motion.h2>
          <p>
            {open
              ? `${totalVotes} ${totalVotes === 1 ? "member has" : "members have"} predicted so far.`
              : prediction.active
              ? "The timer ran out. Start a new round to collect fresh responses."
              : "Starting a new timer clears the previous responses."}
          </p>
        </div>
        <div className="prediction-timer">
          <Field label="Minutes" hint="Up to 24 hours">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={1440}
              value={minutes}
              onChange={(event) => setMinutes(event.target.value)}
            />
          </Field>
          <Field label="Seconds" hint="Up to 59">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={59}
              value={seconds}
              onChange={(event) => setSeconds(event.target.value)}
            />
          </Field>
          <div className="prediction-timer-actions">
            <Button onClick={start} icon={<Clock3 size={16} />}>
              {prediction.active ? "Start new timer" : "Submit and start"}
            </Button>
            {open && (
              <Button variant="secondary" onClick={close}>
                Close now
              </Button>
            )}
          </div>
        </div>
      </motion.section>

      <div className="summary-section">
        <div className="section-minihead">
          <div>
            <span className="eyebrow">PREDICTION TALLY</span>
            <h2>Team choices</h2>
          </div>
          <span className="toolbar-count">{totalVotes} predictions</span>
        </div>
        {totals.length ? (
          <div className="prediction-tally">
            <motion.div layout className="prediction-list">
              {totals.map((row, index) => (
                <TallyRow
                  key={row.team.id}
                  rank={index + 1}
                  name={row.team.name}
                  count={row.count}
                  share={totalVotes ? Math.round((row.count / totalVotes) * 100) : 0}
                  leading={index === 0 && row.count > 0}
                />
              ))}
            </motion.div>
          </div>
        ) : (
          <Empty title="No teams yet" description="Add teams before starting a prediction." />
        )}
      </div>

      <div className="summary-section">
        <div className="section-minihead">
          <div>
            <span className="eyebrow">MEMBER RESPONSES</span>
            <h2>Who predicted what</h2>
          </div>
          <span className="toolbar-count">{filteredResponses.length} of {totalVotes} responses</span>
        </div>
        <div className="print-select-chips response-filters">
          <select
            aria-label="Filter responses by team"
            value={responseTeam}
            onChange={(event) => setResponseTeam(event.target.value)}
          >
            <option value="">All teams</option>
            {data.teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter responses by category"
            value={responseCategory}
            onChange={(event) => setResponseCategory(event.target.value)}
          >
            <option value="">All categories</option>
            {data.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        {filteredResponses.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>MEMBER</th>
                  <th>CATEGORY</th>
                  <th>PREDICTED TEAM</th>
                </tr>
              </thead>
              <tbody>
                {filteredResponses.map((row) => (
                  <motion.tr key={row.memberId} layout transition={SPRING}>
                    <td>
                      <strong>{row.member?.name}</strong>
                    </td>
                    <td>{getCategoryName(data, row.member?.categoryId ?? "")}</td>
                    <td>{row.team?.name ?? "Unknown team"}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title={
              filteredResponses.length === 0 && (responseTeam || responseCategory)
                ? "No predictions match these filters"
                : "No predictions yet"
            }
            description={
              filteredResponses.length === 0 && (responseTeam || responseCategory)
                ? "Try clearing the team or category filter."
                : "Member names, categories and predicted teams appear here after they submit."
            }
          />
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Member-facing card                                                  */
/* ------------------------------------------------------------------ */

export function MemberPredictionCard({ fest, user, onChange, notify }: Pick<SectionProps, "fest" | "user" | "onChange" | "notify">) {
  const data = fest.data;
  const prediction = predictionOf(data);
  // Members vote with their member record; staff without one fall back to their user id.
  const memberId = user.memberId || user.id;
  const selected = prediction.responses[memberId];
  const [open, setOpen] = useState(false);
  const [teamId, setTeamId] = useState(selected ?? "");
  const now = useClock();

  useEffect(() => setTeamId(selected ?? ""), [selected]);

  const left = remaining(prediction.closesAt, now);
  const live = prediction.active && left > 0;
  const closingSoon = live && left <= 10_000;
  const team = selected ? data.teams.find((item) => item.id === selected) : undefined;
  const choices = data.teams.length > 0;

  if (!prediction.active && !selected) return null;

  const submit = () => {
    if (!live) return notify("The prediction timer has ended.");
    if (!teamId) return notify("Select the team you think will win.");
    onChange(
      (current) => ({
        ...current,
        prediction: {
          ...predictionOf(current),
          responses: { ...predictionOf(current).responses, [memberId]: teamId },
        },
      }),
      `${user.name} predicted the fest winner`
    );
    setOpen(false);
    notify("Your prediction is saved");
  };

  const banner = (
    <motion.button
      type="button"
      layout
      className={`member-prediction ${selected ? "submitted" : ""} ${closingSoon ? "closing" : ""}`}
      whileHover={live ? { y: -3 } : undefined}
      whileTap={live ? { scale: 0.99 } : undefined}
      onClick={() => live && choices && setOpen(true)}
      disabled={!live || !choices}
      aria-live="polite"
    >
      <span className="prediction-orb">
        {selected ? <Trophy size={22} /> : <Sparkles size={22} />}
      </span>
      <span className="prediction-copy">
        <small>{selected ? "YOUR FEST PREDICTION" : closingSoon ? "CLOSING NOW" : "PREDICTION IS LIVE"}</small>
        <strong>
          {selected
            ? `YOU PREDICTED ${(team?.name ?? "A TEAM").toUpperCase()} WILL WIN THE FEST`
            : "Who will win the fest?"}
        </strong>
        <em>{live ? `${clock(left)} remaining` : "Prediction closed"}</em>
      </span>
      {!selected && live && <Sparkles size={20} className="prediction-spark" />}
    </motion.button>
  );

  return (
    <>
      {banner}
      {open && (
        <Modal
          title="Who will win the fest?"
          subtitle={`Make one prediction before the timer ends · ${clock(left)} left`}
          onClose={() => setOpen(false)}
        >
          <div className="form-stack">
            {choices ? (
              <div className="prediction-team-options" role="radiogroup" aria-label="Predicted team">
                {data.teams.map((item, index) => (
                  <motion.label
                    key={item.id}
                    layout
                    className={`prediction-team-option ${teamId === item.id ? "picked" : ""}`}
                    whileHover={{ y: -2 }}
                    data-rank={index + 1}
                  >
                    <input
                      type="radio"
                      name={`predicted-team-${memberId}`}
                      value={item.id}
                      checked={teamId === item.id}
                      onChange={() => setTeamId(item.id)}
                    />
                    <span className="prediction-team-mark">{index + 1}</span>
                    <span className="prediction-team-name">{item.name}</span>
                    {teamId === item.id && <Check size={16} />}
                  </motion.label>
                ))}
              </div>
            ) : (
              <Empty title="No teams to pick from" description="Ask the main user to add teams first." />
            )}
            <div className="form-actions">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={!choices} icon={<Check size={16} />}>
                Submit prediction
              </Button>
            </div>
          </div>
        </Modal>
      )}
      {data.members.length > 0 && prediction.active && !selected && (
        <span className="sr-only" aria-hidden="true">
          <Users size={12} /> Prediction open to members
        </span>
      )}
    </>
  );
}
