"use client";

import { useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/Markdown";
import { streamChat } from "@/lib/streamChat";
import type { ChatMessage, Citation } from "@/lib/types";

type Turn = {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  /** Streaming flag — true while tokens are still arriving. */
  streaming?: boolean;
};

const SUGGESTIONS = [
  "Explain the law of demand step by step.",
  "What is opportunity cost? Give a numeric example.",
  "Compare positive vs normative economics.",
  "How does price elasticity of demand work?",
  "Walk me through the difference between perfect competition and monopoly.",
];

/** Mirror of the server-side `normalizeMath()` so streaming output renders
 *  KaTeX correctly even before the full answer arrives. */
function normalizeMath(s: string): string {
  return s
    .replace(/\\\[\s*([\s\S]*?)\s*\\\]/g, (_, inner) => `\n$$\n${inner}\n$$\n`)
    .replace(/\\\(\s*([\s\S]*?)\s*\\\)/g, (_, inner) => `$${inner}$`)
    .replace(/【[^】]*】/g, "")
    .replace(/[ \t]+([.,;:!?])/g, "$1");
}

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
    const userTurn: Turn = { role: "user", content: trimmed };
    const assistantTurn: Turn = {
      role: "assistant",
      content: "",
      streaming: true,
    };
    const baseTurns: Turn[] = [...turns, userTurn];
    // Optimistically render the user message + an empty streaming assistant
    // message so tokens fill in as they arrive.
    setTurns([...baseTurns, assistantTurn]);
    setInput("");
    setLoading(true);

    const messages: ChatMessage[] = baseTurns.map((t) => ({
      role: t.role,
      content: t.content,
    }));

    let buf = "";

    try {
      await streamChat(
        { messages },
        {
          onMeta: (cs) => {
            // Lock in citations on the assistant turn so the user sees the
            // Sources panel even while tokens are still streaming in.
            setTurns((prev) => {
              const copy = prev.slice();
              copy[copy.length - 1] = {
                ...copy[copy.length - 1],
                citations: cs,
              };
              return copy;
            });
          },
          onToken: (delta) => {
            buf += delta;
            const rendered = normalizeMath(buf);
            setTurns((prev) => {
              const copy = prev.slice();
              copy[copy.length - 1] = {
                ...copy[copy.length - 1],
                content: rendered,
              };
              return copy;
            });
          },
          onDone: () => {
            setTurns((prev) => {
              const copy = prev.slice();
              copy[copy.length - 1] = {
                ...copy[copy.length - 1],
                streaming: false,
              };
              return copy;
            });
          },
        },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      // Drop the empty assistant placeholder if we never received any tokens.
      setTurns((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        if (last.role === "assistant" && last.content === "") {
          return prev.slice(0, -1);
        }
        return prev.map((t, i) =>
          i === prev.length - 1 && t.role === "assistant"
            ? { ...t, streaming: false }
            : t,
        );
      });
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
                {t.content ? (
                  <Markdown>{t.content}</Markdown>
                ) : (
                  <div className="text-ink-300 text-sm flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-accent-500 animate-pulse" />
                    {t.streaming
                      ? "Retrieving sources and reasoning…"
                      : "(no content)"}
                  </div>
                )}
                {t.streaming && t.content && (
                  <div className="mt-1 text-ink-300 text-xs flex items-center gap-2">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-500 animate-pulse" />
                    streaming…
                  </div>
                )}
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

        {error && (
          <div className="self-start rounded-md border border-red-500/40 bg-red-900/30 text-red-200 px-3 py-2 text-sm whitespace-pre-wrap">
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
