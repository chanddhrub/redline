import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseDocument, type ParsedDocument } from "./parse-document";

const FIXTURES = join(__dirname, "__fixtures__");

function bytes(name: string): ArrayBuffer {
  const buf = readFileSync(join(FIXTURES, name));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

async function parseFixture(name: string) {
  return parseDocument(bytes(name), name);
}

async function offer(): Promise<ParsedDocument> {
  const result = await parseFixture("offer.txt");
  if (!result.ok) throw new Error(`fixture refused: ${result.refusal.kind}`);
  return result.document;
}

describe("parseDocument — what comes back", () => {
  it("accepts plain text and keeps it verbatim", async () => {
    const result = await parseFixture("offer.txt");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const onDisk = readFileSync(join(FIXTURES, "offer.txt"), "utf8");
    expect(result.document.text).toBe(onDisk);
  });

  // The stored text is what the reader is shown and what a flag is quoted
  // from, so a line ending, a run of spaces or a blank first line has to
  // survive intake untouched (ADR 0001).
  it("trims, collapses and reformats nothing on the way in", async () => {
    const result = await parseFixture("whitespace.txt");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const onDisk = readFileSync(join(FIXTURES, "whitespace.txt"), "utf8");
    expect(result.document.text).toBe(onDisk);
    expect(result.document.text.startsWith("\r\n   \r\n")).toBe(true);
    expect(result.document.text.endsWith("\r\n\r\n   ")).toBe(true);
    expect(result.document.text).toContain("Your  start date");
  });

  it("refuses an empty file", async () => {
    const result = await parseFixture("empty.txt");
    expect(result).toEqual({ ok: false, refusal: { kind: "empty" } });
  });

  it("refuses a file that is nothing but whitespace", async () => {
    const blank = new TextEncoder().encode("   \n\t\n  ");
    const result = await parseDocument(
      blank.buffer.slice(
        blank.byteOffset,
        blank.byteOffset + blank.byteLength,
      ) as ArrayBuffer,
      "blank.txt",
    );
    expect(result).toEqual({ ok: false, refusal: { kind: "empty" } });
  });

  it("refuses a PDF by content, not by extension", async () => {
    const result = await parseDocument(bytes("scan.pdf"), "definitely-a-contract.txt");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal).toEqual({ kind: "unsupported-format", detected: "pdf" });
  });

  it("refuses a legacy .doc", async () => {
    const result = await parseFixture("legacy.doc");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal).toEqual({ kind: "unsupported-format", detected: "doc" });
  });

  it("refuses bytes that are not decodable text", async () => {
    const result = await parseFixture("corrupt.bin");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal.kind).toBe("unreadable");
  });
});

describe("sentences", () => {
  it("every offset slices the canonical text back to its own sentence", async () => {
    const doc = await offer();
    expect(doc.sentences.length).toBeGreaterThan(0);
    for (const sentence of doc.sentences) {
      expect(doc.text.slice(sentence.start, sentence.end)).toBe(sentence.text);
    }
  });

  it("does not split on Inc., a section number, or a bracketed numeral", async () => {
    const doc = await offer();
    const whole = doc.sentences.find((s) => s.text.includes("eighteen (18) months"));
    expect(whole?.text).toContain("anywhere in the United States.");

    const withInc = doc.sentences.find((s) => s.text.includes("shall bear the filing fee"));
    expect(withInc?.text.startsWith("Northwind Analytics, Inc.")).toBe(true);

    const withSection = doc.sentences.find((s) => s.text.includes("Section 3.2"));
    expect(withSection?.text).toContain("binding arbitration.");
  });

  it("does not split on e.g., i.e. or No.", async () => {
    const doc = await offer();

    const withEg = doc.sentences.find((s) => s.text.includes("(e.g., source code"));
    expect(withEg?.text).toContain("made on Company equipment.");

    const withNo = doc.sentences.find((s) => s.text.includes("Policy No. 14"));
    expect(withNo?.text).toContain("before your start date.");
    expect(withNo?.text).toContain("i.e., the provisions");
  });

  it("still splits a sentence whose last word merely ends like an abbreviation", async () => {
    const doc = await offer();
    expect(doc.sentences.map((s) => s.text)).toContain(
      "Relocation is not required during your first year.",
    );
  });
});

describe("locate", () => {
  it("finds a sentence quoted back verbatim and the span slices back to it", async () => {
    const doc = await offer();
    for (const sentence of doc.sentences) {
      const span = doc.locate(sentence.text);
      expect(span, `should locate: ${sentence.text.slice(0, 40)}…`).not.toBeNull();
      expect(doc.text.slice(span!.start, span!.end)).toBe(sentence.text);
    }
  });

  it("finds a fragment that spans a sentence boundary", async () => {
    const doc = await offer();
    const fragment = "within thirty (30) days of your last day of employment.\n\n2. Non-competition.";
    const span = doc.locate(fragment);
    expect(span).not.toBeNull();
    expect(doc.text.slice(span!.start, span!.end)).toBe(fragment);
  });

  // The half that matters more: a near-miss is a dropped flag, never a
  // wrong one. Normalisation tolerance is ticket 02 and arrives inside
  // locate without loosening any of these.
  it("returns null for a sentence with one word changed", async () => {
    const doc = await offer();
    expect(
      doc.locate(
        "For a period of twelve (12) months following the termination of your employment for any reason, you shall not, directly or indirectly, engage in or provide services to any business that competes with the Company anywhere in the United States.",
      ),
    ).toBeNull();
  });

  it("returns null for a paraphrase", async () => {
    const doc = await offer();
    expect(
      doc.locate("You may not work for a competitor for eighteen months after leaving."),
    ).toBeNull();
  });

  it("returns null for a plausible sentence from a different document", async () => {
    const doc = await offer();
    expect(
      doc.locate(
        "You agree to assign to the Company all right, title, and interest in any invention.",
      ),
    ).toBeNull();
  });

  it("returns null for an empty quote rather than matching position zero", async () => {
    const doc = await offer();
    expect(doc.locate("")).toBeNull();
  });
});

describe("a long document", () => {
  // Several hundred KB of contract: the case where reading must report its way
  // through rather than stall. Generated here rather than committed, so the
  // fixture directory stays readable.
  function longContract(): { text: string; bytes: ArrayBuffer } {
    const base = readFileSync(join(FIXTURES, "offer.txt"), "utf8");
    let text = "";
    while (text.length < 400_000) text += base + "\n\n";
    const encoded = new TextEncoder().encode(text);
    return {
      text,
      bytes: encoded.buffer.slice(
        encoded.byteOffset,
        encoded.byteOffset + encoded.byteLength,
      ) as ArrayBuffer,
    };
  }

  it("finishes, reports progress on the way, and ends at 1", async () => {
    const { text, bytes } = longContract();
    const seen: number[] = [];
    const result = await parseDocument(bytes, "long-offer.txt", {
      onProgress: (f) => seen.push(f),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.text).toBe(text);

    // More than just the bookends: the read hands the thread back repeatedly,
    // which is what keeps the page painting instead of hanging.
    expect(seen.length).toBeGreaterThan(2);
    expect(seen[0]).toBe(0);
    expect(seen[seen.length - 1]).toBe(1);
    for (const f of seen) {
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
    }
  });

  it("keeps every offset true to the text it indexes", async () => {
    const { bytes } = longContract();
    const result = await parseDocument(bytes, "long-offer.txt");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const doc = result.document;
    expect(doc.sentences.length).toBeGreaterThan(100);
    for (const sentence of doc.sentences) {
      expect(doc.text.slice(sentence.start, sentence.end)).toBe(sentence.text);
    }
  });
});

// ---------------------------------------------------------------------------
// The adversarial corpus. A quote comes back from a model in whatever shape
// its tokeniser left it in; the document is whatever the typesetter produced.
// The positive half says typography must not cost a job seeker a flag. The
// negative half — which matters more — says nothing that is not literally in
// the document may ever be handed back as if it were (ADR 0001, PRD §4 T1/T4).
// ---------------------------------------------------------------------------

const LQ = "“";
const RQ = "”";
const APO = "’";
const FI = "ﬁ";
const FL = "ﬂ";
const SHY = "­";

async function typography(): Promise<ParsedDocument> {
  const result = await parseFixture("typography.txt");
  if (!result.ok) throw new Error(`fixture refused: ${result.refusal.kind}`);
  return result.document;
}

async function whitespace(): Promise<ParsedDocument> {
  const result = await parseFixture("whitespace.txt");
  if (!result.ok) throw new Error(`fixture refused: ${result.refusal.kind}`);
  return result.document;
}

// Sentences exactly as the typography fixture writes them: curly quotes, a
// curly apostrophe, ligatures, a soft hyphen inside a word, a word split by a
// hyphen at a line break, and a compound split at its own hyphen.
const CURLY_QUOTED = `You agree that the term ${LQ}Confidential Information${RQ} means any information the Company designates as confidential, including the Company${APO}s client lists, pricing, and unpublished ${FI}nancial results.`;
const BROKEN_WORD = `You must give the Company sixty (60) days${APO} written notice before resigning, and the Company may waive that notice at its sole discre-\ntion.`;
const SOFT_HYPHENATED = `For twelve (12) months after your last day you shall not solicit any employee of the Company, whether the solici${SHY}tation is direct or indirect.`;
const LIGATURED = `The Company will reimburse your professional membership fees up to $1,200 per year, provided the receipts are ${FI}led within thirty (30) days.`;
const BROKEN_COMPOUND = `Sections 1 through 4 survive termination, including the non-\ncompete obligations described in your offer letter, and the con${FL}ict-of-interest policy.`;

// Passages exactly as the offer fixture writes them: straight quotes, a
// straight apostrophe, no ligatures, a sentence boundary across a blank line.
const OFFER_NAMED = `at Northwind Analytics, Inc. (the "Company"), reporting to the VP of Engineering.`;
const OFFER_PAYROLL = `in accordance with the Company's standard payroll practices.`;
const OFFER_ARBITRATION = `shall be resolved exclusively by final and binding arbitration.`;
const OFFER_REPAY = `you agree to repay the full gross amount of the signing bonus`;
const OFFER_ACROSS_BREAK = `within thirty (30) days of your last day of employment.\n\n2. Non-competition.`;
const OFFER_NON_COMPETE = `For a period of eighteen (18) months following the termination of your employment for any reason, you shall not, directly or indirectly, engage in or provide services to any business that competes with the Company anywhere in the United States.`;
const WHITESPACE_DOUBLED = `Your  start date is 3.2 weeks away.`;

describe("locate — the fixtures say what this corpus is built from", () => {
  it("the typography fixture really contains the typography being exercised", async () => {
    const doc = await typography();
    for (const passage of [
      CURLY_QUOTED,
      BROKEN_WORD,
      SOFT_HYPHENATED,
      LIGATURED,
      BROKEN_COMPOUND,
    ]) {
      expect(doc.text).toContain(passage);
    }
  });

  it("the offer fixture really contains the passages quoted back at it", async () => {
    const doc = await offer();
    for (const passage of [
      OFFER_NAMED,
      OFFER_PAYROLL,
      OFFER_ARBITRATION,
      OFFER_REPAY,
      OFFER_ACROSS_BREAK,
      OFFER_NON_COMPETE,
    ]) {
      expect(doc.text).toContain(passage);
    }
  });
});

type FixtureName = "typography" | "offer" | "whitespace";

const LOAD: Record<FixtureName, () => Promise<ParsedDocument>> = {
  typography,
  offer,
  whitespace,
};

interface Shaped {
  /** Which fixture the sentence is from. */
  fixture: FixtureName;
  /** What the document says, verbatim. */
  canonical: string;
  /** The shape a model hands it back in. */
  quoted: string;
}

const TYPOGRAPHY_SURVIVES: Array<[string, Shaped]> = [
  [
    "straight quotes where the document curls them",
    {
      fixture: "typography",
      canonical: CURLY_QUOTED,
      quoted: CURLY_QUOTED.split(LQ).join('"').split(RQ).join('"').split(APO).join("'"),
    },
  ],
  [
    "curly quotes where the document keeps them straight",
    {
      fixture: "offer",
      canonical: OFFER_NAMED,
      quoted: OFFER_NAMED.replace('"Company"', `${LQ}Company${RQ}`),
    },
  ],
  [
    "a curly apostrophe for a straight one",
    {
      fixture: "offer",
      canonical: OFFER_PAYROLL,
      quoted: OFFER_PAYROLL.replace("Company's", `Company${APO}s`),
    },
  ],
  [
    "a straight apostrophe for a curly one",
    {
      fixture: "typography",
      canonical: BROKEN_WORD,
      quoted: BROKEN_WORD.split(APO).join("'").replace("discre-\ntion", "discretion"),
    },
  ],
  [
    "a ligature spelled out",
    {
      fixture: "typography",
      canonical: LIGATURED,
      quoted: LIGATURED.replace(`${FI}led`, "filed"),
    },
  ],
  [
    "a ligature where the document spells it out",
    {
      fixture: "offer",
      canonical: OFFER_ARBITRATION,
      quoted: OFFER_ARBITRATION.replace("final", `${FI}nal`),
    },
  ],
  [
    "a word rejoined across the line it was broken on",
    {
      fixture: "typography",
      canonical: BROKEN_WORD,
      quoted: BROKEN_WORD.replace("discre-\ntion", "discretion"),
    },
  ],
  [
    "a compound rejoined across the line its hyphen broke on",
    {
      fixture: "typography",
      canonical: BROKEN_COMPOUND,
      quoted: BROKEN_COMPOUND.replace("non-\ncompete", "non-compete"),
    },
  ],
  [
    "a soft hyphen the model dropped",
    {
      fixture: "typography",
      canonical: SOFT_HYPHENATED,
      quoted: SOFT_HYPHENATED.replace(`solici${SHY}tation`, "solicitation"),
    },
  ],
  [
    "a soft hyphen the model added",
    {
      fixture: "offer",
      canonical: OFFER_REPAY,
      quoted: OFFER_REPAY.replace("signing", `sign${SHY}ing`),
    },
  ],
  [
    "whitespace collapsed where the document has a line break",
    {
      fixture: "offer",
      canonical: OFFER_ACROSS_BREAK,
      quoted: OFFER_ACROSS_BREAK.replace("\n\n", " "),
    },
  ],
  [
    "whitespace doubled where the document has one space",
    {
      fixture: "offer",
      canonical: OFFER_ARBITRATION,
      quoted: OFFER_ARBITRATION.split(" ").join("  "),
    },
  ],
  [
    "one space where the document has two",
    {
      fixture: "whitespace",
      canonical: WHITESPACE_DOUBLED,
      quoted: "Your start date is 3.2 weeks away.",
    },
  ],
  [
    "a leading and trailing space",
    {
      fixture: "typography",
      canonical: LIGATURED,
      quoted: `  ${LIGATURED}\n `,
    },
  ],
  [
    "a leading newline and a trailing tab",
    {
      fixture: "offer",
      canonical: OFFER_NON_COMPETE,
      quoted: `\n${OFFER_NON_COMPETE}\t`,
    },
  ],
];

describe("locate — typography does not cost a flag", () => {
  for (const [name, shaped] of TYPOGRAPHY_SURVIVES) {
    it(`finds the sentence given ${name}`, async () => {
      const doc = await LOAD[shaped.fixture]();
      expect(doc.text).toContain(shaped.canonical);

      const span = doc.locate(shaped.quoted);
      expect(span).not.toBeNull();
      // The span indexes the canonical text, so what the reader checked and
      // what the analysis quotes are the same characters.
      expect(doc.text.slice(span!.start, span!.end)).toBe(shaped.canonical);
    });
  }
});

const NEAR_MISSES: Array<[string, FixtureName, string]> = [
  [
    "one word changed",
    "typography",
    BROKEN_WORD.replace("sixty (60)", "ninety (90)").replace("discre-\ntion", "discretion"),
  ],
  [
    "one word changed in a sentence carrying no typography at all",
    "offer",
    OFFER_ARBITRATION.replace("exclusively", "ordinarily"),
  ],
  [
    "a negation flipped",
    "typography",
    SOFT_HYPHENATED.replace("shall not solicit", "shall solicit").replace(SHY, ""),
  ],
  [
    "a number changed",
    "typography",
    LIGATURED.replace("$1,200", "$1,500").replace(FI, "fi"),
  ],
  [
    "a qualifier dropped",
    "offer",
    OFFER_NON_COMPETE.replace("directly or indirectly, ", ""),
  ],
  [
    "a defined term downcased",
    "typography",
    CURLY_QUOTED.replace("Confidential Information", "confidential information"),
  ],
  [
    "a plural made singular",
    "typography",
    LIGATURED.replace(`${FI}led`, "filed").replace("receipts", "receipt"),
  ],
  [
    "a paraphrase",
    "typography",
    "You must give the Company sixty days of written notice before you resign.",
  ],
  [
    "a paraphrase built from the document's own vocabulary",
    "typography",
    "The non-compete obligations described in your offer letter survive termination.",
  ],
  [
    "a plausible sentence from a different fixture",
    "typography",
    OFFER_NON_COMPETE,
  ],
  [
    "a plausible sentence from a different fixture, the other way round",
    "offer",
    LIGATURED.replace(FI, "fi"),
  ],
  [
    "a sentence assembled from two real fragments that never sit together",
    "offer",
    `${OFFER_REPAY} anywhere in the United States.`,
  ],
  [
    "word order swapped",
    "offer",
    OFFER_ARBITRATION.replace("final and binding", "binding and final"),
  ],
  ["a whitespace-only quote", "typography", "   \n\t "],
];

describe("locate — a near-miss is dropped, never guessed at", () => {
  for (const [name, fixture, quote] of NEAR_MISSES) {
    it(`returns null for ${name}`, async () => {
      const doc = await LOAD[fixture]();
      expect(doc.locate(quote)).toBeNull();
    });
  }
});

describe("locate — a quote that appears more than once", () => {
  // Deterministic by construction: the first occurrence in reading order.
  // Every occurrence is the same characters of the same document, so the
  // reader can check any of them; picking the first means the same document
  // and the same quote always produce the same span, which is what T3 asks
  // for. Nothing here guesses which occurrence the model meant.
  it("returns the first occurrence in the canonical text, every time", async () => {
    const doc = await typography();
    const repeated = "the Company";
    expect(doc.text.indexOf(repeated)).toBeGreaterThan(-1);
    expect(doc.text.indexOf(repeated, doc.text.indexOf(repeated) + 1)).toBeGreaterThan(-1);

    const span = doc.locate(repeated);
    expect(span).toEqual({
      start: doc.text.indexOf(repeated),
      end: doc.text.indexOf(repeated) + repeated.length,
    });
    expect(doc.locate(repeated)).toEqual(span);
  });
});

describe("locate — every sentence of the typography fixture still round-trips", () => {
  it("slices the canonical text back to itself", async () => {
    const doc = await typography();
    expect(doc.sentences.length).toBeGreaterThan(0);
    for (const sentence of doc.sentences) {
      const span = doc.locate(sentence.text);
      expect(span, `should locate: ${sentence.text.slice(0, 40)}`).not.toBeNull();
      expect(doc.text.slice(span!.start, span!.end)).toBe(sentence.text);
    }
  });
});
