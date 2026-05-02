import { NextResponse } from "next/server";
import { CHAT_MODEL, getChatClient } from "@/lib/openai";
import { retrieveForQuiz } from "@/lib/retriever";
import { QuizQuestion, QuizResponse } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `You are "Economics Expert", an Economics tutor that writes faithful multiple-choice quiz questions.

You will be given a TOPIC and a set of source excerpts. Produce a JSON object with exactly this shape:

{
  "questions": [
    {
      "question": "string — the prompt, may include short formula or numeric setup",
      "options": ["string", "string", "string", "string"],
      "correctIndex": 0,
      "explanation": "step-by-step explanation grounded in the source",
      "sourceIndex": 1
    }
  ]
}

Rules:
- Generate exactly N questions (N is given by the user).
- Each question MUST be answerable using the supplied excerpts. Do NOT make up facts.
- "options" must have exactly 4 plausible distractors; only one is correct.
- "correctIndex" is the 0-based index of the correct option.
- "sourceIndex" is the 1-based index of the excerpt the question is drawn from.
- Mix recall and reasoning: include at least one question that requires step-by-step reasoning (e.g., applying a definition or computing a small numeric example).
- "explanation" must walk through the answer step by step and end with a one-line takeaway.
- Output JSON ONLY, no commentary.`;

type ModelQuestion = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  sourceIndex: number;
};

export async function POST(req: Request) {
  let body: { topic?: string; count?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const topic = (body.topic ?? "").trim();
  const count = Math.max(1, Math.min(10, Number(body.count ?? 5)));
  if (!topic) {
    return NextResponse.json({ error: "topic is required" }, { status: 400 });
  }

  let retrieved;
  try {
    retrieved = await retrieveForQuiz(topic, 6);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "retrieval failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  if (retrieved.length === 0) {
    return NextResponse.json(
      { error: "No source content matched that topic." },
      { status: 404 },
    );
  }

  const sourcesBlock = retrieved
    .map(
      (r, i) =>
        `[${i + 1}] ${r.sourceTitle}\n"""${r.text.slice(0, 1400)}"""`,
    )
    .join("\n\n");

  const userPrompt = `TOPIC: ${topic}\nN: ${count}\n\nSources:\n\n${sourcesBlock}`;

  const openai = getChatClient();
  let completion;
  try {
    completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "chat completion failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let parsed: { questions?: ModelQuestion[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "Model returned invalid JSON." },
      { status: 502 },
    );
  }
  const modelQs = Array.isArray(parsed.questions) ? parsed.questions : [];

  const questions: QuizQuestion[] = modelQs
    .filter(
      (q) =>
        q &&
        typeof q.question === "string" &&
        Array.isArray(q.options) &&
        q.options.length === 4 &&
        Number.isInteger(q.correctIndex) &&
        q.correctIndex >= 0 &&
        q.correctIndex < 4,
    )
    .map((q) => {
      const idx = Number.isInteger(q.sourceIndex) ? q.sourceIndex - 1 : 0;
      const r = retrieved[Math.max(0, Math.min(retrieved.length - 1, idx))];
      return {
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation ?? "",
        citation: {
          source: r.source,
          sourceTitle: r.sourceTitle,
          pageHint: r.pageHint,
          excerpt: r.text.slice(0, 280) + (r.text.length > 280 ? "…" : ""),
        },
      };
    });

  if (questions.length === 0) {
    return NextResponse.json(
      { error: "Model did not return usable questions." },
      { status: 502 },
    );
  }

  const payload: QuizResponse = { topic, questions };
  return NextResponse.json(payload);
}
