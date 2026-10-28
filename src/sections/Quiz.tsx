import { useEffect, useState, type FormEvent } from "react";
import { Check, Clock3, Info, Megaphone, Plus, Send, Trash2, Trophy, X } from "lucide-react";
import { Button, Empty, Field, Modal, PageHead, SearchInput } from "../ui";
import { getCategoryName, getTeamName, id, quizPointsFor, type QuizQuestion } from "../types";
import type { SectionProps } from "./common";

const clean = (value: string) => value.trim().replace(/\s+/g, " ");

function formatCountdown(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function QuizBuilderSection({ fest, user, onChange, notify }: SectionProps) {
  const data = fest.data;
  const [question, setQuestion] = useState("");
  const [type, setType] = useState<QuizQuestion["answerType"]>("options");
  const [options, setOptions] = useState(["", ""]);
  const [timerMin, setTimerMin] = useState("");
  const [timerSec, setTimerSec] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const prompt = clean(question);
    if (!prompt) return notify("Type the quiz question.");
    const values = options.map(clean).filter(Boolean);
    if (type === "options" && values.length < 2) return notify("Add at least two options.");
    const minutes = Math.max(0, Math.floor(Number(timerMin) || 0));
    const seconds = Math.max(0, Math.floor(Number(timerSec) || 0));
    if (minutes > 999 || seconds > 59) return notify("Timer must be under 999 minutes and 59 seconds.");
    const totalSeconds = minutes * 60 + seconds;
    const createdAt = new Date().toISOString();
    const quiz: QuizQuestion = {
      id: id(),
      question: prompt,
      answerType: type,
      options: type === "options" ? values : [],
      published: true,
      createdAt,
      timerMinutes: minutes || undefined,
      timerSeconds: seconds || undefined,
      closesAt: totalSeconds > 0 ? new Date(Date.now() + totalSeconds * 1000).toISOString() : undefined,
    };
    onChange(current => ({ ...current, quizzes: [...(current.quizzes || []), quiz] }), `${user.name} published a quiz`);
    setQuestion(""); setOptions(["", ""]); setType("options"); setTimerMin(""); setTimerSec("");
    notify(totalSeconds > 0 ? "Quiz published with a timer" : "Quiz published to every member");
  };
  const remove = (quiz: QuizQuestion) => {
    if (!window.confirm(`Delete “${quiz.question}” and all its answers?`)) return;
    onChange(current => ({ ...current, quizzes: current.quizzes.filter(item => item.id !== quiz.id), quizAnswers: current.quizAnswers.filter(answer => answer.quizId !== quiz.id) }), "Deleted a quiz");
    notify("Quiz deleted");
  };
  const updateOption = (index: number, value: string) => setOptions(previous => previous.map((item, i) => i === index ? value : item));

  return <>
    <PageHead eyebrow="QUIZ MASTER / CREATE" title="Add a quiz" description="Publish one-point questions to every member. Options are selected by default." />
    <form className="quiz-builder" onSubmit={submit}>
      <Field label="Question"><textarea autoFocus rows={3} value={question} onChange={event => setQuestion(event.target.value)} placeholder="Type the quiz question" /></Field>
      <Field label="Answer type"><select value={type} onChange={event => setType(event.target.value as QuizQuestion["answerType"])}><option value="options">Options</option><option value="text">Text answer</option></select></Field>
      {type === "options" && <div className="quiz-options"><span className="field-label">Options</span>{options.map((option, index) => <div className="quiz-option-edit" key={index}><span className="quiz-option-num">{index + 1}</span><input value={option} onChange={event => updateOption(index, event.target.value)} placeholder={`Option ${index + 1}`} />{options.length > 2 && <button type="button" aria-label={`Remove option ${index + 1}`} onClick={() => setOptions(options.filter((_, i) => i !== index))}><Trash2 size={15} /></button>}</div>)}<button type="button" className="add-inline" onClick={() => setOptions([...options, ""])}><Plus size={15} /> Add another option</button></div>}
      <div className="quiz-timer-row">
        <Field label="Timer · minutes" hint="How long members can answer. Leave both empty for no limit."><input type="number" min="0" max="999" value={timerMin} onChange={event => setTimerMin(event.target.value)} placeholder="e.g. 5" /></Field>
        <Field label="Timer · seconds"><input type="number" min="0" max="59" value={timerSec} onChange={event => setTimerSec(event.target.value)} placeholder="e.g. 30" /></Field>
      </div>
      <div className="form-actions"><Button type="submit"><Send size={16} /> Submit and make public</Button></div>
    </form>
    <div className="summary-section"><div className="section-minihead"><span className="eyebrow">PUBLIC QUESTIONS</span><h2>Published quizzes</h2></div>{data.quizzes.length ? <div className="quiz-list">{[...data.quizzes].reverse().map((quiz, index) => <div key={quiz.id} className="quiz-row"><span>{String(data.quizzes.length - index).padStart(2, "0")}</span><div><strong>{quiz.question}</strong><small>{quiz.answerType === "options" ? `${quiz.options.length} options` : "Text answer"} · {(quiz.timerMinutes || 0) * 60 + (quiz.timerSeconds || 0) > 0 ? `timer ${String(quiz.timerMinutes || 0).padStart(2, "0")}:${String(quiz.timerSeconds || 0).padStart(2, "0")}` : "no time limit"}{quiz.resultPublished ? " · result published" : ""}</small></div><button aria-label={`Delete ${quiz.question}`} onClick={() => remove(quiz)}><Trash2 size={15} /></button></div>)}</div> : <Empty title="No quiz questions yet" description="Your public questions appear here after you submit them." />}</div>
  </>;
}

export function QuizPointsSection({ fest }: SectionProps) {
  const data = fest.data;
  const [query, setQuery] = useState("");
  const rows = data.members.map(member => ({ member, points: quizPointsFor(member.id, data), answered: data.quizAnswers.filter(answer => answer.memberId === member.id).length })).filter(row => row.member.name.toLowerCase().includes(query.toLowerCase())).sort((a, b) => b.points - a.points || a.member.name.localeCompare(b.member.name));
  return <><PageHead eyebrow="QUIZ MASTER / SCOREBOARD" title="Quiz points" description="Points from published results only. Members can answer each question once." /><div className="section-toolbar"><SearchInput value={query} onChange={setQuery} placeholder="Search members" /><span className="toolbar-count">{data.quizzes.length} public questions</span></div>{rows.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>RANK</th><th>MEMBER</th><th>CATEGORY</th><th>TEAM</th><th>ANSWERED</th><th>POINTS</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.member.id}><td>{String(index + 1).padStart(2, "0")}</td><td><strong>{row.member.name}</strong></td><td>{getCategoryName(data, row.member.categoryId)}</td><td>{getTeamName(data, row.member.teamId)}</td><td>{row.answered}</td><td><strong className="quiz-point"><Trophy size={14} /> {row.points}</strong></td></tr>)}</tbody></table></div> : <Empty title="No members yet" description="Quiz points appear as members submit answers." />}</>;
}

export function QuizAnswersSection({ fest, onChange, notify }: SectionProps) {
  const data = fest.data;
  const mark = (answerId: string, correct: boolean) => {
    onChange(current => ({ ...current, quizAnswers: current.quizAnswers.map(answer => answer.id === answerId ? { ...answer, correct, reviewed: true } : answer) }), `Marked a quiz answer ${correct ? "correct" : "incorrect"}`);
    notify(correct ? "Marked correct — point adds when you publish the result" : "Marked incorrect");
  };
  return <><PageHead eyebrow="QUIZ MASTER / REVIEW" title="All answers" description="Tick or cross every answer. Points are added only when you publish the result." />{data.quizzes.length ? <div className="quiz-answer-groups">{[...data.quizzes].reverse().map(quiz => { const answers = data.quizAnswers.filter(answer => answer.quizId === quiz.id); return <section key={quiz.id}><div className="section-minihead"><div><span className="eyebrow">{quiz.answerType === "options" ? "OPTIONS QUESTION" : "TEXT QUESTION"}</span><h2>{quiz.question}</h2></div><span className="toolbar-count">{answers.length} answers</span></div>{quiz.answerType === "options" && <p className="muted small-text quiz-options-line">Options: {quiz.options.join(" · ")}</p>}{answers.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>MEMBER</th><th>CATEGORY</th><th>ANSWER</th><th>REVIEW</th></tr></thead><tbody>{answers.map(answer => { const member = data.members.find(item => item.id === answer.memberId); return <tr key={answer.id}><td><strong>{member?.name || "Unknown member"}</strong></td><td>{member ? getCategoryName(data, member.categoryId) : "—"}</td><td>{answer.answer}</td><td><div className="review-actions"><button type="button" aria-label={`Mark ${member?.name || "answer"} correct`} title="Mark correct" className={answer.reviewed && answer.correct ? "active-tick" : ""} onClick={() => mark(answer.id, true)}><Check size={16} /></button><button type="button" aria-label={`Mark ${member?.name || "answer"} incorrect`} title="Mark incorrect" className={answer.reviewed && !answer.correct ? "active-cross" : ""} onClick={() => mark(answer.id, false)}><X size={16} /></button></div></td></tr>; })}</tbody></table></div> : <p className="muted">No answers yet.</p>}</section>; })}</div> : <Empty title="No quizzes yet" description="Create a question to review member answers here." />}</>;
}

export function QuizPublishSection({ fest, onChange, notify }: SectionProps) {
  const data = fest.data;
  const [inspectId, setInspectId] = useState<string | null>(null);
  const inspected = data.quizzes.find(quiz => quiz.id === inspectId);
  const publish = (quizId: string) => {
    const quiz = data.quizzes.find(item => item.id === quizId);
    if (!quiz) return;
    const winners = data.quizAnswers.filter(answer => answer.quizId === quizId && answer.correct).length;
    onChange(current => ({ ...current, quizzes: current.quizzes.map(item => item.id === quizId ? { ...item, resultPublished: true, resultPublishedAt: new Date().toISOString() } : item) }), `Published result for quiz “${quiz.question.slice(0, 40)}”`);
    notify(winners ? `Result published — ${winners} member${winners === 1 ? "" : "s"} earned a point` : "Result published — no correct answers this time");
  };
  return <><PageHead eyebrow="QUIZ MASTER / PUBLISH" title="Publish result" description="Publishing adds one point to every member you marked correct." />{data.quizzes.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Q NO.</th><th>QUESTION</th><th>TYPE</th><th>MARKED CORRECT</th><th>STATUS</th><th className="align-right">ACTIONS</th></tr></thead><tbody>{[...data.quizzes].map((quiz, index) => <tr key={quiz.id}><td><strong>Q{index + 1}</strong></td><td>{quiz.question}</td><td>{quiz.answerType === "options" ? "Options" : "Text"}</td><td>{data.quizAnswers.filter(answer => answer.quizId === quiz.id && answer.correct).length}</td><td>{quiz.resultPublished ? <span className="quiz-correct"><Check size={13} /> Published</span> : <span className="muted">Not published</span>}</td><td><div className="row-actions"><button onClick={() => setInspectId(quiz.id)}><Info size={14} /> Info</button>{!quiz.resultPublished && <button onClick={() => publish(quiz.id)}><Megaphone size={14} /> Publish</button>}</div></td></tr>)}</tbody></table></div> : <Empty title="No quizzes yet" description="Publish a quiz first, then publish its result here." />}
  {inspected && <Modal title={`Question ${data.quizzes.findIndex(item => item.id === inspected.id) + 1}`} subtitle={inspected.answerType === "options" ? "Options question" : "Text-answer question"} onClose={() => setInspectId(null)}><div className="detail-list"><div><span>Question</span><strong>{inspected.question}</strong></div>{inspected.answerType === "options" && <div><span>Options</span><strong>{inspected.options.join(" · ")}</strong></div>}<div><span>Timer</span><strong>{(inspected.timerMinutes || 0) * 60 + (inspected.timerSeconds || 0) > 0 ? `${String(inspected.timerMinutes || 0).padStart(2, "0")}:${String(inspected.timerSeconds || 0).padStart(2, "0")}` : "No time limit"}</strong></div><div><span>Answers</span><strong>{data.quizAnswers.filter(answer => answer.quizId === inspected.id).length} submitted · {data.quizAnswers.filter(answer => answer.quizId === inspected.id && answer.correct).length} marked correct</strong></div><div><span>Points on publish</span><strong>1 per correct answer</strong></div></div></Modal>}</>;
}

export function MemberQuizSection({ fest, user, onChange, notify }: SectionProps) {
  const data = fest.data;
  const memberId = user.memberId || user.id;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [now, setNow] = useState(() => Date.now());
  const published = data.quizzes.filter(quiz => quiz.published);
  const ownAnswers = data.quizAnswers.filter(answer => answer.memberId === memberId);
  const points = quizPointsFor(memberId, data);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const remainingMs = (quiz: { closesAt?: string }) => quiz.closesAt ? Math.max(0, new Date(quiz.closesAt).getTime() - now) : null;
  const submit = (quizId: string) => {
    const quiz = data.quizzes.find(item => item.id === quizId);
    if (!quiz) return;
    if (ownAnswers.some(answer => answer.quizId === quiz.id)) return notify("You already answered this question.");
    if (quiz.closesAt && new Date(quiz.closesAt).getTime() <= Date.now()) return notify("Time is up for this question.");
    const answer = clean(answers[quiz.id] || "");
    if (!answer) return notify("Choose or type an answer first.");
    if (quiz.answerType === "options" && !quiz.options.includes(answer)) return notify("Choose one of the given options.");
    onChange(current => ({ ...current, quizAnswers: [...(current.quizAnswers || []), { id: id(), quizId: quiz.id, memberId, answer, correct: false, submittedAt: new Date().toISOString() }] }), `${user.name} answered a quiz`);
    notify("Answer submitted — points are added when the result is published");
  };
  return <><PageHead eyebrow="YOUR FEST / QUIZ" title="Quiz" description="Answer each public question once before its timer ends. Points are added when results are published." action={<div className="quiz-score"><Trophy size={17} /><span>{points}</span> points</div>} />{published.length ? <div className="quiz-member-list">{[...published].reverse().map((quiz, index) => { const done = ownAnswers.find(answer => answer.quizId === quiz.id); const left = remainingMs(quiz); const expired = left !== null && left <= 0; const publishedResult = Boolean(quiz.resultPublished); return <article key={quiz.id} className={`quiz-member-card ${done ? "done" : ""}`}><div className="quiz-member-head"><span>QUESTION {String(published.length - index).padStart(2, "0")}</span><span className="quiz-head-right">{left !== null && !done && <span className={`quiz-timer ${expired ? "expired" : ""}`}><Clock3 size={13} /> {expired ? "Time up" : formatCountdown(left)}</span>}{done && <span className={publishedResult && done.correct ? "quiz-correct" : "muted"}>{publishedResult ? (done.correct ? <><Check size={13} /> +1 point</> : "Reviewed") : "Submitted"}</span>}</span></div><h3>{quiz.question}</h3>{done ? <p className="quiz-your-answer">Your answer: <strong>{done.answer}</strong></p> : expired ? <p className="muted">The timer has ended for this question.</p> : quiz.answerType === "options" ? <div className="quiz-member-options">{quiz.options.map(option => <label key={option}><input type="radio" name={`quiz-${quiz.id}`} checked={answers[quiz.id] === option} onChange={() => setAnswers({ ...answers, [quiz.id]: option })} /><span>{option}</span></label>)}</div> : <Field label="Your answer"><input value={answers[quiz.id] || ""} onChange={event => setAnswers({ ...answers, [quiz.id]: event.target.value })} placeholder="Type your answer" /></Field>}{!done && !expired && <div className="form-actions"><Button onClick={() => submit(quiz.id)}>Confirm answer <Check size={15} /></Button></div>}</article>; })}</div> : <Empty title="No public quiz right now" description="Questions from the Quiz Master will appear here." />}</>;
}
