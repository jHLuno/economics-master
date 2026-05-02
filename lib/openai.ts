import OpenAI from "openai";

let client: OpenAI | null = null;

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

/**
 * Returns an OpenAI-compatible client pointed at OpenRouter.
 * Embeddings are NOT done through this client — see `lib/embeddings.ts`
 * for the local (zero-API-key) embedding model.
 */
export function getChatClient(): OpenAI {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Get a key at https://openrouter.ai/keys " +
        "and add it to your environment to enable chat and quiz features.",
    );
  }
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: OPENROUTER_BASE_URL,
      defaultHeaders: {
        // Optional but nice: OpenRouter uses these for analytics & better
        // routing. Safe to omit if env vars are not set.
        ...(process.env.OPENROUTER_SITE_URL
          ? { "HTTP-Referer": process.env.OPENROUTER_SITE_URL }
          : {}),
        ...(process.env.OPENROUTER_APP_NAME
          ? { "X-Title": process.env.OPENROUTER_APP_NAME }
          : { "X-Title": "Economics Expert" }),
      },
    });
  }
  return client;
}

export const CHAT_MODEL =
  process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";
