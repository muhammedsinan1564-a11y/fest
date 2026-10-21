import { useState, type FormEvent } from "react";
import { Check, Plus, Send, Trash2, Trophy } from "lucide-react";
import { Button, Empty, Field, PageHead, SearchInput } from "../ui";
import { getCategoryName, getTeamName, id, type QuizQuestion } from "../types";
import type { SectionProps } from "./common";

const clean = (value: string) => value.trim().replace(/\s+/g, " ");
const correctText = (answer: string, correct: string) => clean(answer).toLocaleLowerCase() === clean(correct).toLocaleLowerCase();

export function QuizBuilderSection({ fest, user, onChange, notify }: SectionProps) {
  const data = fest.data;
  const [question, setQuestion] = useState("");
  const [type, setType] = useState<QuizQuestion["answerType"]>("options");
  const [options, setOptions] = useState(["", ""]);
  const [correct, setCorrect] = useState("");
  const [textCorrect, setTextCorrect] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const prompt = clean(question);
    if (!prompt) return notify("Type the quiz question.");
    const values = options.map(clean).filter(Boolean);
    if (type === "options" && values.length < 2) return notify("Add at least two options.");
    const answer = type === "options" ? correct || values[0] : clean(textCorrect);
    if (!answer) return notify("Set the correct answer so points can be calculated.");
    const quiz: QuizQuestion = { id: id(), question: prompt, answerType: type, options: type === "options" ? values : [], correctAnswer: answer, published: true, createdAt: new Date().toISOString() };
    onChange(current => ({ ...current, quizzes: [...(current.quizzes || []), quiz] }), `${user.name} published a quiz`);
    setQuestion(""); setOptions(["", ""]); setCorrect(""); setTextCorrect(""); setType("options");
    notify("Quiz published to every member");
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
      <Field label="Answer type"><select value={type} onChange={event => { setType(event.target.value as QuizQuestion["answerType"]); setCorrect(""); }}><option value="options">Options</option><option value="text">Text answer</option></select></Field>
      {type === "options" ? <div className="quiz-options"><span className="field-label">Options · choose the correct one</span>{options.map((option, index) => <div className="quiz-option-edit" key={index}><input type="radio" name="correct-option" aria-label={`Set option ${index + 1} as correct`} checked={Boolean(option) && correct === option} onChange={() => setCorrect(option)} /><input value={option} onChange={event => { const old = option; updateOption(index, event.target.value); if (correct === old) setCorrect(event.target.value); }} placeholder={`Option ${index + 1}`} />{options.length > 2 && <button type="button" aria-label={`Remove option ${index + 1}`} onClick={() => { setOptions(options.filter((_, i) => i !== index)); if (correct === option) setCorrect(""); }}><Trash2 size={15} /></button>}</div>)}<button type="button" className="add-inline" onClick={() => setOptions([...options, ""])}><Plus size={15} /> Add another option</button></div>
        : <Field label="Correct text answer" hint="Member answers are matched without case sensitivity."><input value={textCorrect} onChange={event => setTextCorrect(event.target.value)} placeholder="Type the expected answer" /></Field>}
      <div className="form-actions"><Button type="submit"><Send size={16} /> Submit and make public</Button></div>
    </form>
    <div className="summary-section"><div className="section-minihead"><span className="eyebrow">PUBLIC QUESTIONS</span><h2>Published quizzes</h2></div>{data.quizzes.length ? <div className="quiz-list">{[...data.quizzes].reverse().map((quiz, index) => <div key={quiz.id} className="quiz-row"><span>{String(data.quizzes.length - index).padStart(2, "0")}</span><div><strong>{quiz.question}</strong><small>{quiz.answerType === "options" ? `${quiz.options.length} options` : "Text answer"} · correct: {quiz.correctAnswer}</small></div><button aria-label={`Delete ${quiz.question}`} onClick={() => remove(quiz)}><Trash2 size={15} /></button></div>)}</div> : <Empty title="No quiz questions yet" description="Your public questions appear here after you submit them." />}</div>
  </>;
}

export function QuizPointsSection({ fest }: SectionProps) {
  const data = fest.data;
  const [query, setQuery] = useState("");
  const rows = data.members.map(member => ({ member, points: data.quizAnswers.filter(answer => answer.memberId === member.id && answer.correct).length, answered: data.quizAnswers.filter(answer => answer.memberId === member.id).length })).filter(row => row.member.name.toLowerCase().includes(query.toLowerCase())).sort((a, b) => b.points - a.points || a.member.name.localeCompare(b.member.name));
  return <><PageHead eyebrow="QUIZ MASTER / SCOREBOARD" title="Quiz points" description="One point for every right answer. Members can answer each question once." /><div className="section-toolbar"><SearchInput value={query} onChange={setQuery} placeholder="Search members" /><span className="toolbar-count">{data.quizzes.length} public questions</span></div>{rows.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>RANK</th><th>MEMBER</th><th>CATEGORY</th><th>TEAM</th><th>ANSWERED</th><th>POINTS</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.member.id}><td>{String(index + 1).padStart(2, "0")}</td><td><strong>{row.member.name}</strong></td><td>{getCategoryName(data, row.member.categoryId)}</td><td>{getTeamName(data, row.member.teamId)}</td><td>{row.answered}</td><td><strong className="quiz-point"><Trophy size={14} /> {row.points}</strong></td></tr>)}</tbody></table></div> : <Empty title="No members yet" description="Quiz points appear as members submit answers." />}</>;
}

export function QuizAnswersSection({ fest }: SectionProps) {
  const data = fest.data;
  const textQuizzes = data.quizzes.filter(quiz => quiz.answerType === "text");
  return <><PageHead eyebrow="QUIZ MASTER / TEXT ANSWERS" title="All answers" description="Only text-answer quizzes appear here. Option answers stay in the points summary." />{textQuizzes.length ? <div className="quiz-answer-groups">{[...textQuizzes].reverse().map(quiz => { const answers = data.quizAnswers.filter(answer => answer.quizId === quiz.id); return <section key={quiz.id}><div className="section-minihead"><div><span className="eyebrow">TEXT QUESTION</span><h2>{quiz.question}</h2></div><span className="toolbar-count">{answers.length} answers</span></div>{answers.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>MEMBER</th><th>CATEGORY</th><th>ANSWER</th><th>RESULT</th></tr></thead><tbody>{answers.map(answer => { const member = data.members.find(item => item.id === answer.memberId); return <tr key={answer.id}><td><strong>{member?.name || "Unknown member"}</strong></td><td>{member ? getCategoryName(data, member.categoryId) : "—"}</td><td>{answer.answer}</td><td>{answer.correct ? <span className="quiz-correct"><Check size={13} /> Correct</span> : <span className="muted">Not correct</span>}</td></tr>; })}</tbody></table></div> : <p className="muted">No answers yet.</p>}</section>; })}</div> : <Empty title="No text-answer quizzes" description="Create a text-answer question to review member responses here." />}</>;
}

export function MemberQuizSection({ fest, user, onChange, notify }: SectionProps) {
  const data = fest.data;
  const memberId = user.memberId || user.id;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const published = data.quizzes.filter(quiz => quiz.published);
  const ownAnswers = data.quizAnswers.filter(answer => answer.memberId === memberId);
  const points = ownAnswers.filter(answer => answer.correct).length;
  const submit = (quiz: QuizQuestion) => {
    if (ownAnswers.some(answer => answer.quizId === quiz.id)) return notify("You already answered this question.");
    const answer = clean(answers[quiz.id] || "");
    if (!answer) return notify("Choose or type an answer first.");
    const correct = quiz.answerType === "text" ? correctText(answer, quiz.correctAnswer) : answer === quiz.correctAnswer;
    onChange(current => ({ ...current, quizAnswers: [...(current.quizAnswers || []), { id: id(), quizId: quiz.id, memberId, answer, correct, submittedAt: new Date().toISOString() }] }), `${user.name} answered a quiz`);
    notify(correct ? "Correct — you earned 1 point!" : "Answer submitted");
  };
  return <><PageHead eyebrow="YOUR FEST / QUIZ" title="Quiz" description="Answer each public question once. Every correct answer earns one point." action={<div className="quiz-score"><Trophy size={17} /><span>{points}</span> points</div>} />{published.length ? <div className="quiz-member-list">{[...published].reverse().map((quiz, index) => { const done = ownAnswers.find(answer => answer.quizId === quiz.id); return <article key={quiz.id} className={`quiz-member-card ${done ? "done" : ""}`}><div className="quiz-member-head"><span>QUESTION {String(published.length - index).padStart(2, "0")}</span>{done && <span className={done.correct ? "quiz-correct" : "muted"}>{done.correct ? <><Check size={13} /> +1 point</> : "Submitted"}</span>}</div><h3>{quiz.question}</h3>{done ? <p className="quiz-your-answer">Your answer: <strong>{done.answer}</strong></p> : quiz.answerType === "options" ? <div className="quiz-member-options">{quiz.options.map(option => <label key={option}><input type="radio" name={`quiz-${quiz.id}`} checked={answers[quiz.id] === option} onChange={() => setAnswers({ ...answers, [quiz.id]: option })} /><span>{option}</span></label>)}</div> : <Field label="Your answer"><input value={answers[quiz.id] || ""} onChange={event => setAnswers({ ...answers, [quiz.id]: event.target.value })} placeholder="Type your answer" /></Field>}{!done && <div className="form-actions"><Button onClick={() => submit(quiz)}>Confirm answer <Check size={15} /></Button></div>}</article>; })}</div> : <Empty title="No public quiz right now" description="Questions from the Quiz Master will appear here." />}</>;
}