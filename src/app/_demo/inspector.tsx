"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { findings, paragraphs, SAMPLE_LETTER, type Finding } from "./sample";

/**
 * The stored text, assembled exactly once, the way intake would store it.
 * Every finding's quote is located in this string before it is allowed to
 * render — a flag whose sentence cannot be found is dropped, not softened.
 */
const storedText = paragraphs
  .map((p) => p.runs.map((r) => r.text).join(" "))
  .join("\n\n");

function locate(quote: string): { start: number; end: number } | null {
  const start = storedText.indexOf(quote);
  return start === -1 ? null : { start, end: start + quote.length };
}

const located = findings
  .map((f) => ({ finding: f, span: locate(f.sentence) }))
  .filter((x): x is { finding: Finding; span: { start: number; end: number } } =>
    x.span !== null,
  );

const droppedCount = findings.length - located.length;

export function Inspector({
  lead,
  action,
}: {
  lead?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const [activeId, setActiveId] = useState(located[0]?.finding.id ?? "");
  const [frame, setFrame] = useState<{ top: number; height: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const citeRefs = useRef<Record<string, HTMLElement | null>>({});

  const measure = useCallback(() => {
    const el = citeRefs.current[activeId];
    const content = contentRef.current;
    if (!el || !content) return;
    const top = el.offsetTop;
    setFrame({ top, height: el.offsetHeight });
  }, [activeId]);

  useEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [measure]);

  // The window travels; the document's words are never moved or transformed.
  const settled = useRef(false);
  useEffect(() => {
    const el = citeRefs.current[activeId];
    const scroller = scrollRef.current;
    if (!el || !scroller) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scroller.scrollTo({
      top: Math.max(0, el.offsetTop - scroller.clientHeight * 0.28),
      behavior: reduce || !settled.current ? "auto" : "smooth",
    });
    settled.current = true;
  }, [activeId]);

  const active = located.find((l) => l.finding.id === activeId);

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-start lg:gap-14">
      {/* ── Findings: the same report rows the review screen uses ────── */}
      <div className="min-w-0">
        {lead}
        <div className="mt-10 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-graphite pb-2 lg:mt-14">
          <h2 className="text-[1.0625rem] font-bold text-graphite">
            {located.length} clauses could hurt you
          </h2>
          <p className="text-[0.8125rem] text-soft">
            Ranked by how hard each is to escape, then money
          </p>
        </div>

        <ul>
          {located.map(({ finding, span }) => {
            const isActive = finding.id === activeId;
            const critical = finding.severity === "Critical";
            return (
              <li key={finding.id} className={`border-b border-rule ${isActive ? "bg-wash" : ""}`}>
                <button
                  type="button"
                  aria-expanded={isActive}
                  onClick={() => setActiveId(finding.id)}
                  className="grid w-full grid-cols-[3rem_minmax(0,1fr)] items-start gap-x-3 gap-y-1.5 px-3 py-3.5 text-left transition-colors duration-150 hover:bg-wash sm:grid-cols-[3rem_minmax(0,1fr)_7rem]"
                >
                  <span className="tabular pt-0.5 text-[0.8125rem] text-soft">{finding.code}</span>
                  <span className="text-[1rem] font-semibold leading-snug text-graphite">
                    {finding.title}
                  </span>
                  <span
                    className={`col-start-2 flex items-center gap-2 sm:col-start-auto sm:pt-0.5 ${
                      critical ? "text-crit" : "text-high"
                    }`}
                  >
                    <span
                      className="sev-bar shrink-0"
                      style={{ width: critical ? 44 : 22 }}
                      aria-hidden="true"
                    />
                    <span className="text-[0.8125rem] font-bold">{finding.severity}</span>
                  </span>
                </button>

                {isActive ? (
                  <div className="px-3 pb-5 sm:pl-[4.5rem]">
                    {/* On a phone the document is below the fold, so the
                        sentence comes with the finding. */}
                    <div className="mb-4 border border-rule bg-quote lg:hidden">
                      <p className="tabular px-4 pt-2.5 text-[0.75rem] font-semibold text-soft">
                        From your document · characters {span.start.toLocaleString()}–
                        {span.end.toLocaleString()}
                      </p>
                      <p className="document px-4 pb-3 pt-1.5 text-[1rem] leading-[1.6] text-graphite">
                        {finding.sentence}
                      </p>
                    </div>

                    <dl className="tabular grid gap-x-5 gap-y-1 text-[0.875rem] sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)] sm:gap-y-1.5">
                      {finding.measures.map((m) => (
                        <div key={m.label} className="contents">
                          <dt className="text-soft">{m.label}</dt>
                          <dd className="mb-1.5 font-semibold text-graphite sm:mb-0">{m.value}</dd>
                        </div>
                      ))}
                    </dl>

                    <p className="mt-4 max-w-[62ch] text-[0.9375rem] leading-relaxed text-graphite">
                      {finding.meaning}
                    </p>

                    <div className="mt-4 border border-rule bg-white px-4 py-3">
                      <p className="text-[0.8125rem] font-semibold text-soft">
                        Counter-offer to send back
                      </p>
                      <p className="mt-1 max-w-[62ch] text-[0.9375rem] leading-relaxed text-graphite">
                        {finding.counter}
                      </p>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>

        <p className="mt-3 text-[0.8125rem] text-soft">
          {droppedCount === 0
            ? "All four quotes matched the stored text. None dropped."
            : `${droppedCount} flag dropped — quote not found in stored text.`}
        </p>

        {action}
      </div>

      {/* ── The document, with the window travelling over it ─────────── */}
      <figure id="inspector" className="relative min-w-0 scroll-mt-6 lg:sticky lg:top-8">
        <figcaption className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1.5 pb-2.5">
          <span className="text-[0.9375rem] font-semibold text-graphite">
            {SAMPLE_LETTER.filename}
          </span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="tabular text-[0.8125rem] text-soft">
              {SAMPLE_LETTER.words.toLocaleString()} words · read in your browser
            </span>
            <span className="border border-rule bg-white px-2 py-0.5 text-[0.75rem] font-semibold text-graphite">
              Sample — not a real contract
            </span>
          </span>
        </figcaption>

        <div
          ref={scrollRef}
          className="sheet sheet-scroll relative h-[26rem] overflow-y-auto border border-rule bg-quote sm:h-[32rem] lg:h-[38rem]"
        >
          <div ref={contentRef} className="relative px-5 py-7 pl-9 sm:px-8 sm:pl-12">
            <p className="document text-[0.9375rem] uppercase tracking-[0.12em] text-soft">
              {SAMPLE_LETTER.company}
            </p>
            <p className="document mt-1 text-base font-bold text-graphite">
              {SAMPLE_LETTER.title}
            </p>

            {paragraphs.map((p, i) => (
              <div key={i} className="mt-5">
                {p.heading ? (
                  <p className="document text-[0.9375rem] font-bold text-graphite">
                    {p.heading}
                  </p>
                ) : null}
                <p className="document mt-1 text-[0.9375rem] text-graphite sm:text-base">
                  {p.runs.map((run, j) => {
                    if (!run.cite) return <span key={j}>{run.text} </span>;
                    return (
                      <span
                        key={j}
                        id={`cite-${run.cite}`}
                        ref={(el) => {
                          citeRefs.current[run.cite!] = el;
                        }}
                      >
                        {run.text}{" "}
                      </span>
                    );
                  })}
                </p>
              </div>
            ))}

            {/* Redline's layer. The window travels over words that do not. */}
            {frame ? (
              <>
                <div
                  className="veil halftone-paper"
                  style={{ top: 0, height: Math.max(0, frame.top - 4) }}
                  aria-hidden="true"
                />
                <div
                  className="veil halftone-paper"
                  style={{ top: frame.top + frame.height + 4, bottom: 0 }}
                  aria-hidden="true"
                />
                <div
                  className="window-mark"
                  style={{ top: frame.top - 4, height: frame.height + 8 }}
                  aria-hidden="true"
                />
              </>
            ) : null}
          </div>
        </div>

        {active ? (
          <p className="tabular border-x border-b border-rule bg-white px-3 py-2 text-[0.8125rem] text-soft">
            {active.finding.code} · the framed sentence is characters{" "}
            {active.span.start.toLocaleString()}–{active.span.end.toLocaleString()}
          </p>
        ) : null}
      </figure>
    </div>
  );
}
