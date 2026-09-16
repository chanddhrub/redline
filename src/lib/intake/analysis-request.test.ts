import { describe, expect, it } from "vitest";
import {
  addRedLine,
  editRedLine,
  emptyRequest,
  INTAKE_SESSION_KEY,
  isReady,
  removeRedLine,
  restoreIntake,
  serialiseIntake,
  setDocument,
  setJurisdiction,
  toAnalysisRequest,
  US_STATES,
  whatIsMissing,
} from "./analysis-request";
import { parseDocument, type ParsedDocument } from "./parse-document";

const doc: ParsedDocument = {
  text: "A sentence. Another sentence.",
  sentences: [
    { text: "A sentence.", start: 0, end: 11 },
    { text: "Another sentence.", start: 12, end: 29 },
  ],
  locate: () => null,
};

describe("red lines", () => {
  it("adds, edits and removes", () => {
    let s = addRedLine(emptyRequest(), "No IP assignment covering personal projects");
    s = addRedLine(s, "No non-compete over six months");
    expect(s.redLines.map((r) => r.text)).toEqual([
      "No IP assignment covering personal projects",
      "No non-compete over six months",
    ]);

    const id = s.redLines[0].id;
    s = editRedLine(s, id, "No IP assignment over anything I build on my own time");
    expect(s.redLines[0].text).toBe(
      "No IP assignment over anything I build on my own time",
    );
    expect(s.redLines[0].id).toBe(id);

    s = removeRedLine(s, id);
    expect(s.redLines.map((r) => r.text)).toEqual(["No non-compete over six months"]);
  });

  it("rejects blank and whitespace-only entries", () => {
    let s = addRedLine(emptyRequest(), "");
    s = addRedLine(s, "   \n\t ");
    expect(s.redLines).toHaveLength(0);
  });

  it("stores text exactly as typed", () => {
    const s = addRedLine(emptyRequest(), "  I will not sign THIS  ");
    expect(s.redLines[0].text).toBe("  I will not sign THIS  ");
  });

  it("does not edit a line into blankness", () => {
    const s = addRedLine(emptyRequest(), "Keep me");
    const after = editRedLine(s, s.redLines[0].id, "   ");
    expect(after.redLines[0].text).toBe("Keep me");
  });

  it("survives a jurisdiction change", () => {
    let s = addRedLine(emptyRequest(), "No arbitration clause");
    s = setJurisdiction(s, "California");
    s = setJurisdiction(s, "New York");
    expect(s.redLines.map((r) => r.text)).toEqual(["No arbitration clause"]);
  });

  it("gives every line its own id", () => {
    let s = addRedLine(emptyRequest(), "One");
    s = addRedLine(s, "One");
    expect(s.redLines[0].id).not.toBe(s.redLines[1].id);
  });

  it("holds several at once, in the order they were written", () => {
    let s = emptyRequest();
    for (const text of [
      "I will not sign an IP assignment covering personal projects",
      "I will not sign a non-compete longer than six months",
      "I will not sign away my right to a jury",
      "I will not repay a signing bonus if I am laid off",
    ]) {
      s = addRedLine(s, text);
    }
    expect(s.redLines).toHaveLength(4);
    expect(s.redLines.map((r) => r.text)).toEqual([
      "I will not sign an IP assignment covering personal projects",
      "I will not sign a non-compete longer than six months",
      "I will not sign away my right to a jury",
      "I will not repay a signing bonus if I am laid off",
    ]);
    expect(new Set(s.redLines.map((r) => r.id)).size).toBe(4);
  });

  it("leaves every other line's id alone when one is edited", () => {
    let s = addRedLine(emptyRequest(), "First");
    s = addRedLine(s, "Second");
    s = addRedLine(s, "Third");
    const ids = s.redLines.map((r) => r.id);

    s = editRedLine(s, ids[1], "Second, sharpened");
    expect(s.redLines.map((r) => r.id)).toEqual(ids);
    expect(s.redLines.map((r) => r.text)).toEqual([
      "First",
      "Second, sharpened",
      "Third",
    ]);
  });

  it("removes only the line asked for, and keeps the rest as they were", () => {
    let s = addRedLine(emptyRequest(), "First");
    s = addRedLine(s, "Second");
    s = addRedLine(s, "Third");
    const ids = s.redLines.map((r) => r.id);

    s = removeRedLine(s, ids[0]);
    expect(s.redLines.map((r) => r.text)).toEqual(["Second", "Third"]);
    expect(s.redLines.map((r) => r.id)).toEqual([ids[1], ids[2]]);

    const unchanged = removeRedLine(s, "rl-nobody");
    expect(unchanged.redLines.map((r) => r.id)).toEqual([ids[1], ids[2]]);
  });

  it("returns new state and leaves the state it was given alone", () => {
    const one = addRedLine(emptyRequest(), "First");
    const two = addRedLine(one, "Second");
    const edited = editRedLine(two, two.redLines[0].id, "First, sharpened");
    const removed = removeRedLine(edited, edited.redLines[1].id);

    expect(one.redLines.map((r) => r.text)).toEqual(["First"]);
    expect(two.redLines.map((r) => r.text)).toEqual(["First", "Second"]);
    expect(edited.redLines.map((r) => r.text)).toEqual([
      "First, sharpened",
      "Second",
    ]);
    expect(removed.redLines.map((r) => r.text)).toEqual(["First, sharpened"]);
  });

  it("stores an edit exactly as typed too", () => {
    const s = addRedLine(emptyRequest(), "Plain");
    const after = editRedLine(
      s,
      s.redLines[0].id,
      "  I will NOT sign this — final answer\t",
    );
    expect(after.redLines[0].text).toBe(
      "  I will NOT sign this — final answer\t",
    );
  });

  it("refuses a blank add without disturbing the lines already held", () => {
    let s = addRedLine(emptyRequest(), "Keep me");
    const ids = s.redLines.map((r) => r.id);
    for (const blank of ["", " ", "\t", "\n", "\u00a0", "  \r\n \t "]) {
      s = addRedLine(s, blank);
    }
    expect(s.redLines.map((r) => r.text)).toEqual(["Keep me"]);
    expect(s.redLines.map((r) => r.id)).toEqual(ids);
  });

  it("carries no severity of its own — promotion is the analysis feature's", () => {
    let s = addRedLine(emptyRequest(), "I will not sign a non-compete");
    s = editRedLine(s, s.redLines[0].id, "I will not sign any non-compete");
    for (const line of s.redLines) {
      expect(Object.keys(line).sort()).toEqual(["id", "text"]);
    }
  });

  it("does not stand between a reader with none and the analysis", () => {
    const none = setJurisdiction(setDocument(emptyRequest(), doc), "Texas");
    expect(none.redLines).toEqual([]);
    expect(isReady(none)).toBe(true);
    expect(whatIsMissing(none)).toEqual([]);
    expect(toAnalysisRequest(none)!.redLines).toEqual([]);

    let some = addRedLine(none, "I will not sign a non-compete");
    expect(isReady(some)).toBe(true);

    some = removeRedLine(some, some.redLines[0].id);
    expect(isReady(some)).toBe(true);
    expect(whatIsMissing(some)).toEqual([]);
  });

  it("survives a jurisdiction change with its ids and its wording intact", () => {
    let s = addRedLine(emptyRequest(), "  I will not sign an arbitration clause  ");
    s = addRedLine(s, "I will not sign a two-year non-solicit");
    const before = s.redLines.map((r) => ({ ...r }));

    s = setJurisdiction(s, "California");
    s = setJurisdiction(s, "New York");
    s = setJurisdiction(s, "Ontario" as never);

    expect(s.redLines).toEqual(before);
  });
});

describe("the state you work in", () => {
  it("is absent until it is answered, and named once it is", () => {
    const before = emptyRequest();
    expect(before.jurisdiction).toBeNull();

    const after = setJurisdiction(before, "California");
    expect(after.jurisdiction).toBe("California");
    expect(before.jurisdiction).toBeNull();
  });

  it("is replaced, not accumulated, when it is changed", () => {
    let s = setJurisdiction(emptyRequest(), "California");
    s = setJurisdiction(s, "Texas");
    s = setJurisdiction(s, "New York");
    expect(s.jurisdiction).toBe("New York");
  });

  it("carries the changed state through to the analysis request", () => {
    let s = setJurisdiction(setDocument(emptyRequest(), doc), "California");
    expect(toAnalysisRequest(s)!.jurisdiction).toBe("California");

    s = setJurisdiction(s, "Washington");
    expect(toAnalysisRequest(s)!.jurisdiction).toBe("Washington");
  });

  it("holds the document and the red lines steady across a change", () => {
    let s = setDocument(emptyRequest(), doc);
    s = addRedLine(s, "No IP assignment covering personal projects");
    s = setJurisdiction(s, "California");
    const wasReady = isReady(s);

    s = setJurisdiction(s, "Oregon");
    expect(isReady(s)).toBe(wasReady);
    expect(s.document).toBe(doc);
    expect(s.redLines.map((r) => r.text)).toEqual([
      "No IP assignment covering personal projects",
    ]);
  });

  it("blocks analysis until it is answered, whatever else is present", () => {
    let s = setDocument(emptyRequest(), doc);
    s = addRedLine(s, "No non-compete at all");
    expect(isReady(s)).toBe(false);
    expect(toAnalysisRequest(s)).toBeNull();
    expect(whatIsMissing(s)).toContain("the state you work in");

    s = setJurisdiction(s, "Illinois");
    expect(isReady(s)).toBe(true);
    expect(toAnalysisRequest(s)).not.toBeNull();
  });

  it("ignores anything that is not a US state, rather than accepting it", () => {
    const typo = setJurisdiction(emptyRequest(), "Californa" as never);
    expect(typo.jurisdiction).toBeNull();
    expect(isReady(setDocument(typo, doc))).toBe(false);

    const blank = setJurisdiction(emptyRequest(), "" as never);
    expect(blank.jurisdiction).toBeNull();

    const kept = setJurisdiction(
      setJurisdiction(emptyRequest(), "Colorado"),
      "Ontario" as never,
    );
    expect(kept.jurisdiction).toBe("Colorado");
  });

  it("accepts every state the reader is offered", () => {
    for (const name of US_STATES) {
      const s = setJurisdiction(setDocument(emptyRequest(), doc), name);
      expect(s.jurisdiction).toBe(name);
      expect(isReady(s)).toBe(true);
    }
    expect(new Set(US_STATES).size).toBe(US_STATES.length);
  });

  it("offers no legal content alongside the state, only the state", () => {
    const s = setJurisdiction(setDocument(emptyRequest(), doc), "California");
    expect(Object.keys(s).sort()).toEqual([
      "document",
      "jurisdiction",
      "redLines",
    ]);
    expect(Object.keys(toAnalysisRequest(s)!).sort()).toEqual([
      "jurisdiction",
      "redLines",
      "sentences",
      "text",
    ]);
  });
});

describe("readiness", () => {
  it("needs a document and a state, but never a red line", () => {
    let s = emptyRequest();
    expect(isReady(s)).toBe(false);
    expect(whatIsMissing(s)).toEqual(["a document", "the state you work in"]);

    s = setDocument(s, doc);
    expect(isReady(s)).toBe(false);
    expect(whatIsMissing(s)).toEqual(["the state you work in"]);

    s = setJurisdiction(s, "California");
    expect(isReady(s)).toBe(true);
    expect(whatIsMissing(s)).toEqual([]);
  });

  it("goes back to not-ready when the document is cleared", () => {
    let s = setJurisdiction(setDocument(emptyRequest(), doc), "Texas");
    s = setDocument(s, null);
    expect(isReady(s)).toBe(false);
  });
});

describe("toAnalysisRequest", () => {
  it("returns null until both a document and a state are present", () => {
    expect(toAnalysisRequest(emptyRequest())).toBeNull();
    expect(toAnalysisRequest(setDocument(emptyRequest(), doc))).toBeNull();
    expect(
      toAnalysisRequest(setJurisdiction(emptyRequest(), "California")),
    ).toBeNull();
  });

  it("carries text, sentences, jurisdiction and red lines", () => {
    let s = setDocument(emptyRequest(), doc);
    s = setJurisdiction(s, "California");
    s = addRedLine(s, "No non-compete");

    const request = toAnalysisRequest(s);
    expect(request).not.toBeNull();
    expect(request!.text).toBe(doc.text);
    expect(request!.sentences).toEqual(doc.sentences);
    expect(request!.jurisdiction).toBe("California");
    expect(request!.redLines.map((r) => r.text)).toEqual(["No non-compete"]);
  });

  it("carries no severity field — promotion belongs to the analysis", () => {
    let s = setDocument(emptyRequest(), doc);
    s = setJurisdiction(s, "California");
    s = addRedLine(s, "No non-compete");
    expect(Object.keys(toAnalysisRequest(s)!.redLines[0]).sort()).toEqual([
      "id",
      "text",
    ]);
  });
});

/* ── Surviving an accidental in-page navigation ──────────────────────── */

const CONTRACT = [
  "You will be employed as a Senior Engineer at Acme Inc. starting on 1 March.",
  "For twelve months after you leave, you will not work for any competitor in any state where the Company does business.",
  "All inventions you create, whether or not on Company time or equipment, are assigned to the Company.",
  "Any dispute will be resolved by binding arbitration in Delaware, and you waive your right to a jury trial.",
].join(" ");

async function readContract() {
  const bytes = new TextEncoder().encode(CONTRACT);
  const result = await parseDocument(
    bytes.buffer.slice(0) as ArrayBuffer,
    "offer.txt",
  );
  if (!result.ok) throw new Error(`fixture text was refused: ${result.refusal.kind}`);
  return result.document;
}

/** Stands in for the browser's store and nothing else — the serialising it
 *  carries is the real thing the shell writes. */
function fakeSessionStorage() {
  const cells = new Map<string, string>();
  return {
    getItem: (key: string) => cells.get(key) ?? null,
    setItem: (key: string, value: string) => void cells.set(key, value),
  };
}

describe("a session that survives a navigation", () => {
  it("brings back the document, the state and the red lines", async () => {
    const parsed = await readContract();
    let before = setDocument(emptyRequest(), parsed);
    before = setJurisdiction(before, "California");
    before = addRedLine(before, "I will not sign an IP assignment covering personal projects");
    before = addRedLine(before, "I will not sign a non-compete longer than six months");

    const store = fakeSessionStorage();
    store.setItem(
      INTAKE_SESSION_KEY,
      serialiseIntake(before, { filename: "offer.txt", source: "yours" }),
    );

    const { state, origin } = await restoreIntake(store.getItem(INTAKE_SESSION_KEY));

    expect(state.document!.text).toBe(parsed.text);
    expect(state.document!.sentences).toEqual(parsed.sentences);
    expect(state.jurisdiction).toBe("California");
    expect(state.redLines).toEqual(before.redLines);
    expect(origin).toEqual({ filename: "offer.txt", source: "yours" });
    expect(isReady(state)).toBe(true);
    expect(whatIsMissing(state)).toEqual([]);
    expect(toAnalysisRequest(state)).toEqual(toAnalysisRequest(before));
  });

  it("brings back a document that can still be quoted from", async () => {
    const parsed = await readContract();
    const before = setJurisdiction(setDocument(emptyRequest(), parsed), "California");

    const { state } = await restoreIntake(
      serialiseIntake(before, { filename: "offer.txt", source: "yours" }),
    );
    const restored = state.document!;

    // Every sentence the reader confirmed on screen is still findable, and
    // the span still slices the stored text back to that exact sentence.
    for (const sentence of parsed.sentences) {
      const span = restored.locate(sentence.text);
      expect(span).not.toBeNull();
      expect(restored.text.slice(span!.start, span!.end)).toBe(sentence.text);
    }

    // Typography a model changes on the way out is still tolerated.
    const quote =
      "All inventions you create, whether or not on Company time or equipment, are assigned to the Company.";
    const spaced = restored.locate(`  ${quote.replace(/ /g, "  ")}\n`);
    expect(spaced).not.toBeNull();
    expect(restored.text.slice(spaced!.start, spaced!.end)).toBe(quote);

    // And a sentence that is not in the document is still refused rather
    // than guessed at.
    expect(
      restored.locate("You may keep any invention you make on your own time."),
    ).toBeNull();
    expect(
      restored.locate(
        "For six months after you leave, you will not work for any competitor in any state where the Company does business.",
      ),
    ).toBeNull();
  });

  it("holds a half-finished intake without pretending it is ready", async () => {
    const half = addRedLine(setJurisdiction(emptyRequest(), "New York"), "No arbitration");

    const { state, origin } = await restoreIntake(serialiseIntake(half, null));

    expect(state.document).toBeNull();
    expect(origin).toBeNull();
    expect(state.jurisdiction).toBe("New York");
    expect(state.redLines.map((r) => r.text)).toEqual(["No arbitration"]);
    expect(isReady(state)).toBe(false);
    expect(whatIsMissing(state)).toEqual(["a document"]);
    expect(toAnalysisRequest(state)).toBeNull();
  });

  it("starts clean when there is nothing to come back to", async () => {
    for (const raw of [null, "", "{", "null", "[]", '"a string"']) {
      const { state, origin } = await restoreIntake(raw);
      expect(state).toEqual(emptyRequest());
      expect(origin).toBeNull();
      expect(isReady(state)).toBe(false);
      expect(whatIsMissing(state)).toEqual(["a document", "the state you work in"]);
    }
  });

  it("drops what did not survive intact rather than half-restoring it", async () => {
    const { state } = await restoreIntake(
      JSON.stringify({
        text: null,
        origin: null,
        jurisdiction: "Ontario",
        redLines: [
          { id: "rl-1", text: "Keep me" },
          { id: "rl-2", text: "   " },
          { id: 7, text: "No id" },
          { text: "No id at all" },
          "not an object",
          null,
        ],
      }),
    );
    expect(state.jurisdiction).toBeNull();
    expect(state.redLines).toEqual([{ id: "rl-1", text: "Keep me" }]);
  });

  it("keeps nothing of the document but its text", async () => {
    const parsed = await readContract();
    const state = setJurisdiction(setDocument(emptyRequest(), parsed), "Texas");
    const written = JSON.parse(
      serialiseIntake(state, { filename: "offer.txt", source: "yours" }),
    ) as Record<string, unknown>;

    expect(Object.keys(written).sort()).toEqual([
      "jurisdiction",
      "origin",
      "redLines",
      "text",
    ]);
    expect(written.text).toBe(parsed.text);
    // Sentences are re-read from the text, never stored: a stored copy would
    // restore alongside a locate that is gone, and break every citation.
    expect(JSON.stringify(written)).not.toContain("sentences");
  });

  it("forgets the document once the reader replaces it", async () => {
    const parsed = await readContract();
    const loaded = setJurisdiction(setDocument(emptyRequest(), parsed), "Texas");
    const cleared = setDocument(loaded, null);

    const { state, origin } = await restoreIntake(
      serialiseIntake(cleared, { filename: "offer.txt", source: "yours" }),
    );
    expect(state.document).toBeNull();
    expect(origin).toBeNull();
    expect(state.jurisdiction).toBe("Texas");
  });

  it("survives more than one navigation", async () => {
    const parsed = await readContract();
    let state = setJurisdiction(setDocument(emptyRequest(), parsed), "Washington");
    state = addRedLine(state, "I will not repay a signing bonus if I am laid off");

    const store = fakeSessionStorage();
    let origin: { filename: string; source: "yours" | "sample" } | null = {
      filename: "offer.txt",
      source: "yours",
    };

    for (let hop = 0; hop < 3; hop += 1) {
      store.setItem(INTAKE_SESSION_KEY, serialiseIntake(state, origin));
      const back = await restoreIntake(store.getItem(INTAKE_SESSION_KEY));
      state = back.state;
      origin = back.origin;
    }

    expect(state.document!.text).toBe(parsed.text);
    expect(state.document!.locate(parsed.sentences[1].text)).not.toBeNull();
    expect(state.jurisdiction).toBe("Washington");
    expect(state.redLines.map((r) => r.text)).toEqual([
      "I will not repay a signing bonus if I am laid off",
    ]);
    expect(origin).toEqual({ filename: "offer.txt", source: "yours" });
  });

  it("remembers a sample loaded from the page as a sample", async () => {
    const parsed = await readContract();
    const state = setJurisdiction(setDocument(emptyRequest(), parsed), "Oregon");
    const { origin } = await restoreIntake(
      serialiseIntake(state, { filename: "sample-offer.txt", source: "sample" }),
    );
    expect(origin).toEqual({ filename: "sample-offer.txt", source: "sample" });
  });
});
