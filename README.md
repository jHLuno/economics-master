# Economics Expert

A web-based AI tutor specialized in Economics. Built with Next.js 14 (App Router), TypeScript, Tailwind CSS, and an OpenAI-compatible **OpenRouter** chat backend. Uses **Retrieval-Augmented Generation (RAG)** over four bundled economics textbooks so every answer is grounded in source material — embeddings run **locally** (no embedding API key needed).

## Features

- **Chat tutor** — ask any economics question; get a step-by-step, markdown-formatted answer with inline citations and an expandable list of source excerpts.
- **Knowledge testing** — pick or type a topic and the tutor generates a multiple-choice quiz drawn from the source library, with instant scoring and step-by-step explanations.
- **Source library**:
  - *Introduction to Economics* (2019)
  - *Introduction to Microeconomics — E201* (Dilts, 2004)
  - *Introduction to Economics* (Van Sickle & Rogge, 1954)
  - *Economics — class notes*

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- **Embeddings**: `Xenova/all-MiniLM-L6-v2` via [`@xenova/transformers`](https://github.com/xenova/transformers.js) — runs in pure JS/WASM, no API key
- **Chat**: any OpenRouter model (default `openai/gpt-oss-120b:free`) via the OpenAI-compatible SDK
- **Vector store**: in-memory cosine similarity over a `data/embeddings.json` produced at ingest time

## How RAG works here

1. **Parse** — PDFs are extracted to plain text with `pdftotext` and stored under `data/raw/`.
2. **Chunk** — `lib/chunk.ts` sanitizes OCR artefacts, splits paragraphs, and merges them into ~1 200-character chunks with 150-character overlap.
3. **Embed (build time)** — `scripts/ingest.ts` runs the local MiniLM model in batches and writes `data/embeddings.json` (~ a few MB, 384-dim vectors).
4. **Retrieve (runtime)** — `lib/retriever.ts` embeds the user query with the same local model, runs cosine similarity against the in-memory corpus, and returns the top-k passages.
5. **Generate** — `app/api/chat/route.ts` and `app/api/quiz/route.ts` build a system prompt that instructs the model to cite excerpts inline and reason step by step, then call the configured OpenRouter chat model.

## Local development

### Prerequisites

- Node.js ≥ 20
- An `OPENROUTER_API_KEY` (https://openrouter.ai/keys)

### Setup

```bash
cp .env.example .env.local   # then fill in OPENROUTER_API_KEY
npm install
npm run ingest               # builds data/embeddings.json — only needed once or after corpus changes
npm run dev
```

Open http://localhost:3000.

The first call to `npm run ingest` (and the first request after a cold start in production) downloads the ~25 MB ONNX model into the local `@xenova/transformers` cache. Subsequent calls reuse it.

### Scripts

- `npm run dev` — Next.js dev server
- `npm run build` — production build
- `npm run start` — serve production build
- `npm run lint` — ESLint
- `npm run typecheck` — `tsc --noEmit`
- `npm run ingest` — chunk + locally embed the source corpus into `data/embeddings.json`

## Project structure

```
app/
  api/
    chat/route.ts        RAG chat endpoint
    quiz/route.ts        RAG quiz-generation endpoint
  chat/                  Chat UI
  quiz/                  Quiz UI
  page.tsx               Landing page
components/              Reusable UI (Header, Markdown)
lib/
  chunk.ts               Sanitize + chunk plain-text sources
  embeddings.ts          Local MiniLM feature extractor (build + runtime)
  openai.ts              OpenAI SDK pointed at OpenRouter for chat
  retriever.ts           Load embeddings, cosine similarity, top-k retrieval
  sources.ts             Source registry
  types.ts               Shared TypeScript types
scripts/
  ingest.ts              CLI: build data/embeddings.json
data/
  raw/                   Plain-text source files (extracted from PDFs)
  embeddings.json        (gitignored) — produced by `npm run ingest`
```

## Deployment (Netlify)

1. Push this repo to GitHub.
2. Import the project on https://app.netlify.com.
3. **Build command**: `npm run ingest && npm run build` (so embeddings are produced as part of every deploy).
4. **Publish directory**: `.next` (Netlify's Next.js Runtime handles this automatically).
5. Add `OPENROUTER_API_KEY` in **Site settings → Environment variables**. Optionally set `OPENROUTER_MODEL` to override the default model.

The `netlify.toml` at the repo root pre-configures the build command, plugin (`@netlify/plugin-nextjs`), and Node version.

## Environment variables

| Name | Required | Default | Purpose |
| --- | --- | --- | --- |
| `OPENROUTER_API_KEY` | yes | — | Auth for OpenRouter chat completions |
| `OPENROUTER_MODEL` | no | `openai/gpt-oss-120b:free` | Override the chat model |
| `OPENROUTER_SITE_URL` | no | — | Sent as `HTTP-Referer` to OpenRouter |
| `OPENROUTER_APP_NAME` | no | `Economics Expert` | Sent as `X-Title` to OpenRouter |

## Notes / limitations

- The 1954 Van Sickle textbook contains heavy OCR noise; the chunker filters lines that are mostly non-letters but some artefacts may still slip through.
- Retrieval is in-memory cosine similarity loaded from `data/embeddings.json`; for very large corpora a vector database (pgvector, Pinecone, etc.) would scale better.
- The chat is single-turn per request from the model's perspective — full message history is sent, but the retriever only embeds the latest user message.
- Cold starts on serverless can be slow because the MiniLM ONNX model has to be downloaded on first use; warm requests are fast.
