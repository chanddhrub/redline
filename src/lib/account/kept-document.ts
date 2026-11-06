/**
 * The seam between the document on screen and the one row that keeps it
 * (ADR 0007).
 *
 * Pure. No client, no React. It decides the two things worth arguing about:
 * what may leave the browser, and what is believed when it comes back.
 *
 * Out: `rowFor` copies each field by name, so an object carrying the original
 * file leaves without it. There is no column for a file and no field here for
 * one.
 *
 * Back: a stored analysis is a claim about a text, so it is checked against
 * that text before it is shown. Every citation has to be found at its own
 * offset, in the document's own words. One that is not takes the whole analysis
 * with it (ADR 0001), and the reader is told rather than shown less.
 */

import {
  isUsState,
  type IntakeOrigin,
  type RedLine,
  type UsState,
} from "../intake/analysis-request";
import { parseDocument, type ParsedDocument } from "../intake/parse-document";
import {
  parseAnalysis,
  parseAnswer,
  type Exchange,
  type WireAnalysis,
  type WireCitation,
} from "../../app/review/_lib/wire";
import { redLinesFrom } from "./red-lines";

/** What is on screen, in the shape that can be kept. */
export interface DocumentSnapshot {
  text: string;
  origin: IntakeOrigin;
  jurisdiction: UsState | null;
  analysis: WireAnalysis | null;
  /** The red lines that analysis ranked against. A list changed since, on
   *  another day, means the ranking on screen is not the reader's current one. */
  analysedRedLines: RedLine[];
  exchanges: Exchange[];
}

/** One row of `public.kept_documents`. */
export interface KeptDocumentRow {
  owner: string;
  text: string;
  filename: string;
  source: IntakeOrigin["source"];
  jurisdiction: UsState | null;
  analysis: WireAnalysis | null;
  analysed_red_lines: RedLine[];
  exchanges: Exchange[];
}

export const KEPT_DOCUMENT_COLUMNS = [
  "owner",
  "text",
  "filename",
  "source",
  "jurisdiction",
  "analysis",
  "analysed_red_lines",
  "exchanges",
] as const;

export function rowFor(owner: string, snapshot: DocumentSnapshot): KeptDocumentRow {
  if (!owner.trim()) throw new Error("A kept document needs an owner.");
  return {
    owner,
    text: snapshot.text,
    filename: snapshot.origin.filename,
    source: snapshot.origin.source,
    jurisdiction: snapshot.jurisdiction,
    analysis: snapshot.analysis,
    analysed_red_lines: snapshot.analysedRedLines.map(({ id, text }) => ({ id, text })),
    exchanges: snapshot.exchanges.map(({ question, answer }) => ({ question, answer })),
  };
}

/** Whether two snapshots hold the same things, so a re-render is not a write. */
export function snapshotKey(snapshot: DocumentSnapshot): string {
  return JSON.stringify(rowFor("key", snapshot));
}

export interface KeptDocument {
  document: ParsedDocument;
  origin: IntakeOrigin;
  jurisdiction: UsState | null;
  analysis: WireAnalysis | null;
  analysedRedLines: RedLine[];
  exchanges: Exchange[];
  /** Something was kept and failed its check, so the reader has to be told
   *  they are looking at less than they saved. */
  dropped: boolean;
}

function holds(text: string, citation: WireCitation): boolean {
  return text.slice(citation.span.start, citation.span.end) === citation.text;
}

function analysisHolds(text: string, analysis: WireAnalysis): boolean {
  const citations = [
    ...analysis.summary.claims.map((claim) => claim.citation),
    ...analysis.flags.map((ranked) => ranked.flag.citation),
    ...(analysis.governingLaw ? [analysis.governingLaw] : []),
  ];
  return citations.every((citation) => holds(text, citation));
}

function exchangesFrom(
  value: unknown,
  text: string,
): { exchanges: Exchange[]; dropped: boolean } {
  if (!Array.isArray(value)) return { exchanges: [], dropped: value != null };
  const exchanges: Exchange[] = [];
  let dropped = false;
  for (const entry of value) {
    const { question, answer: raw } = (entry ?? {}) as { question?: unknown; answer?: unknown };
    const answer = parseAnswer(raw);
    const good =
      typeof question === "string" &&
      answer !== null &&
      (answer.kind === "not-addressed" || answer.citations.every((c) => holds(text, c)));
    if (good) exchanges.push({ question: question as string, answer: answer as Exchange["answer"] });
    else dropped = true;
  }
  return { exchanges, dropped };
}

/**
 * Reads a row back. `null` means there is no document in it that can be shown.
 *
 * The text goes back through the parser that produced it, which is what makes
 * the restored document a real one. If that does not give back the same text,
 * the offsets in the analysis point at nothing, so `holds` fails and it goes.
 */
export async function keptDocumentFrom(value: unknown): Promise<KeptDocument | null> {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.text !== "string" || !row.text.trim()) return null;

  const bytes = new TextEncoder().encode(row.text);
  const parsed = await parseDocument(bytes.buffer.slice(0) as ArrayBuffer, "kept-document.txt");
  if (!parsed.ok) return null;
  const document = parsed.document;

  const analysis = row.analysis == null ? null : parseAnalysis(row.analysis);
  const trusted = analysis && analysisHolds(document.text, analysis) ? analysis : null;
  const { exchanges, dropped } = exchangesFrom(row.exchanges, document.text);

  return {
    document,
    origin: {
      filename:
        typeof row.filename === "string" && row.filename ? row.filename : "your document",
      source: row.source === "sample" ? "sample" : "yours",
    },
    jurisdiction:
      typeof row.jurisdiction === "string" && isUsState(row.jurisdiction)
        ? row.jurisdiction
        : null,
    analysis: trusted,
    analysedRedLines: redLinesFrom(row.analysed_red_lines),
    exchanges,
    dropped: dropped || (row.analysis != null && !trusted),
  };
}
