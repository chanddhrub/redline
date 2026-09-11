/**
 * Seam 2 of intake (tickets 06–08).
 *
 * A pure state module holding the two things the user supplies alongside the
 * document. No React, no storage, no I/O.
 *
 * `AnalysisRequest` is the contract with the analysis feature, which does not
 * exist yet. Defining it here is the point.
 */

import type { ParsedDocument, Sentence } from "./parse-document";

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

export function emptyRequest(): AnalysisRequestState {
  return { document: null, jurisdiction: null, redLines: [] };
}

export function setDocument(
  state: AnalysisRequestState,
  document: ParsedDocument | null,
): AnalysisRequestState {
  return { ...state, document };
}

export function setJurisdiction(
  state: AnalysisRequestState,
  usState: UsState,
): AnalysisRequestState {
  return { ...state, jurisdiction: usState };
}

let counter = 0;
function nextId(): string {
  counter += 1;
  return `rl-${counter}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Blank and whitespace-only entries are rejected so the list stays
 *  meaningful; anything else is stored exactly as typed. */
export function addRedLine(
  state: AnalysisRequestState,
  text: string,
): AnalysisRequestState {
  if (!text.trim()) return state;
  return { ...state, redLines: [...state.redLines, { id: nextId(), text }] };
}

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
