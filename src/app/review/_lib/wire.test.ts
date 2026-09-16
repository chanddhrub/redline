/**
 * The wire contract, checked against the real thing.
 *
 * The body under test is not typed out here. It is produced by running the
 * actual pipeline over the actual fixtures and putting the result through
 * `JSON.parse(JSON.stringify(...))` — the same trip `Response.json` and
 * `fetch` make it take. That is the only way this file can catch the failure
 * it exists to catch: the pipeline growing a field, or changing one, and the
 * browser's view of the wire quietly describing last week's shape.
 *
 * The model client is the one permitted stub. The parser, the gate, the
 * ranking and the receipt all run for real.
 */

import { describe, expect, it } from "vitest";
import { parseDocument } from "../../../lib/intake/parse-document";
import { createStubModelClient, loadFixture } from "../../../lib/model/stub";
import type { FixtureName } from "../../../lib/model/stub";
import { analyse } from "../../../lib/analysis/analyse";
import { answer } from "../../../lib/analysis/answer";
import type { RedLine } from "../../../lib/intake/analysis-request";
import {
  factorLabel,
  headline,
  interpretFailure,
  parseAnalysis,
  parseAnswer,
  remainder,
  stampCodes,
  SEVERITY_BAR_PX,
  type WireAnalysis,
} from "./wire";

/** Everything the route does, short of the HTTP itself. */
async function bodyFor(
  name: FixtureName,
  redLines: RedLine[] = [],
  claimRedLineId?: string,
): Promise<unknown> {
  const fixture = loadFixture(name);
  const bytes = new TextEncoder().encode(fixture.text);
  const parsed = await parseDocument(
    bytes.buffer.slice(0) as ArrayBuffer,
    `${name}.txt`,
  );
  if (!parsed.ok) throw new Error(`fixture ${name} did not parse`);

  const outcome = await analyse(
    {
      text: parsed.document.text,
      sentences: parsed.document.sentences,
      jurisdiction: "California",
      redLines,
    },
    createStubModelClient({
      // The one thing the stub cannot do on its own: claim a red line the
      // reader really declared. Promotion is otherwise unreachable here, and
      // an untested promotion is a decoration (PRD §4 T8).
      transform: claimRedLineId
        ? (payload) => {
            const analysis = payload as {
              candidates: { clauseType: string; claimedRedLineId: string | null }[];
            };
            const target = analysis.candidates.find(
              (candidate) => candidate.clauseType === "ip-assignment",
            );
            if (target) target.claimedRedLineId = claimRedLineId;
            return payload;
          }
        : undefined,
    }),
  );
  if (!outcome.ok) throw new Error(`analysis failed: ${JSON.stringify(outcome.failure)}`);

  // The trip that loses the brand: a symbol key does not survive stringify.
  return JSON.parse(JSON.stringify(outcome.analysis)) as unknown;
}

function expectParsed(body: unknown): WireAnalysis {
  const analysis = parseAnalysis(body);
  if (!analysis) throw new Error("the wire parser refused a body the route produced");
  return analysis;
}

describe("the analysis as it arrives over the wire", () => {
  it("accepts the planted document's analysis and keeps every located sentence", async () => {
    const body = await bodyFor("adhesion-contract");
    const analysis = expectParsed(body);
    const fixture = loadFixture("adhesion-contract");

    expect(analysis.flags.length).toBeGreaterThan(0);
    for (const ranked of analysis.flags) {
      const { text, span } = ranked.flag.citation;
      // The sentence the reader will see is still the document's own bytes,
      // at the offsets the window will crop to.
      expect(fixture.text.slice(span.start, span.end)).toBe(text);
      expect(span.end - span.start).toBe(text.length);
    }

    for (const claim of analysis.summary.claims) {
      const { text, span } = claim.citation;
      expect(fixture.text.slice(span.start, span.end)).toBe(text);
    }

    expect(analysis.coverage.checked).toHaveLength(4);
    expect(analysis.governingLaw).not.toBeNull();
  });

  it("accepts a clean document, where the receipt is the whole result", async () => {
    const analysis = expectParsed(await bodyFor("clean-offer"));

    expect(analysis.flags).toHaveLength(0);
    expect(analysis.coverage.checked.map((entry) => entry.flagCount)).toEqual([
      0, 0, 0, 0,
    ]);
    expect(analysis.coverage.notReviewed.length).toBeGreaterThan(0);
  });

  it("carries a promotion through, at the top, naming the red line it crossed", async () => {
    const redLines: RedLine[] = [
      { id: "rl-ip", text: "I will not sign an IP assignment covering personal projects" },
    ];
    const analysis = expectParsed(
      await bodyFor("adhesion-contract", redLines, "rl-ip"),
    );

    const promoted = analysis.flags[0];
    expect(promoted.promotion).not.toBeNull();
    expect(promoted.promotion?.redLineId).toBe("rl-ip");
    expect(promoted.promotion?.redLineText).toBe(redLines[0].text);
    // The interface names the line, so the line's own wording has to be what
    // arrives — not an id, not our paraphrase of it.
    expect(promoted.flag.clauseType).toBe("ip-assignment");
    // And it is promoted above a Critical band without being relabelled one.
    expect(promoted.severity).toBe("high");
    expect(analysis.flags.slice(1).every((ranked) => ranked.promotion === null)).toBe(
      true,
    );
  });

  it("refuses a citation whose span does not match the sentence it carries", async () => {
    const body = (await bodyFor("adhesion-contract")) as {
      flags: { flag: { citation: { span: { end: number } } } }[];
    };
    body.flags[0].flag.citation.span.end -= 3;
    expect(parseAnalysis(body)).toBeNull();
  });

  it("refuses a receipt that has lost a clause type", async () => {
    const body = (await bodyFor("clean-offer")) as {
      coverage: { checked: unknown[] };
    };
    body.coverage.checked.pop();
    expect(parseAnalysis(body)).toBeNull();
  });

  it("refuses a flag whose citation has gone", async () => {
    const body = (await bodyFor("adhesion-contract")) as {
      flags: { flag: Record<string, unknown> }[];
    };
    delete body.flags[0].flag.citation;
    expect(parseAnalysis(body)).toBeNull();
  });

  it("refuses a body that is not an analysis at all", () => {
    expect(parseAnalysis(null)).toBeNull();
    expect(parseAnalysis("ok")).toBeNull();
    expect(parseAnalysis({ summary: { claims: [] } })).toBeNull();
  });
});

describe("severity, in three signals", () => {
  it("numbers the stamped codes within each band, down the ranked order", async () => {
    const analysis = expectParsed(await bodyFor("adhesion-contract"));
    const codes = stampCodes(analysis.flags);

    expect(codes).toHaveLength(analysis.flags.length);
    // Every code names its own band and counts up from one inside it.
    const critical = codes.filter((code) => code.startsWith("CR-"));
    const high = codes.filter((code) => code.startsWith("HI-"));
    expect(critical.length + high.length).toBe(codes.length);
    expect(critical).toEqual(critical.map((_, i) => `CR-${i + 1}`));
    expect(high).toEqual(high.map((_, i) => `HI-${i + 1}`));

    // And the codes agree with the bars: a CR row is always the longer bar.
    analysis.flags.forEach((ranked, index) => {
      const expected = ranked.severity === "critical" ? 44 : 22;
      expect(SEVERITY_BAR_PX[ranked.severity]).toBe(expected);
      expect(codes[index].startsWith(ranked.severity === "critical" ? "CR" : "HI")).toBe(
        true,
      );
    });
  });
});

describe("reading a failure the route handed back", () => {
  it("names a missing key rather than calling it an error", () => {
    expect(
      interpretFailure(502, {
        error: {
          kind: "model",
          failure: { kind: "missing-configuration", variable: "OPENROUTER_API_KEY" },
        },
      }),
    ).toEqual({ kind: "not-configured", variable: "OPENROUTER_API_KEY" });
  });

  it("separates a transport that never answered from one that refused", () => {
    expect(
      interpretFailure(502, {
        error: { kind: "model", failure: { kind: "unreachable", detail: "ENOTFOUND" } },
      }),
    ).toEqual({ kind: "no-connection" });

    expect(
      interpretFailure(502, {
        error: { kind: "model", failure: { kind: "rejected", status: 429, detail: "" } },
      }),
    ).toEqual({ kind: "refused" });
  });

  it("separates an answer that cannot be used from one that never came", () => {
    expect(
      interpretFailure(502, {
        error: {
          kind: "model",
          failure: { kind: "unusable-response", reason: "off-schema", detail: "" },
        },
      }),
    ).toEqual({ kind: "unusable" });
  });

  it("reads the unreadable-document refusal the route sends at 422", () => {
    expect(
      interpretFailure(422, { error: { kind: "unreadable-document" } }),
    ).toEqual({ kind: "unreadable-document" });
  });

  it("treats a rejected request as ours to fix", () => {
    expect(interpretFailure(400, { error: "invalid-request" })).toEqual({
      kind: "bad-request",
    });
  });
});

describe("what the row and the measures table say", () => {
  it("splits a real meaning into a one-line statement and the rest", async () => {
    const analysis = expectParsed(await bodyFor("adhesion-contract"));

    for (const ranked of analysis.flags) {
      const meaning = ranked.flag.meaning;
      const head = headline(meaning);
      const rest = remainder(meaning);

      // Nothing of the meaning is lost between the row and its expansion.
      expect(meaning.trim().startsWith(head)).toBe(true);
      expect((head + " " + rest).trim().replace(/\s+/g, " ")).toBe(
        meaning.trim().replace(/\s+/g, " "),
      );
      // The row title is one sentence, and it is short enough to be one line.
      expect(head.length).toBeLessThanOrEqual(meaning.trim().length);
      expect(head.trim()).not.toBe("");
    }
  });

  it("makes the escapability factor names readable without touching the values", async () => {
    const analysis = expectParsed(await bodyFor("adhesion-contract"));
    const factors = analysis.flags.flatMap((ranked) => ranked.flag.escapability);
    expect(factors.length).toBeGreaterThan(0);

    for (const { factor } of factors) {
      const label = factorLabel(factor);
      expect(label).not.toMatch(/[_-]/);
      // Every word of the schema key survives, in order, into the label.
      expect(label.replace(/\s+/g, "").toLowerCase()).toBe(
        factor.replace(/[\s_-]+/g, "").toLowerCase(),
      );
    }

    expect(factorLabel("survivesTerminationWithoutCause")).toBe(
      "Survives Termination Without Cause",
    );
    expect(factorLabel("class_action_waiver")).toBe("Class action waiver");
  });
});

/* ── The answer over the wire ────────────────────────────────────────── */

/** The answer route's body, short of the HTTP, for a real question. */
async function answerBodyFor(
  name: FixtureName,
  question: string,
): Promise<unknown> {
  const fixture = loadFixture(name);
  const bytes = new TextEncoder().encode(fixture.text);
  const parsed = await parseDocument(
    bytes.buffer.slice(0) as ArrayBuffer,
    `${name}.txt`,
  );
  if (!parsed.ok) throw new Error(`fixture ${name} did not parse`);

  const outcome = await answer(
    question,
    {
      text: parsed.document.text,
      sentences: parsed.document.sentences,
      jurisdiction: "California",
      redLines: [],
    },
    createStubModelClient({ fixture: name }),
  );
  if (!outcome.ok) throw new Error(`answering failed`);

  // Exactly what `src/app/api/answer/route.ts` puts on the wire, through the
  // same round trip `Response.json` and `fetch` make it take.
  const wire =
    outcome.answer.kind === "answered"
      ? {
          kind: "answered" as const,
          text: outcome.answer.text,
          citations: outcome.answer.citations.map((citation) => ({
            text: citation.text,
            span: citation.span,
          })),
        }
      : { kind: "not-addressed" as const };
  return JSON.parse(JSON.stringify(wire));
}

describe("the answer, over the wire", () => {
  it("reads an answer back with citations that still locate", async () => {
    const body = await answerBodyFor(
      "adhesion-contract",
      "Can the company claw back shares that have already vested?",
    );
    const parsed = parseAnswer(body);
    expect(parsed).not.toBeNull();
    if (!parsed || parsed.kind !== "answered") throw new Error("expected an answer");

    const fixture = loadFixture("adhesion-contract");
    expect(parsed.citations.length).toBeGreaterThan(0);
    for (const citation of parsed.citations) {
      // The span and the sentence still agree after the trip, so the window
      // crops the words being quoted rather than somewhere near them.
      expect(citation.span.end - citation.span.start).toBe(citation.text.length);
      expect(fixture.text).toContain(citation.text);
    }
  });

  it("reads a refusal back as a refusal carrying nothing", async () => {
    const body = await answerBodyFor("adhesion-contract", "What is the severance?");
    expect(body).toEqual({ kind: "not-addressed" });
    expect(parseAnswer(body)).toEqual({ kind: "not-addressed" });
  });

  it("refuses an answered body whose citations did not survive the trip", () => {
    // A span and a sentence that disagree crop somewhere other than the words
    // quoted. The whole answer is refused rather than shown pointing askew.
    expect(
      parseAnswer({
        kind: "answered",
        text: "Eighteen months.",
        citations: [{ text: "For a period of eighteen (18) months", span: { start: 0, end: 4 } }],
      }),
    ).toBeNull();
  });

  it("refuses an answered body with nothing under it", () => {
    expect(parseAnswer({ kind: "answered", text: "Yes.", citations: [] })).toBeNull();
    expect(parseAnswer({ kind: "answered", text: "   ", citations: [] })).toBeNull();
  });

  it("does not read an unreadable body as a document that says nothing", () => {
    // `null` sends the reader to the failure surface. Reporting a body we
    // cannot read as "your document does not address this" would be a claim
    // about their contract that nobody made.
    expect(parseAnswer(null)).toBeNull();
    expect(parseAnswer({ kind: "maybe" })).toBeNull();
    expect(parseAnswer({ error: "boom" })).toBeNull();
  });
});
