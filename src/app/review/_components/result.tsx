"use client";

/**
 * The reader's side of the analysis: the summary, the ranked flags with their
 * expansions, the cited sentence panels, and the coverage receipt.
 *
 * Two registers run through all of it and are carried by material rather than
 * by wording (ADR 0004, PRD §4 T7). The document's own words appear only in
 * Tinos on cream, inside a bordered panel or inside the sheet. Redline's words
 * — the summary claim, the meaning, the counter-offer, every label — are
 * Archivo on the ink frame. A reader who can see which surface a sentence is
 * on knows who said it, and that survives greyscale and a photocopier.
 *
 * Severity is carried three ways at once and never by hue: a bar whose length
 * is the signal (44px / 22px), a stamped code, and the spelled word.
 *
 * The coverage receipt renders on every analysis. On a clean document it is
 * the result and takes the top of the column, because "no flags" read as "safe
 * to sign" is the failure ADR 0004 exists to prevent.
 */

import type { CoverageReceipt } from "@/lib/analysis/coverage";
import {
  factorLabel,
  headline,
  remainder,
  stampCodes,
  SEVERITY_BAR_PX,
  SEVERITY_WORD,
  type RunFailure,
  type WireAnalysis,
  type WireCitation,
  type WireGeneralStatement,
  type WireRankedFlag,
} from "../_lib/wire";

export type Selection =
  | { kind: "flag"; id: string }
  | { kind: "claim"; index: number }
  | { kind: "governing-law" }
  | null;

/* ── Shared material ─────────────────────────────────────────────────── */

/**
 * The document speaking. Cream ground, Tinos, a 2px rule under a Label header
 * that says where in the reader's own text this came from. Nothing on this
 * surface is ours.
 */
export function CitedPanel({
  citation,
  header,
  className = "",
}: {
  citation: WireCitation;
  header: string;
  className?: string;
}) {
  return (
    <div className={`border-2 border-spot bg-paper ${className}`}>
      <p className="label tabular border-b-2 border-ink px-3 py-1.5 text-ink">
        {header} · chars {citation.span.start.toLocaleString()}–
        {citation.span.end.toLocaleString()}
      </p>
      <p className="document px-3 py-2.5 text-[0.9375rem] text-ink">
        {citation.text}
      </p>
    </div>
  );
}

/**
 * The second layer (ADR 0005). Dashed 2px border and a halftone rail, both
 * reserved for this one job: marking a claim that has no sentence behind it.
 * It never merges into a flag and never touches a severity.
 */
function NotFromDocument({ statements }: { statements: readonly WireGeneralStatement[] }) {
  if (statements.length === 0) return null;
  return (
    <div className="border-2 border-dashed border-spot">
      <p className="label border-b-2 border-dashed border-spot px-3 py-1.5 text-spot">
        Not from your document
      </p>
      {statements.map((statement, index) => (
        <div key={index} className="flex items-stretch border-t border-dashed border-spot/50 first:border-t-0">
          <div
            className="halftone-ink w-9 shrink-0 border-r-2 border-dashed border-spot"
            aria-hidden="true"
          />
          <div className="min-w-0 px-3 py-2.5">
            <p className="max-w-[62ch] font-voice text-sm leading-relaxed text-paper">
              {statement.statement}
            </p>
            <p className="label tabular mt-2 text-paper/65">
              {statement.basis} · checked {statement.asOf}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── The summary ─────────────────────────────────────────────────────── */

function Summary({
  analysis,
  selected,
  onSelect,
}: {
  analysis: WireAnalysis;
  selected: Selection;
  onSelect: (selection: Selection) => void;
}) {
  const claims = analysis.summary.claims;
  if (claims.length === 0) return null;

  return (
    <section aria-labelledby="summary-head" className="px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b-2 border-spot pb-2">
        <h3 id="summary-head" className="label text-spot">
          What this document commits you to
        </h3>
        <p className="label text-paper/65">Each line shows the sentence it rests on</p>
      </div>

      <ul>
        {claims.map((claim, index) => {
          const active = selected?.kind === "claim" && selected.index === index;
          return (
            <li key={index} className="border-b border-spot/40">
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onSelect({ kind: "claim", index })}
                className={`block w-full px-3 py-3 text-left transition-colors duration-200 ${
                  active ? "bg-spot text-ink" : "text-paper hover:bg-spot/15"
                }`}
              >
                <span className="block max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed">
                  {claim.statement}
                </span>
                <span
                  className={`label tabular mt-2 block ${
                    active ? "text-burnt" : "text-paper/65"
                  }`}
                >
                  Quote located · chars {claim.citation.span.start.toLocaleString()}–
                  {claim.citation.span.end.toLocaleString()}
                </span>
              </button>
              {active ? (
                <div className="mx-3 mb-3 lg:hidden">
                  <CitedPanel citation={claim.citation} header="From your document" />
                  <a
                    href="#document"
                    className="mark mt-2 inline-block underline decoration-2"
                  >
                    Show it in the document
                  </a>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ── The ranked flags ────────────────────────────────────────────────── */

function clauseLabels(coverage: CoverageReceipt): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const entry of coverage.checked) labels[entry.clauseType] = entry.label;
  return labels;
}

function FlagRow({
  ranked,
  code,
  clauseLabel,
  active,
  onSelect,
}: {
  ranked: WireRankedFlag;
  code: string;
  clauseLabel: string;
  active: boolean;
  onSelect: () => void;
}) {
  const { flag, severity, promotion } = ranked;
  const rest = remainder(flag.meaning);

  return (
    <li className="border-b border-spot/40">
      {promotion ? (
        <div className="border-b-2 border-spot bg-spot px-3 py-2 text-ink">
          <p className="label">Promoted — this crosses a red line you set</p>
          <p className="mt-1 max-w-[62ch] font-voice text-[0.9375rem] leading-snug font-semibold">
            “{promotion.redLineText}”
          </p>
        </div>
      ) : null}

      <button
        type="button"
        aria-pressed={active}
        onClick={onSelect}
        className={`block w-full px-3 py-3 text-left transition-colors duration-200 ${
          active ? "bg-spot text-ink" : "text-paper hover:bg-spot/15"
        }`}
      >
        <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span
            className={`label tabular border-2 px-2 py-0.5 ${
              active ? "border-ink bg-ink text-spot" : "border-spot text-spot"
            }`}
          >
            {code}
          </span>
          <span
            className="sev-bar shrink-0"
            style={{ width: SEVERITY_BAR_PX[severity] }}
            aria-hidden="true"
          />
          <span className="label">{SEVERITY_WORD[severity]}</span>
          <span className={`label ${active ? "text-burnt" : "text-paper/65"}`}>
            {clauseLabel}
          </span>
        </span>

        <span className="mt-2 block max-w-[62ch] font-voice text-[1.0625rem] font-semibold leading-snug">
          {headline(flag.meaning)}
        </span>

        <span
          className={`label tabular mt-2 block ${active ? "text-burnt" : "text-paper/65"}`}
        >
          Quote located · chars {flag.citation.span.start.toLocaleString()}–
          {flag.citation.span.end.toLocaleString()}
        </span>
      </button>

      {active ? (
        <div className="space-y-4 bg-spot/10 px-3 pb-4 pt-3">
          {/* Phone is a different composition of the same mechanic. The
              sentence is here in full, at reading size, and the window above
              is already cropped to it — this is the way back up to it. */}
          <div className="lg:hidden">
            <CitedPanel citation={flag.citation} header="From your document" />
            <a href="#document" className="mark mt-2 inline-block underline decoration-2">
              Show it in the document
            </a>
          </div>

          {flag.escapability.length > 0 ? (
            <dl className="tabular grid gap-x-8 border-t border-spot/40 sm:grid-cols-2">
              {flag.escapability.map((measure, index) => (
                <div key={index} className="min-w-0 border-b border-spot/30 py-2">
                  <dt className="label text-paper/65">{factorLabel(measure.factor)}</dt>
                  <dd className="mt-1 font-voice text-sm font-semibold leading-snug text-paper">
                    {measure.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}

          {rest ? (
            <p className="max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-paper">
              {rest}
            </p>
          ) : null}

          <div className="border-t-2 border-spot pt-3">
            <p className="label text-spot">Counter-offer to send back</p>
            <p className="mt-1.5 max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-paper">
              {flag.counterOffer}
            </p>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function Flags({
  analysis,
  selected,
  onSelect,
}: {
  analysis: WireAnalysis;
  selected: Selection;
  onSelect: (selection: Selection) => void;
}) {
  const codes = stampCodes(analysis.flags);
  const labels = clauseLabels(analysis.coverage);

  return (
    <section aria-labelledby="flags-head" className="px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b-2 border-spot pb-2">
        <h3 id="flags-head" className="label text-spot">
          {analysis.flags.length === 1 ? "One flag" : `${analysis.flags.length} flags`}
        </h3>
        <p className="label text-paper/65">
          Ranked by how hard each one is to get out of, then by money
        </p>
      </div>

      <ul>
        {analysis.flags.map((ranked, index) => (
          <FlagRow
            key={ranked.flag.id}
            ranked={ranked}
            code={codes[index]}
            clauseLabel={labels[ranked.flag.clauseType] ?? ranked.flag.clauseType}
            active={selected?.kind === "flag" && selected.id === ranked.flag.id}
            onSelect={() => onSelect({ kind: "flag", id: ranked.flag.id })}
          />
        ))}
      </ul>

      <p className="label mt-3 max-w-[62ch] leading-relaxed text-paper/65">
        Every sentence above was found in your stored text before the flag was
        shown. Anything the model could not quote was dropped.
      </p>
    </section>
  );
}

/* ── The coverage receipt ────────────────────────────────────────────── */

/**
 * On an ink plate: 2px cream border, cream header strip with ink type, rows
 * divided at 35% cream, the findings column in spot Label type.
 */
export function Receipt({ coverage }: { coverage: CoverageReceipt }) {
  return (
    <div className="border-2 border-paper">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 bg-paper px-3 py-2">
        <h3 className="label text-ink">Coverage receipt</h3>
        <p className="label text-ink/75">What was checked, and what was not</p>
      </div>

      <dl>
        {coverage.checked.map((entry) => (
          <div
            key={entry.clauseType}
            className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-paper/35 px-3 py-2.5"
          >
            <dt className="min-w-0 font-voice text-[0.9375rem] leading-snug text-paper">
              {entry.label}
            </dt>
            <dd className="label tabular text-spot">{entry.finding}</dd>
          </div>
        ))}
      </dl>

      <div className="px-3 py-3">
        <p className="label text-paper/75">Not reviewed</p>
        <ul className="mt-2 space-y-2">
          {coverage.notReviewed.map((line, index) => (
            <li
              key={index}
              className="max-w-[62ch] border-l-2 border-paper/35 pl-3 font-voice text-sm leading-relaxed text-paper/90"
            >
              {line}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ── States ──────────────────────────────────────────────────────────── */

export type RunReason = "first" | "red-lines" | "state" | "again";

const RUNNING_BECAUSE: Record<RunReason, string> = {
  first: "Reading your document",
  "red-lines": "Reading it again — you changed your red lines",
  state: "Reading it again — you changed the state you work in",
  again: "Reading your document again",
};

/**
 * Running is a surface, not a spinner. It says what is happening to the text,
 * what standard is being applied to whatever comes back, and how long it has
 * been. The elapsed count is real; there is no progress to report, so none is
 * invented.
 */
export function Running({
  reason,
  elapsed,
  sentences,
  jurisdiction,
  redLines,
}: {
  reason: RunReason;
  elapsed: number;
  sentences: number;
  jurisdiction: string;
  redLines: number;
}) {
  return (
    <div className="border-2 border-spot" role="status" aria-live="polite">
      <p className="label border-b-2 border-spot bg-spot px-3 py-2 text-ink">
        {RUNNING_BECAUSE[reason]}
      </p>
      <div className="space-y-3 px-4 py-4">
        <p className="max-w-[62ch] font-voice text-[1.0625rem] leading-relaxed text-paper">
          Redline has sent your text to the model once. Nothing reaches this
          screen until every sentence quoted back has been found in the copy
          you are looking at.
        </p>
        <p className="max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-paper/80">
          A quote that cannot be found is dropped rather than softened, so a
          short list is what the standard looks like when it holds.
        </p>
        {/* The bar travels; there is no percentage behind it, so it carries
            no number. Under reduced motion it holds still and the seconds
            beneath it do the work. */}
        <div className="h-[3px] w-full overflow-hidden bg-spot/25" aria-hidden="true">
          <span className="sweep block h-full w-1/3 bg-spot" />
        </div>
        <p className="label tabular text-paper/70">
          {elapsed}s · {sentences.toLocaleString()} sentences · {jurisdiction} ·{" "}
          {redLines === 0
            ? "no red lines"
            : `${redLines} red line${redLines === 1 ? "" : "s"}`}
        </p>
      </div>
    </div>
  );
}

interface FailureCopy {
  head: string;
  what: string;
  why: string;
  retry: boolean;
}

/**
 * A failure is product surface too. Each one says what happened, what it means
 * for the reader's document, and whether trying again is worth anything — a
 * transport's own error text is never put in front of them.
 */
function failureCopy(failure: RunFailure): FailureCopy {
  switch (failure.kind) {
    case "no-connection":
      return {
        head: "The request never got through",
        what:
          "Redline could not reach the model at all. Your document is still on this screen and nothing about it was lost.",
        why: "The connection is the usual cause.",
        retry: true,
      };
    case "refused":
      return {
        head: "The model turned the request away",
        what:
          "The service answered and declined to run it. Your document is untouched.",
        why: "A rate limit does this, and it usually clears within a minute.",
        retry: true,
      };
    case "not-configured":
      return {
        head: "This copy of Redline has no key to call the model with",
        what: `The server needs ${failure.variable} set before it can analyse anything.`,
        why: "Whoever runs this installation sets it. Nothing on this page can get past it, and trying again will land here.",
        retry: false,
      };
    case "unusable":
      return {
        head: "What came back was not an analysis",
        what:
          "The model answered with something Redline cannot read as a result, so it is showing you none of it.",
        why: "Half a result looks exactly like a whole one. Running it again is worth doing before anything else.",
        retry: true,
      };
    case "unreadable-document":
      return {
        head: "The stored text would not read back",
        what:
          "Before analysing anything, Redline re-reads your text so that every quote is an offset into the words in front of you. This copy did not survive that.",
        why: "Load your document again, or paste the text in.",
        retry: false,
      };
    case "bad-request":
      return {
        head: "Redline sent a request the server would not take",
        what: "Redline built it badly. There is nothing wrong with your file.",
        why: "Loading the document again usually clears it. If it happens twice, it is a bug in Redline.",
        retry: true,
      };
  }
}

export function Failed({
  failure,
  onRetry,
}: {
  failure: RunFailure;
  onRetry: () => void;
}) {
  const copy = failureCopy(failure);
  return (
    <div className="border-2 border-spot" role="alert">
      <p className="label border-b-2 border-spot bg-spot px-3 py-2 text-ink">
        No analysis
      </p>
      <div className="space-y-3 px-4 py-4">
        <p className="max-w-[62ch] font-voice text-[1.0625rem] leading-relaxed text-paper">
          {copy.head}.
        </p>
        <p className="max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-paper/85">
          {copy.what}
        </p>
        <p className="max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-paper/85">
          {copy.why}
        </p>
        {copy.retry ? (
          <button type="button" onClick={onRetry} className="slug label slug-on-ink">
            <span>Run it again</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

/* ── The whole result ────────────────────────────────────────────────── */

export function Result({
  analysis,
  selected,
  onSelect,
}: {
  analysis: WireAnalysis;
  selected: Selection;
  onSelect: (selection: Selection) => void;
}) {
  const clean = analysis.flags.length === 0;

  return (
    <>
      {/* On a clean document the receipt is the result, so it comes first and
          carries the statement. Nowhere does this product say whether to
          sign. */}
      {clean ? (
        <section aria-labelledby="clean-head" className="px-4 py-5 sm:px-6">
          <h3 id="clean-head" className="display max-w-[18ch] text-3xl text-paper sm:text-4xl">
            Nothing here qualifies
          </h3>
          <p className="mt-4 max-w-[62ch] font-voice text-[1.0625rem] leading-relaxed text-paper">
            None of the four clause types Redline checks turned anything up in
            this document. That is a narrower statement than it sounds, and the
            receipt below says exactly how narrow.
          </p>
          <div className="mt-5">
            <Receipt coverage={analysis.coverage} />
          </div>
        </section>
      ) : null}

      <Summary analysis={analysis} selected={selected} onSelect={onSelect} />

      {clean ? null : (
        <Flags analysis={analysis} selected={selected} onSelect={onSelect} />
      )}

      {analysis.governingLaw ? (
        <section aria-labelledby="law-head" className="px-4 py-5 sm:px-6">
          <div className="border-b-2 border-spot pb-2">
            <h3 id="law-head" className="label text-spot">
              Governing law
            </h3>
          </div>
          <p className="mt-3 max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-paper">
            This is in your document, so it is quoted rather than explained. It
            names the state whose law the contract says applies, which is often
            not the state you work in.
          </p>
          <button
            type="button"
            aria-pressed={selected?.kind === "governing-law"}
            onClick={() => onSelect({ kind: "governing-law" })}
            className="mt-3 block w-full text-left"
          >
            <CitedPanel citation={analysis.governingLaw} header="From your document" />
          </button>
        </section>
      ) : null}

      {analysis.context.length > 0 ? (
        <section aria-label="General context" className="px-4 py-5 sm:px-6">
          <NotFromDocument statements={analysis.context} />
        </section>
      ) : null}

      {clean ? null : (
        <section aria-label="Coverage receipt" className="px-4 py-5 sm:px-6">
          <Receipt coverage={analysis.coverage} />
        </section>
      )}
    </>
  );
}
