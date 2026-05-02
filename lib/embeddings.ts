/**
 * Local embedding model — no API key required. Uses `@xenova/transformers`
 * which runs ONNX models in pure JS/WASM (works in Node 20+ on Vercel/Netlify
 * functions and at build time during `npm run ingest`).
 *
 * Model: `Xenova/all-MiniLM-L6-v2` — 384-dim sentence embeddings, ~25 MB.
 *
 * This is a thin singleton wrapper so the model is loaded only once per
 * process; subsequent calls reuse the loaded pipeline.
 */

// `@xenova/transformers` is dynamically imported the first time it's needed
// to keep cold-starts fast for unrelated routes.
type FeatureExtractor = (
  texts: string | string[],
  options: { pooling: "mean" | "cls" | "none"; normalize: boolean },
) => Promise<{ data: Float32Array; dims: number[] }>;

let pipelinePromise: Promise<FeatureExtractor> | null = null;

export const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";
export const EMBEDDING_DIMENSIONS = 384;

async function getPipeline(): Promise<FeatureExtractor> {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const transformers = await import("@xenova/transformers");
      // Disable remote progress bars / disk caching guards for serverless.
      // Default cache dir is ~/.cache; on serverless this falls back to /tmp.
      transformers.env.allowLocalModels = false;
      const fn = await transformers.pipeline(
        "feature-extraction",
        EMBEDDING_MODEL,
        { quantized: true },
      );
      return fn as unknown as FeatureExtractor;
    })();
  }
  return pipelinePromise;
}

export async function embedText(text: string): Promise<number[]> {
  const pipe = await getPipeline();
  const out = await pipe(text, { pooling: "mean", normalize: true });
  return Array.from(out.data);
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const pipe = await getPipeline();
  const out = await pipe(texts, { pooling: "mean", normalize: true });
  // out.data is a flat Float32Array of length texts.length * dims
  const dims = out.dims[out.dims.length - 1];
  const result: number[][] = [];
  for (let i = 0; i < texts.length; i += 1) {
    const slice = out.data.subarray(i * dims, (i + 1) * dims);
    result.push(Array.from(slice));
  }
  return result;
}
