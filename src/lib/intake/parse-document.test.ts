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
