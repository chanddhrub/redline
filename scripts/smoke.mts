/**
 * `pnpm smoke` — the planted fixture contract, through the real pipeline, to a
 * terminal.
 *
 * This is not a test and nothing in it is stubbed. The suite runs the gate, the
 * ranking and the promotion against a fixture-backed model; this runs them
 * against the model that ships, because the one thing the suite cannot tell
 * anyone is whether the prompt still finds the planted clauses and still quotes
 * them verbatim.
 *
 * Its most useful number is the dropped count. Every candidate the model
 * returns claims a sentence from the document, and the gate either locates that
 * sentence or drops the candidate (ADR 0001). A run where most candidates are
 * dropped means the prompt has started paraphrasing — a tuning job with a
 * number attached, rather than a vague worry. So the drops are printed with
 * their reasons and the claimed text, which is the only place that text is ever
 * shown: drops are never rendered to a reader.
 *
 * It reads a file from disk, calls OpenRouter, and writes to stdout. It touches
 * no database, uploads no file, and prints no part of the API key.
 */

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseDocument } from "../src/lib/intake/parse-document";
import {
  isUsState,
  type AnalysisRequest,
  type UsState,
} from "../src/lib/intake/analysis-request";
import { createOpenRouterClient } from "../src/lib/model/openrouter";
import { analyse } from "../src/lib/analysis/analyse";
import type { ModelFailure } from "../src/lib/model/client";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE = join(ROOT, "tests", "fixtures", "adhesion-contract.txt");
const SIDECAR = join(ROOT, "tests", "fixtures", "adhesion-contract.expected.json");

/* ── Terminal ──────────────────────────────────────────────────────────── */

const colour = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const bold = (s: string) => (colour ? `\x1b[1m${s}\x1b[0m` : s);
const dim = (s: string) => (colour ? `\x1b[2m${s}\x1b[0m` : s);
const red = (s: string) => (colour ? `\x1b[31m${s}\x1b[0m` : s);
const green = (s: string) => (colour ? `\x1b[32m${s}\x1b[0m` : s);

const WIDTH = 78;

function say(line = ""): void {
  process.stdout.write(`${line}\n`);
}

function rule(title?: string): void {
  say();
  say(
    title
      ? bold(`── ${title} ${"─".repeat(Math.max(0, WIDTH - title.length - 4))}`)
      : "─".repeat(WIDTH),
  );
}

function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/)) {
    if (!current) current = word;
    else if (current.length + 1 + word.length <= width) current += ` ${word}`;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

/**
 * The source sentence is the whole point of the product, so it gets room: a
 * quote block, wrapped, indented, with nothing else on its lines.
 */
function quote(text: string, indent = "    "): void {
  for (const line of wrap(text, WIDTH - indent.length - 2)) {
    say(`${indent}${dim("│")} ${line}`);
  }
}

function paragraph(text: string, indent: string): void {
  for (const line of wrap(text, WIDTH - indent.length)) say(`${indent}${line}`);
}

/**
 * Stops the run, says why, and leaves a non-zero exit code behind.
 *
 * It throws rather than calling `process.exit`, which on Windows aborts the
 * process while the HTTP socket is still closing and replaces the exit code
 * with a libuv crash. Setting `process.exitCode` and letting the event loop
 * drain gets the same answer to a shell, reliably.
 */
class Stop extends Error {
  readonly detail: string | undefined;
  constructor(message: string, detail?: string) {
    super(message);
    this.detail = detail;
  }
}

function die(message: string, detail?: string): never {
  throw new Stop(message, detail);
}

/* ── Configuration ─────────────────────────────────────────────────────── */

/**
 * Checked before anything runs, and by name. A smoke run with no key that
 * printed a tidy empty result would be worse than no smoke run at all.
 *
 * The values are read here only to test that they are non-blank. Neither is
 * printed, in whole or in part.
 */
function requireEnvironment(): void {
  const missing = ["OPENROUTER_API_KEY", "OPENROUTER_MODEL"].filter(
    (name) => !(process.env[name] ?? "").trim(),
  );
  if (missing.length === 0) return;

  const plural = missing.length > 1;
  die(
    `${missing.join(" and ")} ${plural ? "are" : "is"} not set, so nothing was run.`,
    `Put ${plural ? "them" : "it"} in .env.local at the repository root. pnpm smoke reads that file itself, so nothing has to be exported. It is gitignored, and no part of a key is ever printed here.`,
  );
}

/* ── The fixture ───────────────────────────────────────────────────────── */

interface Sidecar {
  jurisdiction: string;
  expectedFlags: { id: string; clauseType: string; sourceSentence: string }[];
  decoySentences?: string[];
}

/**
 * The sidecar names the reader's state as a postal code; `AnalysisRequest`
 * wants the name intake's `<select>` produces. One is the other spelled out,
 * and guessing is not an option, so the map is explicit and a code it does not
 * carry stops the run rather than defaulting to somewhere.
 */
const STATE_NAMES: Readonly<Record<string, UsState>> = {
  CA: "California",
  NY: "New York",
  TX: "Texas",
  WA: "Washington",
  MA: "Massachusetts",
  IL: "Illinois",
  CO: "Colorado",
  FL: "Florida",
};

function jurisdictionOf(sidecar: Sidecar): UsState {
  const named = sidecar.jurisdiction;
  if (isUsState(named)) return named;
  const mapped = STATE_NAMES[named.toUpperCase()];
  if (mapped) return mapped;
  die(`The fixture sidecar names a jurisdiction this script cannot resolve: ${named}`);
}

/* ── The run ───────────────────────────────────────────────────────────── */

async function main(): Promise<void> {
  say();
  say(bold("Redline smoke — the planted fixture through the real pipeline"));
  say(dim("Nothing below is stubbed. The model is called over the network."));

  requireEnvironment();

  const sidecar = JSON.parse(await readFile(SIDECAR, "utf8")) as Sidecar;
  const jurisdiction = jurisdictionOf(sidecar);

  // The real parser, over the real bytes, exactly as the browser runs it.
  const bytes = await readFile(FIXTURE);
  const parsed = await parseDocument(
    bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer,
    "adhesion-contract.txt",
  );
  if (!parsed.ok) die(`The fixture would not parse: ${parsed.refusal.kind}`);
  const document = parsed.document;

  const request: AnalysisRequest = {
    text: document.text,
    sentences: document.sentences,
    jurisdiction,
    // None. Promotion is the suite's business; this run is about whether the
    // model finds the clauses and quotes them exactly.
    redLines: [],
  };

  say();
  say(`Document   ${FIXTURE.slice(ROOT.length + 1)}`);
  say(
    `Stored     ${document.text.length} characters, ${document.sentences.length} sentences`,
  );
  say(
    `Working in ${jurisdiction} ${dim(`(the sidecar's "${sidecar.jurisdiction}")`)}`,
  );
  say(`Model      ${dim("as named by OPENROUTER_MODEL")}`);

  const started = Date.now();
  const outcome = await analyse(request, createOpenRouterClient());
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  if (!outcome.ok) {
    const failure = outcome.failure;
    if (failure.kind === "unreadable-document") {
      die("The pipeline could not re-read the stored text as a document.");
    }
    die(`The model call failed after ${elapsed}s: ${describe(failure.failure)}`);
  }

  const { analysis } = outcome;
  const { flags, dropped } = analysis;
  const candidates = flags.length + dropped.flags.length;

  /* ── Flags ── */

  rule(`Flags — ${flags.length} survived the gate`);
  if (flags.length === 0) {
    say();
    say("  No candidate's quote located in the document. See the drops below.");
  }
  for (const ranked of flags) {
    const { flag } = ranked;
    const { span } = flag.citation;
    say();
    say(
      `  ${bold(`${ranked.rank}.`)} ${bold(ranked.severity.toUpperCase())}   ${flag.clauseType}   ${dim(`chars ${span.start}–${span.end}`)}`,
    );
    if (ranked.promotion) {
      say(`     ${bold("Red line crossed:")} ${ranked.promotion.redLineText}`);
    }
    say();
    say(`    ${dim("Source sentence, verbatim from the stored text:")}`);
    quote(flag.citation.text);
    say();
    say(`    ${dim("What it means:")}`);
    paragraph(flag.meaning, "      ");
    say();
    say(`    ${dim("Counter-offer:")}`);
    paragraph(flag.counterOffer, "      ");
  }

  /* ── The span check ── */

  rule("Span check");
  say();
  paragraph(
    "Every printed span is sliced out of the stored text here and compared with the sentence printed above it.",
    "  ",
  );
  say();
  const mismatches = flags.filter(
    (ranked) =>
      request.text.slice(
        ranked.flag.citation.span.start,
        ranked.flag.citation.span.end,
      ) !== ranked.flag.citation.text,
  );
  if (mismatches.length > 0) {
    for (const ranked of mismatches) {
      say(
        red(
          `  ✗ flag ${ranked.rank} (${ranked.flag.id}): the span does not slice back to the printed sentence`,
        ),
      );
    }
  } else {
    say(
      green(
        `  ✓ all ${flags.length} printed spans slice the stored text back to the printed sentence exactly`,
      ),
    );
  }

  /* ── Drops ── */

  rule(`Dropped — ${dropped.flags.length} of ${candidates} candidates`);
  say();
  paragraph(
    "A candidate whose quote does not locate is dropped, never softened. The claimed text below is what the model said the document says; it is printed here and nowhere a reader can see it.",
    "  ",
  );
  if (candidates > 0) {
    const share = Math.round((dropped.flags.length / candidates) * 100);
    say();
    say(`  ${bold(`${dropped.flags.length}/${candidates}`)} candidate flags dropped (${share}%).`);
  }
  for (const drop of dropped.flags) {
    say();
    say(`  ${red("dropped")}  ${drop.clauseType}  ${dim(drop.reason)}  ${dim(drop.id)}`);
    quote(drop.claimedSentence);
  }
  say();
  say(
    `  Summary claims dropped: ${dropped.summaryClaims.length} of ${analysis.summary.claims.length + dropped.summaryClaims.length}`,
  );
  for (const drop of dropped.summaryClaims) {
    say(`    ${red("dropped")} ${dim(drop.reason)}`);
    quote(drop.claimedSentence, "      ");
  }
  say(
    `  Governing-law quote: ${
      analysis.governingLaw
        ? green("located")
        : dropped.governingLaw
          ? red(`dropped (${dropped.governingLaw.reason})`)
          : dim("none claimed")
    }`,
  );
  say(`  Red-line claims refused: ${dropped.redLineClaims}`);

  /* ── Summary ── */

  rule(`Summary — ${analysis.summary.claims.length} claims, each with its sentence`);
  for (const claim of analysis.summary.claims) {
    say();
    paragraph(claim.statement, "  ");
    say(`    ${dim(`chars ${claim.citation.span.start}–${claim.citation.span.end}`)}`);
    quote(claim.citation.text);
  }

  /* ── Governing law ── */

  if (analysis.governingLaw) {
    rule("Governing law");
    say();
    say(
      `    ${dim(`chars ${analysis.governingLaw.span.start}–${analysis.governingLaw.span.end}`)}`,
    );
    quote(analysis.governingLaw.text);
  }

  /* ── Coverage receipt ── */

  rule("Coverage receipt");
  say();
  for (const entry of analysis.coverage.checked) {
    say(`  ${entry.label}`);
    say(`    ${entry.finding}`);
  }
  say();
  say("  Not reviewed:");
  for (const item of analysis.coverage.notReviewed) {
    say();
    paragraph(item, "    ");
  }

  /* ── Did it find what was planted? ── */

  rule("Planted clauses");
  say();
  const found = new Set(flags.map((ranked) => ranked.flag.citation.text));
  let missed = 0;
  for (const expected of sidecar.expectedFlags) {
    const hit = found.has(expected.sourceSentence);
    if (!hit) missed += 1;
    say(
      `  ${hit ? green("✓ found ") : red("✗ missed")}  ${expected.clauseType}   ${dim(expected.id)}`,
    );
  }
  say();
  say(
    `  ${sidecar.expectedFlags.length - missed} of ${sidecar.expectedFlags.length} planted clauses came back as flags.`,
  );
  paragraph(
    "A miss here is the model's recall. A drop above is the gate. They are different problems and they have different fixes.",
    "  ",
  );

  /* ── The bottom line ── */

  rule();
  say();
  say(
    `  ${candidates} candidates · ${flags.length} survived · ${dropped.flags.length} dropped · ${elapsed}s`,
  );
  say();

  if (mismatches.length > 0) {
    die(
      `${mismatches.length} printed span(s) did not slice back to the printed sentence.`,
    );
  }
}

function describe(failure: ModelFailure): string {
  switch (failure.kind) {
    case "missing-configuration":
      return `${failure.variable} is not set`;
    case "unreachable":
      return `the endpoint was unreachable — ${failure.detail}`;
    case "rejected":
      return `the endpoint refused with HTTP ${failure.status} — ${failure.detail}`;
    case "unusable-response":
      return `the response could not be used (${failure.reason}) — ${failure.detail}`;
  }
}

try {
  await main();
} catch (cause) {
  say();
  say(red(`✗ ${cause instanceof Error ? cause.message : String(cause)}`));
  if (cause instanceof Stop && cause.detail) paragraph(cause.detail, "  ");
  else if (!(cause instanceof Stop) && cause instanceof Error && cause.stack) {
    say(dim(cause.stack.split("\n").slice(1).join("\n")));
  }
  say();
  process.exitCode = 1;
}
