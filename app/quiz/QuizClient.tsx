"use client";

import { useState } from "react";
import { Markdown } from "@/components/Markdown";
import type { QuizQuestion, QuizResponse } from "@/lib/types";

const PRESETS = [
  "Supply and demand",
  "Elasticity",
  "Opportunity cost & PPF",
  "Market structures (perfect competition vs monopoly)",
  "Consumer behavior & utility",
  "Costs of production",
  "GDP & national income",
];

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; quiz: QuizResponse }
  | { kind: "error"; message: string };

export function QuizClient() {
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(5);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  async function start(t: string) {
    const trimmed = t.trim();
    if (!trimmed) return;
    setStatus({ kind: "loading" });
    setAnswers({});
    setSubmitted(false);
    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic: trimmed, count }),
      });
      const data = (await res.json()) as QuizResponse | { error: string };
      if (!res.ok || "error" in data) {
        throw new Error(("error" in data && data.error) || `HTTP ${res.status}`);
      }
      setStatus({ kind: "ready", quiz: data });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus({ kind: "error", message: msg });
    }
  }

  function score(quiz: QuizResponse): number {
    let s = 0;
    quiz.questions.forEach((q, i) => {
      if (answers[i] === q.correctIndex) s += 1;
    });
    return s;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-ink-700 bg-ink-800 p-6">
        <h2 className="text-xl font-semibold text-ink-50">
          Test your knowledge
        </h2>
        <p className="mt-1 text-ink-200">
          Pick a topic — the tutor will generate a fresh quiz from the source
          library. Submit your answers to see step-by-step explanations.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setTopic(p);
                start(p);
              }}
              className="text-sm rounded-full border border-ink-600 bg-ink-700/60 px-3 py-1.5 hover:border-accent-500 hover:text-accent-400"
            >
              {p}
            </button>
          ))}
        </div>

        <form
          className="mt-4 flex flex-col sm:flex-row gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(topic);
          }}
        >
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Custom topic (e.g. price ceilings, GDP deflator)…"
            className="flex-1 rounded-xl bg-ink-900 border border-ink-700 px-4 py-2.5 text-ink-50 placeholder:text-ink-400 outline-none focus:border-accent-500"
          />
          <select
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="rounded-xl bg-ink-900 border border-ink-700 px-3 py-2.5 text-ink-50"
          >
            {[3, 5, 7, 10].map((n) => (
              <option key={n} value={n}>
                {n} questions
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={status.kind === "loading" || !topic.trim()}
            className="rounded-xl bg-accent-600 hover:bg-accent-500 disabled:opacity-40 disabled:cursor-not-allowed text-ink-900 font-semibold px-5"
          >
            Generate quiz
          </button>
        </form>
      </section>

      {status.kind === "loading" && (
        <div className="text-ink-300 text-sm flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-accent-500 animate-pulse" />
          Generating quiz from source passages…
        </div>
      )}
      {status.kind === "error" && (
        <div className="rounded-md border border-red-500/40 bg-red-900/30 text-red-200 px-3 py-2 text-sm">
          {status.message}
        </div>
      )}

      {status.kind === "ready" && (
        <Quiz
          quiz={status.quiz}
          answers={answers}
          setAnswers={setAnswers}
          submitted={submitted}
          onSubmit={() => setSubmitted(true)}
          onReset={() => {
            setAnswers({});
            setSubmitted(false);
          }}
          scoreFn={score}
        />
      )}
    </div>
  );
}

function Quiz({
  quiz,
  answers,
  setAnswers,
  submitted,
  onSubmit,
  onReset,
  scoreFn,
}: {
  quiz: QuizResponse;
  answers: Record<number, number>;
  setAnswers: (a: Record<number, number>) => void;
  submitted: boolean;
  onSubmit: () => void;
  onReset: () => void;
  scoreFn: (q: QuizResponse) => number;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-lg font-semibold text-ink-50">
          Topic: <span className="text-accent-400">{quiz.topic}</span>
        </h3>
        {submitted && (
          <div className="text-ink-100">
            Score:{" "}
            <span className="font-semibold text-accent-400">
              {scoreFn(quiz)}
            </span>{" "}
            / {quiz.questions.length}
          </div>
        )}
      </div>

      {quiz.questions.map((q, i) => (
        <QuestionCard
          key={i}
          index={i}
          q={q}
          selected={answers[i]}
          onSelect={(idx) => setAnswers({ ...answers, [i]: idx })}
          submitted={submitted}
        />
      ))}

      <div className="flex gap-2">
        {!submitted ? (
          <button
            type="button"
            onClick={onSubmit}
            disabled={Object.keys(answers).length < quiz.questions.length}
            className="rounded-xl bg-accent-600 hover:bg-accent-500 disabled:opacity-40 disabled:cursor-not-allowed text-ink-900 font-semibold px-5 py-2.5"
          >
            Submit answers
          </button>
        ) : (
          <button
            type="button"
            onClick={onReset}
            className="rounded-xl border border-ink-600 hover:border-accent-500 text-ink-100 font-semibold px-5 py-2.5"
          >
            Try again
          </button>
        )}
      </div>
    </section>
  );
}

function QuestionCard({
  index,
  q,
  selected,
  onSelect,
  submitted,
}: {
  index: number;
  q: QuizQuestion;
  selected: number | undefined;
  onSelect: (i: number) => void;
  submitted: boolean;
}) {
  return (
    <article className="rounded-2xl border border-ink-700 bg-ink-800 p-5">
      <div className="text-ink-50 font-medium">
        Q{index + 1}. {q.question}
      </div>
      <ul className="mt-3 space-y-2">
        {q.options.map((opt, i) => {
          const isSelected = selected === i;
          const isCorrect = q.correctIndex === i;
          let classes =
            "block w-full text-left rounded-lg border px-3 py-2 cursor-pointer ";
          if (submitted) {
            if (isCorrect) {
              classes +=
                "border-emerald-500 bg-emerald-900/30 text-emerald-100";
            } else if (isSelected && !isCorrect) {
              classes += "border-red-500 bg-red-900/30 text-red-100";
            } else {
              classes += "border-ink-600 bg-ink-900 text-ink-200";
            }
          } else if (isSelected) {
            classes += "border-accent-500 bg-accent-600/20 text-ink-50";
          } else {
            classes +=
              "border-ink-600 bg-ink-900 text-ink-100 hover:border-accent-500";
          }
          return (
            <li key={i}>
              <button
                type="button"
                disabled={submitted}
                onClick={() => onSelect(i)}
                className={classes}
              >
                <span className="font-mono text-ink-300 mr-2">
                  {String.fromCharCode(65 + i)}.
                </span>
                {opt}
              </button>
            </li>
          );
        })}
      </ul>
      {submitted && (
        <div className="mt-3 rounded-lg border border-ink-600 bg-ink-900/60 p-3">
          <div className="text-sm font-semibold text-ink-50">
            Step-by-step explanation
          </div>
          <Markdown>{q.explanation}</Markdown>
          <details className="mt-2 text-sm text-ink-200">
            <summary className="cursor-pointer text-accent-400 hover:text-accent-500">
              Source: {q.citation.sourceTitle}
            </summary>
            <p className="mt-1 italic text-ink-300">{q.citation.excerpt}</p>
          </details>
        </div>
      )}
    </article>
  );
}
