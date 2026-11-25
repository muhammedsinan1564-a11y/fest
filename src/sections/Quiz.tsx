import { useEffect, useState, type FormEvent } from "react";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { Check, Clock3, Info, Megaphone, Plus, Send, Trash2, Trophy, X } from "lucide-react";
import { Button, Empty, Field, Modal, PageHead, SearchInput } from "../ui";
import { getCategoryName, getTeamName, id, quizPointsFor, type QuizQuestion } from "../types";
import type { SectionProps } from "./common";

const clean = (value: string) => value.trim().replace(/\s+/g, " ");

/** Formats remaining milliseconds as MM:SS (or H:MM:SS for timers ≥ 60m); never prints NaN. */
function formatCountdown(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "00:00";
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor(total / 60) % 60;
  const s = total % 60;
  return h
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Formats a configured duration (minutes + seconds) safely. */
function formatConfiguredTimer(minutes?: number, seconds?: number): string | null {
  const m = typeof minutes === "number" && Number.isFinite(minutes) && minutes > 0 ? Math.floor(minutes) : 0;
  const s = typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  if (m * 60 + s <= 0) return null;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Parses an optional non-negative integer field strictly so "-5", "abc", or "3.5" never slip through. */
function parseTimerInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

/** Safe remaining ms for a quiz with an optional closesAt ISO string; null when untimed. */
function getRemainingMs(closesAt: string | undefined, now: number): number | null {
  if (!closesAt) return null;
  const deadline = new Date(closesAt).getTime();
  if (Number.isNaN(deadline)) return 0;
  return Math.max(0, deadline - now);
}

/**
 * Only runs a 1-second interval while at least one quiz has an active live countdown,
 * and cleans up cleanly on unmount or when every timer finishes.
 */
function useLiveNow(activeTimers: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!activeTimers) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeTimers]);
  return now;
}

/** Multi-word case-insensitive matcher for search inputs. */
function matchesQuery(query: string, ...fields: string[]): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const haystack = fields.join(" ").toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

const SPRING = { type: "spring" as const, stiffness: 420, damping: 34 };

export function QuizBuilderSection({ fest, user, onChange, notify }: SectionProps) {
  const data = fest.data;
  const quizzes = data.quizzes ?? [];
  const [question, setQuestion] = useState("");
  const [type, setType] = useState<QuizQuestion["answerType"]>("options");
  const [options, setOptions] = useState(["", ""]);
  const [timerMin, setTimerMin] = useState("");
  const [timerSec, setTimerSec] = useState("");

  // Keep live timers fresh on published quiz rows without ticking unnecessarily when none are running.
  const hasRunningTimer = quizzes.some((quiz) => {
    if (!quiz.closesAt) return false;
    const deadline = new Date(quiz.closesAt).getTime();
    return Number.isFinite(deadline) && deadline > Date.now();
  });
  const now = useLiveNow(hasRunningTimer);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const prompt = clean(question);
    if (!prompt) return notify("Type the quiz question.");

    const values = options.map(clean).filter(Boolean);
    if (type === "options") {
      if (values.length < 2) return notify("Add at least two non-empty options.");
      const uniqueKeys = new Set(values.map((item) => item.toLowerCase()));
      if (uniqueKeys.size !== values.length) return notify("Remove duplicate options before publishing.");
    }

    const minutes = parseTimerInput(timerMin);
    const seconds = parseTimerInput(timerSec);
    if (minutes === null || seconds === null) {
      return notify("Enter whole non-negative numbers for the timer.");
    }
    if (minutes > 999 || seconds > 59) {
      return notify("Timer must be at most 999 minutes and 59 seconds.");
    }
    const totalSeconds = minutes * 60 + seconds;
    const createdAt = new Date().toISOString();
    const quiz: QuizQuestion = {
      id: id(),
      question: prompt,
      answerType: type,
      options: type === "options" ? values : [],
      published: true,
      createdAt,
      timerMinutes: minutes > 0 ? minutes : undefined,
      timerSeconds: seconds > 0 ? seconds : undefined,
      closesAt: totalSeconds > 0 ? new Date(Date.now() + totalSeconds * 1000).toISOString() : undefined,
    };
    onChange(
      (current) => ({ ...current, quizzes: [...(current.quizzes ?? []), quiz] }),
      `${user.name} published a quiz`
    );
    setQuestion("");
    setOptions(["", ""]);
    setType("options");
    setTimerMin("");
    setTimerSec("");
    notify(totalSeconds > 0 ? "Quiz published with a timer" : "Quiz published to every member");
  };

  const remove = (quiz: QuizQuestion) => {
    if (!window.confirm(`Delete “${quiz.question}” and all its answers?`)) return;
    onChange(
      (current) => ({
        ...current,
        quizzes: (current.quizzes ?? []).filter((item) => item.id !== quiz.id),
        quizAnswers: (current.quizAnswers ?? []).filter((answer) => answer.quizId !== quiz.id),
      }),
      "Deleted a quiz"
    );
    notify("Quiz deleted");
  };

  const updateOption = (index: number, value: string) =>
    setOptions((previous) => previous.map((item, i) => (i === index ? value : item)));

  const removeOption = (index: number) =>
    setOptions((previous) => (previous.length > 2 ? previous.filter((_, i) => i !== index) : previous));

  const addOption = () =>
    setOptions((previous) => (previous.length < 10 ? [...previous, ""] : previous));

  return (
    <MotionConfig reducedMotion="user">
      <PageHead
        eyebrow="QUIZ MASTER / CREATE"
        title="Add a quiz"
        description="Publish one-point questions to every member. Options are selected by default."
      />
      <form className="quiz-builder" onSubmit={submit}>
        <Field label="Question">
          <textarea
            autoFocus
            rows={3}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Type the quiz question"
          />
        </Field>
        <Field label="Answer type">
          <select value={type} onChange={(event) => setType(event.target.value as QuizQuestion["answerType"])}>
            <option value="options">Options</option>
            <option value="text">Text answer</option>
          </select>
        </Field>
        <AnimatePresence initial={false}>
          {type === "options" && (
            <motion.div
              key="options-editor"
              className="quiz-options"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18 }}
            >
              <span className="field-label">Options</span>
              {options.map((option, index) => (
                <div className="quiz-option-edit" key={index}>
                  <span className="quiz-option-num">{index + 1}</span>
                  <input
                    aria-label={`Option ${index + 1}`}
                    value={option}
                    onChange={(event) => updateOption(index, event.target.value)}
                    placeholder={`Option ${index + 1}`}
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      aria-label={`Remove option ${index + 1}`}
                      onClick={() => removeOption(index)}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
              {options.length < 10 && (
                <button type="button" className="add-inline" onClick={addOption}>
                  <Plus size={15} /> Add another option
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        <div className="quiz-timer-row">
          <Field label="Timer · minutes" hint="How long members can answer. Leave both empty for no limit.">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={999}
              step={1}
              value={timerMin}
              onChange={(event) => setTimerMin(event.target.value)}
              placeholder="e.g. 5"
            />
          </Field>
          <Field label="Timer · seconds" hint="0 to 59 seconds">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={59}
              step={1}
              value={timerSec}
              onChange={(event) => setTimerSec(event.target.value)}
              placeholder="e.g. 30"
            />
          </Field>
        </div>
        <div className="form-actions">
          <Button type="submit" icon={<Send size={16} />}>
            Submit and make public
          </Button>
        </div>
      </form>

      <div className="summary-section">
        <div className="section-minihead">
          <div>
            <span className="eyebrow">PUBLIC QUESTIONS</span>
            <h2>Published quizzes</h2>
          </div>
          <span className="toolbar-count">
            {quizzes.length} {quizzes.length === 1 ? "question" : "questions"}
          </span>
        </div>
        {quizzes.length ? (
          <div className="quiz-list">
            <AnimatePresence initial={false}>
              {[...quizzes].reverse().map((quiz, index) => {
                const opts = quiz.options ?? [];
                const configured = formatConfiguredTimer(quiz.timerMinutes, quiz.timerSeconds);
                const left = getRemainingMs(quiz.closesAt, now);
                const timerNote =
                  left !== null
                    ? left > 0
                      ? `live · ${formatCountdown(left)} left`
                      : "timer ended"
                    : configured
                    ? `timer ${configured}`
                    : "no time limit";
                return (
                  <motion.div
                    key={quiz.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.2 }}
                    className={`quiz-row ${left !== null && left > 0 ? "is-live" : ""}`}
                  >
                    <span className="quiz-row-index">{String(quizzes.length - index).padStart(2, "0")}</span>
                    <div className="quiz-row-copy">
                      <strong>{quiz.question}</strong>
                      <small>
                        {quiz.answerType === "options" ? `${opts.length} options` : "Text answer"} · {timerNote}
                        {quiz.resultPublished ? " · result published" : ""}
                      </small>
                    </div>
                    <button
                      type="button"
                      className="quiz-row-delete"
                      aria-label={`Delete ${quiz.question}`}
                      onClick={() => remove(quiz)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          <Empty title="No quiz questions yet" description="Your public questions appear here after you submit them." />
        )}
      </div>
    </MotionConfig>
  );
}

export function QuizPointsSection({ fest }: SectionProps) {
  const data = fest.data;
  const members = data.members ?? [];
  const quizzes = data.quizzes ?? [];
  const quizAnswers = data.quizAnswers ?? [];
  const safeQuizData = { quizzes, quizAnswers };
  const [query, setQuery] = useState("");

  // Compute ranks before filtering so searching never renumbers the leaderboard.
  const ranked = members
    .map((member) => ({
      member,
      points: quizPointsFor(member.id, safeQuizData),
      answered: quizAnswers.filter((answer) => answer.memberId === member.id).length,
    }))
    .sort((a, b) => b.points - a.points || b.answered - a.answered || a.member.name.localeCompare(b.member.name))
    .map((row, _index, list) => ({
      ...row,
      rank: list.findIndex((other) => other.points === row.points) + 1,
    }));

  const rows = ranked.filter((row) =>
    matchesQuery(
      query,
      row.member.name,
      row.member.code || "",
      getCategoryName(data, row.member.categoryId),
      getTeamName(data, row.member.teamId)
    )
  );

  return (
    <MotionConfig reducedMotion="user">
      <PageHead
        eyebrow="QUIZ MASTER / SCOREBOARD"
        title="Quiz points"
        description="Points from published results only. Members can answer each question once."
      />
      <div className="section-toolbar">
        <SearchInput value={query} onChange={setQuery} placeholder="Search members, team or category" />
        <span className="toolbar-count">
          {quizzes.length} public {quizzes.length === 1 ? "question" : "questions"}
        </span>
      </div>
      {rows.length ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>RANK</th>
                <th>MEMBER</th>
                <th>CATEGORY</th>
                <th>TEAM</th>
                <th>ANSWERED</th>
                <th>POINTS</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <motion.tr
                  key={row.member.id}
                  layout
                  transition={SPRING}
                  className={row.points > 0 && row.rank <= 3 ? `row-place-${row.rank}` : ""}
                >
                  <td className="mono">{String(row.rank).padStart(2, "0")}</td>
                  <td>
                    <strong>{row.member.name}</strong>
                  </td>
                  <td>{getCategoryName(data, row.member.categoryId)}</td>
                  <td>{getTeamName(data, row.member.teamId)}</td>
                  <td className="mono">{row.answered}</td>
                  <td>
                    <strong className="quiz-point mono">
                      <Trophy size={14} /> {row.points}
                    </strong>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title={query.trim() && members.length ? "No member matches that search" : "No members yet"}
          description={
            query.trim() && members.length
              ? "Check the spelling or clear the search."
              : "Quiz points appear as members submit answers."
          }
        />
      )}
    </MotionConfig>
  );
}

export function QuizAnswersSection({ fest, onChange, notify }: SectionProps) {
  const data = fest.data;
  const quizzes = data.quizzes ?? [];
  const quizAnswers = data.quizAnswers ?? [];
  const members = data.members ?? [];

  const mark = (answerId: string, correct: boolean) => {
    onChange(
      (current) => ({
        ...current,
        quizAnswers: (current.quizAnswers ?? []).map((answer) =>
          answer.id === answerId ? { ...answer, correct, reviewed: true } : answer
        ),
      }),
      `Marked a quiz answer ${correct ? "correct" : "incorrect"}`
    );
    notify(correct ? "Marked correct — point adds when you publish the result" : "Marked incorrect");
  };

  return (
    <MotionConfig reducedMotion="user">
      <PageHead
        eyebrow="QUIZ MASTER / REVIEW"
        title="All answers"
        description="Tick or cross every answer. Points are added only when you publish the result."
      />
      {quizzes.length ? (
        <div className="quiz-answer-groups">
          {[...quizzes].reverse().map((quiz) => {
            const answers = quizAnswers.filter((answer) => answer.quizId === quiz.id);
            const opts = quiz.options ?? [];
            const correctCount = answers.filter((answer) => answer.correct).length;
            return (
              <section key={quiz.id} className="quiz-answer-section">
                <div className="section-minihead">
                  <div>
                    <span className="eyebrow">
                      {quiz.answerType === "options" ? "OPTIONS QUESTION" : "TEXT QUESTION"}
                      {quiz.resultPublished ? " · RESULT PUBLISHED" : ""}
                    </span>
                    <h2>{quiz.question}</h2>
                  </div>
                  <span className="toolbar-count">
                    {answers.length} {answers.length === 1 ? "answer" : "answers"} · {correctCount} correct
                  </span>
                </div>
                {quiz.answerType === "options" && opts.length > 0 && (
                  <p className="muted small-text quiz-options-line">Options: {opts.join(" · ")}</p>
                )}
                {answers.length ? (
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>MEMBER</th>
                          <th>CATEGORY</th>
                          <th>ANSWER</th>
                          <th>REVIEW</th>
                        </tr>
                      </thead>
                      <tbody>
                        {answers.map((answer) => {
                          const member = members.find((item) => item.id === answer.memberId);
                          const isTick = Boolean(answer.reviewed && answer.correct);
                          const isCross = Boolean(answer.reviewed && !answer.correct);
                          return (
                            <tr key={answer.id}>
                              <td>
                                <strong>{member?.name || "Unknown member"}</strong>
                              </td>
                              <td>{member ? getCategoryName(data, member.categoryId) : "—"}</td>
                              <td>{answer.answer}</td>
                              <td>
                                <div className="review-actions">
                                  <button
                                    type="button"
                                    aria-label={`Mark ${member?.name || "answer"} correct`}
                                    aria-pressed={isTick}
                                    title="Mark correct"
                                    className={isTick ? "active-tick" : ""}
                                    onClick={() => mark(answer.id, true)}
                                  >
                                    <Check size={16} />
                                  </button>
                                  <button
                                    type="button"
                                    aria-label={`Mark ${member?.name || "answer"} incorrect`}
                                    aria-pressed={isCross}
                                    title="Mark incorrect"
                                    className={isCross ? "active-cross" : ""}
                                    onClick={() => mark(answer.id, false)}
                                  >
                                    <X size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="muted">No answers yet.</p>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <Empty title="No quizzes yet" description="Create a question to review member answers here." />
      )}
    </MotionConfig>
  );
}

export function QuizPublishSection({ fest, onChange, notify }: SectionProps) {
  const data = fest.data;
  const quizzes = data.quizzes ?? [];
  const quizAnswers = data.quizAnswers ?? [];
  const [inspectId, setInspectId] = useState<string | null>(null);
  const inspected = inspectId ? quizzes.find((quiz) => quiz.id === inspectId) : undefined;
  const inspectedIndex = inspected ? quizzes.findIndex((item) => item.id === inspected.id) : -1;

  const publish = (quizId: string) => {
    const quiz = quizzes.find((item) => item.id === quizId);
    if (!quiz || quiz.resultPublished) return;
    const answers = quizAnswers.filter((answer) => answer.quizId === quizId);
    const unreviewed = answers.filter((answer) => !answer.reviewed).length;
    if (
      unreviewed > 0 &&
      !window.confirm(
        `${unreviewed} answer${unreviewed === 1 ? " has" : "s have"} not been reviewed yet. Publish this result anyway?`
      )
    ) {
      return;
    }
    const winners = answers.filter((answer) => answer.correct).length;
    onChange(
      (current) => ({
        ...current,
        quizzes: (current.quizzes ?? []).map((item) =>
          item.id === quizId ? { ...item, resultPublished: true, resultPublishedAt: new Date().toISOString() } : item
        ),
      }),
      `Published result for quiz “${quiz.question.slice(0, 40)}”`
    );
    notify(
      winners
        ? `Result published — ${winners} member${winners === 1 ? "" : "s"} earned a point`
        : "Result published — no correct answers this time"
    );
  };

  return (
    <MotionConfig reducedMotion="user">
      <PageHead
        eyebrow="QUIZ MASTER / PUBLISH"
        title="Publish result"
        description="Publishing adds one point to every member you marked correct."
      />
      {quizzes.length ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Q NO.</th>
                <th>QUESTION</th>
                <th>TYPE</th>
                <th>MARKED CORRECT</th>
                <th>STATUS</th>
                <th className="align-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {quizzes.map((quiz, index) => {
                const answers = quizAnswers.filter((answer) => answer.quizId === quiz.id);
                const correctCount = answers.filter((answer) => answer.correct).length;
                return (
                  <tr key={quiz.id}>
                    <td className="mono">
                      <strong>Q{index + 1}</strong>
                    </td>
                    <td>{quiz.question}</td>
                    <td>{quiz.answerType === "options" ? "Options" : "Text"}</td>
                    <td className="mono">{correctCount}</td>
                    <td>
                      {quiz.resultPublished ? (
                        <span className="quiz-correct">
                          <Check size={13} /> Published
                        </span>
                      ) : (
                        <span className="muted">Not published</span>
                      )}
                    </td>
                    <td className="align-right">
                      <div className="row-actions">
                        <button type="button" onClick={() => setInspectId(quiz.id)}>
                          <Info size={14} /> Info
                        </button>
                        {!quiz.resultPublished && (
                          <button type="button" onClick={() => publish(quiz.id)}>
                            <Megaphone size={14} /> Publish
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="No quizzes yet" description="Publish a quiz first, then publish its result here." />
      )}

      <AnimatePresence>
        {inspected && (
          <Modal
            key={inspected.id}
            title={`Question ${inspectedIndex + 1}`}
            subtitle={inspected.answerType === "options" ? "Options question" : "Text-answer question"}
            onClose={() => setInspectId(null)}
          >
            <div className="detail-list">
              <div>
                <span>Question</span>
                <strong>{inspected.question}</strong>
              </div>
              {inspected.answerType === "options" && (inspected.options ?? []).length > 0 && (
                <div>
                  <span>Options</span>
                  <strong>{(inspected.options ?? []).join(" · ")}</strong>
                </div>
              )}
              <div>
                <span>Timer</span>
                <strong>{formatConfiguredTimer(inspected.timerMinutes, inspected.timerSeconds) ?? "No time limit"}</strong>
              </div>
              <div>
                <span>Answers</span>
                <strong>
                  {quizAnswers.filter((answer) => answer.quizId === inspected.id).length} submitted ·{" "}
                  {quizAnswers.filter((answer) => answer.quizId === inspected.id && answer.correct).length} marked correct
                </strong>
              </div>
              <div>
                <span>Points on publish</span>
                <strong>1 per correct answer</strong>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}

export function MemberQuizSection({ fest, user, onChange, notify }: SectionProps) {
  const data = fest.data;
  const quizzes = data.quizzes ?? [];
  const quizAnswers = data.quizAnswers ?? [];
  const memberId = user.memberId || user.id;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const published = quizzes.filter((quiz) => quiz.published);
  const ownAnswers = quizAnswers.filter((answer) => answer.memberId === memberId);
  const points = quizPointsFor(memberId, { quizzes, quizAnswers });

  // Run the 1-second tick only while at least one unanswered quiz has a live countdown.
  const hasActiveCountdown = published.some((quiz) => {
    if (!quiz.closesAt) return false;
    if (ownAnswers.some((answer) => answer.quizId === quiz.id)) return false;
    const deadline = new Date(quiz.closesAt).getTime();
    return Number.isFinite(deadline) && deadline > Date.now();
  });
  const now = useLiveNow(hasActiveCountdown);

  const submit = (quizId: string) => {
    const quiz = quizzes.find((item) => item.id === quizId);
    if (!quiz) return;
    if (ownAnswers.some((answer) => answer.quizId === quiz.id)) {
      return notify("You already answered this question.");
    }
    const leftNow = getRemainingMs(quiz.closesAt, Date.now());
    if (leftNow !== null && leftNow <= 0) {
      return notify("Time is up for this question.");
    }
    const answer = clean(answers[quiz.id] ?? "");
    if (!answer) return notify("Choose or type an answer first.");
    const opts = quiz.options ?? [];
    if (quiz.answerType === "options" && opts.length > 0 && !opts.includes(answer)) {
      return notify("Choose one of the given options.");
    }

    let duplicate = false;
    onChange((current) => {
      const existing = current.quizAnswers ?? [];
      if (existing.some((item) => item.quizId === quiz.id && item.memberId === memberId)) {
        duplicate = true;
        return current;
      }
      return {
        ...current,
        quizAnswers: [
          ...existing,
          { id: id(), quizId: quiz.id, memberId, answer, correct: false, submittedAt: new Date().toISOString() },
        ],
      };
    }, `${user.name} answered a quiz`);

    if (duplicate) return notify("You already answered this question.");
    setAnswers((previous) => ({ ...previous, [quiz.id]: "" }));
    notify("Answer submitted — points are added when the result is published");
  };

  return (
    <MotionConfig reducedMotion="user">
      <PageHead
        eyebrow="YOUR FEST / QUIZ"
        title="Quiz"
        description="Answer each public question once before its timer ends. Points are added when results are published."
        action={
          <div className="quiz-score">
            <Trophy size={17} />
            <motion.span key={points} initial={{ scale: 1.35 }} animate={{ scale: 1 }}>
              {points}
            </motion.span>{" "}
            {points === 1 ? "point" : "points"}
          </div>
        }
      />
      {published.length ? (
        <div className="quiz-member-list">
          <AnimatePresence initial={false}>
            {[...published].reverse().map((quiz, index) => {
              const done = ownAnswers.find((answer) => answer.quizId === quiz.id);
              const left = getRemainingMs(quiz.closesAt, now);
              const expired = left !== null && left <= 0;
              const urgent = left !== null && !expired && left <= 15_000;
              const publishedResult = Boolean(quiz.resultPublished);
              const opts = quiz.options ?? [];
              const draft = answers[quiz.id] ?? "";

              return (
                <motion.article
                  key={quiz.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className={`quiz-member-card ${done ? "done" : ""}`}
                >
                  <div className="quiz-member-head">
                    <span>QUESTION {String(published.length - index).padStart(2, "0")}</span>
                    <span className="quiz-head-right">
                      {left !== null && !done && (
                        <span className={`quiz-timer ${expired ? "expired" : urgent ? "urgent" : ""}`}>
                          <Clock3 size={13} /> {expired ? "Time up" : formatCountdown(left)}
                        </span>
                      )}
                      {done && (
                        <span className={publishedResult && done.correct ? "quiz-correct" : "muted"}>
                          {publishedResult ? (
                            done.correct ? (
                              <>
                                <Check size={13} /> +1 point
                              </>
                            ) : (
                              "Reviewed"
                            )
                          ) : (
                            "Submitted"
                          )}
                        </span>
                      )}
                    </span>
                  </div>
                  <h3>{quiz.question}</h3>
                  {done ? (
                    <p className="quiz-your-answer">
                      Your answer: <strong>{done.answer}</strong>
                    </p>
                  ) : expired ? (
                    <p className="muted">The timer has ended for this question.</p>
                  ) : quiz.answerType === "options" && opts.length > 0 ? (
                    <div className="quiz-member-options" role="radiogroup" aria-label={quiz.question}>
                      {opts.map((option, optIdx) => (
                        <label key={`${optIdx}-${option}`} className={draft === option ? "selected" : ""}>
                          <input
                            type="radio"
                            name={`quiz-${quiz.id}`}
                            checked={draft === option}
                            onChange={() => setAnswers((previous) => ({ ...previous, [quiz.id]: option }))}
                          />
                          <span className="quiz-option-num">{optIdx + 1}</span>
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <Field label="Your answer">
                      <input
                        value={draft}
                        onChange={(event) => setAnswers((previous) => ({ ...previous, [quiz.id]: event.target.value }))}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            submit(quiz.id);
                          }
                        }}
                        placeholder="Type your answer"
                      />
                    </Field>
                  )}
                  {!done && !expired && (
                    <div className="form-actions">
                      <Button disabled={!clean(draft)} onClick={() => submit(quiz.id)}>
                        Confirm answer <Check size={15} />
                      </Button>
                    </div>
                  )}
                </motion.article>
              );
            })}
          </AnimatePresence>
        </div>
      ) : (
        <Empty title="No public quiz right now" description="Questions from the Quiz Master will appear here." />
      )}
    </MotionConfig>
  );
}
