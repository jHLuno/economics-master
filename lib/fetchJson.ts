/**
 * Wrapper around `fetch` that always returns a parsed JSON body and never
 * crashes the caller with a confusing `SyntaxError: Unexpected token 'A',
 * "An error o"... is not valid JSON`.
 *
 * Vercel / serverless platforms sometimes return a plain-text or HTML error
 * page when a function times out, runs out of memory, or fails to boot. Those
 * pages start with strings like `An error occurred with this application` and
 * blow up `Response.json()`. This helper:
 *
 *   1. Reads the body as text first.
 *   2. Attempts JSON.parse.
 *   3. On parse failure, throws an Error whose message is human-readable
 *      (status, content-type, and a short snippet of the body).
 *   4. On HTTP error status with a parsed `{ error }` field, throws that
 *      message verbatim.
 *
 * Usage:
 *   const data = await fetchJson<ChatResponse>("/api/chat", {
 *     method: "POST",
 *     body: JSON.stringify(...),
 *   });
 */
export async function fetchJson<T>(
  url: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const controller = new AbortController();
  const timeoutMs = init?.timeoutMs ?? 90_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { "content-type": "application/json", ...init?.headers },
      signal: init?.signal ?? controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(
        `Request to ${url} timed out after ${Math.round(timeoutMs / 1000)}s. ` +
          `The serverless function may be cold-starting — please try again.`,
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    const snippet = text.trim().slice(0, 200) || "(empty body)";
    throw new Error(
      `Server returned a non-JSON response (HTTP ${res.status}). ` +
        `This usually means the serverless function timed out or crashed. ` +
        `Try again in a moment. Server said: "${snippet}"`,
    );
  }

  if (!res.ok) {
    const message =
      isErrorPayload(data) && typeof data.error === "string"
        ? data.error
        : `HTTP ${res.status} ${res.statusText}`.trim();
    throw new Error(message);
  }

  if (isErrorPayload(data) && typeof data.error === "string") {
    throw new Error(data.error);
  }

  return data as T;
}

function isErrorPayload(x: unknown): x is { error?: unknown } {
  return typeof x === "object" && x !== null && "error" in x;
}
