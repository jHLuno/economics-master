import { NextResponse } from "next/server";
import { CHAT_MODEL, getChatClient } from "@/lib/openai";
import { retrieve } from "@/lib/retriever";
import { ChatMessage, ChatResponse, Citation } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `You are "Economics Expert", a precise and patient AI tutor specialized in Economics.

You answer the user's question using ONLY the provided source excerpts plus widely-accepted, textbook-grade economic background where the excerpts are silent.

Output rules:
- Default tone: clear, encouraging, and rigorous. Treat the reader as a motivated student.
- For any non-trivial concept, give a STEP-BY-STEP explanation:
    1. State the definition or core idea in one sentence.
    2. Explain the intuition.
    3. Walk through any formula or graph step by step.
    4. Give a concrete numeric or real-world example.
    5. Conclude with a one-sentence "takeaway".
- Use Markdown: headings (##), bulleted/numbered lists, and \`inline code\` for variable names. Prefer prose and lists over Markdown tables (tables often break in chat UIs).
- For math, use LaTeX delimited by single dollar signs for inline (\`$E = mc^2$\`) and double dollars for display (\`$$\\text{PED} = \\frac{\\%\\Delta Q}{\\%\\Delta P}$$\`). Do NOT wrap math in parentheses or square brackets — those will not render.
- When you use a source excerpt, cite it inline with bracketed numbers like [1], [2] that match the order of the "Sources" list you receive.
- If the excerpts do not cover the question, say so explicitly and answer from general economics knowledge, marking that part with "(general knowledge)".
- Never invent citations. Never claim an excerpt says something it doesn't.
- If the user asks something off-topic (not economics), politely steer them back.`;

/**
 * Normalize the LLM's output for the UI:
 *   - Convert LaTeX-flavoured \[..\] / \(..\) delimiters to Markdown-math
 *     $$..$$ / $..$ that remark-math + KaTeX understand.
 *   - Strip the CJK citation brackets some models inject (e.g. 【†L1-L4】
 *     "fake citation" blobs from reasoning-trained models). We surface real
 *     citations separately in the Sources panel.
 */
function normalizeMath(s: string): string {
  return s
    .replace(/\\\[\s*([\s\S]*?)\s*\\\]/g, (_, inner) => `\n$$\n${inner}\n$$\n`)
    .replace(/\\\(\s*([\s\S]*?)\s*\\\)/g, (_, inner) => `$${inner}$`)
    .replace(/【[^】]*】/g, "")
    .replace(/[ \t]+([.,;:!?])/g, "$1");
}

export async function POST(req: Request) {
  try {
    return await handle(req);
  } catch (err) {
    // Outermost safety net: anything thrown here must still surface as JSON
    // so the client never sees a plain-text/HTML Vercel error page.
    const msg = err instanceof Error ? err.message : "internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function handle(req: Request): Promise<Response> {
  let body: { messages: ChatMessage[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const messages = (body.messages ?? []).filter(
    (m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
  );
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user" || !last.content.trim()) {
    return NextResponse.json(
      { error: "Last message must be a non-empty user message." },
      { status: 400 },
    );
  }

  let retrieved;
  try {
    retrieved = await retrieve(last.content, 6);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "retrieval failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const sourcesBlock = retrieved
    .map(
      (r, i) =>
        `[${i + 1}] ${r.sourceTitle}\n"""${r.text.slice(0, 1400)}"""`,
    )
    .join("\n\n");

  const sysWithSources = `${SYSTEM_PROMPT}\n\nSources (cite with [n]):\n\n${sourcesBlock}`;

  const openai = getChatClient();
  let completion;
  try {
    completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0.2,
      messages: [
        { role: "system", content: sysWithSources },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "chat completion failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const rawAnswer = completion.choices[0]?.message?.content ?? "";
  const answer = normalizeMath(rawAnswer);

  const citations: Citation[] = retrieved.map((r) => ({
    source: r.source,
    sourceTitle: r.sourceTitle,
    pageHint: r.pageHint,
    excerpt: r.text.slice(0, 280) + (r.text.length > 280 ? "…" : ""),
  }));

  const payload: ChatResponse = { answer, citations };
  return NextResponse.json(payload);
}
