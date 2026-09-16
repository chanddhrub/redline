/**
 * The fixture-backed stub. This is the one permitted stub in the suite: it
 * replaces the network and nothing else. The verification gate, the ranking and
 * the promotion all run for real against what it returns.
 *
 * Everything it returns is derived from `tests/fixtures/*.expected.json` and
 * the document beside it, so a change to a fixture changes the stub and a test
 * that passed for the wrong reason stops passing. Nothing here is a fixed
 * value typed out by hand.
 *
 * It is also the source of the negative corpus. Ticket 02's whole subject is
 * output that is *well-formed and wrong* — a paraphrase that reads like a
 * quote, a sentence lifted from the other document, an answer citing text that
 * is not there, a claimed match to a red line nobody declared. Those are the
 * `StubCorruption` knobs: each produces a payload that satisfies the declared
 * schema and must still be stopped downstream. `off-schema` is the exception,
 * and exists to exercise the failure path through the same seam.
 *
 * Node-only (it reads files). It is imported by tests, never by the app.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  ModelClient,
  ModelFailure,
  ModelResult,
  StructuredRequest,
} from "./client";
import {
  ANALYSIS_OPERATION,
  ANSWER_OPERATION,
  type ClauseType,
  type Severity,
} from "./payloads";

export const FIXTURE_NAMES = ["adhesion-contract", "clean-offer"] as const;
export type FixtureName = (typeof FIXTURE_NAMES)[number];

/** The shape of a sidecar on disk. Read, never written, by this module. */
export interface SidecarFlag {
  id: string;
  clauseType: ClauseType;
  sourceSentence: string;
  expectedSeverity: Severity;
  meaning: string;
  counterOffer: string;
  escapability: Record<string, string>;
}

export interface Sidecar {
  document: string;
  description: string;
  jurisdiction: string;
  governingLaw: string | null;
  expectedFlags: SidecarFlag[];
  decoySentences: string[];
  clauseTypesChecked: ClauseType[];
}

export interface Fixture {
  name: FixtureName;
  sidecar: Sidecar;
  /** The document exactly as it sits on disk. */
  text: string;
}

export const DEFAULT_FIXTURES_DIR = join(
  __dirname,
  "..",
  "..",
  "..",
  "tests",
  "fixtures",
);

export function loadFixture(
  name: FixtureName,
  fixturesDir: string = DEFAULT_FIXTURES_DIR,
): Fixture {
  const sidecar = JSON.parse(
    readFileSync(join(fixturesDir, `${name}.expected.json`), "utf8"),
  ) as Sidecar;
  const text = readFileSync(join(fixturesDir, sidecar.document), "utf8");
  return { name, sidecar, text };
}

export function loadFixtures(
  fixturesDir: string = DEFAULT_FIXTURES_DIR,
): Record<FixtureName, Fixture> {
  return {
    "adhesion-contract": loadFixture("adhesion-contract", fixturesDir),
    "clean-offer": loadFixture("clean-offer", fixturesDir),
  };
}

/**
 * Each knob makes the model lie in one specific way. They compose, and every
 * one except `off-schema` produces a payload that passes the declared schema —
 * which is the point, because a schema cannot tell a quote from a paraphrase.
 */
export type StubCorruption =
  /** Every quoted sentence is reworded. None of them is in the document. */
  | "paraphrase-quotes"
  /** One word per quote is swapped. The near miss, which is the hard case. */
  | "one-word-changed"
  /** Quotes are real sentences — from the *other* fixture's document. */
  | "quotes-from-other-fixture"
  /** A confident answer citing a sentence that is not in the document. */
  | "answer-cites-absent-text"
  /** Every candidate claims a red line the user never declared. */
  | "claim-undeclared-red-line"
  /** Well-formed JSON that breaks the declared schema. */
  | "off-schema";

export interface StubOptions {
  fixturesDir?: string;
  /**
   * Forces the fixture. Left unset, the stub picks the fixture whose document
   * appears in the request, and throws if neither does — a request built
   * against no document is a broken test, not a model failure.
   */
  fixture?: FixtureName;
  corruptions?: StubCorruption[];
  /** Makes the stub fail exactly the way the transport fails. */
  failWith?: ModelFailure;
  /** Escape hatch for a lie the named knobs do not cover. Applied last. */
  transform?: (
    payload: unknown,
    context: { operation: string; fixture: FixtureName },
  ) => unknown;
}

/** The red line id no fixture declares, so a claim to it can never verify. */
export const UNDECLARED_RED_LINE_ID = "red-line-that-was-never-declared";

export function createStubModelClient(options: StubOptions = {}): ModelClient {
  const fixtures = loadFixtures(options.fixturesDir);
  const corruptions = new Set(options.corruptions ?? []);

  return {
    async complete<T>(request: StructuredRequest<T>): Promise<ModelResult<T>> {
      if (options.failWith) return { ok: false, failure: options.failWith };

      const fixture = options.fixture
        ? fixtures[options.fixture]
        : pickFixture(fixtures, request.user);
      const other = fixtures[otherName(fixture.name)];

      let payload: unknown;
      if (request.operation === ANALYSIS_OPERATION) {
        payload = buildAnalysis(fixture, other, corruptions);
      } else if (request.operation === ANSWER_OPERATION) {
        payload = buildAnswer(fixture, other, request.user, corruptions);
      } else {
        throw new Error(
          `stub model client has no payload for operation "${request.operation}"; ` +
            `known operations are "${ANALYSIS_OPERATION}" and "${ANSWER_OPERATION}"`,
        );
      }

      if (options.transform) {
        payload = options.transform(payload, {
          operation: request.operation,
          fixture: fixture.name,
        });
      }

      // The stub is held to the caller's schema for the same reason the
      // transport is: if the declared shape and the fixture shape drift apart,
      // the suite should say so rather than quietly test the old one.
      const outcome = request.schema.parse(payload);
      if (!outcome.ok) {
        return {
          ok: false,
          failure: {
            kind: "unusable-response",
            reason: "off-schema",
            detail: outcome.detail,
          },
        };
      }
      return { ok: true, value: outcome.value };
    },
  };
}

function otherName(name: FixtureName): FixtureName {
  return name === "adhesion-contract" ? "clean-offer" : "adhesion-contract";
}

function pickFixture(
  fixtures: Record<FixtureName, Fixture>,
  user: string,
): Fixture {
  for (const name of FIXTURE_NAMES) {
    const fixture = fixtures[name];
    if (user.includes(fixture.text.trim().slice(0, 200))) return fixture;
  }
  throw new Error(
    "stub model client could not tell which fixture this request is about; " +
      "include the fixture document in the request, or set StubOptions.fixture",
  );
}

function buildAnalysis(
  fixture: Fixture,
  other: Fixture,
  corruptions: Set<StubCorruption>,
) {
  const { sidecar } = fixture;
  const foreign = foreignSentences(other);

  const candidates = sidecar.expectedFlags.map((flag, index) => ({
    id: flag.id,
    clauseType: flag.clauseType,
    severity: flag.expectedSeverity,
    sourceSentence: corruptQuote(
      flag.sourceSentence,
      index,
      foreign,
      corruptions,
    ),
    meaning: flag.meaning,
    counterOffer: flag.counterOffer,
    escapability: Object.entries(flag.escapability).map(([factor, value]) => ({
      factor,
      value,
    })),
    claimedRedLineId: corruptions.has("claim-undeclared-red-line")
      ? UNDECLARED_RED_LINE_ID
      : null,
  }));

  const citationSource = sidecar.expectedFlags.length
    ? sidecar.expectedFlags.map((flag) => flag.sourceSentence)
    : sidecar.decoySentences;

  const payload = {
    summary: {
      text: sidecar.description,
      citations: citationSource
        .slice(0, 2)
        .map((sentence, index) =>
          corruptQuote(sentence, index, foreign, corruptions),
        ),
    },
    candidates,
    governingLawSentence: sidecar.governingLaw
      ? corruptQuote(sidecar.governingLaw, 0, foreign, corruptions)
      : null,
    coverage: sidecar.clauseTypesChecked.map((clauseType) => ({
      clauseType,
      finding: finding(sidecar, clauseType),
    })),
  };

  if (corruptions.has("off-schema")) {
    return { ...payload, candidates: "none" };
  }
  return payload;
}

function finding(sidecar: Sidecar, clauseType: ClauseType): string {
  const count = sidecar.expectedFlags.filter(
    (flag) => flag.clauseType === clauseType,
  ).length;
  return count === 0
    ? "checked; nothing found that qualifies"
    : `checked; ${count} clause${count === 1 ? "" : "s"} found`;
}

function buildAnswer(
  fixture: Fixture,
  other: Fixture,
  user: string,
  corruptions: Set<StubCorruption>,
) {
  if (corruptions.has("answer-cites-absent-text")) {
    return {
      addressed: true,
      text: "Yes. The document is explicit about this.",
      citations: [foreignSentences(other)[0]],
    };
  }

  const question = lastLine(user);
  const match = bestSentence(fixture.text, question);
  if (!match) {
    return {
      addressed: false,
      text: "The document does not address this.",
      citations: [],
    };
  }
  return {
    addressed: true,
    text: match,
    citations: [corruptQuote(match, 0, foreignSentences(other), corruptions)],
  };
}

/** Real sentences, from the wrong document. */
function foreignSentences(other: Fixture): string[] {
  const sentences = [
    ...other.sidecar.expectedFlags.map((flag) => flag.sourceSentence),
    ...other.sidecar.decoySentences,
  ];
  return sentences.length ? sentences : [other.text.trim()];
}

function corruptQuote(
  sentence: string,
  index: number,
  foreign: string[],
  corruptions: Set<StubCorruption>,
): string {
  let quote = sentence;
  if (corruptions.has("quotes-from-other-fixture")) {
    quote = foreign[index % foreign.length];
  }
  if (corruptions.has("paraphrase-quotes")) quote = paraphrase(quote);
  if (corruptions.has("one-word-changed")) quote = changeOneWord(quote);
  return quote;
}

/**
 * Reads as a quote, is not one. Legal boilerplate rewritten the way a model
 * rewrites it when it is summarising rather than copying.
 */
const PARAPHRASES: [RegExp, string][] = [
  [/\byou shall not\b/g, "you may not"],
  [/\bshall be\b/g, "will be"],
  [/\bshall\b/g, "will"],
  [/\bdirectly or indirectly, /g, ""],
  [/\beighteen \(18\)\b/g, "18"],
  [/\btwenty-four \(24\)\b/g, "24"],
  [/\bthirty \(30\)\b/g, "30"],
  [/\bfour \(4\)\b/g, "4"],
  [/\bfor any reason\b/g, "for whatever reason"],
  [/\bof the Company\b/g, "of the employer"],
  [/\bthe Company\b/g, "the employer"],
  [/\bthis Agreement\b/g, "this contract"],
];

function paraphrase(sentence: string): string {
  let out = sentence;
  for (const [pattern, replacement] of PARAPHRASES) {
    out = out.replace(pattern, replacement);
  }
  if (out === sentence) out = `In substance, ${lowerFirst(sentence)}`;
  return out;
}

/**
 * The near miss. One word changed and the quote is no longer the document's,
 * which is exactly the failure a reader could not catch unaided.
 */
const NEAR_MISSES: [RegExp, string][] = [
  [/\beighteen\b/, "twelve"],
  [/\btwenty-four\b/, "thirty-six"],
  [/\bthirty\b/, "sixty"],
  [/\bexclusively\b/, "ordinarily"],
  [/\bany\b/, "each"],
  [/\ball\b/, "any"],
  [/\bshall\b/, "must"],
  [/\bwill\b/, "shall"],
];

function changeOneWord(sentence: string): string {
  for (const [pattern, replacement] of NEAR_MISSES) {
    if (pattern.test(sentence)) return sentence.replace(pattern, replacement);
  }
  // Nothing in the table matched: drop the final word rather than return the
  // sentence unchanged, because an uncorrupted quote here would make a
  // negative test pass by accident.
  return sentence.replace(/\s+\S+$/, "");
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function lastLine(user: string): string {
  const lines = user
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length ? lines[lines.length - 1] : user;
}

const STOP_WORDS = new Set([
  "about",
  "after",
  "could",
  "does",
  "have",
  "same",
  "that",
  "their",
  "there",
  "these",
  "this",
  "what",
  "when",
  "where",
  "which",
  "will",
  "with",
  "would",
  "your",
]);

/**
 * Picks the sentence the question is most about, by shared words. Crude on
 * purpose: the stub is not meant to be a good reader, only a consistent one
 * that quotes the document verbatim when it quotes at all.
 */
function bestSentence(text: string, question: string): string | null {
  const terms = question
    .toLowerCase()
    .split(/[^a-z0-9$]+/)
    .filter((word) => word.length >= 4 && !STOP_WORDS.has(word));
  if (terms.length === 0) return null;

  let best: string | null = null;
  let bestScore = 0;
  for (const raw of text.split(/(?<=\.)\s+/)) {
    const sentence = raw.trim();
    if (sentence.length < 40) continue;
    const lowered = sentence.toLowerCase();
    const score = terms.filter((term) => lowered.includes(term)).length;
    if (score > bestScore) {
      bestScore = score;
      best = sentence;
    }
  }
  // One incidental word in common is not an answer. Two is the threshold at
  // which the question is plausibly about that sentence.
  return bestScore >= 2 ? best : null;
}
