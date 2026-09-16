/**
 * The labelled second layer, run through the real pipeline (ticket 07).
 *
 * The centre of this file is the leak test. ADR 0005 lets this product say one
 * kind of thing it cannot cite a sentence for, on the condition that the thing
 * it says cannot move anything the reader checks. So the pipeline is run twice
 * over the same fixture — once with the layer, once without — and the two
 * ranked outputs are compared flag for flag, band for band, position for
 * position. A difference is a leak, and a leak means the condition ADR 0005
 * set has been broken.
 *
 * The other half is the absence of a span. There is no field on a note to put
 * one in, which the compiler enforces; the runtime assertions below are there
 * for the route boundary, where a note becomes JSON and the type stops
 * travelling with it.
 *
 * As everywhere in this suite, the model client is the only stub. The gate,
 * the ranking, the parser and the lookup all run for real.
 */

import { describe, expect, it } from "vitest";
import { parseDocument } from "../intake/parse-document";
import { US_STATES, type AnalysisRequest, type UsState } from "../intake/analysis-request";
import { CLAUSE_TYPES, type ClauseType } from "../model/payloads";
import { createStubModelClient, loadFixture, type FixtureName } from "../model/stub";
import { analyse, type Analysis } from "./analyse";
import {
  enforceabilityNotes,
  governingLawStates,
  notesForTopic,
  stateNamedIn,
  type EnforceabilityNote,
  type EnforceabilityTopic,
} from "./enforceability";
import { ENFORCEABILITY_SET, SET_WRITTEN } from "./enforceability-set";

const FIXTURES: FixtureName[] = ["adhesion-contract", "clean-offer"];

async function requestFor(
  name: FixtureName,
  jurisdiction: UsState,
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
    jurisdiction,
    redLines: [],
  };
}

/** The route's own call, made the route's own way: the notes are looked up
 *  from the request's state and handed in. `withLayer: false` is the same run
 *  with the second argument missing, which is the only difference. */
async function run(
  name: FixtureName,
  jurisdiction: UsState,
  withLayer = true,
): Promise<Analysis> {
  const request = await requestFor(name, jurisdiction);
  const outcome = await analyse(request, createStubModelClient(), {
    context: withLayer ? enforceabilityNotes(request.jurisdiction) : undefined,
  });
  if (!outcome.ok) {
    throw new Error(`analysis failed: ${JSON.stringify(outcome.failure)}`);
  }
  return outcome.analysis;
}

/** Everything about the ranked list a note is forbidden to touch: which flags
 *  there are, what band each one is in, and where each one sits. */
function ranking(analysis: Analysis) {
  return analysis.flags.map((ranked) => ({
    rank: ranked.rank,
    id: ranked.flag.id,
    clauseType: ranked.flag.clauseType,
    severity: ranked.severity,
    flagSeverity: ranked.flag.severity,
    promoted: ranked.promotion !== null,
    span: ranked.flag.citation.span,
  }));
}

describe("a note has no sentence behind it, and no way to grow one", () => {
  it("carries no span and no citation, in every state", async () => {
    for (const state of US_STATES) {
      for (const note of enforceabilityNotes(state)) {
        const keys = Object.keys(note).sort();
        expect(keys).toEqual(["asOf", "basis", "register", "statement", "topic"]);
        expect(JSON.stringify(note)).not.toContain("span");
      }
    }
  });

  it("cannot be given one", () => {
    const note: EnforceabilityNote = {
      register: "general",
      topic: "non-compete",
      statement: "California voids employee non-compete clauses.",
      basis: "Cal. Bus. & Prof. Code section 16600",
      asOf: SET_WRITTEN,
    };

    // @ts-expect-error a note has nowhere to put a span, and that is the point
    const forged: EnforceabilityNote = { ...note, span: { start: 0, end: 4 } };
    // @ts-expect-error nor a citation, which only the gate can mint
    const merged: EnforceabilityNote = { ...note, citation: { text: "", span: null } };

    // The assignments above are what is being tested; reading them keeps the
    // compiler from treating them as unused and deleting the check.
    expect(typeof forged).toBe("object");
    expect(typeof merged).toBe("object");
  });

  it("survives the JSON trip without picking up evidence", async () => {
    const analysis = await run("adhesion-contract", "California");
    const overTheWire = JSON.parse(JSON.stringify(analysis.context)) as unknown[];

    expect(overTheWire.length).toBeGreaterThan(0);
    for (const note of overTheWire) {
      expect(Object.keys(note as object).sort()).toEqual([
        "asOf",
        "basis",
        "register",
        "statement",
        "topic",
      ]);
    }
  });
});

describe("the layer cannot move a flag", () => {
  for (const name of FIXTURES) {
    it(`ranks ${name} identically with the layer and without it`, async () => {
      const withLayer = await run(name, "California", true);
      const without = await run(name, "California", false);

      expect(without.context).toEqual([]);
      expect(withLayer.context.length).toBeGreaterThan(0);
      expect(ranking(withLayer)).toEqual(ranking(without));
      expect(withLayer.coverage).toEqual(without.coverage);
      expect(withLayer.summary).toEqual(without.summary);
    });
  }

  it("gives a Californian and a Texan the same flags in the same order", async () => {
    const californian = await run("adhesion-contract", "California");
    const texan = await run("adhesion-contract", "Texas");

    expect(ranking(californian)).toEqual(ranking(texan));
    expect(californian.coverage).toEqual(texan.coverage);
  });

  it("gives a Californian and a Texan different notes", async () => {
    const californian = await run("adhesion-contract", "California");
    const texan = await run("adhesion-contract", "Texas");

    expect(californian.context).not.toEqual(texan.context);

    const nonCompete = (analysis: Analysis) =>
      notesForTopic(analysis.context, "non-compete").map((note) => note.basis);

    expect(nonCompete(californian)).toEqual([
      "Cal. Bus. & Prof. Code §16600 and §16600.5 (SB 699, in force 1 January 2024)",
    ]);
    expect(nonCompete(texan)).toEqual(["Tex. Bus. & Com. Code §§15.50–15.51"]);
  });

  it("puts the Californian non-compete position beside a non-compete flag at its own band", async () => {
    const analysis = await run("adhesion-contract", "California");

    const flag = analysis.flags.find(
      (ranked) => ranked.flag.clauseType === "non-compete",
    );
    expect(flag).toBeDefined();

    const beside = notesForTopic(analysis.context, "non-compete");
    expect(beside.length).toBe(1);
    expect(beside[0].statement).toContain("California voids employee non-compete clauses");

    // The scenario ADR 0005 was written for: the note is there, and the flag
    // it sits beside is banded and placed exactly as it is for a Texan.
    const texan = await run("adhesion-contract", "Texas");
    const texanFlag = texan.flags.find(
      (ranked) => ranked.flag.clauseType === "non-compete",
    );
    expect(flag!.severity).toBe(texanFlag!.severity);
    expect(flag!.rank).toBe(texanFlag!.rank);
  });
});

describe("silence where there is nothing to say", () => {
  it("returns no note rather than a hedge for a clause type it has not covered", () => {
    for (const state of US_STATES) {
      expect(notesForTopic(enforceabilityNotes(state), "equity-clawback")).toEqual([]);
    }
    expect(notesForTopic(enforceabilityNotes("Texas"), "ip-assignment")).toEqual([]);
    expect(notesForTopic(enforceabilityNotes("Alaska"), "non-compete")).toEqual([]);
  });

  it("never reaches for the hedged sentence ADR 0004 rules out", () => {
    const hedges = [
      "varies by state",
      "may or may not",
      "it depends",
      "generally speaking",
      "consult an attorney",
      "we are not lawyers",
      "this is not legal advice",
    ];
    for (const entry of ENFORCEABILITY_SET) {
      const text = entry.statement.toLowerCase();
      for (const hedge of hedges) expect(text).not.toContain(hedge);
    }
  });

  it("records a source and a checkable date against every statement", () => {
    for (const entry of ENFORCEABILITY_SET) {
      expect(entry.basis.length).toBeGreaterThan(8);
      expect(entry.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(entry.asOf))).toBe(false);
      expect(entry.statement.trim().length).toBeGreaterThan(40);
    }
  });

  it("keys every note to a topic the interface can place it against", () => {
    const topics: EnforceabilityTopic[] = [...CLAUSE_TYPES, "governing-law"];
    for (const entry of ENFORCEABILITY_SET) {
      expect(topics).toContain(entry.topic);
    }
  });

  it("returns the same notes in the same order every time it is asked", () => {
    for (const state of ["California", "Texas", "Washington"] as UsState[]) {
      expect(enforceabilityNotes(state)).toEqual(enforceabilityNotes(state));
    }
  });
});

describe("the governing-law clause, which is in the document", () => {
  for (const name of FIXTURES) {
    it(`slices ${name}'s canonical text back exactly`, async () => {
      const request = await requestFor(name, "California");
      const analysis = await run(name, "California");

      expect(analysis.governingLaw).not.toBeNull();
      const { span, text } = analysis.governingLaw!;
      expect(request.text.slice(span.start, span.end)).toBe(text);
    });
  }

  it("names the document's state separately from the reader's", async () => {
    const analysis = await run("adhesion-contract", "California");
    const states = governingLawStates(analysis.governingLaw!.text, "California");

    expect(states.named).toBe("Texas");
    expect(states.worksIn).toBe("California");
    expect(states.differ).toBe(true);
  });

  it("says the two agree where they do", async () => {
    const analysis = await run("clean-offer", "California");
    const states = governingLawStates(analysis.governingLaw!.text, "California");

    expect(states.named).toBe("California");
    expect(states.worksIn).toBe("California");
    expect(states.differ).toBe(false);
  });

  it("reads the state out of the sentence rather than near it", () => {
    expect(stateNamedIn("governed by the laws of the State of West Virginia.")).toBe(
      "West Virginia",
    );
    expect(stateNamedIn("governed by Virginia law, venue in New York.")).toBe(
      "Virginia",
    );
    expect(stateNamedIn("governed by the laws of England and Wales.")).toBeNull();
    expect(stateNamedIn("Indianapolis is the venue.")).toBeNull();
    expect(stateNamedIn("the laws of the District of Columbia apply")).toBe(
      "District of Columbia",
    );
  });

  it("puts the Californian choice-of-law position on the labelled layer, not beside the quote", async () => {
    const analysis = await run("adhesion-contract", "California");
    const notes = notesForTopic(analysis.context, "governing-law");

    expect(notes.length).toBe(1);
    expect(notes[0].register).toBe("general");
    expect(notes[0].basis).toBe("Cal. Bus. & Prof. Code §16600.5(a)");
    // The claim about what the Texas choice of law achieves lives here, and
    // nowhere near the citation it would otherwise borrow credibility from.
    expect(JSON.stringify(analysis.governingLaw)).not.toContain(notes[0].statement);
  });
});

describe("what the starting set actually covers", () => {
  it("keys arbitration's federal position to every state", () => {
    for (const state of US_STATES) {
      const notes = notesForTopic(enforceabilityNotes(state), "arbitration");
      expect(notes.some((note) => note.basis.startsWith("9 U.S.C."))).toBe(true);
    }
  });

  it("covers the clause types it claims and no others", () => {
    const covered = new Set<ClauseType | "governing-law">(
      ENFORCEABILITY_SET.map((entry) => entry.topic),
    );
    expect(covered.has("non-compete")).toBe(true);
    expect(covered.has("arbitration")).toBe(true);
    expect(covered.has("ip-assignment")).toBe(true);
    expect(covered.has("governing-law")).toBe(true);
    expect(covered.has("equity-clawback")).toBe(false);
  });

  it("leaves most states with nothing on non-competes, which is the honest number", () => {
    const withNote = US_STATES.filter(
      (state) => notesForTopic(enforceabilityNotes(state), "non-compete").length > 0,
    );
    expect(withNote.sort()).toEqual(
      [
        "California",
        "Colorado",
        "Minnesota",
        "North Dakota",
        "Oklahoma",
        "Texas",
        "Washington",
      ].sort(),
    );
  });
});
