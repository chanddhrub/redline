/**
 * Writes every intake fixture: the two readable ones — a text-layer PDF and a
 * DOCX — and the files each refusal is asserted against.
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
 *
 * The refusal fixtures are at the foot of the file, each with a note on what
 * about it is the thing under test.
 */

import { createHash } from "node:crypto";
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

/* ------------------------------------------------------------- refusals */

/**
 * The refusal fixtures (ticket 05). Each one exists so a refusal kind is
 * asserted against real bytes rather than described in a comment.
 *
 * Everything below is written as latin1 strings, where one character is one
 * byte, so binary image data and RC4 output sit in the same builder as the
 * PDF's own syntax.
 */

/** Generic PDF assembler: bodies in, a cross-reference table and trailer out. */
function assemblePdf(bodies, trailerExtra = "") {
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  bodies.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefAt = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${bodies.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const at of offsets) {
    pdf += `${String(at).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${bodies.length + 1} /Root 1 0 R${trailerExtra} >>\n`;
  pdf += `startxref\n${xrefAt}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

function stream(dict, data) {
  return `<< ${dict} /Length ${Buffer.byteLength(data, "latin1")} >>\nstream\n${data}\nendstream`;
}

/** A 2x2 block of raw RGB. It stands in for the scan: a page whose entire
 *  content is a picture, drawn with `Do` and carrying no text operator at
 *  all. What it is a picture *of* does not matter — pdf.js extracts nothing
 *  from an image either way, which is the whole point of the fixture. */
const IMAGE_BYTES = "\x20\x20\x20\xd0\xd0\xd0\xa0\xa0\xa0\x40\x40\x40";
const IMAGE_DICT =
  "/Type /XObject /Subtype /Image /Width 2 /Height 2 " +
  "/ColorSpace /DeviceRGB /BitsPerComponent 8";

/** Draws the image over the whole page. No BT, no Tj: nothing to extract. */
const SCANNED_PAGE = "q\n612 0 0 792 0 0 cm\n/Im0 Do\nQ\n";

/**
 * A PDF whose pages are pictures.
 *
 * `fragments` gives, per page, the handful of characters that survived — a
 * header stamp, a page number, a fax line. An empty string is a page with no
 * text operator at all. `scan.pdf` gets none of it; `mostly-scan.pdf` gets
 * just enough to be tempting.
 */
function buildScannedPdf(fragments) {
  const pageCount = fragments.length;
  const contents = fragments.map((fragment) => {
    if (!fragment) return SCANNED_PAGE;
    return `${SCANNED_PAGE}BT\n/F1 9 Tf\n12 TL\n72 740 Td\n${pdfString(fragment)}\nET\n`;
  });

  // 1 catalog, 2 pages, 3 image, 4 font, then one page object and one content
  // stream per page.
  const firstPage = 5;
  const firstContent = firstPage + pageCount;
  const kids = contents.map((_, i) => `${firstPage + i} 0 R`).join(" ");

  const bodies = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`,
    stream(IMAGE_DICT, IMAGE_BYTES),
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    ...contents.map(
      (_, i) =>
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] " +
        "/Resources << /XObject << /Im0 3 0 R >> /Font << /F1 4 0 R >> >> " +
        `/Contents ${firstContent + i} 0 R >>`,
    ),
    ...contents.map((content) => stream("", content)),
  ];

  return assemblePdf(bodies);
}

/* --------------------------------------------------------- encrypted PDF */

/**
 * A genuinely password-protected PDF: standard security handler, revision 2,
 * RC4 at 40 bits. Old and weak, and still what an HR department's "secure"
 * export produces. What matters here is only that pdf.js asks for a password
 * rather than reading the file.
 *
 * The algorithms are the ones in the PDF specification: 2 (the file key from
 * the user password), 3 (the /O entry from the owner password) and 4 (the /U
 * entry, which is how a reader checks the password it was handed). Trying the
 * empty password against this file recomputes a /U that does not match, and
 * that mismatch is what makes pdf.js raise `PasswordException`.
 *
 * RC4 is written out here rather than taken from `node:crypto`, where it now
 * sits behind OpenSSL's legacy provider and is not reliably available.
 */
const PAD = Buffer.from([
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41, 0x64, 0x00, 0x4e, 0x56,
  0xff, 0xfa, 0x01, 0x08, 0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80,
  0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a,
]);

function padPassword(password) {
  const raw = Buffer.from(password, "latin1").subarray(0, 32);
  return Buffer.concat([raw, PAD], 32);
}

function rc4(key, data) {
  const s = new Uint8Array(256);
  for (let i = 0; i < 256; i += 1) s[i] = i;
  let j = 0;
  for (let i = 0; i < 256; i += 1) {
    j = (j + s[i] + key[i % key.length]) & 0xff;
    const swap = s[i];
    s[i] = s[j];
    s[j] = swap;
  }
  const out = Buffer.alloc(data.length);
  let a = 0;
  let b = 0;
  for (let n = 0; n < data.length; n += 1) {
    a = (a + 1) & 0xff;
    b = (b + s[a]) & 0xff;
    const swap = s[a];
    s[a] = s[b];
    s[b] = swap;
    out[n] = data[n] ^ s[(s[a] + s[b]) & 0xff];
  }
  return out;
}

function md5(...parts) {
  const hash = createHash("md5");
  for (const part of parts) hash.update(part);
  return hash.digest();
}

const USER_PASSWORD = "redline";
const OWNER_PASSWORD = "redline-owner";
/** Fixed, so the fixture's bytes are the same every run. */
const FILE_ID = Buffer.alloc(16, 0x42);
/** Permissions: everything allowed. This file is shut by a password, not by
 *  its permission bits. */
const PERMISSIONS = -1;

function buildEncryptedPdf(lines) {
  // Algorithm 3 — /O, the owner entry.
  const ownerKey = md5(padPassword(OWNER_PASSWORD)).subarray(0, 5);
  const o = rc4(ownerKey, padPassword(USER_PASSWORD));

  // Algorithm 2 — the file encryption key.
  const p = Buffer.alloc(4);
  p.writeInt32LE(PERMISSIONS, 0);
  const fileKey = md5(padPassword(USER_PASSWORD), o, p, FILE_ID).subarray(0, 5);

  // Algorithm 4 — /U, which is what a reader recomputes to check a password.
  const u = rc4(fileKey, PAD);

  /** Every stream gets its own key, derived from the file key and the object
   *  it lives in, so the same bytes in two objects do not encrypt alike. */
  const objectKey = (number) => {
    const suffix = Buffer.from([
      number & 0xff,
      (number >> 8) & 0xff,
      (number >> 16) & 0xff,
      0,
      0,
    ]);
    return md5(fileKey, suffix).subarray(0, 10);
  };

  const content = contentStream(lines);
  const encrypted = rc4(objectKey(5), Buffer.from(content, "latin1")).toString(
    "latin1",
  );

  const bodies = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] " +
      "/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    stream("", encrypted),
    `<< /Filter /Standard /V 1 /R 2 /O <${o.toString("hex")}> ` +
      `/U <${u.toString("hex")}> /P ${PERMISSIONS} >>`,
  ];

  const id = FILE_ID.toString("hex");
  return assemblePdf(bodies, ` /Encrypt 6 0 R /ID [<${id}> <${id}>]`);
}

/* ---------------------------------------------------- the smaller files */

/**
 * Not a contract, and not refused for it. Intake has no opinion about what a
 * document is; deciding that belongs to the analysis, which can say what it
 * found. A "does this look like a contract" check here would be Redline
 * guessing at why the reader uploaded something.
 */
const NOT_A_CONTRACT = `Sunday, late morning.

Buy two lemons, a bunch of parsley, and the good bread from the place on Mill
Street. Ask whether they still do the olive loaf.

Roast the chicken at 200C for an hour and ten. Rest it fifteen minutes or the
juice runs everywhere.

Ring Mum back. She called twice on Friday and I still have not.
`;

/** A PDF header and nothing that follows it, which is the shape a reader
 *  actually meets a corrupt file in: a download that stopped early, or a copy
 *  off a failing drive. */
const TRUNCATED_PDF = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n";

/** The legacy Word format, by its OLE2 compound-file signature. What follows
 *  the signature is not a real Word document and does not need to be: the
 *  format is refused on what it is, before anything tries to read it. */
const LEGACY_DOC = Buffer.concat([
  Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
  Buffer.from("legacy word payload", "latin1"),
]);

/** Bytes that are not UTF-8 and are not any format the sniff recognises: a
 *  byte-order mark for the wrong encoding, continuation bytes with nothing to
 *  continue, and a lone surrogate. */
const CORRUPT = Buffer.concat([
  Buffer.from([0xff, 0xfe, 0x00, 0x01, 0x82, 0x83, 0xc0, 0xc1]),
  Buffer.from("invalid utf8 ", "latin1"),
  Buffer.from([0xed, 0xa0, 0x80]),
]);

function write(name, contents) {
  const at = join(FIXTURES, name);
  writeFileSync(at, contents);
  console.log(`wrote ${at}`);
}

// Every page a picture; not one text operator anywhere.
write("scan.pdf", buildScannedPdf(["", "", ""]));

// The tempting one: three scanned pages carrying a header stamp and a page
// number apiece. There is text in it, and reading that text would produce a
// thin, confident-looking analysis of a document nobody has actually read.
write("mostly-scan.pdf", buildScannedPdf(["CONFIDENTIAL", "Page 2 of 3", "Page 3 of 3"]));

write(
  "encrypted.pdf",
  buildEncryptedPdf([
    "Northwind Analytics, Inc. Offer of Employment.",
    "This letter confirms our offer for the position of Senior Data Engineer.",
    "Your annual base salary will be $185,000.",
  ]),
);

write("truncated.pdf", Buffer.from(TRUNCATED_PDF, "latin1"));
write("legacy.doc", LEGACY_DOC);
write("corrupt.bin", CORRUPT);
write("empty.txt", Buffer.alloc(0));
write("not-a-contract.txt", Buffer.from(NOT_A_CONTRACT, "utf8"));
