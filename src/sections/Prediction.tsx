import { useEffect, useMemo, useState } from "react";
import { Check, Clock3, Sparkles, Trophy } from "lucide-react";
import { Button, Empty, Field, Modal, PageHead } from "../ui";
import { getCategoryName } from "../types";
import type { SectionProps } from "./common";

function remaining(closesAt?: string, now = Date.now()) {
  if (!closesAt) return 0;
  return Math.max(0, new Date(closesAt).getTime() - now);
}

function clock(ms: number) {
  const seconds = Math.ceil(ms / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor(seconds / 60) % 60;
  const s = seconds % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function PredictionSection({ fest, onChange, notify }: SectionProps) {
  const data = fest.data;
  const prediction = data.prediction || { active: false, responses: {} };
  const [minutes, setMinutes] = useState("30");
  const [seconds, setSeconds] = useState("0");
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const left = remaining(prediction.closesAt, now);
  const open = prediction.active && left > 0;
  const responses = Object.entries(prediction.responses || {}).map(([memberId, teamId]) => ({ member: data.members.find(member => member.id === memberId), team: data.teams.find(team => team.id === teamId) })).filter(row => row.member);
  const totals = useMemo(() => data.teams.map(team => ({ team, count: responses.filter(row => row.team?.id === team.id).length })).sort((a, b) => b.count - a.count), [data.teams, responses]);

  const start = () => {
    const duration = Math.max(1, (parseInt(minutes) || 0) * 60 + (parseInt(seconds) || 0));
    const startedAt = new Date();
    const closesAt = new Date(startedAt.getTime() + duration * 1000);
    onChange(current => ({ ...current, prediction: { active: true, startedAt: startedAt.toISOString(), closesAt: closesAt.toISOString(), responses: {} } }), "Started a fest winner prediction");
    notify("Prediction opened for every member");
  };
  const close = () => {
    onChange(current => ({ ...current, prediction: { ...current.prediction, active: false } }), "Closed the fest winner prediction");
    notify("Prediction closed");
  };

  return <><PageHead eyebrow="ENGAGEMENT / MEMBERS" title="Prediction" description="Open a timed vote for members to predict which team will win the fest." />
    <div className="prediction-control"><div><span className="eyebrow">{open ? "PREDICTION LIVE" : prediction.active ? "TIME ENDED" : "SET THE TIMER"}</span><h2>{open ? clock(left) : "Who will win?"}</h2><p>{open ? `${responses.length} members have predicted so far.` : "Starting a new timer clears the previous responses."}</p></div><div className="prediction-timer"><Field label="Minutes"><input type="number" min="0" max="1440" value={minutes} onChange={event => setMinutes(event.target.value)} /></Field><Field label="Seconds"><input type="number" min="0" max="59" value={seconds} onChange={event => setSeconds(event.target.value)} /></Field><Button onClick={start}><Clock3 size={16} /> {prediction.active ? "Start new timer" : "Submit and start"}</Button>{open && <Button variant="secondary" onClick={close}>Close now</Button>}</div></div>
    <div className="summary-section"><div className="section-minihead"><div><span className="eyebrow">PREDICTION TALLY</span><h2>Team choices</h2></div><span className="toolbar-count">{responses.length} predictions</span></div>{totals.length ? <div className="prediction-tally">{totals.map((row, index) => <div key={row.team.id}><span>{String(index + 1).padStart(2, "0")}</span><strong>{row.team.name}</strong><b>{row.count}</b></div>)}</div> : <Empty title="No teams yet" description="Add teams before starting a prediction." />}</div>
    <div className="summary-section"><div className="section-minihead"><div><span className="eyebrow">MEMBER RESPONSES</span><h2>Who predicted what</h2></div></div>{responses.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>MEMBER</th><th>CATEGORY</th><th>PREDICTED TEAM</th></tr></thead><tbody>{responses.map(row => <tr key={row.member!.id}><td><strong>{row.member!.name}</strong></td><td>{getCategoryName(data, row.member!.categoryId)}</td><td>{row.team?.name || "Unknown team"}</td></tr>)}</tbody></table></div> : <Empty title="No predictions yet" description="Member names, categories and predicted teams appear here after they submit." />}</div>
  </>;
}

export function MemberPredictionCard({ fest, user, onChange, notify }: Pick<SectionProps, "fest" | "user" | "onChange" | "notify">) {
  const data = fest.data;
  const prediction = data.prediction || { active: false, responses: {} };
  const memberId = user.memberId || user.id;
  const selected = prediction.responses?.[memberId];
  const [open, setOpen] = useState(false);
  const [teamId, setTeamId] = useState(selected || "");
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => setTeamId(selected || ""), [selected]);
  const left = remaining(prediction.closesAt, now);
  const live = prediction.active && left > 0;
  if (!prediction.active && !selected) return null;
  const team = data.teams.find(item => item.id === selected);
  const submit = () => {
    if (!teamId) return notify("Select the team you think will win.");
    if (!live) return notify("The prediction timer has ended.");
    onChange(current => ({ ...current, prediction: { ...current.prediction, responses: { ...(current.prediction?.responses || {}), [memberId]: teamId } } }), `${user.name} predicted the fest winner`);
    setOpen(false); notify("Your prediction is saved");
  };
  return <>
    <button className={`member-prediction ${selected ? "submitted" : ""}`} onClick={() => live && setOpen(true)}>
      <span className="prediction-orb"><Trophy size={22} /></span>
      <span><small>{selected ? "YOUR FEST PREDICTION" : "PREDICTION IS LIVE"}</small><strong>{selected ? `YOU PREDICTED ${team?.name?.toUpperCase() || "A TEAM"} WILL WIN THE FEST` : "Who will win the fest?"}</strong><em>{live ? `${clock(left)} remaining` : "Prediction closed"}</em></span>
      {!selected && live && <Sparkles size={20} />}
    </button>
    {open && <Modal title="Who will win the fest?" subtitle={`Make one prediction before the timer ends · ${clock(left)} left`} onClose={() => setOpen(false)}><div className="form-stack"><div className="prediction-team-options">{data.teams.map(item => <label key={item.id}><input type="radio" name="predicted-team" checked={teamId === item.id} onChange={() => setTeamId(item.id)} /><span>{item.name}</span></label>)}</div><div className="form-actions"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={submit}>Submit prediction <Check size={16} /></Button></div></div></Modal>}
  </>;
}