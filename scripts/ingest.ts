/**
 * Ingest pipeline: read raw text files, chunk, embed (locally), and
 * write `data/embeddings.json`. No API key is required — embeddings are
 * computed with `@xenova/transformers` and the `Xenova/all-MiniLM-L6-v2`
 * ONNX model.
 *
 * Usage: `npm run ingest`
 */
import fs from "node:fs";
import path from "node:path";
import { chunkText } from "../lib/chunk";
import { SOURCES } from "../lib/sources";
import { CorpusFile, EmbeddedChunk } from "../lib/types";
import {
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
  embedBatch,
} from "../lib/embeddings";

async function main() {
  const root = process.cwd();
  const outFile = path.join(root, "data", "embeddings.json");
  fs.mkdirSync(path.dirname(outFile), { recursive: true });

  const allChunks: { meta: Omit<EmbeddedChunk, "embedding">; text: string }[] = [];

  for (const src of SOURCES) {
    const filePath = path.join(root, src.textFile);
    if (!fs.existsSync(filePath)) {
      console.warn(`[skip] missing ${filePath}`);
      continue;
    }
    const raw = fs.readFileSync(filePath, "utf-8");
    const chunks = chunkText(raw, { targetChars: 1200, overlapChars: 150 });
    console.log(`[${src.id}] ${chunks.length} chunks`);
    chunks.forEach((text, i) => {
      allChunks.push({
        meta: {
          id: `${src.id}#${i}`,
          source: src.id,
          sourceTitle: src.title,
          text,
        },
        text,
      });
    });
  }

  console.log(`Total chunks: ${allChunks.length}`);
  if (allChunks.length === 0) {
    console.error(
      "No chunks produced. Check that data/raw/*.txt files exist and contain text.",
    );
    process.exit(1);
  }

  const BATCH = 16;
  const embedded: EmbeddedChunk[] = [];
  for (let i = 0; i < allChunks.length; i += BATCH) {
    const slice = allChunks.slice(i, i + BATCH);
    const embeddings = await embedBatch(slice.map((c) => c.text));
    slice.forEach((c, j) => {
      embedded.push({ ...c.meta, embedding: embeddings[j] });
    });
    if ((i / BATCH) % 5 === 0) {
      console.log(
        `embedded ${Math.min(i + BATCH, allChunks.length)}/${allChunks.length}`,
      );
    }
  }

  const dimensions = embedded[0]?.embedding.length ?? EMBEDDING_DIMENSIONS;
  const out: CorpusFile = {
    model: EMBEDDING_MODEL,
    dimensions,
    chunks: embedded,
  };

  fs.writeFileSync(outFile, JSON.stringify(out));
  const sizeMB = (fs.statSync(outFile).size / (1024 * 1024)).toFixed(2);
  console.log(
    `Wrote ${outFile} (${sizeMB} MB, ${embedded.length} vectors @ ${dimensions}d, model=${EMBEDDING_MODEL})`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
