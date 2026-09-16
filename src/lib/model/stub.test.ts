import { describe, expect, it } from "vitest";
import {
  ANALYSIS_OPERATION,
  ANSWER_OPERATION,
  analysisSchema,
  answerSchema,
  type AnalysisPayload,
  type AnswerPayload,
} from "./payloads";
import {
  createStubModelClient,
  loadFixture,
  UNDECLARED_RED_LINE_ID,
  type FixtureName,
  type StubCorruption,
} from "./stub";
import type { ModelClient } from "./client";

const adhesion = loadFixture("adhesion-contract");
const clean = loadFixture("clean-offer");

function analysisCall(fixture: { text: string }) {
  return {
    operation: ANALYSIS_OPERATION,
    system: "Quote the document.",
    user: `Document:\n${fixture.text}`,
    schema: analysisSchema,
  };
}

function questionCall(fixture: { text: string }, question: string) {
  return {
    operation: ANSWER_OPERATION,
    system: "Answer only from the document.",
    user: `Document:\n${fixture.text}\n\nQuestion: ${question}`,
    schema: answerSchema,
  };
}

async function analyse(
  client: ModelClient,
  fixture: { text: string },
): Promise<AnalysisPayload> {
  const result = await client.complete(analysisCall(fixture));
  if (!result.ok) throw new Error(`stub failed: ${result.failure.kind}`);
  return result.value;
}

async function ask(
  client: ModelClient,
  fixture: { text: string },
  question: string,
): Promise<AnswerPayload> {
  const result = await client.complete(questionCall(fixture, question));
  if (!result.ok) throw new Error(`stub failed: ${result.failure.kind}`);
  return result.value;
}

function stub(corruptions?: StubCorruption[], fixture?: FixtureName) {
  return createStubModelClient({ corruptions, fixture });
}

describe("the stub, told the truth", () => {
  it("returns one candidate per planted clause, quoted verbatim from the document", async () => {
    const payload = await analyse(stub(), adhesion);

    expect(payload.candidates).toHaveLength(
      adhesion.sidecar.expectedFlags.length,
    );
    for (const candidate of payload.candidates) {
      expect(adhesion.text).toContain(candidate.sourceSentence);
    }
    expect(payload.candidates.map((c) => c.severity)).toEqual(
      adhesion.sidecar.expectedFlags.map((f) => f.expectedSeverity),
    );
  });

  it("picks the fixture from the document in the request, not from a setting", async () => {
    const client = stub();

    expect((await analyse(client, adhesion)).candidates.length).toBeGreaterThan(0);
    expect((await analyse(client, clean)).candidates).toEqual([]);
  });

  it("quotes the governing law sentence, because it is in the document", async () => {
    const payload = await analyse(stub(), adhesion);

    expect(payload.governingLawSentence).not.toBeNull();
    expect(adhesion.text).toContain(payload.governingLawSentence as string);
  });

  it("supports every summary claim the same way a flag is supported", async () => {
    const payload = await analyse(stub(), adhesion);

    expect(payload.summary.claims.length).toBeGreaterThan(0);
    for (const { claim, sourceSentence } of payload.summary.claims) {
      expect(claim).not.toBe("");
      expect(adhesion.text).toContain(sourceSentence);
    }
  });

  it("summarises a clean document from sentences that are in it", async () => {
    const payload = await analyse(stub(), clean);

    expect(payload.candidates).toEqual([]);
    expect(payload.summary.claims.length).toBeGreaterThan(0);
    for (const { sourceSentence } of payload.summary.claims) {
      expect(clean.text).toContain(sourceSentence);
    }
  });

  it("never quotes a decoy sentence as a flag's source", async () => {
    const payload = await analyse(stub(), adhesion);
    const quoted = payload.candidates.map((c) => c.sourceSentence);

    for (const decoy of adhesion.sidecar.decoySentences) {
      expect(quoted).not.toContain(decoy);
    }
  });

  it("claims no red line unless told to", async () => {
    const payload = await analyse(stub(), adhesion);

    expect(payload.candidates.every((c) => c.claimedRedLineId === null)).toBe(true);
  });

  it("runs with no OpenRouter variables set", async () => {
    const saved = { ...process.env };
    delete process.env.OPENROUTER_MODEL;
    delete process.env.OPENROUTER_API_KEY;
    try {
      const payload = await analyse(stub(), adhesion);
      expect(payload.candidates.length).toBeGreaterThan(0);
    } finally {
      process.env = saved;
    }
  });
});

describe("the stub, lying", () => {
  const quoteKnobs: StubCorruption[] = [
    "paraphrase-quotes",
    "one-word-changed",
    "quotes-from-other-fixture",
  ];

  for (const knob of quoteKnobs) {
    it(`"${knob}" makes every quote absent from the document`, async () => {
      const payload = await analyse(stub([knob]), adhesion);

      expect(payload.candidates.length).toBeGreaterThan(0);
      for (const candidate of payload.candidates) {
        expect(adhesion.text).not.toContain(candidate.sourceSentence);
      }
      for (const { sourceSentence } of payload.summary.claims) {
        expect(adhesion.text).not.toContain(sourceSentence);
      }
    });
  }

  it("\"quotes-from-other-fixture\" hands over real sentences from the wrong document", async () => {
    const payload = await analyse(stub(["quotes-from-other-fixture"]), adhesion);

    for (const candidate of payload.candidates) {
      expect(clean.text).toContain(candidate.sourceSentence);
      expect(adhesion.text).not.toContain(candidate.sourceSentence);
    }
  });

  it("\"one-word-changed\" keeps the quote a near miss rather than a rewrite", async () => {
    const payload = await analyse(stub(["one-word-changed"]), adhesion);

    for (const [index, candidate] of payload.candidates.entries()) {
      const original = adhesion.sidecar.expectedFlags[index].sourceSentence;
      expect(candidate.sourceSentence).not.toBe(original);
      // Still recognisably the same sentence: the first forty characters of
      // one of them survives in the other.
      const shared =
        candidate.sourceSentence.slice(0, 40) === original.slice(0, 40) ||
        original.includes(candidate.sourceSentence.slice(-40));
      expect(shared).toBe(true);
    }
  });

  it("\"claim-undeclared-red-line\" claims a match the user never declared", async () => {
    const payload = await analyse(stub(["claim-undeclared-red-line"]), adhesion);

    expect(payload.candidates.length).toBeGreaterThan(0);
    for (const candidate of payload.candidates) {
      expect(candidate.claimedRedLineId).toBe(UNDECLARED_RED_LINE_ID);
    }
  });

  it("\"off-schema\" is a failure, not a value", async () => {
    const result = await stub(["off-schema"]).complete(analysisCall(adhesion));

    expect(result.ok).toBe(false);
    if (result.ok || result.failure.kind !== "unusable-response") {
      throw new Error("expected an unusable response");
    }
    expect(result.failure.reason).toBe("off-schema");
  });

  it("fails exactly the way the transport fails when told to", async () => {
    const client = createStubModelClient({
      failWith: { kind: "unreachable", detail: "fetch failed" },
    });

    const result = await client.complete(analysisCall(adhesion));

    expect(result).toEqual({
      ok: false,
      failure: { kind: "unreachable", detail: "fetch failed" },
    });
  });

  it("takes an arbitrary transform for a lie the knobs do not name", async () => {
    const client = createStubModelClient({
      transform: (payload) => ({
        ...(payload as AnalysisPayload),
        candidates: [],
      }),
    });

    const payload = await analyse(client, adhesion);

    expect(payload.candidates).toEqual([]);
  });
});

describe("the stub answering questions", () => {
  it("quotes the document when it answers", async () => {
    const answer = await ask(
      stub(),
      adhesion,
      "What happens to my signing bonus if I leave early?",
    );

    expect(answer.addressed).toBe(true);
    expect(answer.citations.length).toBeGreaterThan(0);
    for (const citation of answer.citations) {
      expect(adhesion.text).toContain(citation);
    }
  });

  it("says the document does not address a question it is silent on", async () => {
    const answer = await ask(
      stub(),
      adhesion,
      "Is this compensation competitive for Berlin?",
    );

    expect(answer.addressed).toBe(false);
    expect(answer.citations).toEqual([]);
  });

  it("\"answer-cites-absent-text\" answers confidently from the wrong document", async () => {
    const answer = await ask(
      stub(["answer-cites-absent-text"]),
      adhesion,
      "Can I keep my side projects?",
    );

    expect(answer.addressed).toBe(true);
    expect(answer.citations.length).toBeGreaterThan(0);
    for (const citation of answer.citations) {
      expect(adhesion.text).not.toContain(citation);
    }
  });
});

describe("the stub refuses to guess", () => {
  it("throws when the request is about no fixture at all", async () => {
    await expect(
      stub().complete({
        operation: ANALYSIS_OPERATION,
        system: "",
        user: "a document nobody wrote",
        schema: analysisSchema,
      }),
    ).rejects.toThrow(/could not tell which fixture/);
  });

  it("throws on an operation it has no payload for", async () => {
    await expect(
      stub().complete({
        ...analysisCall(adhesion),
        operation: "enforceability",
      }),
    ).rejects.toThrow(/no payload for operation/);
  });
});
