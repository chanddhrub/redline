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

/**
 * A line that stops on a hyphen has stopped in the middle of a word, so the
 * sentence carries on over the break — whether the break is the end of a line
 * or the foot of a page. Without this, "…confidential infor-" and "mation you
 * will receive." are two sentences and the clause can never be quoted whole.
 */
function endsMidWord(chunk: string): boolean {
  const tail = chunk.trimEnd();
  return tail.length > 0 && HYPHENS.has(tail[tail.length - 1]);
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

    // Re-join a split caused by a legal abbreviation, a clause number, or a
    // word the typesetter broke across a line or a page.
    if (
      end < text.length &&
      (endsWithNonTerminal(piece.segment) || endsMidWord(piece.segment))
    ) {
      continue;
    }

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

/* ---------------------------------------------------------------------------
 * PDF (ticket 03) and DOCX (ticket 04).
 *
 * Both extractors run in the browser and under the Node test runner, which is
 * what lets this seam be exercised without a DOM. Neither is reachable from a
 * server route: there is no route that accepts a file, and its absence is the
 * enforcement (ADR 0003).
 *
 * Both libraries are loaded on demand. A pasted contract or a .txt should not
 * pay for a PDF engine it never touches, and in the browser the import becomes
 * a chunk fetched only when someone actually drops a PDF or a Word file.
 * ------------------------------------------------------------------------ */

/**
 * pdf.js normally hands parsing to a Web Worker, which it finds by URL. A URL
 * is exactly what cannot be made to mean the same thing in a bundler and in
 * Node: under Node there is no `Worker` to hand it to, and under a bundler the
 * path only exists after the build has rewritten it.
 *
 * pdf.js offers one door that needs no URL in either place: if
 * `globalThis.pdfjsWorker` already holds a worker module, it runs that module's
 * message handler in place rather than looking anything up. So the worker is
 * imported as an ordinary module — the bundler resolves it like any other
 * import, Node resolves it like any other import — and handed over before the
 * first document is opened.
 *
 * The cost is that a PDF is read on the calling thread rather than a worker.
 * That is why reading hands the thread back between pages: the page keeps
 * painting its progress instead of freezing (story 6).
 *
 * The `legacy` build is the one used in both environments. pdf.js's modern
 * build warns and then fails outright under Node; the legacy build is the
 * supported answer there and is equally correct in a browser, so both get the
 * same code rather than a split that only one environment ever tests.
 */
let pdfjsReady: Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs")> | null = null;

function loadPdfjs() {
  pdfjsReady ??= (async () => {
    const workerModule = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
    const host = globalThis as { pdfjsWorker?: unknown };
    host.pdfjsWorker ??= workerModule;
    return import("pdfjs-dist/legacy/build/pdf.mjs");
  })();
  return pdfjsReady;
}

/** How much of the reported progress the extraction phase owns. The rest
 *  belongs to segmentation, so the fraction only ever climbs. */
const EXTRACTION_SHARE = 0.6;

function scaled(
  onProgress: ProgressListener | undefined,
  from: number,
  to: number,
): ProgressListener | undefined {
  if (!onProgress) return undefined;
  return (fraction) => onProgress(from + (to - from) * fraction);
}

type Extracted =
  | { ok: true; text: string }
  | { ok: false; refusal: Refusal };

/** What a line can end on and still have ended something. Anything else is a
 *  line the typesetter wrapped, not a line the author finished. */
const CLOSES_A_LINE = /[.!?:;][")'’”\]]?$/;

/**
 * Puts two typeset lines back together.
 *
 * A PDF has no paragraphs, only lines, and most of its line breaks are the
 * typesetter running out of width rather than the author finishing a thought.
 * Rejoining a wrapped line with a space is what keeps a clause running over
 * three lines as one sentence instead of three.
 *
 * A line that stops on a hyphen keeps its break. That is deliberate: the break
 * is the signal that the hyphen is a typesetter's, not the author's, and it is
 * what lets a quote of "information" find a document that says "infor-\nmation".
 *
 * A page boundary is joined by this same rule and nothing else, so the foot of
 * one page meets the head of the next exactly as two lines of one page do. That
 * is the whole of the page-join decision: a sentence that spans a page break is
 * one sentence because nothing is put at the seam that would end it.
 */
function join(previous: string): string {
  const tail = previous.trimEnd();
  if (!tail) return "\n";
  if (HYPHENS.has(tail[tail.length - 1])) return "\n";
  return CLOSES_A_LINE.test(tail) ? "\n" : " ";
}

async function extractPdf(
  bytes: Uint8Array,
  onProgress?: ProgressListener,
): Promise<Extracted> {
  let pdfjs: typeof import("pdfjs-dist/legacy/build/pdf.mjs");
  try {
    pdfjs = await loadPdfjs();
  } catch {
    return { ok: false, refusal: { kind: "unreadable" } };
  }

  // `data` is consumed and detached by pdf.js, so it gets its own copy: the
  // caller's bytes stay intact for anything else that wants to look at them.
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    // Nothing here renders. Text extraction needs no font drawn, so neither
    // is loaded: it is work nobody sees, and under Node there is no font
    // machinery to do it with.
    disableFontFace: true,
    useSystemFonts: false,
  });

  try {
    const pdf = await task.promise;
    const lines: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      let line = "";
      for (const item of content.items) {
        if (!("str" in item)) continue;
        line += item.str;
        if (item.hasEOL) {
          lines.push(line);
          line = "";
        }
      }
      if (line) lines.push(line);
      page.cleanup();
      onProgress?.(pageNumber / pdf.numPages);
      await handBack();
    }

    let text = "";
    lines.forEach((line, index) => {
      text += index === 0 ? line : join(lines[index - 1]) + line;
    });
    // A PDF that yields nothing is a picture of a contract, not a contract.
    // Saying so is the honest answer; OCR is excluded on purpose, and a
    // citation into text a machine guessed at is worth less than no citation.
    if (!text.trim()) return { ok: false, refusal: { kind: "no-text-layer" } };
    return { ok: true, text };
  } catch (error) {
    if ((error as { name?: string })?.name === "PasswordException") {
      return { ok: false, refusal: { kind: "encrypted" } };
    }
    return { ok: false, refusal: { kind: "unreadable" } };
  } finally {
    await task.destroy().catch(() => {});
  }
}

/**
 * `mammoth` takes its bytes under a different key depending on which build the
 * host resolved — `buffer` under Node, `arrayBuffer` in the browser. Both are
 * passed, so the same call works wherever it runs and neither environment has
 * a branch the other never exercises.
 */
async function extractDocx(bytes: Uint8Array): Promise<Extracted> {
  const copy = bytes.slice().buffer as ArrayBuffer;
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({
      arrayBuffer: copy,
      buffer: copy,
    } as unknown as { arrayBuffer: ArrayBuffer });
    const text = result.value;
    if (!text.trim()) return { ok: false, refusal: { kind: "empty" } };
    return { ok: true, text };
  } catch {
    return { ok: false, refusal: { kind: "unreadable" } };
  }
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

  let text: string;
  let segmentProgress = onProgress;

  if (format === "doc" || format === "rtf") {
    return { ok: false, refusal: { kind: "unsupported-format", detected: format } };
  }

  if (format === "pdf" || format === "zip") {
    const extracted =
      format === "pdf"
        ? await extractPdf(view, scaled(onProgress, 0, EXTRACTION_SHARE))
        : await extractDocx(view);
    if (!extracted.ok) return extracted;
    // Verbatim: whatever the extractor produced is what is kept, shown and
    // quoted from. Nothing is trimmed or reflowed on the way in.
    text = extracted.text;
    segmentProgress = scaled(onProgress, EXTRACTION_SHARE, 1);
  } else {
    const decoded = decodeUtf8(view);
    if (decoded === null) return { ok: false, refusal: { kind: "unreadable" } };

    // Strip a UTF-8 BOM: it is an encoding marker, not a character of the
    // document, and leaving it in would offset every span by one.
    text = decoded.charCodeAt(0) === 0xfeff ? decoded.slice(1) : decoded;
  }

  if (!text.trim()) return { ok: false, refusal: { kind: "empty" } };

  const document = await makeDocument(text, segmentProgress);
  onProgress?.(1);
  return { ok: true, document };
}
