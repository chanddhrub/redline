/**
 * Seam 1 of intake (ticket 01).
 *
 * Bytes and a filename in; either a parsed document or a typed refusal out.
 * Format detection, extraction and sentence segmentation are internals with
 * no seams of their own — tests assert only what this function returns.
 *
 * The canonical text is stored verbatim. Whatever the extractor produced is
 * what is kept, shown to the user, and quoted from. Nothing is cleaned on the
 * way in, because that is what makes "the quote string-matches the stored
 * text exactly" checkable at all (ADR 0001).
 *
 * `locate` is exact-match only here. Reversible normalisation — curly quotes,
 * ligatures, broken hyphens — is ticket 02 and lands inside `locate` without
 * changing this contract.
 */

export interface Sentence {
  text: string;
  start: number;
  end: number;
}

export interface Span {
  start: number;
  end: number;
}

export interface ParsedDocument {
  /** Canonical stored text, verbatim. */
  text: string;
  /** Offsets into `text`. A convenience for the prompt and the UI, never
   *  load-bearing for citation integrity. */
  sentences: Sentence[];
  /** Returns null rather than a best guess. A near-miss is a failed flag, and
   *  a failed flag is dropped — fuzzy matching would turn a dropped flag into
   *  a wrong one, which is the exact failure this product rules out. */
  locate(quote: string): Span | null;
}

export type Refusal =
  | { kind: "no-text-layer" }
  | { kind: "encrypted" }
  | { kind: "unsupported-format"; detected: string }
  | { kind: "unreadable" }
  | { kind: "empty" };

export type ParseResult =
  | { ok: true; document: ParsedDocument }
  | { ok: false; refusal: Refusal };

/** Called with a fraction between 0 and 1 while the document is being read,
 *  and once with 1 when it is done. Reading yields the thread between calls,
 *  so a several-hundred-KB contract reports its way through rather than
 *  locking the page into an apparent hang. */
export type ProgressListener = (fraction: number) => void;

export interface ParseOptions {
  onProgress?: ProgressListener;
}

/** Abbreviations and enumerations whose full stop does not end a sentence. */
const NON_TERMINAL = [
  "inc.",
  "ltd.",
  "llc.",
  "co.",
  "corp.",
  "no.",
  "nos.",
  "e.g.",
  "i.e.",
  "etc.",
  "cf.",
  "vs.",
  "v.",
  "approx.",
  "mr.",
  "mrs.",
  "ms.",
  "dr.",
  "sec.",
  "art.",
  "para.",
  "cl.",
];

function endsWithNonTerminal(chunk: string): boolean {
  const tail = chunk.trimEnd().toLowerCase();
  for (const abbr of NON_TERMINAL) {
    if (!tail.endsWith(abbr)) continue;
    // The abbreviation has to be a word of its own. Without this, a sentence
    // ending in "Reno." or "Tabasco." is swallowed into the next one.
    const before = tail[tail.length - abbr.length - 1];
    if (before === undefined || !/[a-z0-9]/.test(before)) return true;
  }
  // Section numbers: "3.", "3.2." — a digit-run before the stop.
  return /(?:^|[\s(])\d+(?:\.\d+)*\.$/.test(tail);
}

/** How many segments are taken before the loop hands the thread back. Small
 *  enough that a several-hundred-KB contract keeps repainting while it is read;
 *  large enough that the yields are not themselves the cost. */
const SEGMENTS_PER_YIELD = 400;

/** Hands control back to the host so the browser can paint the progress the
 *  caller has just been told about. In Node this is simply the next macrotask. */
function handBack(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function segment(
  text: string,
  onProgress?: ProgressListener,
): Promise<Sentence[]> {
  const out: Sentence[] = [];
  if (!("Segmenter" in Intl)) {
    // Environments without Intl.Segmenter still get whole-text citation
    // integrity; only the convenience list degrades.
    return text.trim() ? [{ text, start: 0, end: text.length }] : [];
  }
  const seg = new Intl.Segmenter("en", { granularity: "sentence" });

  const push = (from: number, to: number) => {
    const raw = text.slice(from, to);
    if (!raw.trim()) return;
    const lead = raw.length - raw.trimStart().length;
    const trail = raw.length - raw.trimEnd().length;
    out.push({
      text: text.slice(from + lead, to - trail),
      start: from + lead,
      end: to - trail,
    });
  };

  let pendingStart: number | null = null;
  let seen = 0;
  for (const piece of seg.segment(text)) {
    const start = piece.index;
    const end = start + piece.segment.length;
    if (pendingStart === null) pendingStart = start;

    seen += 1;
    if (seen % SEGMENTS_PER_YIELD === 0) {
      onProgress?.(text.length === 0 ? 1 : end / text.length);
      await handBack();
    }

    // Re-join a split caused by a legal abbreviation or a clause number.
    if (endsWithNonTerminal(piece.segment) && end < text.length) continue;

    push(pendingStart, end);
    pendingStart = null;
  }

  if (pendingStart !== null) push(pendingStart, text.length);
  return out;
}

async function makeDocument(
  text: string,
  onProgress?: ProgressListener,
): Promise<ParsedDocument> {
  const sentences = await segment(text, onProgress);
  return {
    text,
    sentences,
    locate(quote: string): Span | null {
      if (!quote) return null;
      const start = text.indexOf(quote);
      return start === -1 ? null : { start, end: start + quote.length };
    },
  };
}

/** Detected from content, never from the extension. The filename is only
 *  ever used in the message shown to the reader. */
function sniff(bytes: Uint8Array): "pdf" | "zip" | "doc" | "rtf" | "text" {
  const startsWith = (sig: number[]) =>
    sig.every((b, i) => bytes[i] === b);
  if (startsWith([0x25, 0x50, 0x44, 0x46])) return "pdf"; // %PDF
  if (startsWith([0x50, 0x4b, 0x03, 0x04])) return "zip"; // docx container
  if (startsWith([0xd0, 0xcf, 0x11, 0xe0])) return "doc"; // legacy OLE2
  if (startsWith([0x7b, 0x5c, 0x72, 0x74, 0x66])) return "rtf";
  return "text";
}

/** UTF-8 that round-trips. A file full of undecodable bytes is not text we
 *  can quote from, so it is refused rather than rendered as mojibake. */
function decodeUtf8(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

export async function parseDocument(
  bytes: ArrayBuffer,
  filename: string,
  options: ParseOptions = {},
): Promise<ParseResult> {
  void filename;
  const onProgress = options.onProgress;
  onProgress?.(0);
  const view = new Uint8Array(bytes);

  if (view.byteLength === 0) return { ok: false, refusal: { kind: "empty" } };

  const format = sniff(view);
  if (format !== "text") {
    return { ok: false, refusal: { kind: "unsupported-format", detected: format } };
  }

  const decoded = decodeUtf8(view);
  if (decoded === null) return { ok: false, refusal: { kind: "unreadable" } };

  // Strip a UTF-8 BOM: it is an encoding marker, not a character of the
  // document, and leaving it in would offset every span by one.
  const text = decoded.charCodeAt(0) === 0xfeff ? decoded.slice(1) : decoded;

  if (!text.trim()) return { ok: false, refusal: { kind: "empty" } };

  const document = await makeDocument(text, onProgress);
  onProgress?.(1);
  return { ok: true, document };
}
