/**
 * The question box, run for real over both fixtures.
 *
 * The model client is the one permitted stub. Nothing else is stubbed: the
 * fixture documents go through the real `parseDocument`, the citations the stub
 * returns go through the real `verifyQuotes`, and the two states come out of
 * the real `answer`. A test that mocked the gate or `locate` would be testing
 * the mock, and the gate is the entire subject here.
 *
 * The adversarial set is the centre of this file. PRD §4 T5 puts the bar at
 * ~30 questions whose answers are genuinely absent from the document, and
 * counts one fabricated answer as worse than ten missed flags. So the positive
 * case gets one section and the refusals get most of the file.
 *
 * Every question in `ABSENT` was checked against the fixture text before it was
 * written here: a legal prediction, a market fact, a fact about the employer,
 * or a subject the document simply does not carry. "says nothing on the absent
 * subjects" keeps that honest — it asserts the fixtures have not grown a
 * sentence that would make one of these questions fair, so a fixture edit fails
 * the suite rather than quietly turning a refusal test into a tautology.
 */

import { describe, expect, it } from "vitest";
import { parseDocument } from "../intake/parse-document";
import {
  createStubModelClient,
  loadFixture,
  type FixtureName,
  type StubCorruption,
} from "../model/stub";
import type { AnalysisRequest } from "../intake/analysis-request";
import { answer, type AnswerOutcome } from "./answer";
import { ANSWER_SYSTEM_PROMPT, buildAnswerUser } from "./prompt";

const FIXTURES: FixtureName[] = ["adhesion-contract", "clean-offer"];

/** The fixture, through the real parser, in the shape intake hands over. */
async function requestFor(name: FixtureName): Promise<AnalysisRequest> {
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
    redLines: [],
  };
}

interface AskOptions {
  corruptions?: StubCorruption[];
  transform?: (payload: unknown) => unknown;
}

async function ask(
  name: FixtureName,
  question: string,
  options: AskOptions = {},
): Promise<AnswerOutcome> {
  const request = await requestFor(name);
  const transform = options.transform;
  const model = createStubModelClient({
    fixture: name,
    corruptions: options.corruptions,
    transform: transform ? (payload) => transform(payload) : undefined,
  });
  return answer(question, request, model);
}

/** The answer, or a thrown failure. Every test below expects an answer. */
async function answerFor(
  name: FixtureName,
  question: string,
  options: AskOptions = {},
) {
  const outcome = await ask(name, question, options);
  if (!outcome.ok) {
    throw new Error(`answering failed: ${JSON.stringify(outcome.failure)}`);
  }
  return outcome;
}

/* ── The adversarial set ─────────────────────────────────────────────── */

interface AbsentQuestion {
  question: string;
  why: string;
  /** Where this one is genuinely absent, when it is not absent from both. */
  only?: FixtureName[];
}

/**
 * Questions whose answers are genuinely not in the fixtures. Four kinds,
 * because they fail for four different reasons and a box that refuses one kind
 * and not another has not understood the standard.
 */
const ABSENT: AbsentQuestion[] = [
  // Predictions about law. The document cannot say what a court will do.
  { question: "Is this enforceable in Texas?", why: "a legal prediction" },
  { question: "Would a judge strike this down?", why: "a legal prediction" },
  { question: "Can they actually make me pay the bonus back if I am laid off?", why: "a legal prediction" },
  { question: "Is any of this illegal?", why: "a legal prediction" },
  { question: "Would I win if I sued?", why: "a legal prediction" },
  { question: "Do I need a lawyer to sign this?", why: "advice, not text" },

  // Facts about the market. Nothing in an offer letter carries them.
  { question: "Is this salary competitive?", why: "a market fact" },
  { question: "How does this equity grant compare to other startups?", why: "a market fact" },
  { question: "Is an 18 month non-compete normal in this industry?", why: "a market fact" },
  { question: "Should I try to negotiate for more?", why: "advice, not text" },
  { question: "What is the company worth?", why: "a market fact" },

  // Facts about the employer. Neither document names them.
  { question: "Who is the CEO?", why: "not in the document" },
  { question: "How many people work there?", why: "not in the document" },
  { question: "Who would I report to?", why: "not in the document" },
  { question: "Has the company raised funding recently?", why: "not in the document" },
  { question: "Who wrote this contract?", why: "not in the document" },

  // Subjects the document is silent on. The hardest kind: they sound like
  // ordinary offer-letter questions, and the document still does not say.
  { question: "What is the severance?", why: "the document is silent" },
  { question: "How much severance would I get if I were laid off?", why: "the document is silent" },
  // PRD §4 T5's own example, kept in its own words. It belongs to the planted
  // contract only: the clean offer gives three months to exercise an option
  // after leaving, which is close enough to be a fair reading of the question.
  {
    question: "What happens if I quit in month three?",
    why: "the document is silent",
    only: ["adhesion-contract"],
  },
  { question: "What happens if I quit during my first ninety days?", why: "the document is silent" },
  { question: "How much notice do I have to give before resigning?", why: "the document is silent" },
  { question: "How many sick days do I get?", why: "the document is silent" },
  { question: "Am I allowed to live abroad?", why: "the document is silent" },
  { question: "Will they sponsor a visa?", why: "the document is silent" },
  { question: "Is there a relocation allowance?", why: "the document is silent" },
  { question: "What health insurance is included?", why: "the document is silent" },
  { question: "Is there a sabbatical policy?", why: "the document is silent" },
  { question: "When is the annual review?", why: "the document is silent" },
  { question: "Do I get a company laptop?", why: "the document is silent" },
  { question: "What is the dress code on client visits?", why: "the document is silent" },
  { question: "Is there a bonus for referring someone?", why: "the document is silent" },
];

function absentFor(name: FixtureName): AbsentQuestion[] {
  return ABSENT.filter((entry) => !entry.only || entry.only.includes(name));
}

/**
 * A question both fixtures genuinely answer, and answer in opposite
 * directions: the planted contract can repurchase vested shares at the lower
 * of cost and value, the clean one says it has no such right.
 */
const ANSWERABLE = "Can the company claw back shares that have already vested?";

describe("the adversarial set", () => {
  it("is large enough to be a set", () => {
    // PRD §4 T5 puts the bar at ~30. A handful of token cases would pass every
    // assertion below and prove nothing about a box that answers too readily.
    expect(ABSENT.length).toBeGreaterThanOrEqual(30);
  });

  for (const name of FIXTURES) {
    describe(name, () => {
      for (const { question, why } of absentFor(name)) {
        it(`refuses "${question}" — ${why}`, async () => {
          const outcome = await answerFor(name, question);
          expect(outcome.answer.kind).toBe("not-addressed");
          // No text, no citations, no caveat — there is no field to put one in.
          expect(Object.keys(outcome.answer)).toEqual(["kind"]);
        });
      }
    });
  }
});

describe("the fixtures behind the adversarial set", () => {
  /**
   * The refusals above are only meaningful while the documents really are
   * silent. This is the check that keeps them meaningful: no answer to any
   * absent question may be sitting in the text, waiting to make a refusal into
   * a false negative rather than a held standard.
   */
  it.each(FIXTURES)("%s says nothing on the absent subjects", async (name) => {
    const request = await requestFor(name);
    const text = request.text.toLowerCase();
    const subjects = [
      "severance",
      "sick day",
      "sick leave",
      "health insurance",
      "visa",
      "sponsor",
      "relocat",
      "chief executive",
      "ceo",
      "headcount",
      "referral bonus",
      "dress code",
      "annual review",
      "market rate",
      "competitive salary",
      "industry standard",
    ];
    for (const subject of subjects) {
      expect(text, `fixture now mentions "${subject}"`).not.toContain(subject);
    }
  });
});

/* ── The case that matters most ──────────────────────────────────────── */

describe("a confident answer citing text that is not in the document", () => {
  /**
   * The stub's `answer-cites-absent-text` knob returns exactly the payload T5
   * is about: `addressed: true`, a fluent sentence of assurance, and a citation
   * that is a real sentence — from the other fixture's document. Schema-valid,
   * plausible, and wrong. It must not reach the reader in any form.
   */
  it.each(FIXTURES)("is refused outright on %s", async (name) => {
    const outcome = await answerFor(name, ANSWERABLE, {
      corruptions: ["answer-cites-absent-text"],
    });
    expect(outcome.answer.kind).toBe("not-addressed");
  });

  it.each(FIXTURES)("does not leak the fabricated text on %s", async (name) => {
    const outcome = await answerFor(name, ANSWERABLE, {
      corruptions: ["answer-cites-absent-text"],
    });
    // The refusal carries nothing. Not the model's sentence, not its citation,
    // not a note that something was dropped.
    expect(JSON.stringify(outcome.answer)).toBe('{"kind":"not-addressed"}');
  });

  it.each(FIXTURES)("counts the drop on %s rather than losing it", async (name) => {
    const outcome = await answerFor(name, ANSWERABLE, {
      corruptions: ["answer-cites-absent-text"],
    });
    // The instrument. A box refusing because the model has stopped quoting
    // looks identical from outside to one refusing because the document is
    // silent, and this count is what tells them apart.
    expect(outcome.dropped.length).toBe(1);
    expect(outcome.dropped[0].reason).toBe("quote-not-found");
    expect(outcome.dropped[0].claimedSentence.length).toBeGreaterThan(20);
  });

  it.each(FIXTURES)("refuses the same way on an absent question on %s", async (name) => {
    // The two failures compound: a question the document does not address,
    // answered confidently, citing text from somewhere else.
    const outcome = await answerFor(name, "What is the severance?", {
      corruptions: ["answer-cites-absent-text"],
    });
    expect(outcome.answer.kind).toBe("not-addressed");
  });
});

describe("quotes that are nearly the document's", () => {
  it.each(FIXTURES)("refuses a paraphrased citation on %s", async (name) => {
    const outcome = await answerFor(name, ANSWERABLE, {
      corruptions: ["paraphrase-quotes"],
    });
    expect(outcome.answer.kind).toBe("not-addressed");
  });

  it.each(FIXTURES)("refuses a citation with one word changed on %s", async (name) => {
    // The near miss, which is the case a reader could not catch unaided.
    const outcome = await answerFor(name, ANSWERABLE, {
      corruptions: ["one-word-changed"],
    });
    expect(outcome.answer.kind).toBe("not-addressed");
  });

  it.each(FIXTURES)("refuses a real sentence from the other document on %s", async (name) => {
    const outcome = await answerFor(name, ANSWERABLE, {
      corruptions: ["quotes-from-other-fixture"],
    });
    expect(outcome.answer.kind).toBe("not-addressed");
  });
});

describe("an answer that is only partly supported", () => {
  /**
   * Half the support locates and half does not. Keeping the located half would
   * mean showing prose that rests jointly on a sentence nobody can find, with a
   * real quote under it vouching for the whole thing. The answer is refused
   * whole.
   */
  it.each(FIXTURES)("is refused whole on %s", async (name) => {
    const outcome = await answerFor(name, ANSWERABLE, {
      transform: (payload) => {
        const body = payload as { citations: string[] };
        return {
          ...body,
          citations: [...body.citations, "The Company shall provide you with a pony."],
        };
      },
    });
    expect(outcome.answer.kind).toBe("not-addressed");
  });

  it.each(FIXTURES)("still counts only the citation that failed on %s", async (name) => {
    const outcome = await answerFor(name, ANSWERABLE, {
      transform: (payload) => {
        const body = payload as { citations: string[] };
        return { ...body, citations: [...body.citations, "Not a sentence from here."] };
      },
    });
    expect(outcome.dropped.map((drop) => drop.claimedSentence)).toEqual([
      "Not a sentence from here.",
    ]);
  });
});

describe("a confident answer resting on nothing", () => {
  it.each(FIXTURES)("is refused when it cites no sentence at all on %s", async (name) => {
    const outcome = await answerFor(name, ANSWERABLE, {
      transform: (payload) => ({
        ...(payload as object),
        addressed: true,
        text: "Yes — the document is clear that you are fully protected here.",
        citations: [],
      }),
    });
    expect(outcome.answer.kind).toBe("not-addressed");
  });

  it.each(FIXTURES)("is refused when its only citation is blank on %s", async (name) => {
    const outcome = await answerFor(name, ANSWERABLE, {
      transform: (payload) => ({
        ...(payload as object),
        addressed: true,
        text: "Yes.",
        citations: ["   "],
      }),
    });
    expect(outcome.answer.kind).toBe("not-addressed");
    expect(outcome.dropped[0].reason).toBe("quote-empty");
  });

  it.each(FIXTURES)("is refused when the answer has citations but no words on %s", async (name) => {
    const outcome = await answerFor(name, ANSWERABLE, {
      transform: (payload) => ({ ...(payload as object), addressed: true, text: "  " }),
    });
    expect(outcome.answer.kind).toBe("not-addressed");
  });
});

/* ── The positive half ───────────────────────────────────────────────── */

describe("a question the document does answer", () => {
  it.each(FIXTURES)("answers it with the sentences it rests on, on %s", async (name) => {
    const outcome = await answerFor(name, ANSWERABLE);
    expect(outcome.answer.kind).toBe("answered");
    if (outcome.answer.kind !== "answered") return;
    expect(outcome.answer.text.trim().length).toBeGreaterThan(20);
    expect(outcome.answer.citations.length).toBeGreaterThan(0);
    expect(outcome.dropped).toEqual([]);
  });

  it.each(FIXTURES)("slices every citation back out of the reader's own text, on %s", async (name) => {
    const request = await requestFor(name);
    const outcome = await answerFor(name, ANSWERABLE);
    if (outcome.answer.kind !== "answered") throw new Error("expected an answer");

    for (const citation of outcome.answer.citations) {
      // The canonical text, sliced at the citation's own offsets, is the
      // citation's text. Character for character, not normalised back.
      expect(request.text.slice(citation.span.start, citation.span.end)).toBe(
        citation.text,
      );
      expect(citation.span.end).toBeGreaterThan(citation.span.start);
    }
  });

  it.each(FIXTURES)("carries the document's own bytes, not the model's, on %s", async (name) => {
    const fixture = loadFixture(name);
    const outcome = await answerFor(name, ANSWERABLE);
    if (outcome.answer.kind !== "answered") throw new Error("expected an answer");

    for (const citation of outcome.answer.citations) {
      expect(fixture.text).toContain(citation.text);
    }
  });
});

/* ── Failures are not refusals ───────────────────────────────────────── */

describe("things that are not an answer about the document", () => {
  it("does not call the model on an empty question", async () => {
    const request = await requestFor("adhesion-contract");
    let called = false;
    const outcome = await answer("   ", request, {
      async complete() {
        called = true;
        throw new Error("the model must not be asked a question nobody asked");
      },
    });
    expect(called).toBe(false);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.failure.kind).toBe("no-question");
  });

  it("does not report a transport failure as a silent document", async () => {
    // Telling someone their contract does not address a question because a
    // rate limit was hit would be a statement about their document we never
    // made. It comes back as a failure instead.
    const request = await requestFor("adhesion-contract");
    const model = createStubModelClient({
      fixture: "adhesion-contract",
      failWith: { kind: "rejected", status: 429, detail: "slow down" },
    });
    const outcome = await answer("How long is the non-compete?", request, model);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.failure.kind).toBe("model");
  });

  it("does not report an off-schema response as a silent document", async () => {
    const outcome = await ask("adhesion-contract", ANSWERABLE, {
      transform: () => ({ addressed: "probably", text: 7 }),
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.failure.kind).toBe("model");
  });

  it("does not answer about text that will not re-read as a document", async () => {
    const request = await requestFor("adhesion-contract");
    const outcome = await answer(
      "How long is the non-compete?",
      { ...request, text: "" },
      createStubModelClient({ fixture: "adhesion-contract" }),
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.failure.kind).toBe("unreadable-document");
  });
});

/* ── What the model is actually told ─────────────────────────────────── */

describe("the prompt", () => {
  it("sends the document whole and the question unchanged", async () => {
    const request = await requestFor("adhesion-contract");
    const question = "  How long does the non-compete last?  ";
    const user = buildAnswerUser(question, request);

    // Whole, because the model is being asked to quote it and a truncated copy
    // is a copy whose quotes will not locate.
    expect(user).toContain(request.text);
    // Unchanged, because a question we improved is a question they did not ask.
    expect(user).toContain("How long does the non-compete last?");
  });

  it("sends the document and the question and nothing else", async () => {
    const request = await requestFor("adhesion-contract");
    const user = buildAnswerUser("Anything here about equity?", {
      ...request,
      redLines: [{ id: "rl-1", text: "I will not sign a non-compete" }],
    });

    // Everything the call carries, with the reader's own document taken out.
    // What is left is ours, and it names neither the state they work in nor
    // their red lines. Enforceability is a separate labelled layer (ADR 0005),
    // and naming the state here invites the model to fold "a California court
    // would void this" into an answer that is otherwise about the document.
    const ours = user.replace(request.text, "").toLowerCase();
    expect(ours).not.toContain("california");
    expect(ours).not.toContain("red line");
    expect(ours).not.toContain("state");
    expect(ours).not.toContain("jurisdiction");
  });

  it("tells the model the truth about what happens to a quote it cannot reproduce", () => {
    // The prompt says an unlocatable quote is discarded and takes the answer
    // with it. `answer` does exactly that, so the sentence is not a threat.
    expect(ANSWER_SYSTEM_PROMPT).toContain("discarded");
    expect(ANSWER_SYSTEM_PROMPT).toContain("character for character");
  });
});
