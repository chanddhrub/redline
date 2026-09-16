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

// ---------------------------------------------------------------------------
// The two binary fixtures. Both are committed bytes, produced by
// `scripts/make-intake-fixtures.mjs`, which says what is in them and why.
//
// `offer.pdf` is a two-page text-layer PDF. Its fourth sentence starts on page
// one and finishes on page two, and the word it breaks on — "infor-mation" —
// is broken at the page boundary itself. That is the case a PDF quote has to
// survive: a clause cut in half by the layout can never be cited whole.
//
// `offer.docx` is a real zip of real WordprocessingML, so the format sniff,
// the unzip and the XML read are all exercised rather than described.
// ---------------------------------------------------------------------------

const PDF_TEXT = [
  "Northwind Analytics, Inc. Offer of Employment.",
  "This letter confirms our offer for the position of Senior Data Engineer.",
  "Your annual base salary will be $185,000, paid in accordance with the Company's standard payroll practices.",
  "For a period of twelve (12) months after your last day you will not solicit any employee of the Company, and you agree that this restriction is reasonable in scope and duration given the confidential infor-\nmation you will receive in the course of your employment.",
  "Any dispute arising out of this letter, including any dispute about Section 3.2, shall be resolved by final and binding arbitration.",
  "Please sign and return this letter before your start date.",
].join("\n");

/** The sentence that runs from the foot of page one to the head of page two,
 *  exactly as the stored text holds it. */
const PDF_ACROSS_THE_PAGE_BREAK =
  "For a period of twelve (12) months after your last day you will not solicit " +
  "any employee of the Company, and you agree that this restriction is reasonable " +
  "in scope and duration given the confidential infor-\nmation you will receive in " +
  "the course of your employment.";

const DOCX_TEXT = [
  "Northwind Analytics, Inc. Offer of Employment.",
  "This letter confirms our offer for the position of Staff Product Designer. Your annual base salary will be $172,500, paid in accordance with the Company's standard payroll practices.",
  "You assign to the Company all right, title and interest in any invention (e.g., source code, designs or written material) that you conceive during your employment, whether or not it was made on Company equipment.",
  "Any dispute arising out of this letter, including any dispute about Section 3.2, shall be resolved exclusively by final and binding arbitration.",
  "Please review Policy No. 14 and return a signed copy before your start date.",
  // mammoth ends every paragraph, the last one included, with a blank line.
  // It is kept: the stored text is whatever the extractor produced.
  "",
].join("\n\n");

async function pdfOffer(): Promise<ParsedDocument> {
  const result = await parseFixture("offer.pdf");
  if (!result.ok) throw new Error(`fixture refused: ${result.refusal.kind}`);
  return result.document;
}

async function docxOffer(): Promise<ParsedDocument> {
  const result = await parseFixture("offer.docx");
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

  // The extension is a claim the file makes about itself. A PDF renamed
  // `.txt` is still read as a PDF, and the name is only ever used in the
  // message shown to the reader.
  it("reads a PDF by content, whatever the filename claims", async () => {
    const result = await parseDocument(bytes("offer.pdf"), "definitely-plain-text.txt");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.text).toBe(PDF_TEXT);
  });

  it("reads a Word file by content, whatever the filename claims", async () => {
    const result = await parseDocument(bytes("offer.docx"), "contract.pdf");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.text).toBe(DOCX_TEXT);
  });

  it("refuses a scanned PDF as having no text layer", async () => {
    const result = await parseFixture("scan.pdf");
    expect(result).toEqual({ ok: false, refusal: { kind: "no-text-layer" } });
  });

  // The one that matters. A copier's header stamp and a page number are text,
  // and a reading built out of them would arrive looking exactly like a
  // reading of the whole document. It is refused as the scan it is.
  //
  // The two PDF fixtures sit either side of the threshold on purpose:
  // `mostly-scan.pdf` carries 34 characters over three pages, `offer.pdf`
  // carries 674 over two. Tuning the threshold upward past roughly 300
  // characters a page needs a longer readable fixture first.
  it("refuses a mostly-scanned PDF as a scan rather than reading its fragments", async () => {
    const result = await parseFixture("mostly-scan.pdf");
    expect(result).toEqual({ ok: false, refusal: { kind: "no-text-layer" } });
  });

  it("refuses a password-protected PDF as encrypted, not as broken", async () => {
    const result = await parseFixture("encrypted.pdf");
    expect(result).toEqual({ ok: false, refusal: { kind: "encrypted" } });
  });

  it("refuses a truncated PDF as unreadable", async () => {
    const result = await parseFixture("truncated.pdf");
    expect(result).toEqual({ ok: false, refusal: { kind: "unreadable" } });
  });

  it("refuses a legacy .doc", async () => {
    const result = await parseFixture("legacy.doc");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal).toEqual({ kind: "unsupported-format", detected: "doc" });
  });

  // The extension is not what decides it: a `.doc` renamed `.docx` is still
  // the old format, and the name only reaches the message on screen.
  it("refuses a legacy Word file by its bytes, whatever it is called", async () => {
    const result = await parseDocument(bytes("legacy.doc"), "offer-letter.docx");
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

  // Intake has no opinion about what a document is. Guessing at that would be
  // guessing at why the reader uploaded it; the analysis can say what it found.
  it("parses a document that is not a contract at all", async () => {
    const result = await parseFixture("not-a-contract.txt");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.text).toBe(
      readFileSync(join(FIXTURES, "not-a-contract.txt"), "utf8"),
    );
    expect(result.document.text).toContain("Ring Mum back.");
    expect(result.document.sentences.length).toBeGreaterThan(1);
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

// ---------------------------------------------------------------------------
// PDF (ticket 03). Everything here runs under the Node test runner with no
// DOM, which is the point: the seam is exercised where the UI is not.
// ---------------------------------------------------------------------------

describe("a text-layer PDF", () => {
  it("comes through as the text the document actually says", async () => {
    const doc = await pdfOffer();
    expect(doc.text).toBe(PDF_TEXT);
  });

  it("keeps every sentence offset true to the text it indexes", async () => {
    const doc = await pdfOffer();
    expect(doc.sentences.length).toBe(6);
    for (const sentence of doc.sentences) {
      expect(doc.text.slice(sentence.start, sentence.end)).toBe(sentence.text);
    }
  });

  it("treats a sentence spanning a page break as one sentence", async () => {
    const doc = await pdfOffer();
    const spanning = doc.sentences.filter((s) => s.text.includes("twelve (12) months"));
    expect(spanning).toHaveLength(1);
    expect(spanning[0].text).toBe(PDF_ACROSS_THE_PAGE_BREAK);
    // Both halves really are on opposite sides of the break: the clause opens
    // on page one and its last words are on page two.
    expect(spanning[0].text).toContain("given the confidential infor-");
    expect(spanning[0].text).toContain("mation you will receive");
  });

  it("locates the page-spanning sentence quoted back verbatim", async () => {
    const doc = await pdfOffer();
    const span = doc.locate(PDF_ACROSS_THE_PAGE_BREAK);
    expect(span).not.toBeNull();
    expect(doc.text.slice(span!.start, span!.end)).toBe(PDF_ACROSS_THE_PAGE_BREAK);
  });

  // The hyphen is the typesetter's, not the author's. A reader quoting the
  // clause writes "information", and losing the span over that would cost
  // them the flag.
  it("locates it with the word the page boundary broke put back together", async () => {
    const doc = await pdfOffer();
    const rejoined = PDF_ACROSS_THE_PAGE_BREAK.replace("infor-\nmation", "information");
    expect(rejoined).not.toBe(PDF_ACROSS_THE_PAGE_BREAK);

    const span = doc.locate(rejoined);
    expect(span).not.toBeNull();
    expect(doc.text.slice(span!.start, span!.end)).toBe(PDF_ACROSS_THE_PAGE_BREAK);
  });

  it("locates a fragment that starts on one page and ends on the next", async () => {
    const doc = await pdfOffer();
    const fragment = "given the confidential information you will receive";
    const span = doc.locate(fragment);
    expect(span).not.toBeNull();
    expect(doc.text.slice(span!.start, span!.end)).toBe(
      "given the confidential infor-\nmation you will receive",
    );
  });

  it("locates every one of its sentences and slices back to each", async () => {
    const doc = await pdfOffer();
    for (const sentence of doc.sentences) {
      const span = doc.locate(sentence.text);
      expect(span, `should locate: ${sentence.text.slice(0, 40)}`).not.toBeNull();
      expect(doc.text.slice(span!.start, span!.end)).toBe(sentence.text);
    }
  });

  it("still returns null for a page-spanning sentence with one number changed", async () => {
    const doc = await pdfOffer();
    const altered = PDF_ACROSS_THE_PAGE_BREAK
      .replace("twelve (12)", "twenty-four (24)")
      .replace("infor-\nmation", "information");
    expect(doc.locate(altered)).toBeNull();
  });

  it("still returns null for a paraphrase of the page-spanning sentence", async () => {
    const doc = await pdfOffer();
    expect(
      doc.locate(
        "You may not solicit any Company employee for a year after you leave, because of the confidential information you saw.",
      ),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// DOCX (ticket 04).
// ---------------------------------------------------------------------------

describe("a Word document", () => {
  it("comes through as the text the document actually says", async () => {
    const doc = await docxOffer();
    expect(doc.text).toBe(DOCX_TEXT);
  });

  it("keeps every sentence offset true to the text it indexes", async () => {
    const doc = await docxOffer();
    expect(doc.sentences.length).toBe(6);
    for (const sentence of doc.sentences) {
      expect(doc.text.slice(sentence.start, sentence.end)).toBe(sentence.text);
    }
  });

  it("does not split a clause on e.g., No. or a section number", async () => {
    const doc = await docxOffer();

    const withEg = doc.sentences.find((s) => s.text.includes("(e.g., source code"));
    expect(withEg?.text).toContain("made on Company equipment.");

    const withSection = doc.sentences.find((s) => s.text.includes("Section 3.2"));
    expect(withSection?.text).toContain("binding arbitration.");

    const withNo = doc.sentences.find((s) => s.text.includes("Policy No. 14"));
    expect(withNo?.text).toContain("before your start date.");
  });

  it("locates every one of its sentences and slices back to each", async () => {
    const doc = await docxOffer();
    for (const sentence of doc.sentences) {
      const span = doc.locate(sentence.text);
      expect(span, `should locate: ${sentence.text.slice(0, 40)}`).not.toBeNull();
      expect(doc.text.slice(span!.start, span!.end)).toBe(sentence.text);
    }
  });

  it("locates a clause quoted with a curly apostrophe and collapsed whitespace", async () => {
    const doc = await docxOffer();
    const canonical =
      "Your annual base salary will be $172,500, paid in accordance with the Company's standard payroll practices.";
    expect(doc.text).toContain(canonical);

    const span = doc.locate(`  ${canonical.replace("Company's", `Company${APO}s`)}\n`);
    expect(span).not.toBeNull();
    expect(doc.text.slice(span!.start, span!.end)).toBe(canonical);
  });

  it("returns null for a clause that belongs to the PDF fixture", async () => {
    const doc = await docxOffer();
    expect(doc.locate("Please sign and return this letter before your start date.")).toBeNull();
  });

  it("returns null for one of its own clauses with a qualifier dropped", async () => {
    const doc = await docxOffer();
    expect(
      doc.locate(
        "Any dispute arising out of this letter, including any dispute about Section 3.2, shall be resolved by final and binding arbitration.",
      ),
    ).toBeNull();
  });
});
