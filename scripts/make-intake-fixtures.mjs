/**
 * Writes the two binary intake fixtures: a text-layer PDF and a DOCX.
 *
 * They are committed, so this script exists to say where the bytes came from
 * and to let anyone regenerate them. Nothing in the repository produces a PDF
 * or a Word file, and both formats are writable by hand: a PDF is a text
 * format with a byte-offset table, and a DOCX is a zip of XML.
 *
 *   node scripts/make-intake-fixtures.mjs
 *
 * The prose is deliberately chosen, not filler:
 *
 *   - `offer.pdf` breaks a sentence across its page boundary, and breaks the
 *     word "infor-mation" at that same boundary. Both are the cases a quote
 *     has to survive for a PDF flag to be citable at all.
 *   - `offer.docx` carries the section numbers and abbreviations that a naive
 *     sentence splitter cuts in half.
 *
 * Changing the prose changes what the tests assert. The test file holds the
 * expected text; keep the two in step.
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

const FIXTURES = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "lib",
  "intake",
  "__fixtures__",
);

/* ---------------------------------------------------------------------- PDF */

/** One `Tj` per entry, one entry per typeset line. The first page ends
 *  mid-sentence, on a hyphen, mid-word. */
const PDF_PAGE_ONE = [
  "Northwind Analytics, Inc. Offer of Employment.",
  "This letter confirms our offer for the position of Senior Data Engineer.",
  "Your annual base salary will be $185,000, paid in accordance with the",
  "Company's standard payroll practices.",
  "For a period of twelve (12) months after your last day you will not solicit",
  "any employee of the Company, and you agree that this restriction is",
  "reasonable in scope and duration given the confidential infor-",
];

const PDF_PAGE_TWO = [
  "mation you will receive in the course of your employment.",
  "Any dispute arising out of this letter, including any dispute about",
  "Section 3.2, shall be resolved by final and binding arbitration.",
  "Please sign and return this letter before your start date.",
];

/** PDF string literals escape the delimiters and the escape character. */
function pdfString(line) {
  return `(${line.replace(/([\\()])/g, "\\$1")}) Tj`;
}

/** Leading (`TL`) plus `T*` puts each line on its own baseline, which is what
 *  makes the extractor see a line break rather than one long run. */
function contentStream(lines) {
  return [
    "BT",
    "/F1 11 Tf",
    "14 TL",
    "72 720 Td",
    lines.map(pdfString).join("\nT*\n"),
    "ET",
    "",
  ].join("\n");
}

function buildPdf() {
  const streamOne = contentStream(PDF_PAGE_ONE);
  const streamTwo = contentStream(PDF_PAGE_TWO);

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] " +
      "/Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] " +
      "/Resources << /Font << /F1 5 0 R >> >> /Contents 7 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    `<< /Length ${Buffer.byteLength(streamOne, "latin1")} >>\nstream\n${streamOne}endstream`,
    `<< /Length ${Buffer.byteLength(streamTwo, "latin1")} >>\nstream\n${streamTwo}endstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefAt = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const at of offsets) {
    pdf += `${String(at).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefAt}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1");
}

/* --------------------------------------------------------------------- DOCX */

const DOCX_PARAGRAPHS = [
  "Northwind Analytics, Inc. Offer of Employment.",
  "This letter confirms our offer for the position of Staff Product Designer. " +
    "Your annual base salary will be $172,500, paid in accordance with the Company's " +
    "standard payroll practices.",
  "You assign to the Company all right, title and interest in any invention " +
    "(e.g., source code, designs or written material) that you conceive during your " +
    "employment, whether or not it was made on Company equipment.",
  "Any dispute arising out of this letter, including any dispute about Section 3.2, " +
    "shall be resolved exclusively by final and binding arbitration.",
  "Please review Policy No. 14 and return a signed copy before your start date.",
];

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;

function xmlEscape(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function documentXml(paragraphs) {
  const body = paragraphs
    .map((p) => `<w:p><w:r><w:t xml:space="preserve">${xmlEscape(p)}</w:t></w:r></w:p>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr/></w:body></w:document>`;
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

/** A deflate-compressed zip, written by hand so the fixture needs no zip
 *  library. `mammoth` reads it through JSZip exactly as it reads Word's own. */
function buildZip(entries) {
  const locals = [];
  const central = [];
  let offset = 0;

  for (const [name, text] of entries) {
    const nameBytes = Buffer.from(name, "utf8");
    const raw = Buffer.from(text, "utf8");
    const deflated = deflateRawSync(raw);
    const crc = crc32(raw);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(0, 10); // mod time — fixed, so the bytes are stable
    local.writeUInt16LE(0x21, 12); // mod date — 1 Jan 1996
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(deflated.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBytes, deflated);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4); // version made by
    entry.writeUInt16LE(20, 6); // version needed
    entry.writeUInt16LE(0, 8);
    entry.writeUInt16LE(8, 10);
    entry.writeUInt16LE(0, 12);
    entry.writeUInt16LE(0x21, 14);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(deflated.length, 20);
    entry.writeUInt32LE(raw.length, 24);
    entry.writeUInt16LE(nameBytes.length, 28);
    entry.writeUInt16LE(0, 30); // extra
    entry.writeUInt16LE(0, 32); // comment
    entry.writeUInt16LE(0, 34); // disk
    entry.writeUInt16LE(0, 36); // internal attrs
    entry.writeUInt32LE(0, 38); // external attrs
    entry.writeUInt32LE(offset, 42);
    central.push(entry, nameBytes);

    offset += 30 + nameBytes.length + deflated.length;
  }

  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...locals, centralBuf, end]);
}

/* -------------------------------------------------------------------- write */

const pdf = join(FIXTURES, "offer.pdf");
writeFileSync(pdf, buildPdf());
console.log(`wrote ${pdf}`);

const docx = join(FIXTURES, "offer.docx");
writeFileSync(
  docx,
  buildZip([
    ["[Content_Types].xml", CONTENT_TYPES],
    ["_rels/.rels", ROOT_RELS],
    ["word/document.xml", documentXml(DOCX_PARAGRAPHS)],
  ]),
);
console.log(`wrote ${docx}`);
