/**
 * Seam 3, run for real. The model client is the one permitted stub; the parser,
 * the gate and the ranking are all the real thing.
 *
 * Every flag in here is obtained the only way a `Flag` can be obtained: by
 * parsing the fixture on disk with the real `parseDocument`, building
 * candidates from the sidecar through the stub, and putting them through the
 * real `verifyFlags`. Nothing hand-builds a flag, because nothing can.
 *
 * Where a test needs a pair that differs at exactly one step of the
 * precedence, it edits the *candidate* — the model's payload, which is the
 * thing a model varies — and leaves the quoted sentence verbatim, so the gate
 * still passes it. That is the only way to isolate a step: the planted clauses
 * differ on several axes at once, and a pair that differs on two steps proves
 * nothing about either.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseDocument, type ParsedDocument } from "../intake/parse-document";
import {
  ANALYSIS_OPERATION,
  analysisSchema,
  type CandidateFlag,
  type ClauseType,
  type Severity,
} from "../model/payloads";
import {
  createStubModelClient,
  loadFixture,
  DEFAULT_FIXTURES_DIR,
  UNDECLARED_RED_LINE_ID,
  type StubCorruption,
} from "../model/stub";
import type { RedLine } from "../intake/analysis-request";
import { verifyFlags, type Flag } from "./verify";
import { DEFAULT_SEVERITY, rankFlags, type RankedFlag } from "./rank";

const FIXTURE = "adhesion-contract" as const;
const fixture = loadFixture(FIXTURE);

async function parseFixture(): Promise<ParsedDocument> {
  const bytes = readFileSync(
    join(DEFAULT_FIXTURES_DIR, fixture.sidecar.document),
  );
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const result = await parseDocument(buffer, fixture.sidecar.document);
  if (!result.ok) {
    throw new Error(`fixture did not parse: ${result.refusal.kind}`);
  }
  return result.document;
}

async function candidates(
  corruptions: StubCorruption[] = [],
): Promise<CandidateFlag[]> {
  const client = createStubModelClient({ fixture: FIXTURE, corruptions });
  const result = await client.complete({
    operation: ANALYSIS_OPERATION,
    system: "Quote the document.",
    user: `Document:\n${fixture.text}`,
    schema: analysisSchema,
  });
  if (!result.ok) throw new Error(`stub failed: ${result.failure.kind}`);
  return result.value.candidates;
}

/** The real gate over the real parsed document. No mock, no shortcut. */
async function gate(given: readonly CandidateFlag[]): Promise<Flag[]> {
  const document = await parseFixture();
  const { flags, dropped } = verifyFlags(given, document);
  expect(dropped).toEqual([]);
  expect(flags.length).toBe(given.length);
  return flags;
}

type Edit = Partial<
  Pick<CandidateFlag, "escapability" | "claimedRedLineId" | "severity">
>;

/**
 * Picks candidates by id, in the order given, and applies per-id edits. Quotes
 * are never touched, so every one of these still has to earn its way through
 * the gate.
 */
function pick(
  all: readonly CandidateFlag[],
  ids: readonly string[],
  edits: Readonly<Record<string, Edit>> = {},
): CandidateFlag[] {
  return ids.map((id) => {
    const found = all.find((candidate) => candidate.id === id);
    if (!found) throw new Error(`fixture has no candidate "${id}"`);
    return { ...found, ...(edits[id] ?? {}) };
  });
}

function ids(ranked: readonly RankedFlag[]): string[] {
  return ranked.map((entry) => entry.flag.id);
}

function idsOfType(clauseType: ClauseType): string[] {
  return fixture.sidecar.expectedFlags
    .filter((flag) => flag.clauseType === clauseType)
    .map((flag) => flag.id);
}

/** The two flags of one clause type furthest apart in the document, so that a
 *  win by the later one cannot be explained by span position. */
function byDocumentOrder(flags: readonly Flag[]): Flag[] {
  return [...flags].sort(
    (a, b) => a.citation.span.start - b.citation.span.start,
  );
}

const NEUTRAL: CandidateFlag["escapability"] = [
  { factor: "scopeOfCoveredDisputes", value: "every dispute under this Agreement" },
];

describe("default severity", () => {
  it("gives each of the four clause types the band PRD §5 sets", async () => {
    const ranked = rankFlags(await gate(await candidates()), []);

    const bands = new Map<string, Severity>(
      ranked.map((entry) => [entry.flag.id, entry.severity]),
    );
    for (const planted of fixture.sidecar.expectedFlags) {
      expect(bands.get(planted.id)).toBe(DEFAULT_SEVERITY[planted.clauseType]);
    }
    expect(DEFAULT_SEVERITY["non-compete"]).toBe("critical");
    expect(DEFAULT_SEVERITY.arbitration).toBe("critical");
    expect(DEFAULT_SEVERITY["ip-assignment"]).toBe("high");
    expect(DEFAULT_SEVERITY["equity-clawback"]).toBe("high");
  });

  it("ignores the band the model asked for and uses the clause type's own", async () => {
    const all = await candidates();
    const nonCompete = idsOfType("non-compete")[0];
    const ip = idsOfType("ip-assignment")[0];

    const ranked = rankFlags(
      await gate(
        pick(all, [nonCompete, ip], {
          // The model demotes the non-compete and promotes the IP clause.
          [nonCompete]: { severity: "high" },
          [ip]: { severity: "critical" },
        }),
      ),
      [],
    );

    expect(ranked[0].flag.id).toBe(nonCompete);
    expect(ranked[0].severity).toBe("critical");
    expect(ranked[1].severity).toBe("high");
  });
});

describe("the precedence, one step at a time", () => {
  it("puts a promoted flag above a higher band", async () => {
    const all = await candidates();
    const nonCompete = idsOfType("non-compete")[0];
    const ip = idsOfType("ip-assignment")[0];
    const redLines: RedLine[] = [
      { id: "no-side-project-grab", text: "Nothing I build on my own time." },
    ];

    const ranked = rankFlags(
      await gate(
        pick(all, [nonCompete, ip], {
          [ip]: { claimedRedLineId: "no-side-project-grab" },
        }),
      ),
      redLines,
    );

    expect(ids(ranked)).toEqual([ip, nonCompete]);
    expect(ranked[0].severity).toBe("high");
    expect(ranked[1].severity).toBe("critical");
  });

  it("puts the higher band above the longer duration and the broader scope", async () => {
    const all = await candidates();
    const nonCompete = idsOfType("non-compete")[0];
    const ip = idsOfType("ip-assignment")[0];

    const ranked = rankFlags(
      await gate(
        pick(all, [nonCompete, ip], {
          [nonCompete]: { escapability: [] },
          [ip]: {
            escapability: [
              { factor: "duration", value: "sixty (60) months" },
              { factor: "coversWorkOutsideWorkingHours", value: "yes" },
              { factor: "coversWorkOffCompanyEquipment", value: "yes" },
            ],
          },
        }),
      ),
      [],
    );

    expect(ids(ranked)).toEqual([nonCompete, ip]);
  });

  it("puts the longer duration first within a band, against span position", async () => {
    const all = await candidates();
    const pair = byDocumentOrder(await gate(pick(all, idsOfType("arbitration"))))
      .map((flag) => flag.id)
      .filter((_, index, list) => index === 0 || index === list.length - 1);
    const [earlier, later] = pair;

    const ranked = rankFlags(
      await gate(
        pick(all, [earlier, later], {
          [earlier]: {
            escapability: [{ factor: "duration", value: "twelve (12) months" }],
          },
          [later]: {
            escapability: [
              { factor: "duration", value: "twenty-four (24) months" },
            ],
          },
        }),
      ),
      [],
    );

    expect(ids(ranked)).toEqual([later, earlier]);
  });

  it("puts the broader scope first where the duration ties", async () => {
    const all = await candidates();
    const pair = byDocumentOrder(await gate(pick(all, idsOfType("arbitration"))))
      .map((flag) => flag.id)
      .filter((_, index, list) => index === 0 || index === list.length - 1);
    const [earlier, later] = pair;
    const duration = { factor: "duration", value: "twelve (12) months" };

    const ranked = rankFlags(
      await gate(
        pick(all, [earlier, later], {
          [earlier]: {
            escapability: [
              duration,
              { factor: "classActionWaiver", value: "no" },
              { factor: "carveOuts", value: "yes, claims under the statute" },
            ],
          },
          [later]: {
            escapability: [
              duration,
              { factor: "classActionWaiver", value: "yes, explicit" },
              { factor: "carveOuts", value: "no" },
            ],
          },
        }),
      ),
      [],
    );

    expect(ids(ranked)).toEqual([later, earlier]);
  });

  it("puts the larger dollar figure first where escapability ties", async () => {
    const all = await candidates();
    const pair = byDocumentOrder(await gate(pick(all, idsOfType("arbitration"))))
      .map((flag) => flag.id)
      .filter((_, index, list) => index === 0 || index === list.length - 1);
    const [earlier, later] = pair;
    const shared = [
      { factor: "duration", value: "twelve (12) months" },
      { factor: "classActionWaiver", value: "yes" },
    ];

    const ranked = rankFlags(
      await gate(
        pick(all, [earlier, later], {
          [earlier]: {
            escapability: [...shared, { factor: "amountAtStake", value: "$5,000" }],
          },
          [later]: {
            escapability: [
              ...shared,
              { factor: "amountAtStake", value: "$40,000" },
            ],
          },
        }),
      ),
      [],
    );

    expect(ids(ranked)).toEqual([later, earlier]);
  });

  it("breaks a complete tie by span position, so nothing is ever tied", async () => {
    const all = await candidates();
    const arbitration = idsOfType("arbitration");
    const flat = Object.fromEntries(
      arbitration.map((id) => [id, { escapability: NEUTRAL }]),
    );

    const flags = await gate(pick(all, [...arbitration].reverse(), flat));
    const ranked = rankFlags(flags, []);

    expect(ranked.length).toBeGreaterThan(1);
    expect(ids(ranked)).toEqual(byDocumentOrder(flags).map((flag) => flag.id));
    for (let i = 1; i < ranked.length; i += 1) {
      expect(ranked[i].flag.citation.span.start).toBeGreaterThan(
        ranked[i - 1].flag.citation.span.start,
      );
    }
    expect(ranked.map((entry) => entry.rank)).toEqual(
      ranked.map((_, index) => index + 1),
    );
  });

  it("ranks a flag whose escapability inputs are missing below one that states them", async () => {
    const all = await candidates();
    const pair = byDocumentOrder(await gate(pick(all, idsOfType("arbitration"))))
      .map((flag) => flag.id)
      .filter((_, index, list) => index === 0 || index === list.length - 1);
    const [earlier, later] = pair;

    const ranked = rankFlags(
      await gate(
        pick(all, [earlier, later], {
          // The earlier sentence states nothing we can read; the later one
          // states a duration. The stated one wins although it comes second in
          // the document.
          [earlier]: {
            escapability: [
              { factor: "duration", value: "not stated in the sentence" },
            ],
          },
          [later]: {
            escapability: [{ factor: "duration", value: "six (6) months" }],
          },
        }),
      ),
      [],
    );

    expect(ids(ranked)).toEqual([later, earlier]);
  });
});

describe("determinism", () => {
  /** A fixed permutation sequence — the shuffle has to be reproducible, or a
   *  failure could not be chased down. */
  function shuffle(list: readonly CandidateFlag[], seed: number): CandidateFlag[] {
    const out = [...list];
    let state = seed;
    for (let i = out.length - 1; i > 0; i -= 1) {
      state = (state * 1103515245 + 12345) % 2147483648;
      const j = state % (i + 1);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  it("ranks a shuffled input identically, over repeated runs", async () => {
    const all = await candidates();
    const expected = ids(rankFlags(await gate(all), []));

    for (let run = 0; run < 3; run += 1) {
      for (const seed of [1, 7, 4242, 99991]) {
        const permuted = shuffle(all, seed + run);
        // A shuffle that did not shuffle would prove nothing.
        expect(permuted.map((candidate) => candidate.id)).not.toEqual(
          all.map((candidate) => candidate.id),
        );
        const ranked = rankFlags(await gate(permuted), []);
        expect(ids(ranked)).toEqual(expected);
      }
    }
    expect(expected.length).toBe(fixture.sidecar.expectedFlags.length);
  });

  it("puts the same flags in the same order whichever end of the list they arrive from", async () => {
    const all = await candidates();
    const forwards = rankFlags(await gate(all), []);
    const backwards = rankFlags(await gate([...all].reverse()), []);

    expect(ids(backwards)).toEqual(ids(forwards));
    expect(backwards.map((e) => e.severity)).toEqual(
      forwards.map((e) => e.severity),
    );
  });
});

describe("promotion", () => {
  const RED_LINE: RedLine = {
    id: "no-signing-bonus-clawback",
    text: "I will not owe money back if I leave.",
  };

  it("lifts a matching flag to the top and names the red line it crossed", async () => {
    const all = await candidates();
    const clawback = idsOfType("equity-clawback")[0];

    const flags = await gate(
      pick(all, all.map((c) => c.id), {
        [clawback]: { claimedRedLineId: RED_LINE.id },
      }),
    );
    const without = rankFlags(flags, []);
    const withRedLine = rankFlags(flags, [RED_LINE]);

    // It was not already first, so first is something the red line did.
    expect(without[0].flag.id).not.toBe(clawback);
    expect(withRedLine[0].flag.id).toBe(clawback);
    expect(withRedLine[0].promotion).toEqual({
      redLineId: RED_LINE.id,
      redLineText: RED_LINE.text,
    });
    expect(withRedLine.slice(1).every((e) => e.promotion === null)).toBe(true);
  });

  it("drops a claimed match to a red line the user never declared", async () => {
    const all = await candidates(["claim-undeclared-red-line"]);
    const flags = await gate(all);

    expect(all.every((c) => c.claimedRedLineId === UNDECLARED_RED_LINE_ID)).toBe(
      true,
    );

    const ranked = rankFlags(flags, [RED_LINE]);
    const unpromoted = rankFlags(flags, []);

    expect(ranked.every((entry) => entry.promotion === null)).toBe(true);
    expect(ids(ranked)).toEqual(ids(unpromoted));
  });

  it("leaves a flag unpromoted when the id matches nothing, even with red lines declared", async () => {
    const all = await candidates();
    const clawback = idsOfType("equity-clawback")[0];

    const ranked = rankFlags(
      await gate(
        pick(all, all.map((c) => c.id), {
          [clawback]: { claimedRedLineId: "a-red-line-from-another-user" },
        }),
      ),
      [RED_LINE],
    );

    expect(ranked.find((e) => e.flag.id === clawback)?.promotion).toBeNull();
    expect(ranked[0].flag.id).not.toBe(clawback);
  });

  it("changes the order and adds a name, and changes no severity", async () => {
    const all = await candidates();
    const clawback = idsOfType("equity-clawback")[0];
    const flags = await gate(
      pick(all, all.map((c) => c.id), {
        [clawback]: { claimedRedLineId: RED_LINE.id },
      }),
    );

    const without = rankFlags(flags, []);
    const withRedLine = rankFlags(flags, [RED_LINE]);

    expect(ids(withRedLine)).not.toEqual(ids(without));
    expect(without.every((e) => e.promotion === null)).toBe(true);
    expect(withRedLine.filter((e) => e.promotion !== null).length).toBe(1);

    const bandOf = (list: RankedFlag[]) =>
      new Map(list.map((e) => [e.flag.id, e.severity]));
    expect([...bandOf(withRedLine).entries()].sort()).toEqual(
      [...bandOf(without).entries()].sort(),
    );
  });

  it("never lowers a severity below the clause type's default, whatever the red lines", async () => {
    const all = await candidates();
    const everyIdClaimed = Object.fromEntries(
      all.map((c) => [c.id, { claimedRedLineId: RED_LINE.id }]),
    );
    const flags = await gate(pick(all, all.map((c) => c.id), everyIdClaimed));

    const runs = [
      rankFlags(flags, []),
      rankFlags(flags, [RED_LINE]),
      rankFlags(flags, [RED_LINE, { id: "another", text: "No arbitration." }]),
    ];

    for (const ranked of runs) {
      for (const entry of ranked) {
        expect(entry.severity).toBe(DEFAULT_SEVERITY[entry.flag.clauseType]);
      }
    }
    expect(runs[1].every((e) => e.promotion !== null)).toBe(true);
  });

  it("promotes without filtering: every flag that went in comes back out", async () => {
    const all = await candidates();
    const clawback = idsOfType("equity-clawback")[0];
    const flags = await gate(
      pick(all, all.map((c) => c.id), {
        [clawback]: { claimedRedLineId: RED_LINE.id },
      }),
    );

    const ranked = rankFlags(flags, [RED_LINE]);

    expect(ids(ranked).sort()).toEqual(flags.map((f) => f.id).sort());
  });
});

describe("purity", () => {
  it("does not touch the flags it was given, and returns the same order twice", async () => {
    const flags = await gate(await candidates());
    const before = flags.map((flag) => flag.id);

    const first = rankFlags(flags, []);
    const second = rankFlags(flags, []);

    expect(flags.map((flag) => flag.id)).toEqual(before);
    expect(ids(first)).toEqual(ids(second));
  });

  it("ranks an empty list to an empty list", () => {
    expect(rankFlags([], [])).toEqual([]);
  });
});
