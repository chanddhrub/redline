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
 * `locate` tolerates typography and nothing else. It normalises a view of the
 * canonical text and the incoming quote the same way, matches exactly in that
 * view, and maps the match back — so the offsets it returns always index the
 * canonical text (ticket 02).
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

/* ---------------------------------------------------------------------------
 * Reversible normalisation, used only by `locate`.
 *
 * The canonical text is never touched. A normalised *view* of it is built
 * alongside, with, for every normalised character, the canonical range that
 * produced it. A quote is normalised the same way, matched exactly in
 * normalised space, and the match is mapped back — so `locate` hands out
 * offsets into the canonical text and the sentence the reader checked is the
 * sentence the analysis quotes (ADR 0001).
 *
 * What is normalised is typography only: whitespace runs, smart quotes and
 * apostrophes, typographic ligatures, soft hyphens, and a hyphen broken across
 * a line or a page. Nothing here changes a letter, a case or a word order.
 * Matching is `indexOf` and nothing else: there is no edit distance, no
 * token overlap, no nearest-sentence fallback. A quote that does not match is
 * a dropped flag, which is the intended cost; a quote matched loosely would be
 * a wrong flag, which is the failure this product exists to rule out.
 * ------------------------------------------------------------------------ */

/** Curly quotes and apostrophes, folded to their straight equivalents. Both
 *  directions are covered by folding the document and the quote alike. */
const QUOTE_FOLD: Record<string, string> = {
  "\u201c": '"',
  "\u201d": '"',
  "\u201e": '"',
  "\u201f": '"',
  "\u2033": '"',
  "\u2018": "'",
  "\u2019": "'",
  "\u201a": "'",
  "\u201b": "'",
  "\u2032": "'",
};

/** Typographic ligatures, spelled out. These are glyph choices made by the
 *  typesetter, not spellings: a word set with one is the same word. */
const LIGATURE_FOLD: Record<string, string> = {
  "\ufb00": "ff",
  "\ufb01": "fi",
  "\ufb02": "fl",
  "\ufb03": "ffi",
  "\ufb04": "ffl",
  "\ufb05": "st",
  "\ufb06": "st",
};

/** Hyphens that a PDF may leave at the end of a line. */
const HYPHENS = new Set(["-", "\u2010"]);

/** An invisible hint about where a word may break. It is not part of the
 *  word, and a model quoting the word never returns it. */
const SOFT_HYPHEN = "\u00ad";

function isSpace(ch: string): boolean {
  return /\s/.test(ch);
}

function hasLineBreak(run: string): boolean {
  return /[\n\r\f\v\u2028\u2029]/.test(run);
}

interface View {
  /** The normalised text. */
  normalised: string;
  /** For normalised position i, the canonical offset its source starts at. */
  from: number[];
  /** For normalised position i, the canonical offset its source ends at. */
  to: number[];
  /** What a hyphen at a line break becomes in this view. */
  brokenHyphen: "" | "-";
}

/**
 * A hyphen at a line break is ambiguous: "discre-\ntion" is one word split by
 * the typesetter, "non-\ncompete" is a compound whose hyphen belongs to the
 * word. There is no way to tell them apart without a dictionary, so both
 * readings are built as separate views and each is searched exactly. This is
 * two exact matches, not a fuzzy one — nothing partial is ever accepted.
 */
function buildView(text: string, brokenHyphen: "" | "-"): View {
  let normalised = "";
  const from: number[] = [];
  const to: number[] = [];

  const emit = (chars: string, srcStart: number, srcEnd: number) => {
    for (const ch of chars) {
      normalised += ch;
      from.push(srcStart);
      to.push(srcEnd);
    }
  };

  let i = 0;
  while (i < text.length) {
    const ch = text[i];

    if (ch === SOFT_HYPHEN) {
      i += 1;
      continue;
    }

    if (HYPHENS.has(ch)) {
      let j = i + 1;
      while (j < text.length && isSpace(text[j])) j += 1;
      if (j > i + 1 && hasLineBreak(text.slice(i + 1, j))) {
        if (brokenHyphen === "-") emit("-", i, i + 1);
        i = j;
        continue;
      }
      emit("-", i, i + 1);
      i += 1;
      continue;
    }

    if (isSpace(ch)) {
      let j = i;
      while (j < text.length && isSpace(text[j])) j += 1;
      emit(" ", i, j);
      i = j;
      continue;
    }

    const ligature = LIGATURE_FOLD[ch];
    if (ligature !== undefined) {
      emit(ligature, i, i + 1);
      i += 1;
      continue;
    }

    const quoteMark = QUOTE_FOLD[ch];
    emit(quoteMark ?? ch, i, i + 1);
    i += 1;
  }

  return { normalised, from, to, brokenHyphen };
}

function findIn(view: View, quote: string): Span | null {
  // Leading and trailing whitespace is the shape a model returns a sentence
  // in; it is not part of the sentence.
  const needle = buildView(quote, view.brokenHyphen).normalised.trim();
  if (!needle) return null;
  const at = view.normalised.indexOf(needle);
  if (at === -1) return null;
  return { start: view.from[at], end: view.to[at + needle.length - 1] };
}

async function makeDocument(
  text: string,
  onProgress?: ProgressListener,
): Promise<ParsedDocument> {
  const sentences = await segment(text, onProgress);

  // Built on first use and kept: most documents are never located into, and a
  // document that is gets one flag after another checked against it.
  let views: View[] | null = null;

  return {
    text,
    sentences,
    locate(quote: string): Span | null {
      if (!quote) return null;
      views ??= [buildView(text, ""), buildView(text, "-")];
      for (const view of views) {
        const span = findIn(view, quote);
        if (span) return span;
      }
      return null;
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
