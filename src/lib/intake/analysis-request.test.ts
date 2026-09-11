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
