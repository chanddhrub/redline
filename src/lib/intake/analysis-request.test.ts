import { describe, expect, it } from "vitest";
import {
  addRedLine,
  editRedLine,
  emptyRequest,
  isReady,
  removeRedLine,
  setDocument,
  setJurisdiction,
  toAnalysisRequest,
  US_STATES,
  whatIsMissing,
} from "./analysis-request";
import type { ParsedDocument } from "./parse-document";

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
