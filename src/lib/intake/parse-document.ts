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
  if (NON_TERMINAL.some((a) => tail.endsWith(a))) return true;
  // Section numbers: "3.", "3.2." — a digit-run before the stop.
  return /(?:^|[\s(])\d+(?:\.\d+)*\.$/.test(tail);
}

function segment(text: string): Sentence[] {
  const out: Sentence[] = [];
  if (!("Segmenter" in Intl)) {
    // Environments without Intl.Segmenter still get whole-text citation
    // integrity; only the convenience list degrades.
    return text.trim() ? [{ text, start: 0, end: text.length }] : [];
  }
  const seg = new Intl.Segmenter("en", { granularity: "sentence" });

  let pendingStart: number | null = null;
  for (const piece of seg.segment(text)) {
    const start = piece.index;
    const end = start + piece.segment.length;
    if (pendingStart === null) pendingStart = start;

    // Re-join a split caused by a legal abbreviation or a clause number.
    if (endsWithNonTerminal(piece.segment) && end < text.length) continue;

    const raw = text.slice(pendingStart, end);
    if (raw.trim()) {
      const lead = raw.length - raw.trimStart().length;
      const trail = raw.length - raw.trimEnd().length;
      out.push({
        text: text.slice(pendingStart + lead, end - trail),
        start: pendingStart + lead,
        end: end - trail,
      });
    }
    pendingStart = null;
  }

  if (pendingStart !== null) {
    const raw = text.slice(pendingStart);
    if (raw.trim()) {
      const lead = raw.length - raw.trimStart().length;
      const trail = raw.length - raw.trimEnd().length;
      out.push({
        text: text.slice(pendingStart + lead, text.length - trail),
        start: pendingStart + lead,
        end: text.length - trail,
      });
    }
  }
  return out;
}

function makeDocument(text: string): ParsedDocument {
  return {
    text,
    sentences: segment(text),
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
): Promise<ParseResult> {
  void filename;
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

  return { ok: true, document: makeDocument(text) };
}
