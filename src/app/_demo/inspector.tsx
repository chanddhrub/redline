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
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:gap-12 lg:items-start">
      {/* ── Findings: title lines on the flat field ─────────────────── */}
      <div className="min-w-0">
        {lead}
        <div className="mt-10 flex items-baseline justify-between gap-4 border-b-2 border-ink pb-2 lg:mt-14">
          <h2 className="label">Ranked findings</h2>
          <p className="label text-burnt">Escapability, then money</p>
        </div>

        <ul className="mt-1">
          {located.map(({ finding, span }) => {
            const isActive = finding.id === activeId;
            return (
              <li key={finding.id} className="border-b border-ink/35">
                <button
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setActiveId(finding.id)}
                  className={`group block w-full px-3 py-4 text-left transition-colors duration-200 sm:px-4 ${
                    isActive
                      ? "on-ink bg-ink text-spot"
                      : "text-ink hover:bg-ink/10"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="label tabular shrink-0">{finding.code}</span>
                    <span
                      className="sev-bar shrink-0"
                      style={{ width: finding.severity === "Critical" ? 44 : 22 }}
                      aria-hidden="true"
                    />
                    <span className="label shrink-0">{finding.severity}</span>
                  </div>
                  <p className="mt-2 font-voice text-[1.0625rem] leading-snug font-semibold sm:text-lg">
                    {finding.title}
                  </p>
                  <p
                    className={`label tabular mt-2 ${
                      isActive ? "text-spot" : "text-burnt"
                    }`}
                  >
                    Quote located · chars {span.start.toLocaleString()}–
                    {span.end.toLocaleString()}
                  </p>
                </button>

                {isActive ? (
                  <div className="bg-ink/8 px-3 pb-5 pt-4 sm:px-4">
                    <dl className="tabular grid grid-cols-1 gap-x-8 border-t border-ink/40 sm:grid-cols-2">
                      {finding.measures.map((m) => (
                        <div
                          key={m.label}
                          className="min-w-0 border-b border-ink/25 py-2"
                        >
                          <dt className="label text-burnt">{m.label}</dt>
                          <dd className="mt-1 font-voice text-sm leading-snug font-semibold">
                            {m.value}
                          </dd>
                        </div>
                      ))}
                    </dl>

                    <div className="mt-4 border-2 border-ink bg-paper lg:hidden">
                      <p className="label border-b-2 border-ink px-3 py-1.5">
                        From your document · chars {span.start.toLocaleString()}–
                        {span.end.toLocaleString()}
                      </p>
                      <p className="document px-3 py-3 text-[0.9375rem] text-ink">
                        {finding.sentence}
                      </p>
                    </div>

                    <p className="mt-4 max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed">
                      {finding.meaning}
                    </p>

                    <div className="mt-4 border-t-2 border-ink pt-3">
                      <p className="label text-burnt">Counter-offer to send back</p>
                      <p className="mt-1.5 max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed">
                        {finding.counter}
                      </p>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>

        <p className="label text-burnt mt-4">
          {droppedCount === 0
            ? "All four quotes matched the stored text. None dropped."
            : `${droppedCount} flag dropped — quote not found in stored text.`}
        </p>

        {action}
      </div>

      {/* ── The document: cropped hard, bleeding off the edge ────────── */}
      <figure
        id="inspector"
        className="relative min-w-0 scroll-mt-6 lg:sticky lg:top-8"
      >
        <figcaption className="border-b-2 border-ink pb-2">
          <span className="label block">{SAMPLE_LETTER.filename}</span>
          <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="label tabular text-burnt">
              {SAMPLE_LETTER.words.toLocaleString()} words · parsed in your browser
            </span>
            <span className="label bg-ink px-2 py-1 text-spot">
              Sample — not a real contract
            </span>
          </span>
        </figcaption>

        <div
          ref={scrollRef}
          className="sheet sheet-scroll relative h-[26rem] overflow-y-auto bg-paper sm:h-[32rem] lg:-mr-[5vw] lg:h-[38rem]"
        >
          <div ref={contentRef} className="relative px-5 py-7 pl-9 sm:px-8 sm:pl-12">
            <p className="document text-[0.9375rem] uppercase tracking-[0.12em] text-ink/70">
              {SAMPLE_LETTER.company}
            </p>
            <p className="document mt-1 text-base font-bold text-ink">
              {SAMPLE_LETTER.title}
            </p>

            {paragraphs.map((p, i) => (
              <div key={i} className="mt-5">
                {p.heading ? (
                  <p className="document text-[0.9375rem] font-bold text-ink">
                    {p.heading}
                  </p>
                ) : null}
                <p className="document mt-1 text-[0.9375rem] text-ink sm:text-base">
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
          <p className="label border-t-2 border-ink bg-ink px-3 py-2 text-spot lg:-mr-[5vw]">
            {active.finding.code} · windowed at chars{" "}
            <span className="tabular">
              {active.span.start.toLocaleString()}–{active.span.end.toLocaleString()}
            </span>
          </p>
        ) : null}
      </figure>
    </div>
  );
}
