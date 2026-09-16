/**
 * Seam 2 of intake (tickets 06–08).
 *
 * A pure state module holding the two things the user supplies alongside the
 * document. No React, no storage, no I/O.
 *
 * `AnalysisRequest` is the contract with the analysis feature, which does not
 * exist yet. Defining it here is the point.
 */

import {
  parseDocument,
  type ParsedDocument,
  type Sentence,
} from "./parse-document";

/** A constraint the reader declares in their own words. Two fields, and it
 *  stays at two: intake carries red lines and does nothing else with them.
 *
 *  No severity field. Promotion — raising a matching flag to the top and naming
 *  the line it crossed — is the analysis feature's job (ADR 0003), and a
 *  severity here would pre-empt it. Nothing in intake reads this text for
 *  meaning either; parsing, taxonomy and matching all live downstream. */
export interface RedLine {
  id: string;
  text: string;
}

export interface AnalysisRequest {
  text: string;
  sentences: Sentence[];
  jurisdiction: UsState;
  redLines: RedLine[];
}

export interface AnalysisRequestState {
  document: ParsedDocument | null;
  jurisdiction: UsState | null;
  redLines: RedLine[];
}

export const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
  "Connecticut", "Delaware", "District of Columbia", "Florida", "Georgia",
  "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky",
  "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
  "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
  "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota",
  "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island",
  "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont",
  "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming",
] as const;

export type UsState = (typeof US_STATES)[number];

const US_STATE_SET: ReadonlySet<string> = new Set(US_STATES);

/** The boundary guard. A `<select>` hands back a string, and a string cast to
 *  `UsState` is a lie the compiler cannot catch. */
export function isUsState(value: string): value is UsState {
  return US_STATE_SET.has(value);
}

export function emptyRequest(): AnalysisRequestState {
  return { document: null, jurisdiction: null, redLines: [] };
}

export function setDocument(
  state: AnalysisRequestState,
  document: ParsedDocument | null,
): AnalysisRequestState {
  return { ...state, document };
}

/** The state the reader works in. Setting it again replaces it rather than
 *  adding to it, because the answer is one state and changing it is expected:
 *  a mistake gets corrected, and a role in another state gets checked.
 *
 *  Anything that is not a US state is ignored and the state comes back
 *  unchanged, the same way a blank red line is ignored. The jurisdiction is
 *  required before analysis can run, and "required" is worth nothing if a
 *  stray string can satisfy it. */
export function setJurisdiction(
  state: AnalysisRequestState,
  usState: UsState,
): AnalysisRequestState {
  if (!isUsState(usState)) return state;
  return { ...state, jurisdiction: usState };
}

let counter = 0;
function nextId(): string {
  counter += 1;
  return `rl-${counter}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Blank and whitespace-only entries are rejected so the list stays meaningful.
 *  Anything else is stored exactly as typed: no trimming, no title-casing, no
 *  normalising. The reader's wording is the thing the analysis has to quote
 *  back when it says which line was crossed, so it survives intact.
 *
 *  `trim` here is an emptiness test and nothing more. It is the only place
 *  intake touches the characters of a red line at all. */
export function addRedLine(
  state: AnalysisRequestState,
  text: string,
): AnalysisRequestState {
  if (!text.trim()) return state;
  return { ...state, redLines: [...state.redLines, { id: nextId(), text }] };
}

/** Sharpening a line once the document has been read. The id is kept, so a
 *  line that has been edited is still the same line; every other entry comes
 *  through untouched, id included. An edit into blankness is refused the same
 *  way an add is, and leaves the line as it was rather than emptying it. */
export function editRedLine(
  state: AnalysisRequestState,
  id: string,
  text: string,
): AnalysisRequestState {
  if (!text.trim()) return state;
  return {
    ...state,
    redLines: state.redLines.map((r) => (r.id === id ? { ...r, text } : r)),
  };
}

/** Changing your mind. An id that is not in the list leaves the list as it
 *  was. */
export function removeRedLine(
  state: AnalysisRequestState,
  id: string,
): AnalysisRequestState {
  return { ...state, redLines: state.redLines.filter((r) => r.id !== id) };
}

/** A document and a state. Red lines are optional — a user with none gets a
 *  normal analysis. */
export function isReady(state: AnalysisRequestState): boolean {
  return state.document !== null && state.jurisdiction !== null;
}

/** What is still missing, in the user's words, so the interface never has to
 *  render a disabled control with no reason attached. */
export function whatIsMissing(state: AnalysisRequestState): string[] {
  const missing: string[] = [];
  if (!state.document) missing.push("a document");
  if (!state.jurisdiction) missing.push("the state you work in");
  return missing;
}

export function toAnalysisRequest(
  state: AnalysisRequestState,
): AnalysisRequest | null {
  if (!state.document || !state.jurisdiction) return null;
  return {
    text: state.document.text,
    sentences: state.document.sentences,
    jurisdiction: state.jurisdiction,
    redLines: state.redLines,
  };
}

/* ── Surviving an accidental in-page navigation ──────────────────────── */

/** Where the reader's session is kept while the tab is open.
 *
 *  `sessionStorage`, never `localStorage`. A shared machine must not still
 *  have someone's offer letter in it tomorrow morning. Nothing goes to a
 *  server and nothing goes to a database. */
export const INTAKE_SESSION_KEY = "redline.intake";

/** What the document is called and where it came from. The seam carries it
 *  because a restored page that cannot name the document it is showing is a
 *  page the reader has to take on trust. */
export interface IntakeOrigin {
  filename: string;
  source: "yours" | "sample";
}

export interface RestoredIntake {
  state: AnalysisRequestState;
  origin: IntakeOrigin | null;
}

interface StoredIntake {
  text: string | null;
  origin: IntakeOrigin | null;
  jurisdiction: UsState | null;
  redLines: RedLine[];
}

/** The canonical text goes in, and nothing else from the document does.
 *
 *  `ParsedDocument` carries a `locate` method, and a method does not survive
 *  a round trip through JSON. Storing the sentences too would produce a
 *  document that looks whole and whose `locate` is gone — every citation
 *  broken after a refresh, silently. So only the text is kept, and
 *  `restoreIntake` reads it back through the same parser that produced it. */
export function serialiseIntake(
  state: AnalysisRequestState,
  origin: IntakeOrigin | null,
): string {
  const stored: StoredIntake = {
    text: state.document ? state.document.text : null,
    origin: state.document ? origin : null,
    jurisdiction: state.jurisdiction,
    redLines: state.redLines,
  };
  return JSON.stringify(stored);
}

function storedRedLines(value: unknown): RedLine[] {
  if (!Array.isArray(value)) return [];
  const lines: RedLine[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const { id, text } = entry as { id?: unknown; text?: unknown };
    if (typeof id !== "string" || typeof text !== "string") continue;
    if (!text.trim()) continue;
    lines.push({ id, text });
  }
  return lines;
}

/** Reads a session back. Anything that does not survive intact is dropped
 *  rather than half-restored: a jurisdiction that is not a US state, a red
 *  line that is not two strings, a document whose text will not re-read.
 *
 *  The document is re-read through `parseDocument`, which is what makes the
 *  restored `locate` a real one rather than a shape that type-checks. The
 *  parser is a pure function of the text it is given, so the sentences come
 *  back identical to the ones the reader already confirmed on screen. */
export async function restoreIntake(raw: string | null): Promise<RestoredIntake> {
  const empty: RestoredIntake = { state: emptyRequest(), origin: null };
  if (!raw) return empty;

  let stored: Partial<StoredIntake>;
  try {
    stored = JSON.parse(raw) as Partial<StoredIntake>;
  } catch {
    return empty;
  }
  if (!stored || typeof stored !== "object") return empty;

  let state = emptyRequest();

  if (typeof stored.jurisdiction === "string" && isUsState(stored.jurisdiction)) {
    state = setJurisdiction(state, stored.jurisdiction);
  }
  state = { ...state, redLines: storedRedLines(stored.redLines) };

  let origin: IntakeOrigin | null = null;
  if (typeof stored.text === "string" && stored.text.trim()) {
    const bytes = new TextEncoder().encode(stored.text);
    const result = await parseDocument(
      bytes.buffer.slice(0) as ArrayBuffer,
      "restored-session.txt",
    );
    if (result.ok) {
      state = setDocument(state, result.document);
      const saved = stored.origin;
      origin =
        saved &&
        typeof saved.filename === "string" &&
        (saved.source === "yours" || saved.source === "sample")
          ? { filename: saved.filename, source: saved.source }
          : { filename: "your document", source: "yours" };
    }
  }

  return { state, origin };
}
