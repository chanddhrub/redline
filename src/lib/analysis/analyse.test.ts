/**
 * The whole pipeline, run for real over both fixtures.
 *
 * The model client is the one permitted stub. Nothing else is stubbed: the
 * fixture documents are parsed by the real `parseDocument`, the candidates the
 * stub returns go through the real gate, the survivors go through the real
 * ranking, and the receipt is derived from what came out. A test that mocked
 * the gate would be testing the mock.
 *
 * The negative cases matter more than the positive ones here. The stub's
 * corruption knobs produce payloads that satisfy the declared schema and are
 * still wrong — a paraphrase, a near miss, a real sentence from the other
 * document, a claimed match to a red line nobody declared. What each of those
 * tests is that it cannot reach the reader.
 */

import { describe, expect, it } from "vitest";
import { parseDocument } from "../intake/parse-document";
import {
  createStubModelClient,
  loadFixture,
  UNDECLARED_RED_LINE_ID,
  type FixtureName,
  type StubCorruption,
} from "../model/stub";
import { CLAUSE_TYPES, type ClauseType } from "../model/payloads";
import type { AnalysisRequest, RedLine } from "../intake/analysis-request";
import { analyse, type Analysis } from "./analyse";
import { DEFAULT_SEVERITY } from "./rank";
import type { EnforceabilityNote } from "./enforceability";

/** The fixture, through the real parser, in the shape intake hands over. */
async function requestFor(
  name: FixtureName,
  redLines: RedLine[] = [],
): Promise<AnalysisRequest> {
  const fixture = loadFixture(name);
  const bytes = new TextEncoder().encode(fixture.text);
  const result = await parseDocument(
    bytes.buffer.slice(0) as ArrayBuffer,
    `${name}.txt`,
  );
  if (!result.ok) throw new Error(`fixture ${name} did not parse`);
  return {
    text: result.document.text,
    sentences: result.document.sentences,
    jurisdiction: "California",
    redLines,
  };
}

interface RunOptions {
  corruptions?: StubCorruption[];
  redLines?: RedLine[];
  context?: EnforceabilityNote[];
  transform?: (payload: unknown) => unknown;
}

async function run(
  name: FixtureName,
  options: RunOptions = {},
): Promise<Analysis> {
  const request = await requestFor(name, options.redLines ?? []);
  const transform = options.transform;
  const model = createStubModelClient({
    corruptions: options.corruptions,
    transform: transform ? (payload) => transform(payload) : undefined,
  });
  const outcome = await analyse(request, model, { context: options.context });
  if (!outcome.ok) {
    throw new Error(`analysis failed: ${JSON.stringify(outcome.failure)}`);
  }
  return outcome.analysis;
}

describe("the planted document", () => {
  it("returns the planted clauses at the bands their clause types carry", async () => {
    const fixture = loadFixture("adhesion-contract");
    const analysis = await run("adhesion-contract");

    const expected = new Map(
      fixture.sidecar.expectedFlags.map((flag) => [flag.id, flag]),
    );
    expect(analysis.flags.length).toBe(expected.size);

    for (const ranked of analysis.flags) {
      const planted = expected.get(ranked.flag.id);
      expect(planted).toBeDefined();
      expect(ranked.flag.clauseType).toBe(planted!.clauseType);
      expect(ranked.severity).toBe(planted!.expectedSeverity);
      expect(ranked.severity).toBe(DEFAULT_SEVERITY[ranked.flag.clauseType]);
    }
  });

  it("quotes each flag's sentence back out of the reader's own text", async () => {
    const request = await requestFor("adhesion-contract");
    const analysis = await run("adhesion-contract");

    for (const ranked of analysis.flags) {
      const { span, text } = ranked.flag.citation;
      expect(request.text.slice(span.start, span.end)).toBe(text);
    }
  });

  it("gives every flag a meaning and a counter-offer that is not the clause itself", async () => {
    const analysis = await run("adhesion-contract");

    for (const ranked of analysis.flags) {
      expect(ranked.flag.meaning.length).toBeGreaterThan(20);
      expect(ranked.flag.counterOffer.length).toBeGreaterThan(20);
      expect(ranked.flag.counterOffer).not.toBe(ranked.flag.citation.text);
    }
  });

  it("never quotes a decoy sentence as a flag's source", async () => {
    const fixture = loadFixture("adhesion-contract");
    const analysis = await run("adhesion-contract");
    const quoted = analysis.flags.map((ranked) => ranked.flag.citation.text);

    for (const decoy of fixture.sidecar.decoySentences) {
      expect(quoted).not.toContain(decoy);
    }
  });

  it("shows the governing-law sentence, because it is in the document", async () => {
    const fixture = loadFixture("adhesion-contract");
    const request = await requestFor("adhesion-contract");
    const analysis = await run("adhesion-contract");

    expect(analysis.governingLaw).not.toBeNull();
    expect(analysis.governingLaw!.text).toBe(fixture.sidecar.governingLaw);
    const { span } = analysis.governingLaw!;
    expect(request.text.slice(span.start, span.end)).toBe(
      fixture.sidecar.governingLaw,
    );
  });

  it("counts every clause type it flagged, in its receipt", async () => {
    const analysis = await run("adhesion-contract");

    for (const entry of analysis.coverage.checked) {
      const shown = analysis.flags.filter(
        (ranked) => ranked.flag.clauseType === entry.clauseType,
      ).length;
      expect(entry.flagCount).toBe(shown);
      expect(entry.finding).toContain("Checked");
    }
  });
});

describe("the clean document", () => {
  it("returns no flags at all", async () => {
    const analysis = await run("clean-offer");

    expect(analysis.flags).toEqual([]);
    expect(analysis.dropped.flags).toEqual([]);
  });

  it("returns a receipt naming all four clause types with a finding for each", async () => {
    const analysis = await run("clean-offer");

    expect(analysis.coverage.checked.map((entry) => entry.clauseType)).toEqual([
      ...CLAUSE_TYPES,
    ]);
    for (const entry of analysis.coverage.checked) {
      expect(entry.flagCount).toBe(0);
      expect(entry.finding).toBe("Checked. Nothing here qualifies.");
      expect(entry.label.length).toBeGreaterThan(0);
    }
  });

  it("says what it did not review, rather than stopping at 'no flags'", async () => {
    const analysis = await run("clean-offer");

    expect(analysis.coverage.notReviewed.length).toBeGreaterThan(0);
    const said = analysis.coverage.notReviewed.join(" ").toLowerCase();
    // The two limits a reader cannot infer from the list in front of them: the
    // four types are the whole of the coverage, and a term the document leaves
    // out has no sentence to quote (PRD §5.5).
    expect(said).toContain("four clause types");
    expect(said).toContain("leaves out");
  });

  it("still summarises the document, from sentences that are in it", async () => {
    const request = await requestFor("clean-offer");
    const analysis = await run("clean-offer");

    expect(analysis.summary.claims.length).toBeGreaterThan(0);
    for (const claim of analysis.summary.claims) {
      const { span, text } = claim.citation;
      expect(request.text.slice(span.start, span.end)).toBe(text);
      expect(claim.register).toBe("document");
    }
  });

  it("is a receipt, not an empty result", async () => {
    const analysis = await run("clean-offer");
    const counts = analysis.coverage.checked.map((entry) => entry.flagCount);

    // ADR 0004: never an invented low-severity finding to fill the space.
    expect(counts).toEqual([0, 0, 0, 0]);
    expect(analysis.flags).toEqual([]);
    expect(analysis.coverage.checked.length).toBe(4);
  });
});

describe("the gate, over the whole pipeline", () => {
  const quoteKnobs: StubCorruption[] = [
    "paraphrase-quotes",
    "one-word-changed",
    "quotes-from-other-fixture",
  ];

  for (const knob of quoteKnobs) {
    it(`"${knob}" reaches the reader as nothing at all`, async () => {
      const analysis = await run("adhesion-contract", { corruptions: [knob] });

      expect(analysis.flags).toEqual([]);
      expect(analysis.summary.claims).toEqual([]);
      expect(analysis.governingLaw).toBeNull();
    });

    it(`"${knob}" is counted as a drop for every candidate`, async () => {
      const fixture = loadFixture("adhesion-contract");
      const analysis = await run("adhesion-contract", { corruptions: [knob] });

      expect(analysis.dropped.flags.length).toBe(
        fixture.sidecar.expectedFlags.length,
      );
      for (const drop of analysis.dropped.flags) {
        expect(drop.reason).toBe("quote-not-found");
        expect(fixture.text).not.toContain(drop.claimedSentence);
      }
      expect(analysis.dropped.summaryClaims.length).toBeGreaterThan(0);
      expect(analysis.dropped.governingLaw).not.toBeNull();
    });

    it(`"${knob}" still returns the full receipt, with nothing found`, async () => {
      const analysis = await run("adhesion-contract", { corruptions: [knob] });

      expect(analysis.coverage.checked.map((e) => e.clauseType)).toEqual([
        ...CLAUSE_TYPES,
      ]);
      for (const entry of analysis.coverage.checked) {
        expect(entry.flagCount).toBe(0);
      }
      expect(analysis.coverage.notReviewed.length).toBeGreaterThan(0);
    });
  }

  it("drops a claimed red line the reader never declared, and counts it", async () => {
    const fixture = loadFixture("adhesion-contract");
    const declared: RedLine[] = [
      { id: "rl-1", text: "I will not sign an 18-month non-compete." },
    ];
    const analysis = await run("adhesion-contract", {
      corruptions: ["claim-undeclared-red-line"],
      redLines: declared,
    });

    expect(analysis.flags.length).toBe(fixture.sidecar.expectedFlags.length);
    for (const ranked of analysis.flags) {
      expect(ranked.flag.claimedRedLineId).toBe(UNDECLARED_RED_LINE_ID);
      expect(ranked.promotion).toBeNull();
    }
    expect(analysis.dropped.redLineClaims).toBe(analysis.flags.length);
  });

  it("promotes a flag whose claimed red line the reader did declare", async () => {
    const fixture = loadFixture("adhesion-contract");
    const target = fixture.sidecar.expectedFlags.find(
      (flag) => flag.clauseType === "ip-assignment",
    )!;
    const line: RedLine = {
      id: "rl-personal-projects",
      text: "I will not sign an IP assignment covering personal projects.",
    };

    const analysis = await run("adhesion-contract", {
      redLines: [line],
      transform: (payload) => {
        const claimed = payload as {
          candidates: { id: string; claimedRedLineId: string | null }[];
        };
        return {
          ...claimed,
          candidates: claimed.candidates.map((candidate) =>
            candidate.id === target.id
              ? { ...candidate, claimedRedLineId: line.id }
              : candidate,
          ),
        };
      },
    });

    expect(analysis.flags[0].flag.id).toBe(target.id);
    expect(analysis.flags[0].promotion).toEqual({
      redLineId: line.id,
      redLineText: line.text,
    });
    // Promotion raises and names. It never lowers a band.
    expect(analysis.flags[0].severity).toBe(DEFAULT_SEVERITY["ip-assignment"]);
    expect(analysis.dropped.redLineClaims).toBe(0);
  });

  it("drops a summary claim whose support is not in the document, and keeps the rest", async () => {
    const fabricated =
      "You may terminate this Agreement at any time on no notice and with no consequence whatsoever.";
    const invented =
      "You can walk away from this agreement whenever you like.";
    const request = await requestFor("adhesion-contract");
    expect(request.text).not.toContain(fabricated);

    const analysis = await run("adhesion-contract", {
      transform: (payload) => {
        const claimed = payload as {
          summary: { claims: { claim: string; sourceSentence: string }[] };
        };
        return {
          ...claimed,
          summary: {
            claims: [
              ...claimed.summary.claims,
              { claim: invented, sourceSentence: fabricated },
            ],
          },
        };
      },
    });

    const shown = analysis.summary.claims.map((claim) => claim.statement);
    expect(shown).not.toContain(invented);
    expect(shown.length).toBeGreaterThan(0);
    expect(analysis.dropped.summaryClaims).toEqual([
      { claimedSentence: fabricated, reason: "quote-not-found" },
    ]);
  });

  it("returns the transport's failure rather than an analysis, when the model fails", async () => {
    const request = await requestFor("clean-offer");
    const model = createStubModelClient({
      failWith: { kind: "unreachable", detail: "offline" },
    });

    const outcome = await analyse(request, model);

    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("the model failed and the pipeline did not");
    expect(outcome.failure).toEqual({
      kind: "model",
      failure: { kind: "unreachable", detail: "offline" },
    });
  });

  it("returns a failure rather than an empty analysis, when the model breaks the schema", async () => {
    const request = await requestFor("adhesion-contract");
    const model = createStubModelClient({ corruptions: ["off-schema"] });

    const outcome = await analyse(request, model);

    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("the payload was off-schema and passed");
    expect(outcome.failure.kind).toBe("model");
  });
});

describe("the standing check", () => {
  const fixtures: FixtureName[] = ["adhesion-contract", "clean-offer"];
  const knobs: (StubCorruption[] | undefined)[] = [
    undefined,
    ["paraphrase-quotes"],
    ["one-word-changed"],
    ["quotes-from-other-fixture"],
    ["claim-undeclared-red-line"],
  ];

  for (const name of fixtures) {
    for (const corruptions of knobs) {
      const label = corruptions ? corruptions.join("+") : "uncorrupted";
      it(`no flag in ${name} (${label}) lacks a located span`, async () => {
        const request = await requestFor(name);
        const analysis = await run(name, { corruptions });

        for (const ranked of analysis.flags) {
          const { span, text } = ranked.flag.citation;
          expect(span.start).toBeGreaterThanOrEqual(0);
          expect(span.end).toBeGreaterThan(span.start);
          expect(span.end).toBeLessThanOrEqual(request.text.length);
          expect(request.text.slice(span.start, span.end)).toBe(text);
        }
        for (const claim of analysis.summary.claims) {
          const { span, text } = claim.citation;
          expect(request.text.slice(span.start, span.end)).toBe(text);
        }
        if (analysis.governingLaw) {
          const { span, text } = analysis.governingLaw;
          expect(request.text.slice(span.start, span.end)).toBe(text);
        }
      });
    }
  }
});

describe("the two registers", () => {
  const note: EnforceabilityNote = {
    register: "general",
    topic: "non-compete",
    statement:
      "California does not enforce employee non-competes, whatever the contract says.",
    basis: "Cal. Bus. & Prof. Code section 16600",
    asOf: "2026-09-15",
  };

  it("keeps general context out of the flags, and the flags out of it", async () => {
    const analysis = await run("adhesion-contract", { context: [note] });

    expect(analysis.context).toEqual([note]);
    for (const ranked of analysis.flags) {
      expect(ranked.flag.citation.text.length).toBeGreaterThan(0);
      expect(ranked.flag.meaning).not.toContain(note.statement);
    }
  });

  it("changes no severity and no order by being present", async () => {
    const without = await run("adhesion-contract");
    const withNote = await run("adhesion-contract", { context: [note] });

    const shape = (analysis: Analysis) =>
      analysis.flags.map((ranked) => [
        ranked.rank,
        ranked.flag.id,
        ranked.severity,
      ]);

    expect(shape(withNote)).toEqual(shape(without));
  });

  it("bands every flag from its clause type, never from the model", async () => {
    const analysis = await run("adhesion-contract");
    const seen = new Set<ClauseType>();

    for (const ranked of analysis.flags) {
      seen.add(ranked.flag.clauseType);
      expect(ranked.severity).toBe(DEFAULT_SEVERITY[ranked.flag.clauseType]);
    }
    expect(seen.size).toBe(CLAUSE_TYPES.length);
  });
});
