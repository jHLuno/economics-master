"use client";

import { useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/Markdown";
import type { ChatMessage, ChatResponse, Citation } from "@/lib/types";

type Turn = {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
};

const SUGGESTIONS = [
  "Explain the law of demand step by step.",
  "What is opportunity cost? Give a numeric example.",
  "Compare positive vs normative economics.",
  "How does price elasticity of demand work?",
  "Walk me through the difference between perfect competition and monopoly.",
];

export function ChatClient() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, loading]);

  async function send(question: string) {
    const trimmed = question.trim();
    if (!trimmed || loading) return;
    setError(null);
    const next: Turn[] = [...turns, { role: "user", content: trimmed }];
    setTurns(next);
    setInput("");
    setLoading(true);
    try {
      const messages: ChatMessage[] = next.map((t) => ({
        role: t.role,
        content: t.content,
      }));
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages }),
      });
      const data = (await res.json()) as ChatResponse | { error: string };
      if (!res.ok || "error" in data) {
        throw new Error(("error" in data && data.error) || `HTTP ${res.status}`);
      }
      setTurns([
        ...next,
        {
          role: "assistant",
          content: data.answer,
          citations: data.citations,
        },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border border-ink-700 bg-ink-800 p-4 sm:p-6 min-h-[60vh] flex flex-col gap-4">
        {turns.length === 0 && (
          <div className="text-ink-200">
            <h2 className="text-xl font-semibold text-ink-50">
              Ask anything about economics
            </h2>
            <p className="mt-2">
              Every answer is grounded in the 4 source textbooks and includes
              step-by-step reasoning. Try one of these:
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="text-sm rounded-full border border-ink-600 bg-ink-700/60 px-3 py-1.5 hover:border-accent-500 hover:text-accent-400"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((t, i) => (
          <article
            key={i}
            className={
              t.role === "user"
                ? "self-end max-w-[85%] rounded-2xl bg-accent-600/20 border border-accent-600/40 px-4 py-3"
                : "self-start max-w-[95%] rounded-2xl bg-ink-700/60 border border-ink-600 px-4 py-3"
            }
          >
            {t.role === "user" ? (
              <p className="text-ink-50 whitespace-pre-wrap">{t.content}</p>
            ) : (
              <>
                <Markdown>{t.content}</Markdown>
                {t.citations && t.citations.length > 0 && (
                  <details className="mt-3 text-sm text-ink-200">
                    <summary className="cursor-pointer text-accent-400 hover:text-accent-500">
                      Sources ({t.citations.length})
                    </summary>
                    <ul className="mt-2 space-y-2">
                      {t.citations.map((c, j) => (
                        <li
                          key={j}
                          className="rounded-md border border-ink-600 bg-ink-800 p-2"
                        >
                          <div className="font-medium text-ink-50">
                            [{j + 1}] {c.sourceTitle}
                          </div>
                          <div className="mt-1 text-ink-300 italic">
                            {c.excerpt}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </>
            )}
          </article>
        ))}

        {loading && (
          <div className="self-start text-ink-300 text-sm flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-accent-500 animate-pulse" />
            Retrieving sources and reasoning…
          </div>
        )}
        {error && (
          <div className="self-start rounded-md border border-red-500/40 bg-red-900/30 text-red-200 px-3 py-2 text-sm">
            {error}
          </div>
        )}
        <div ref={endRef} />
      </section>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about supply &amp; demand, GDP, elasticity, market structures…"
          className="flex-1 rounded-xl bg-ink-800 border border-ink-700 px-4 py-3 text-ink-50 placeholder:text-ink-400 outline-none focus:border-accent-500"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-xl bg-accent-600 hover:bg-accent-500 disabled:opacity-40 disabled:cursor-not-allowed text-ink-900 font-semibold px-5"
        >
          Send
        </button>
      </form>
    </div>
  );
}
