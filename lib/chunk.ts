/**
 * Lightweight text chunker tuned for textbook-style content.
 * Splits on paragraph boundaries first, then merges paragraphs into windows
 * of ~`targetChars` characters with `overlapChars` of overlap.
 */
export function chunkText(
  text: string,
  opts: { targetChars?: number; overlapChars?: number } = {},
): string[] {
  const targetChars = opts.targetChars ?? 1200;
  const overlapChars = opts.overlapChars ?? 150;

  const cleaned = sanitize(text);
  const paragraphs = cleaned
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length >= 20 && hasReadableContent(p));

  const chunks: string[] = [];
  let buf = "";

  const flush = () => {
    const t = buf.trim();
    if (t.length >= 80) chunks.push(t);
    buf = "";
  };

  for (const para of paragraphs) {
    if (buf.length + para.length + 1 <= targetChars) {
      buf += (buf ? "\n\n" : "") + para;
    } else {
      flush();
      // start new buffer with overlap from previous chunk
      const last = chunks[chunks.length - 1];
      if (last && overlapChars > 0) {
        buf = last.slice(-overlapChars);
      }
      // if a single paragraph is huge, hard-split it
      if (para.length > targetChars) {
        for (let i = 0; i < para.length; i += targetChars - overlapChars) {
          const piece = para.slice(i, i + targetChars);
          chunks.push(piece.trim());
        }
        buf = "";
      } else {
        buf += (buf ? "\n\n" : "") + para;
      }
    }
  }
  flush();
  return chunks;
}

/** Strip junk artefacts from PDF text extraction. */
export function sanitize(raw: string): string {
  return raw
    // Remove obvious banner/separator lines (rows of $$$, ===, ---, ***)
    .replace(/^[\s]*[\$=\-\*\#_]{6,}.*$/gm, "")
    // Drop dotted leader lines like "Preface....... ii"
    .replace(/^.*\.{6,}.*$/gm, "")
    // Collapse repeated single-character runs (stray OCR)
    .replace(/(.)\1{8,}/g, "$1$1")
    // Normalise hyphenated line-breaks: "exam-\nple" -> "example"
    .replace(/-\n/g, "")
    // Normalise CRLF
    .replace(/\r\n?/g, "\n")
    // Remove form-feeds & other ctrl chars
    .replace(/[\f\v\u0000-\u0008\u000E-\u001F]/g, "")
    // Collapse 3+ blank lines into 2
    .replace(/\n{3,}/g, "\n\n");
}

/** Reject paragraphs that are mostly noise (digits/symbols/non-letters). */
export function hasReadableContent(p: string): boolean {
  const letters = p.match(/[A-Za-z]/g)?.length ?? 0;
  if (letters < 30) return false;
  const ratio = letters / p.length;
  return ratio > 0.45;
}
