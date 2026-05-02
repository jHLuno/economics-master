import type { Citation } from "./types";

export type ChatStreamEvent =
  | { type: "meta"; citations: Citation[] }
  | { type: "token"; value: string }
  | { type: "done" }
  | { type: "error"; value: string };

export type StreamChatHandlers = {
  onMeta?: (citations: Citation[]) => void;
  onToken?: (delta: string) => void;
  onDone?: () => void;
};

/**
 * POST a chat request and stream NDJSON events from /api/chat back into
 * the supplied handlers. Resolves on `done`, rejects on `error` or HTTP
 * failure, and (importantly) NEVER calls `Response.json()` on a plain-text
 * body — instead it reads as text first and surfaces a human-readable error.
 *
 * Includes an AbortSignal-backed timeout so a stuck cold-start surfaces
 * a clear message rather than hanging forever.
 */
export async function streamChat(
  payload: unknown,
  handlers: StreamChatHandlers,
  options: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 90_000;
  const internal = new AbortController();
  const timer = setTimeout(() => internal.abort("timeout"), timeoutMs);

  // If the caller passed their own AbortSignal, abort our internal one too.
  const externalSignal = options.signal;
  const onExternalAbort = () => internal.abort("aborted");
  externalSignal?.addEventListener("abort", onExternalAbort);

  let res: Response;
  try {
    res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: internal.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    externalSignal?.removeEventListener("abort", onExternalAbort);
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(
        `Chat request timed out after ${Math.round(timeoutMs / 1000)}s. ` +
          "The free model is slow or the serverless function is cold-starting — please try again.",
      );
    }
    throw err;
  }

  // Non-2xx → expect a JSON error body (our outermost try/catch guarantees
  // that), but defensively handle plain-text Vercel pages too.
  if (!res.ok) {
    clearTimeout(timer);
    externalSignal?.removeEventListener("abort", onExternalAbort);
    const text = await res.text();
    throw extractError(text, res.status, res.statusText);
  }

  if (!res.body) {
    clearTimeout(timer);
    externalSignal?.removeEventListener("abort", onExternalAbort);
    throw new Error("Empty response body from /api/chat");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sawAny = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let idx: number;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line) continue;
        sawAny = true;
        let ev: ChatStreamEvent | null = null;
        try {
          ev = JSON.parse(line) as ChatStreamEvent;
        } catch {
          // If the very first line isn't JSON, the entire body is probably
          // a Vercel plain-text error page. Read everything we have and
          // throw a helpful error.
          throw extractError(line + buffer, res.status, res.statusText);
        }
        if (!ev || typeof ev !== "object") continue;
        if (ev.type === "meta") handlers.onMeta?.(ev.citations ?? []);
        else if (ev.type === "token") handlers.onToken?.(ev.value);
        else if (ev.type === "done") {
          handlers.onDone?.();
          return;
        } else if (ev.type === "error") {
          throw new Error(ev.value || "stream error");
        }
      }
    }

    if (!sawAny) {
      throw new Error("No data received from /api/chat");
    }
    // Stream ended without an explicit `done` event — treat as success
    // since we may have just had truncation; let the caller finalize.
    handlers.onDone?.();
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener("abort", onExternalAbort);
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }
}

function extractError(text: string, status: number, statusText: string): Error {
  // Try to parse JSON `{ error: "..." }` first.
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as { error?: unknown };
      if (typeof parsed.error === "string" && parsed.error.length > 0) {
        return new Error(parsed.error);
      }
    } catch {
      // fall through
    }
  }
  const snippet = trimmed.slice(0, 200) || "(empty body)";
  return new Error(
    `Server returned a non-JSON response (HTTP ${status}${
      statusText ? " " + statusText : ""
    }). This usually means the serverless function timed out or crashed. ` +
      `Try again in a moment. Server said: "${snippet}"`,
  );
}
