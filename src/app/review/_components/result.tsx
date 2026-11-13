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
import type { UsState } from "@/lib/intake/analysis-request";
import {
  governingLawStates,
  notesForTopic,
  type EnforceabilityTopic,
} from "@/lib/analysis/enforceability";
import {
  factorLabel,
  headline,
  remainder,
  stampCodes,
  SEVERITY_BAR_PX,
  SEVERITY_WORD,
  type RunFailure,
  type WireAnalysis,
  type WireAnswer,
  type WireCitation,
  type WireGeneralStatement,
  type WireRankedFlag,
} from "../_lib/wire";
import { createContext, useContext, useEffect, useState } from "react";

export type Selection =
  | { kind: "flag"; id: string }
  | { kind: "claim"; index: number }
  | { kind: "governing-law" }
  /** A sentence an answer rests on. Selectable exactly as a flag is, and it
   *  drives the same travelling window (`shell.tsx`), because it is the same
   *  kind of thing: a located sentence in the reader's own text. */
  | { kind: "answer"; turn: number; index: number }
  | null;

/**
 * Opens the document panel at the selected sentence. Provided by the shell,
 * which owns the panel; anything that shows a quote can offer the way back to
 * it without the call being threaded through every component in between.
 */
export const ShowInDocument = createContext<() => void>(() => {});

function ShowInDocumentButton({ onBefore }: { onBefore?: () => void }) {
  const show = useContext(ShowInDocument);
  return (
    <button
      type="button"
      onClick={() => {
        onBefore?.();
        show();
      }}
      className="slug slug-quiet"
    >
      <span>Show in document</span>
    </button>
  );
}
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
    <div className={`border border-rule bg-quote ${className}`}>
      <p className="tabular px-4 pt-2.5 text-[0.75rem] font-semibold text-soft">
        {header} · characters {citation.span.start.toLocaleString()}–
        {citation.span.end.toLocaleString()}
      </p>
      <p className="document px-4 pb-3 pt-1.5 text-[1rem] leading-[1.6] text-graphite">
        {citation.text}
      </p>
    </div>
  );
}
/**
 * The second layer (ADR 0005, DESIGN.md).
 *
 * Built exactly like `CitedPanel` and then marked, in three ways at once, as
 * the one thing that is not: a 2px *dashed* ink border, which this system
 * reserves for this and nothing else; a 9-unit halftone rail down the inside
 * left edge, because a screen means not-yours; and a header that says so in
 * words, which is what a screen reader, a photocopy and a first-time reader
 * all get. The copy is Archivo — Redline's voice. Tinos never appears on this
 * panel, because Tinos is the contract talking and the contract did not say
 * any of this.
 *
 * There is no span here and no sentence to point at. What stands in for them
 * is the source and the date, printed under every line, because that is all a
 * reader has to weigh a claim they cannot check against their own copy.
 */
export function NotFromDocument({
  statements,
  worksIn,
}: {
  statements: readonly WireGeneralStatement[];
  worksIn: string | null;
}) {
  if (statements.length === 0) return null;
  return (
    <div className="border border-dashed border-soft bg-white">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-dashed border-soft px-3 py-1.5">
        <p className="label text-graphite">Not from your document</p>
        {worksIn ? (
          <p className="label text-soft">General context · {worksIn}</p>
        ) : null}
      </div>

      <p className="border-b border-dashed border-soft px-3 py-2 font-voice text-[0.8125rem] leading-relaxed text-soft">
        None of this is in your contract, so there is no sentence to check it
        against. It is background on the law where you work, and it is not
        advice about your situation. The source and the date under each line
        are what you have to weigh it by.
      </p>

      {statements.map((statement, index) => (
        <div key={index} className="flex items-stretch border-t border-dashed border-soft first:border-t-0">
          <div className="halftone w-9 shrink-0 border-r border-dashed border-soft" aria-hidden="true" />
          <div className="min-w-0 px-3 py-2.5">
            <p className="max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-graphite">
              {statement.statement}
            </p>
            <p className="label tabular mt-2 text-soft">
              {statement.basis} · checked {statement.asOf}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

/** The notes that belong beside one flag, or beside the governing-law quote.
 *  A topic with nothing recorded for this reader's state renders nothing —
 *  not a line saying it varies, which is the hedge ADR 0004 rules out. */
function TopicNotes({
  analysis,
  topic,
  worksIn,
}: {
  analysis: WireAnalysis;
  topic: EnforceabilityTopic;
  worksIn: string | null;
}) {
  const notes = notesForTopic(analysis.context, topic);
  if (notes.length === 0) return null;
  return <NotFromDocument statements={notes} worksIn={worksIn} />;
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
    <section aria-labelledby="summary-head" className="px-4 pb-2 pt-8 sm:px-8">
      <h3 id="summary-head" className="text-[1.0625rem] font-bold text-graphite">
        What this document commits you to
      </h3>
      <p className="mt-0.5 text-[0.875rem] text-soft">
        Each line rests on a sentence from your document. Open one to see it.
      </p>

      <ul className="mt-3 border-t border-rule">
        {claims.map((claim, index) => {
          const active = selected?.kind === "claim" && selected.index === index;
          return (
            <li key={index} className={`border-b border-rule ${active ? "bg-wash" : ""}`}>
              <button
                type="button"
                aria-expanded={active}
                onClick={() => onSelect(active ? null : { kind: "claim", index })}
                className="flex w-full items-start gap-3 px-3 py-3 text-left transition-colors duration-150 hover:bg-wash"
              >
                <Chevron open={active} />
                <span className="block max-w-[64ch] text-[0.9375rem] leading-relaxed text-graphite">
                  {claim.statement}
                </span>
              </button>
              {active ? (
                <div className="space-y-3 px-3 pb-4 pl-10">
                  <CitedPanel citation={claim.citation} header="From your document" />
                  <ShowInDocumentButton />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Open and closed, drawn rather than typed, in the text colour. */
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 12 12"
      width="12"
      height="12"
      aria-hidden="true"
      className={`mt-[0.32rem] shrink-0 text-soft transition-transform duration-150 ${open ? "rotate-90" : ""}`}
    >
      <path d="M4 2.5 7.5 6 4 9.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

/* ── The ranked flags ────────────────────────────────────────────────── */

function clauseLabels(coverage: CoverageReceipt): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const entry of coverage.checked) labels[entry.clauseType] = entry.label;
  return labels;
}
/**
 * Severity, three ways: the bar's length (44px or 22px), the spelled word,
 * and a colour that repeats them for readers who have colour. Greyscale loses
 * the third and keeps the other two.
 */
function SeverityMark({ severity }: { severity: WireRankedFlag["severity"] }) {
  const tone = severity === "critical" ? "text-crit" : "text-high";
  return (
    <span className={`flex items-center gap-2 ${tone}`}>
      <span
        className="sev-bar shrink-0"
        style={{ width: SEVERITY_BAR_PX[severity] }}
        aria-hidden="true"
      />
      <span className="text-[0.8125rem] font-bold">{SEVERITY_WORD[severity]}</span>
    </span>
  );
}

function CopyCounterOffer({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(
          () => setCopied(true),
          () => setCopied(false),
        );
      }}
      className="slug"
    >
      <span aria-live="polite">{copied ? "Copied" : "Copy counter-offer"}</span>
    </button>
  );
}

function FlagRow({
  ranked,
  code,
  clauseLabel,
  active,
  onSelect,
  notes,
  worksIn,
}: {
  ranked: WireRankedFlag;
  code: string;
  clauseLabel: string;
  active: boolean;
  onSelect: () => void;
  /** The second layer for this clause type, if the reader's state has one.
   *  It arrives as a prop rather than being fetched here, and the row has
   *  already been ranked and banded by the time it does. */
  notes: readonly WireGeneralStatement[];
  worksIn: string | null;
}) {
  const { flag, severity, promotion } = ranked;
  const rest = remainder(flag.meaning);
  const detail = `flag-${flag.id}`;

  return (
    <li className={`border-b border-rule ${active ? "bg-wash" : ""}`}>
      {promotion ? (
        <p className="px-3 pt-3 text-[0.8125rem] text-graphite @xl:pl-[4.75rem]">
          <span className="font-bold">Moved to the top:</span> this crosses your red line
          &ldquo;{promotion.redLineText}&rdquo;
        </p>
      ) : null}

      <button
        type="button"
        aria-expanded={active}
        aria-controls={detail}
        onClick={onSelect}
        className="grid w-full grid-cols-[3.25rem_minmax(0,1fr)] items-start gap-x-3 gap-y-2 px-3 py-3.5 text-left transition-colors duration-150 hover:bg-wash @xl:grid-cols-[3.25rem_minmax(0,1fr)_7.5rem_7rem]"
      >
        <span className="tabular flex items-center gap-1.5 pt-0.5 text-[0.8125rem] text-soft">
          <Chevron open={active} />
          {code}
        </span>
        <span className="min-w-0">
          <span className="block text-[1rem] font-semibold leading-snug text-graphite">
            {headline(flag.meaning)}
          </span>
          <span className="mt-0.5 block text-[0.8125rem] text-soft">{clauseLabel}</span>
        </span>
        <span className="col-start-2 @xl:col-start-auto @xl:pt-0.5">
          <SeverityMark severity={severity} />
        </span>
        <span className="col-start-2 text-[0.8125rem] text-soft @xl:col-start-auto @xl:pt-0.5">
          Quote found
        </span>
      </button>

      {active ? (
        <div id={detail} className="px-3 pb-5 @xl:pl-[4.75rem]">
          <div className="grid gap-5 @3xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div className="min-w-0 space-y-4">
              <CitedPanel citation={flag.citation} header="From your document" />

              {flag.escapability.length > 0 ? (
                <dl className="tabular grid gap-x-5 gap-y-1 text-[0.875rem] @md:grid-cols-[minmax(0,10rem)_minmax(0,1fr)] @md:gap-y-1.5">
                  {flag.escapability.map((measure, index) => (
                    <div key={index} className="contents">
                      <dt className="text-soft">{factorLabel(measure.factor)}</dt>
                      <dd className="mb-1.5 font-semibold text-graphite @md:mb-0">{measure.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}

              {rest ? (
                <p className="max-w-[64ch] text-[0.9375rem] leading-relaxed text-graphite">
                  {rest}
                </p>
              ) : null}
            </div>

            <div className="min-w-0">
              <div className="border border-rule bg-white px-4 py-3">
                <p className="text-[0.8125rem] font-semibold text-soft">
                  Counter-offer to send back
                </p>
                <p className="mt-1 text-[0.9375rem] leading-relaxed text-graphite">
                  {flag.counterOffer}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <CopyCounterOffer text={flag.counterOffer} />
                <ShowInDocumentButton />
              </div>
            </div>
          </div>

          {/* The second layer, beside the flag and never inside it. The
              severity, the band and the position above were all settled
              before this was looked up, and nothing here can move them
              (ADR 0005). */}
          {notes.length > 0 ? (
            <div className="mt-5">
              <NotFromDocument statements={notes} worksIn={worksIn} />
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function Flags({
  analysis,
  selected,
  onSelect,
  worksIn,
}: {
  analysis: WireAnalysis;
  selected: Selection;
  onSelect: (selection: Selection) => void;
  worksIn: string | null;
}) {
  const codes = stampCodes(analysis.flags);
  const labels = clauseLabels(analysis.coverage);
  const count = analysis.flags.length;
  const critical = analysis.flags.filter((ranked) => ranked.severity === "critical").length;
  const high = count - critical;
  const tally = [
    critical ? `${critical} Critical` : null,
    high ? `${high} High` : null,
  ]
    .filter(Boolean)
    .join(" and ");

  return (
    <section aria-labelledby="flags-head" className="px-4 pb-2 pt-4 sm:px-8">
      <h3 id="flags-head" className="text-[1.0625rem] font-bold text-graphite">
        {count === 1 ? "1 clause could hurt you" : `${count} clauses could hurt you`}
      </h3>
      <p className="mt-0.5 max-w-[64ch] text-[0.875rem] leading-relaxed text-soft">
        {tally}, ranked by how hard each one is to get out of, then by money.
        Every quote was found in your document before it was shown. Open a row
        for the sentence and a counter-offer.
      </p>

      <div
        className="tabular mt-4 hidden grid-cols-[3.25rem_minmax(0,1fr)_7.5rem_7rem] gap-x-3 border-b border-rule px-3 pb-2 text-[0.75rem] font-semibold text-soft @xl:grid"
        aria-hidden="true"
      >
        <span>Code</span>
        <span>Clause</span>
        <span>Severity</span>
        <span>Source</span>
      </div>
      <ul className="border-t border-rule @xl:border-t-0">
        {analysis.flags.map((ranked, index) => {
          const active = selected?.kind === "flag" && selected.id === ranked.flag.id;
          return (
            <FlagRow
              key={ranked.flag.id}
              ranked={ranked}
              code={codes[index]}
              clauseLabel={labels[ranked.flag.clauseType] ?? ranked.flag.clauseType}
              active={active}
              onSelect={() => onSelect(active ? null : { kind: "flag", id: ranked.flag.id })}
              notes={notesForTopic(analysis.context, ranked.flag.clauseType)}
              worksIn={worksIn}
            />
          );
        })}
      </ul>
    </section>
  );
}
/* ── The coverage receipt ────────────────────────────────────────────── */

/**
 * White, not cream: the receipt is Redline describing its own work, not the
 * reader's words. Ruled rows, the finding for each clause type at the right,
 * and what was not reviewed said in full underneath.
 */
export function Receipt({ coverage }: { coverage: CoverageReceipt }) {
  return (
    <div className="border border-rule bg-white">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule px-4 py-2.5">
        <h3 className="text-[0.9375rem] font-bold text-graphite">What was checked</h3>
        <p className="text-[0.8125rem] text-soft">And what was not</p>
      </div>

      <dl>
        {coverage.checked.map((entry) => (
          <div
            key={entry.clauseType}
            className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-rule px-4 py-2.5"
          >
            <dt className="min-w-0 text-[0.9375rem] leading-snug text-graphite">{entry.label}</dt>
            <dd className="tabular text-[0.8125rem] font-semibold text-soft">{entry.finding}</dd>
          </div>
        ))}
      </dl>

      <div className="px-4 py-3">
        <p className="text-[0.8125rem] font-semibold text-graphite">Not reviewed</p>
        <ul className="mt-1.5 list-disc space-y-1.5 pl-5 marker:text-soft">
          {coverage.notReviewed.map((line, index) => (
            <li key={index} className="max-w-[64ch] text-[0.875rem] leading-relaxed text-soft">
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
    <div className="border border-rule" role="status" aria-live="polite">
      <p className="label border-b border-rule bg-wash px-3 py-2 text-graphite">
        {RUNNING_BECAUSE[reason]}
      </p>
      <div className="space-y-3 px-4 py-4">
        <p className="max-w-[62ch] font-voice text-[1.0625rem] leading-relaxed text-graphite">
          Redline has sent your text to the model once. Nothing reaches this
          screen until every sentence quoted back has been found in the copy
          you are looking at.
        </p>
        <p className="max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-soft">
          A quote that cannot be found is dropped rather than softened, so a
          short list is what the standard looks like when it holds.
        </p>
        {/* The bar travels; there is no percentage behind it, so it carries
            no number. Under reduced motion it holds still and the seconds
            beneath it do the work. */}
        <div className="h-[3px] w-full overflow-hidden bg-rule" aria-hidden="true">
          <span className="sweep block h-full w-1/3 bg-wash" />
        </div>
        <p className="label tabular text-soft">
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
  heading = "No analysis",
}: {
  failure: RunFailure;
  onRetry: () => void;
  /** What did not happen. The question box borrows this surface, and "no
   *  analysis" over a failed question would name the wrong thing. */
  heading?: string;
}) {
  const copy = failureCopy(failure);
  return (
    <div className="border border-rule" role="alert">
      <p className="label border-b border-rule bg-wash px-3 py-2 text-graphite">
        {heading}
      </p>
      <div className="space-y-3 px-4 py-4">
        <p className="max-w-[62ch] font-voice text-[1.0625rem] leading-relaxed text-graphite">
          {copy.head}.
        </p>
        <p className="max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-graphite">
          {copy.what}
        </p>
        <p className="max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-graphite">
          {copy.why}
        </p>
        {copy.retry ? (
          <button type="button" onClick={onRetry} className="slug label slug-">
            <span>Run it again</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

/* ── The answer ──────────────────────────────────────────────────────── */

/**
 * The standing holding, not a failure to answer.
 *
 * This surface is the whole point of the question box, so it is written as
 * product copy and given the same weight as an answer: the same header strip,
 * the same measure, the same voice. A reader who has just been told their
 * document is silent has learned something about their contract, and a
 * shrinking apology would teach them to distrust the refusal and go looking
 * for a tool that always answers (PRD §4 T5, ADR 0004).
 */
function NotAddressed() {
  return (
    <>
      <p className="label border-y border-rule bg-wash px-3 py-2 text-graphite">
        Your document does not address this
      </p>
      <div className="space-y-3 px-3 py-3">
        <p className="max-w-[62ch] font-voice text-[1.0625rem] leading-relaxed text-graphite">
          Nothing in the text beside this speaks to that question, so there is
          no answer to give you.
        </p>
        <p className="max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-graphite">
          Redline answers from your document and from nothing else. Something
          that sounds right is easy to write, and you would have no way to tell
          it apart from an answer that really was in your contract, so this box
          does not write it.
        </p>
        <p className="max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-graphite">
          Questions about the law where you work, about what is usual in the
          market, or about the company itself all land here. They need someone
          who can look outside this file. Ask about something your document
          sets out and you will get the sentence it came from.
        </p>
      </div>
    </>
  );
}

/**
 * The answer, in two states and no more.
 *
 * The registers are the same two that run through the rest of this file, and
 * they are further apart here than anywhere else, because an answer is the one
 * place where Redline's words are shaped by the reader's own question and could
 * most easily be mistaken for the contract's. So the answer is Archivo on ink,
 * under a header that says whose words these are, and every sentence it rests
 * on is Tinos on cream inside a bordered panel. Nothing on the cream is ours.
 *
 * Each cited sentence is a button, and selecting one recrops the document the
 * way selecting a flag does. The answer is checked the way a flag is checked.
 */
export function AnswerPanel({
  turn,
  question,
  answer,
  selected,
  onSelect,
}: {
  /** Which exchange in the thread this is. */
  turn: number;
  question: string;
  answer: WireAnswer;
  selected: Selection;
  onSelect: (selection: Selection) => void;
}) {
  return (
    <div className="border border-rule" aria-live="polite">
      <p className="label border-b border-rule px-3 py-1.5 text-graphite">
        You asked
      </p>
      <p className="px-3 py-2 font-voice text-[0.9375rem] leading-relaxed text-graphite">
        {question}
      </p>

      {answer.kind === "not-addressed" ? <NotAddressed /> : null}

      {answer.kind === "answered" ? (
        <>
          <p className="label border-y border-rule bg-wash px-3 py-2 text-graphite">
            Answered from your document
          </p>
          <p className="max-w-[62ch] px-3 py-3 font-voice text-[1.0625rem] leading-relaxed text-graphite">
            {answer.text}
          </p>

          <p className="label border-t border-rule px-3 py-1.5 text-graphite">
            {answer.citations.length === 1
              ? "The sentence this rests on"
              : "The sentences this rests on"}
          </p>
          <ul className="space-y-2 px-3 pb-3">
            {answer.citations.map((citation, index) => {
              const active =
                selected?.kind === "answer" &&
                selected.turn === turn &&
                selected.index === index;
              return (
                <li key={index}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => onSelect({ kind: "answer", turn, index })}
                    className="block w-full text-left"
                  >
                    <CitedPanel
                      citation={citation}
                      header={active ? "Shown in the document" : "From your document"}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="label border-t border-rule px-3 py-2 leading-relaxed text-soft">
            Each sentence above was found in your stored text before the answer
            was shown. One that could not be found would have taken the answer
            with it.
          </p>
        </>
      ) : null}
    </div>
  );
}

/* ── The whole result ────────────────────────────────────────────────── */

export function Result({
  analysis,
  selected,
  onSelect,
  jurisdiction,
}: {
  analysis: WireAnalysis;
  selected: Selection;
  onSelect: (selection: Selection) => void;
  /** The state the reader told us they work in. It is the key the second
   *  layer was looked up by, and it is the state the governing-law clause is
   *  named against. */
  jurisdiction: UsState | null;
}) {
  const clean = analysis.flags.length === 0;

  // Notes whose topic did not land beside anything — a clause type the reader
  // has no flag for, on a clean document or otherwise. They are collected at
  // the foot rather than dropped, on one panel with the same dashed border, so
  // nothing keyed to this reader's state goes missing and nothing appears
  // twice.
  const placed = new Set<EnforceabilityTopic>(
    analysis.flags.map((ranked) => ranked.flag.clauseType),
  );
  if (analysis.governingLaw) placed.add("governing-law");
  const unplaced = analysis.context.filter((note) => !placed.has(note.topic));

  const law = analysis.governingLaw
    ? governingLawStates(analysis.governingLaw.text, jurisdiction)
    : null;

  return (
    <>
      {/* On a clean document the receipt is the result, so it comes first and
          carries the statement. Nowhere does this product say whether to
          sign. */}
      {clean ? (
        <section aria-labelledby="clean-head" className="px-4 py-5 sm:px-6">
          <h3 id="clean-head" className="display max-w-[18ch] text-3xl text-graphite sm:text-4xl">
            Nothing here qualifies
          </h3>
          <p className="mt-4 max-w-[62ch] font-voice text-[1.0625rem] leading-relaxed text-graphite">
            None of the four clause types Redline checks turned anything up in
            this document. That is a narrower statement than it sounds, and the
            receipt below says exactly how narrow.
          </p>
          <div className="mt-5">
            <Receipt coverage={analysis.coverage} />
          </div>
        </section>
      ) : null}

      {/* The flags lead: they are what the reader came for. The summary
          follows, one line per commitment, each opening onto its sentence. */}
      {clean ? null : (
        <Flags
          analysis={analysis}
          selected={selected}
          onSelect={onSelect}
          worksIn={jurisdiction}
        />
      )}

      <Summary analysis={analysis} selected={selected} onSelect={onSelect} />

      {analysis.governingLaw ? (
        <section aria-labelledby="law-head" className="px-4 py-5 sm:px-6">
          <div className="border-b border-rule pb-2">
            <h3 id="law-head" className="label text-graphite">
              Governing law
            </h3>
          </div>
          <p className="mt-3 max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-graphite">
            This sentence is in your document, so it is quoted. It picks the
            state whose law your contract says applies, and that is often not
            the state you work in.
          </p>
          <button
            type="button"
            aria-pressed={selected?.kind === "governing-law"}
            onClick={() => onSelect({ kind: "governing-law" })}
            className="mt-3 block w-full text-left"
          >
            <CitedPanel citation={analysis.governingLaw} header="From your document" />
          </button>

          {/* Two states, named separately, both read off things the reader
              can check: one out of the sentence above, one out of what they
              told us. Nothing here says which of them wins — that is a
              general-context question and it goes on the dashed panel. */}
          {law ? (
            <dl className="tabular mt-3 grid gap-x-8 border-t border-rule sm:grid-cols-2">
              <div className="min-w-0 border-b border-rule py-2">
                <dt className="label text-soft">The clause picks</dt>
                <dd className="mt-1 font-voice text-[0.9375rem] font-semibold leading-snug text-graphite">
                  {law.named ?? "No state named in that sentence"}
                </dd>
              </div>
              <div className="min-w-0 border-b border-rule py-2">
                <dt className="label text-soft">You work in</dt>
                <dd className="mt-1 font-voice text-[0.9375rem] font-semibold leading-snug text-graphite">
                  {law.worksIn ?? "No state set"}
                </dd>
              </div>
            </dl>
          ) : null}

          {law?.differ ? (
            <p className="mt-3 max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-graphite">
              Those are two different states. Your document does not settle
              which one a court would apply, and nothing above answers that.
            </p>
          ) : null}

          <div className="mt-3">
            <TopicNotes
              analysis={analysis}
              topic="governing-law"
              worksIn={jurisdiction}
            />
          </div>
        </section>
      ) : null}

      {unplaced.length > 0 ? (
        <section aria-label="General context" className="px-4 py-5 sm:px-6">
          <NotFromDocument statements={unplaced} worksIn={jurisdiction} />
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
