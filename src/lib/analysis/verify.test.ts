/**
 * The gate, run for real. The model client is stubbed — that is the one
 * permitted stub, and it replaces the network and nothing else. `locate`, the
 * parser and `verifyFlags` are the code under test and none of them is mocked.
 *
 * The negative half is the point. Every corruption knob here produces output
 * that satisfies the declared schema and reads like a quote, which is exactly
 * the failure a schema cannot catch and a reader could not catch unaided.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseDocument, type ParsedDocument } from "../intake/parse-document";
import {
  ANALYSIS_OPERATION,
  ANSWER_OPERATION,
  analysisSchema,
  answerSchema,
  type AnalysisPayload,
  type AnswerPayload,
} from "../model/payloads";
import {
  createStubModelClient,
  loadFixture,
  DEFAULT_FIXTURES_DIR,
  type FixtureName,
  type StubCorruption,
} from "../model/stub";
import { verifyFlags, verifyQuotes, type Flag } from "./verify";

const fixtures = {
  "adhesion-contract": loadFixture("adhesion-contract"),
  "clean-offer": loadFixture("clean-offer"),
};
const adhesion = fixtures["adhesion-contract"];
const clean = fixtures["clean-offer"];

/** The real parser over the real bytes on disk. Nothing is hand-built. */
async function parseFixture(name: FixtureName): Promise<ParsedDocument> {
  const bytes = readFileSync(
    join(DEFAULT_FIXTURES_DIR, fixtures[name].sidecar.document),
  );
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const result = await parseDocument(buffer, fixtures[name].sidecar.document);
  if (!result.ok) {
    throw new Error(`fixture did not parse: ${result.refusal.kind}`);
  }
  return result.document;
}

async function modelAnalysis(
  name: FixtureName,
  corruptions: StubCorruption[] = [],
): Promise<AnalysisPayload> {
  const client = createStubModelClient({ fixture: name, corruptions });
  const result = await client.complete({
    operation: ANALYSIS_OPERATION,
    system: "Quote the document.",
    user: `Document:\n${fixtures[name].text}`,
    schema: analysisSchema,
  });
  if (!result.ok) throw new Error(`stub failed: ${result.failure.kind}`);
  return result.value;
}

async function modelAnswer(
  name: FixtureName,
  question: string,
  corruptions: StubCorruption[] = [],
): Promise<AnswerPayload> {
  const client = createStubModelClient({ fixture: name, corruptions });
  const result = await client.complete({
    operation: ANSWER_OPERATION,
    system: "Answer only from the document.",
    user: `Document:\n${fixtures[name].text}\n\nQuestion: ${question}`,
    schema: answerSchema,
  });
  if (!result.ok) throw new Error(`stub failed: ${result.failure.kind}`);
  return result.value;
}

/** Every way the model can be well-formed and wrong, singly and combined. */
const CORRUPTIONS: StubCorruption[][] = [
  ["paraphrase-quotes"],
  ["one-word-changed"],
  ["quotes-from-other-fixture"],
  ["quotes-from-other-fixture", "one-word-changed"],
  ["quotes-from-other-fixture", "paraphrase-quotes"],
  ["paraphrase-quotes", "one-word-changed"],
  ["quotes-from-other-fixture", "paraphrase-quotes", "one-word-changed"],
];

function sliceOf(document: ParsedDocument, flag: Flag): string {
  return document.text.slice(flag.citation.span.start, flag.citation.span.end);
}

describe("the gate, positively", () => {
  it("keeps every planted clause whose sentence is verbatim from the document", async () => {
    const document = await parseFixture("adhesion-contract");
    const payload = await modelAnalysis("adhesion-contract");

    const { flags, dropped } = verifyFlags(payload.candidates, document);

    expect(payload.candidates.length).toBe(
      adhesion.sidecar.expectedFlags.length,
    );
    expect(dropped).toEqual([]);
    expect(flags.map((flag) => flag.id)).toEqual(
      adhesion.sidecar.expectedFlags.map((flag) => flag.id),
    );
  });

  it("gives each surviving flag a span that slices the document back to the planted sentence", async () => {
    const document = await parseFixture("adhesion-contract");
    const payload = await modelAnalysis("adhesion-contract");

    const { flags } = verifyFlags(payload.candidates, document);

    const expected = new Map(
      adhesion.sidecar.expectedFlags.map((flag) => [
        flag.id,
        flag.sourceSentence,
      ]),
    );
    for (const flag of flags) {
      expect(sliceOf(document, flag)).toBe(expected.get(flag.id));
      expect(flag.citation.text).toBe(expected.get(flag.id));
    }
  });

  it("carries the severity, the meaning and the counter-offer through unchanged", async () => {
    const document = await parseFixture("adhesion-contract");
    const payload = await modelAnalysis("adhesion-contract");

    const { flags } = verifyFlags(payload.candidates, document);

    const planted = new Map(
      adhesion.sidecar.expectedFlags.map((flag) => [flag.id, flag]),
    );
    for (const flag of flags) {
      const source = planted.get(flag.id);
      expect(source).toBeDefined();
      expect(flag.severity).toBe(source?.expectedSeverity);
      expect(flag.clauseType).toBe(source?.clauseType);
      expect(flag.meaning).toBe(source?.meaning);
      expect(flag.counterOffer).toBe(source?.counterOffer);
    }
  });

  it("locates the governing-law sentence, because it is in the document", async () => {
    const document = await parseFixture("adhesion-contract");
    const payload = await modelAnalysis("adhesion-contract");

    expect(payload.governingLawSentence).not.toBeNull();
    const { citations, dropped } = verifyQuotes(
      [payload.governingLawSentence as string],
      document,
    );

    expect(dropped).toEqual([]);
    expect(citations[0].text).toBe(adhesion.sidecar.governingLaw);
  });
});

describe("the gate, negatively", () => {
  for (const corruptions of CORRUPTIONS) {
    const label = corruptions.join(" + ");

    it(`lets no candidate through when the model returns ${label}`, async () => {
      const document = await parseFixture("adhesion-contract");
      const payload = await modelAnalysis("adhesion-contract", corruptions);

      const { flags, dropped } = verifyFlags(payload.candidates, document);

      expect(payload.candidates.length).toBeGreaterThan(0);
      expect(flags.length).toBe(0);
      expect(dropped.length).toBe(payload.candidates.length);
      for (const drop of dropped) {
        expect(drop.reason).toBe("quote-not-found");
        expect(drop.claimedSentence.length).toBeGreaterThan(0);
      }
    });

    it(`drops every summary citation when the model returns ${label}`, async () => {
      const document = await parseFixture("adhesion-contract");
      const payload = await modelAnalysis("adhesion-contract", corruptions);
      const claimed = payload.summary.claims.map((c) => c.sourceSentence);

      const { citations, dropped } = verifyQuotes(claimed, document);

      expect(claimed.length).toBeGreaterThan(0);
      expect(citations.length).toBe(0);
      expect(dropped.length).toBe(claimed.length);
    });
  }

  it("drops real sentences lifted from the other document", async () => {
    const document = await parseFixture("adhesion-contract");
    const foreign = [
      ...clean.sidecar.decoySentences,
      clean.sidecar.governingLaw as string,
    ];

    const { citations, dropped } = verifyQuotes(foreign, document);

    expect(foreign.length).toBeGreaterThan(0);
    expect(citations.length).toBe(0);
    expect(dropped.every((drop) => drop.reason === "quote-not-found")).toBe(
      true,
    );
  });

  it("drops a quote the model left blank", async () => {
    const document = await parseFixture("adhesion-contract");

    const { citations, dropped } = verifyQuotes(["", "   "], document);

    expect(citations.length).toBe(0);
    expect(dropped.map((drop) => drop.reason)).toEqual([
      "quote-empty",
      "quote-empty",
    ]);
  });

  it("drops an invented sentence even though it describes the clause correctly", async () => {
    const document = await parseFixture("adhesion-contract");
    const invented =
      "You may not work for any competitor for eighteen months after you leave.";

    const { flags, dropped } = verifyFlags(
      [
        {
          id: "invented",
          clauseType: "non-compete",
          severity: "critical",
          sourceSentence: invented,
          meaning: "A non-compete.",
          counterOffer: "Strike it.",
          escapability: [],
          claimedRedLineId: null,
        },
      ],
      document,
    );

    expect(flags.length).toBe(0);
    expect(dropped[0].claimedSentence).toBe(invented);
    expect(dropped[0].reason).toBe("quote-not-found");
  });
});

describe("the same gate over an answer", () => {
  it("keeps a citation the document actually contains", async () => {
    const document = await parseFixture("adhesion-contract");
    const payload = await modelAnswer(
      "adhesion-contract",
      "What happens to my signing bonus if I leave early?",
    );

    const { citations } = verifyQuotes(payload.citations, document);

    expect(payload.citations.length).toBeGreaterThan(0);
    expect(citations.length).toBe(payload.citations.length);
    for (const citation of citations) {
      expect(document.text.slice(citation.span.start, citation.span.end)).toBe(
        citation.text,
      );
    }
  });

  it("leaves a confident answer citing absent text with nothing to show", async () => {
    const document = await parseFixture("adhesion-contract");
    const payload = await modelAnswer(
      "adhesion-contract",
      "Is this enforceable in Texas?",
      ["answer-cites-absent-text"],
    );

    const { citations, dropped } = verifyQuotes(payload.citations, document);

    expect(payload.addressed).toBe(true);
    expect(payload.citations.length).toBeGreaterThan(0);
    expect(citations.length).toBe(0);
    expect(dropped.length).toBe(payload.citations.length);
  });

  it("leaves nothing to show when an answer paraphrases the sentence it cites", async () => {
    const document = await parseFixture("adhesion-contract");
    const payload = await modelAnswer(
      "adhesion-contract",
      "What happens to my signing bonus if I leave early?",
      ["paraphrase-quotes", "one-word-changed"],
    );

    const { citations } = verifyQuotes(payload.citations, document);

    expect(payload.citations.length).toBeGreaterThan(0);
    expect(citations.length).toBe(0);
  });
});

describe("the standing check", () => {
  it("produces no flag without a span that round-trips, over every fixture and every corruption", async () => {
    const names: FixtureName[] = ["adhesion-contract", "clean-offer"];
    const runs: StubCorruption[][] = [[], ...CORRUPTIONS];

    let checked = 0;
    for (const name of names) {
      const document = await parseFixture(name);
      for (const corruptions of runs) {
        const payload = await modelAnalysis(name, corruptions);
        const { flags } = verifyFlags(payload.candidates, document);
        const summary = verifyQuotes(
          payload.summary.claims.map((c) => c.sourceSentence),
          document,
        );

        for (const flag of flags) {
          expect(flag.citation.span.start).toBeGreaterThanOrEqual(0);
          expect(flag.citation.span.end).toBeLessThanOrEqual(
            document.text.length,
          );
          expect(flag.citation.span.end).toBeGreaterThan(
            flag.citation.span.start,
          );
          expect(sliceOf(document, flag)).toBe(flag.citation.text);
          expect(document.locate(flag.citation.text)).not.toBeNull();
          checked += 1;
        }
        for (const citation of summary.citations) {
          expect(
            document.text.slice(citation.span.start, citation.span.end),
          ).toBe(citation.text);
          expect(document.locate(citation.text)).not.toBeNull();
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("returns a clean document no flags rather than an invented one", async () => {
    const document = await parseFixture("clean-offer");
    const payload = await modelAnalysis("clean-offer");

    const { flags, dropped } = verifyFlags(payload.candidates, document);

    expect(flags.length).toBe(0);
    expect(dropped.length).toBe(0);
  });

  it("never sources a flag from a decoy sentence the document deliberately contains", async () => {
    const document = await parseFixture("adhesion-contract");
    const payload = await modelAnalysis("adhesion-contract");

    const { flags } = verifyFlags(payload.candidates, document);

    for (const decoy of adhesion.sidecar.decoySentences) {
      expect(flags.map((flag) => flag.citation.text)).not.toContain(decoy);
    }
  });
});
