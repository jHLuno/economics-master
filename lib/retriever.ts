import fs from "node:fs";
import path from "node:path";
import { CorpusFile, EmbeddedChunk } from "./types";
import { embedText } from "./embeddings";

let corpus: CorpusFile | null = null;

export function loadCorpus(): CorpusFile {
  if (corpus) return corpus;
  const file = path.join(process.cwd(), "data", "embeddings.json");
  if (!fs.existsSync(file)) {
    throw new Error(
      `Embeddings file not found at ${file}. Run \`npm run ingest\` first.`,
    );
  }
  const raw = fs.readFileSync(file, "utf-8");
  corpus = JSON.parse(raw) as CorpusFile;
  return corpus;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export type Retrieved = EmbeddedChunk & { score: number };

export async function retrieve(
  query: string,
  topK = 6,
): Promise<Retrieved[]> {
  const c = loadCorpus();
  const qEmb = await embedText(query);
  const scored: Retrieved[] = c.chunks.map((ch) => ({
    ...ch,
    score: cosineSimilarity(qEmb, ch.embedding),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

/** Diversified sample for quiz generation: random chunks matching a topic. */
export async function retrieveForQuiz(
  topic: string,
  count: number,
): Promise<Retrieved[]> {
  const top = await retrieve(topic, Math.max(count * 4, 12));
  // Spread chunks across distinct sources where possible
  const bySource = new Map<string, Retrieved[]>();
  for (const r of top) {
    const arr = bySource.get(r.source) ?? [];
    arr.push(r);
    bySource.set(r.source, arr);
  }
  const out: Retrieved[] = [];
  let idx = 0;
  while (out.length < count) {
    let added = false;
    for (const arr of bySource.values()) {
      if (arr[idx]) {
        out.push(arr[idx]);
        added = true;
        if (out.length >= count) break;
      }
    }
    if (!added) break;
    idx += 1;
  }
  return out;
}
