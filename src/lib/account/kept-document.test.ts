import { describe, expect, it } from "vitest";
import {
  KEPT_DOCUMENT_COLUMNS,
  keptDocumentFrom,
  rowFor,
  snapshotKey,
  type DocumentSnapshot,
} from "./kept-document";
import type { WireAnalysis, WireCitation } from "@/app/review/_lib/wire";

const OWNER = "8b1d6c5a-0000-4000-8000-000000000001";
const TEXT = [
  "Base salary shall be $184,500 per annum, payable semi-monthly.",
  "All inventions conceived during employment are assigned to the Company.",
].join(" ");

function cite(sentence: string): WireCitation {
  const start = TEXT.indexOf(sentence);
  return { text: sentence, span: { start, end: start + sentence.length } };
}

const SALARY = cite("Base salary shall be $184,500 per annum, payable semi-monthly.");
const INVENTIONS = cite("All inventions conceived during employment are assigned to the Company.");

function analysis(citation: WireCitation = INVENTIONS): WireAnalysis {
  return {
    summary: {
      claims: [{ register: "document", statement: "Pay is stated.", citation: SALARY }],
    },
    flags: [
      {
        flag: {
          id: "f1",
          clauseType: "ip-assignment",
          severity: "high",
          citation,
          meaning: "Your inventions go to them.",
          counterOffer: "Limit it to work done for them.",
          escapability: [],
          claimedRedLineId: null,
        },
        severity: "high",
        rank: 1,
        promotion: null,
      },
    ],
    coverage: {
      checked: (["non-compete", "arbitration", "ip-assignment", "equity-clawback"] as const).map(
        (clauseType) => ({ clauseType, label: clauseType, flagCount: 0, finding: "Checked." }),
      ),
      notReviewed: ["Anything else."],
    },
    context: [],
    governingLaw: null,
  };
}

function snapshot(overrides: Partial<DocumentSnapshot> = {}): DocumentSnapshot {
  return {
    text: TEXT,
    origin: { filename: "offer.pdf", source: "yours" },
    jurisdiction: "California",
    analysis: analysis(),
    analysedRedLines: [{ id: "rl-1", text: "No non-competes" }],
    exchanges: [
      {
        question: "What is the salary?",
        answer: { kind: "answered", text: "$184,500.", citations: [SALARY] },
      },
      { question: "Is there a pension?", answer: { kind: "not-addressed" } },
    ],
    ...overrides,
  };
}

/** The row as the database hands it back: through JSON, like the real thing. */
function stored(value: DocumentSnapshot) {
  return JSON.parse(JSON.stringify(rowFor(OWNER, value))) as unknown;
}

describe("what goes to the account", () => {
  it("writes exactly the named columns and no others", () => {
    expect(Object.keys(rowFor(OWNER, snapshot())).sort()).toEqual(
      [...KEPT_DOCUMENT_COLUMNS].sort(),
    );
  });

  it("cannot carry the original file, even on an object that holds one", () => {
    const carrying = { ...snapshot(), bytes: new Uint8Array([1, 2, 3]), file: "base64" };
    const row = rowFor(OWNER, carrying) as unknown as Record<string, unknown>;
    expect(row.bytes).toBeUndefined();
    expect(row.file).toBeUndefined();
  });

  it("refuses a row with no owner, which row level security could not protect", () => {
    expect(() => rowFor("  ", snapshot())).toThrow();
  });
});

describe("what is believed on the way back", () => {
  it("brings back the text, the analysis and the questions whole", async () => {
    const kept = await keptDocumentFrom(stored(snapshot()));
    expect(kept?.document.text).toBe(TEXT);
    expect(kept?.origin).toEqual({ filename: "offer.pdf", source: "yours" });
    expect(kept?.jurisdiction).toBe("California");
    expect(kept?.analysis?.flags).toHaveLength(1);
    expect(kept?.analysedRedLines).toEqual([{ id: "rl-1", text: "No non-competes" }]);
    expect(kept?.exchanges).toHaveLength(2);
    expect(kept?.dropped).toBe(false);
  });

  it("gives back a document that has really been read", async () => {
    const kept = await keptDocumentFrom(stored(snapshot()));
    expect(kept?.document.sentences.length).toBeGreaterThan(0);
  });

  it("drops an analysis whose quoted sentence is not at its offset", async () => {
    const moved = { ...INVENTIONS, span: { start: 1, end: 1 + INVENTIONS.text.length } };
    const kept = await keptDocumentFrom(stored(snapshot({ analysis: analysis(moved) })));
    expect(kept?.analysis).toBeNull();
    expect(kept?.dropped).toBe(true);
    expect(kept?.document.text).toBe(TEXT);
  });

  it("drops an analysis whose quoted words are not the document's", async () => {
    const forged = { ...INVENTIONS, text: "X".repeat(INVENTIONS.text.length) };
    const kept = await keptDocumentFrom(stored(snapshot({ analysis: analysis(forged) })));
    expect(kept?.analysis).toBeNull();
    expect(kept?.dropped).toBe(true);
  });

  it("drops the whole analysis for one bad citation, not just the flag", async () => {
    const whole = analysis();
    const bad = { ...SALARY, span: { start: 2, end: 2 + SALARY.text.length } };
    const broken: WireAnalysis = {
      ...whole,
      summary: { claims: [{ ...whole.summary.claims[0], citation: bad }] },
    };
    const kept = await keptDocumentFrom(stored(snapshot({ analysis: broken })));
    expect(kept?.analysis).toBeNull();
  });

  it("drops an analysis that is not the right shape", async () => {
    const row = stored(snapshot()) as Record<string, unknown>;
    const kept = await keptDocumentFrom({ ...row, analysis: { summary: "no" } });
    expect(kept?.analysis).toBeNull();
    expect(kept?.dropped).toBe(true);
  });

  it("does not call an analysis dropped when none was ever run", async () => {
    const kept = await keptDocumentFrom(stored(snapshot({ analysis: null })));
    expect(kept?.analysis).toBeNull();
    expect(kept?.dropped).toBe(false);
  });

  it("drops only the answer whose citation fails, and says so", async () => {
    const bad = { ...SALARY, span: { start: 3, end: 3 + SALARY.text.length } };
    const kept = await keptDocumentFrom(
      stored(
        snapshot({
          exchanges: [
            { question: "Bad?", answer: { kind: "answered", text: "Yes.", citations: [bad] } },
            { question: "Good?", answer: { kind: "answered", text: "Yes.", citations: [SALARY] } },
          ],
        }),
      ),
    );
    expect(kept?.exchanges.map((e) => e.question)).toEqual(["Good?"]);
    expect(kept?.dropped).toBe(true);
  });

  it("ignores a jurisdiction that is not a US state", async () => {
    const row = stored(snapshot()) as Record<string, unknown>;
    const kept = await keptDocumentFrom({ ...row, jurisdiction: "Narnia" });
    expect(kept?.jurisdiction).toBeNull();
  });

  it("refuses a row with no readable text", async () => {
    const row = stored(snapshot()) as Record<string, unknown>;
    expect(await keptDocumentFrom({ ...row, text: "   " })).toBeNull();
    expect(await keptDocumentFrom({ ...row, text: 7 })).toBeNull();
    expect(await keptDocumentFrom(null)).toBeNull();
  });
});

describe("telling a real change from a re-render", () => {
  it("gives the same key to the same contents", () => {
    expect(snapshotKey(snapshot())).toBe(snapshotKey(snapshot()));
  });

  it("gives a new key when a question is added", () => {
    const more = snapshot({
      exchanges: [{ question: "New?", answer: { kind: "not-addressed" } }],
    });
    expect(snapshotKey(more)).not.toBe(snapshotKey(snapshot()));
  });
});
