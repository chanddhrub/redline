import { describe, expect, it } from "vitest";
import {
  mergeRedLines,
  redLinesFrom,
  RED_LINE_COLUMNS,
  rowsFor,
  sameRedLines,
  type RedLineRow,
} from "./red-lines";
import { idsToRemove } from "./store";
import { readAccountConfig } from "./config";
import {
  addRedLine,
  emptyRequest,
  setDocument,
  type RedLine,
} from "../intake/analysis-request";
import { parseDocument, type ParsedDocument } from "../intake/parse-document";

const OWNER = "8b1d6c5a-0000-4000-8000-000000000001";

function lines(...texts: string[]): RedLine[] {
  return texts.map((text, i) => ({ id: `rl-${i + 1}`, text }));
}

/**
 * A real document, read by the real parser, so the test below is asking
 * whether the write path can carry the reader's contract — not whether a
 * string constant can.
 */
const OFFER = [
  "Employee shall not, for a period of twenty-four (24) months following termination,",
  "engage in any business that competes with the Company anywhere in the United States.",
  "Base salary shall be $184,500 per annum, payable semi-monthly.",
  "All inventions conceived during employment are assigned to the Company.",
].join(" ");

async function readOffer(): Promise<ParsedDocument> {
  const bytes = new TextEncoder().encode(OFFER);
  const result = await parseDocument(bytes.buffer.slice(0) as ArrayBuffer, "offer.txt");
  if (!result.ok) throw new Error("the fixture text should parse");
  return result.document;
}

describe("whether this build has an account behind it", () => {
  it("has one when both variables are set", () => {
    expect(
      readAccountConfig({ url: "https://abc.supabase.co", anonKey: "anon-key" }),
    ).toEqual({ url: "https://abc.supabase.co", anonKey: "anon-key" });
  });

  it("has none when the variables are absent, which is a working state", () => {
    expect(readAccountConfig({ url: undefined, anonKey: undefined })).toBeNull();
  });

  it("has none on half a configuration, rather than a client that throws later", () => {
    expect(readAccountConfig({ url: "https://abc.supabase.co", anonKey: undefined })).toBeNull();
    expect(readAccountConfig({ url: undefined, anonKey: "anon-key" })).toBeNull();
  });

  it("treats blank and whitespace-only values as absent", () => {
    expect(readAccountConfig({ url: "  ", anonKey: "anon-key" })).toBeNull();
    expect(readAccountConfig({ url: "https://abc.supabase.co", anonKey: "" })).toBeNull();
  });

  it("trims what it accepts, because a trailing newline in an env file is not part of a URL", () => {
    expect(
      readAccountConfig({ url: "https://abc.supabase.co\n", anonKey: " anon-key " }),
    ).toEqual({ url: "https://abc.supabase.co", anonKey: "anon-key" });
  });
});

describe("what is written", () => {
  it("writes four columns and no others", () => {
    const rows = rowsFor(OWNER, lines("No non-compete longer than six months"));
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]).sort()).toEqual([...RED_LINE_COLUMNS].sort());
  });

  it("stores the reader's wording exactly as typed", () => {
    const typed = "  I will NOT sign an IP assignment covering personal projects  ";
    const [row] = rowsFor(OWNER, [{ id: "rl-1", text: typed }]);
    expect(row.text).toBe(typed);
  });

  it("numbers the lines in the order the reader put them in", () => {
    const rows = rowsFor(OWNER, lines("first", "second", "third"));
    expect(rows.map((r) => r.ordinal)).toEqual([0, 1, 2]);
    expect(rows.map((r) => r.text)).toEqual(["first", "second", "third"]);
  });

  it("stamps every row with the owner, so a row cannot be written unattached", () => {
    const rows = rowsFor(OWNER, lines("a", "b"));
    expect(rows.every((r) => r.owner === OWNER)).toBe(true);
  });

  it("refuses to build rows with no owner rather than returning an empty list", () => {
    // An empty list would read downstream as "this reader has nothing", and
    // the save that follows would delete everything they had.
    expect(() => rowsFor("", lines("a"))).toThrow(/owner/i);
  });

  it("drops blank and whitespace-only lines, which the table refuses anyway", () => {
    const rows = rowsFor(OWNER, [
      { id: "rl-1", text: "No unpaid overtime" },
      { id: "rl-2", text: "   " },
      { id: "rl-3", text: "" },
    ]);
    expect(rows.map((r) => r.text)).toEqual(["No unpaid overtime"]);
    expect(rows.map((r) => r.ordinal)).toEqual([0]);
  });
});

describe("the document's text cannot reach the database", () => {
  it("carries nothing of the document even when the whole request is in hand", async () => {
    const document = await readOffer();
    let state = setDocument(emptyRequest(), document);
    state = addRedLine(state, "No non-compete longer than six months");
    state = addRedLine(state, "No assignment of personal projects");

    const rows = rowsFor(OWNER, state.redLines);
    const written = JSON.stringify(rows);

    // Every sentence the parser found, and the salary in the middle of it.
    for (const sentence of document.sentences) {
      expect(written).not.toContain(sentence.text);
    }
    expect(written).not.toContain("$184,500");
    expect(written).not.toContain(document.text);
  });

  it("drops anything smuggled onto a red line, because each field is copied by name", () => {
    const smuggled = {
      id: "rl-1",
      text: "No non-compete longer than six months",
      // What a widened type or a careless spread would carry through.
      document: OFFER,
      sentences: [{ text: OFFER, start: 0, end: OFFER.length }],
    } as unknown as RedLine;

    const rows = rowsFor(OWNER, [smuggled]);
    expect(Object.keys(rows[0]).sort()).toEqual([...RED_LINE_COLUMNS].sort());
    expect(JSON.stringify(rows)).not.toContain("184,500");
  });

  it("names only columns the migration declares", () => {
    // The table in `supabase/migrations` has no column for document text, and
    // this is the list the application writes to it.
    expect([...RED_LINE_COLUMNS]).toEqual(["id", "owner", "text", "ordinal"]);
  });
});

describe("what is read back", () => {
  it("round-trips a reader's lines through rows and back unchanged", () => {
    const mine = lines(
      "No non-compete longer than six months",
      "Nothing that assigns what I build on weekends",
      "No fee if they let me go",
    );
    const rows = rowsFor(OWNER, mine);
    expect(redLinesFrom(rows)).toEqual(mine);
  });

  it("survives the trip through JSON, which is how the rows actually arrive", () => {
    const mine = lines("No exclusivity clause", "No relocation without notice");
    const overTheWire: unknown = JSON.parse(JSON.stringify(rowsFor(OWNER, mine)));
    expect(redLinesFrom(overTheWire)).toEqual(mine);
  });

  it("restores the reader's own order from the stored positions, not the row order", () => {
    const shuffled: RedLineRow[] = [
      { id: "rl-3", owner: OWNER, text: "third", ordinal: 2 },
      { id: "rl-1", owner: OWNER, text: "first", ordinal: 0 },
      { id: "rl-2", owner: OWNER, text: "second", ordinal: 1 },
    ];
    expect(redLinesFrom(shuffled).map((l) => l.text)).toEqual([
      "first",
      "second",
      "third",
    ]);
  });

  it("drops a row that is not two strings rather than half-restoring it", () => {
    const mixed = [
      { id: "rl-1", text: "No non-compete", ordinal: 0 },
      { id: 7, text: "No non-compete", ordinal: 1 },
      { id: "rl-3", text: null, ordinal: 2 },
      { id: "rl-4", text: "   ", ordinal: 3 },
      null,
      "rl-5",
    ];
    expect(redLinesFrom(mixed)).toEqual([{ id: "rl-1", text: "No non-compete" }]);
  });

  it("reads nothing out of a body that is not a list of rows", () => {
    expect(redLinesFrom(null)).toEqual([]);
    expect(redLinesFrom({ message: "permission denied" })).toEqual([]);
    expect(redLinesFrom(undefined)).toEqual([]);
  });
});

describe("signing in on a page the reader has already typed on", () => {
  it("keeps both lists, kept lines first", () => {
    const keptLines = [{ id: "a", text: "No non-compete" }];
    const typed = [{ id: "b", text: "No weekend work assigned to them" }];
    expect(mergeRedLines(keptLines, typed)).toEqual([...keptLines, ...typed]);
  });

  it("does not duplicate a line that is on both sides", () => {
    const keptLines = [
      { id: "a", text: "No non-compete" },
      { id: "b", text: "No IP assignment" },
    ];
    const typed = [{ id: "b", text: "No IP assignment" }];
    expect(mergeRedLines(keptLines, typed)).toEqual(keptLines);
  });

  it("prefers the kept wording when the same line was edited in this sitting", () => {
    // Same line, two wordings. The id is the identity, so there is one line
    // afterwards rather than two saying almost the same thing.
    const keptLines = [{ id: "a", text: "No non-compete at all" }];
    const typed = [{ id: "a", text: "No non-compete longer than six months" }];
    expect(mergeRedLines(keptLines, typed)).toEqual(keptLines);
  });

  it("gives a first sitting back exactly what was typed", () => {
    const typed = lines("No non-compete", "No IP assignment");
    expect(mergeRedLines([], typed)).toEqual(typed);
  });

  it("gives a fresh tab back exactly what was kept", () => {
    const keptLines = lines("No non-compete", "No IP assignment");
    expect(mergeRedLines(keptLines, [])).toEqual(keptLines);
  });
});

describe("what counts as a change worth writing", () => {
  it("is not a change when the same lines are in the same order", () => {
    expect(sameRedLines(lines("a", "b"), lines("a", "b"))).toBe(true);
  });

  it("is a change when the wording moves", () => {
    const before = [{ id: "rl-1", text: "No non-compete" }];
    const after = [{ id: "rl-1", text: "No non-compete longer than six months" }];
    expect(sameRedLines(before, after)).toBe(false);
  });

  it("is a change when the order moves", () => {
    const before = lines("a", "b");
    expect(sameRedLines(before, [before[1], before[0]])).toBe(false);
  });

  it("is a change when a line is added or removed", () => {
    expect(sameRedLines(lines("a"), lines("a", "b"))).toBe(false);
    expect(sameRedLines(lines("a", "b"), lines("a"))).toBe(false);
  });
});

describe("saving is a replacement, not an append", () => {
  it("removes the kept lines the reader has since deleted", () => {
    const keeping = rowsFor(OWNER, lines("still here"));
    expect(idsToRemove(["rl-1", "rl-9"], keeping)).toEqual(["rl-9"]);
  });

  it("removes everything when the reader has emptied the list", () => {
    expect(idsToRemove(["rl-1", "rl-2"], [])).toEqual(["rl-1", "rl-2"]);
  });

  it("removes nothing on a first save", () => {
    expect(idsToRemove([], rowsFor(OWNER, lines("a", "b")))).toEqual([]);
  });

  it("removes a line whose text is blank, because a blank line was never written", () => {
    const keeping = rowsFor(OWNER, [
      { id: "rl-1", text: "kept" },
      { id: "rl-2", text: "   " },
    ]);
    expect(idsToRemove(["rl-1", "rl-2"], keeping)).toEqual(["rl-2"]);
  });
});
