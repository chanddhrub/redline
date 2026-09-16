"use client";

/**
 * The document, and the window that travels over it.
 *
 * The contract's own words are rendered once and never moved, transformed or
 * animated. Selecting a finding does not repaginate anything: Redline's own
 * layer travels instead — two halftone veils close in from above and below,
 * a 2px ink bracket lands around the cited sentence, and a 7px spot tick marks
 * the crop in the left margin. Everything that moves belongs to us.
 *
 * That is the whole reason the sentence is wrapped in a bare `<span>` carrying
 * no styling at all. The span exists to be measured. If it carried a
 * background or a rule, the document's appearance would change when a finding
 * was selected, and the reader could no longer be sure the words in front of
 * them are the words in their file.
 *
 * Under `prefers-reduced-motion: reduce` the transitions are gone (globals.css)
 * and the scroll jumps. The crop still lands; it simply does not travel.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { WireSpan } from "../_lib/wire";

interface Frame {
  top: number;
  height: number;
}

/** How far down the panel the cited sentence settles. DESIGN.md: 28%. */
const SETTLE = 0.28;

export function DocumentSheet({
  text,
  span,
  stamp,
  sample,
}: {
  text: string;
  span: WireSpan | null;
  /** The stamped code of whatever is windowed, for the receipt strip. */
  stamp: string | null;
  sample: boolean;
}) {
  const [frame, setFrame] = useState<Frame | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const citedRef = useRef<HTMLSpanElement>(null);
  const settled = useRef(false);

  const key = span ? `${span.start}-${span.end}` : "none";

  const measure = useCallback(() => {
    const cited = citedRef.current;
    if (!cited || !contentRef.current) {
      setFrame(null);
      return;
    }
    setFrame({ top: cited.offsetTop, height: cited.offsetHeight });
  }, []);

  useEffect(() => {
    measure();
  }, [measure, key, text]);

  // Type arrives after the first layout, and a frame measured against a
  // fallback face crops the wrong three lines. Re-measuring when the real
  // faces land costs nothing and is the difference between a bracket that
  // fits and one that is a line out.
  useEffect(() => {
    let live = true;
    document.fonts?.ready.then(() => {
      if (live) measure();
    });
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    return () => {
      live = false;
      window.removeEventListener("resize", onResize);
    };
  }, [measure]);

  // The scroller eases the sentence to 28% of the panel. The first crop of a
  // session jumps rather than animating: a page that scrolls itself the
  // moment it loads is a page that has taken the reader somewhere.
  useEffect(() => {
    const cited = citedRef.current;
    const scroller = scrollRef.current;
    if (!span || !cited || !scroller) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scroller.scrollTo({
      top: Math.max(0, cited.offsetTop - scroller.clientHeight * SETTLE),
      behavior: reduce || !settled.current ? "auto" : "smooth",
    });
    settled.current = true;
  }, [key, span]);

  const before = span ? text.slice(0, span.start) : text;
  const cited = span ? text.slice(span.start, span.end) : "";
  const after = span ? text.slice(span.end) : "";

  return (
    <figure className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        className="sheet sheet-scroll relative max-h-[26rem] min-h-0 flex-1 overflow-y-auto border-2 border-spot bg-paper sm:max-h-[32rem] lg:max-h-none"
      >
        {/* Margins rather than padding: the veils and the bracket position
            against this box, and the tick hangs 1.45rem off its left edge
            into the gutter the margin leaves. */}
        <div ref={contentRef} className="relative ml-12 mr-4 sm:mr-6">
          <pre className="document whitespace-pre-wrap break-words py-7 text-[0.9375rem] text-ink sm:text-base">
            {span ? (
              <>
                {before}
                <span ref={citedRef}>{cited}</span>
                {after}
              </>
            ) : (
              text
            )}
          </pre>

          {frame ? (
            <>
              <div
                className="veil halftone-paper"
                style={{
                  left: "-3rem",
                  right: "-1.5rem",
                  top: 0,
                  height: Math.max(0, frame.top - 4),
                }}
                aria-hidden="true"
              />
              <div
                className="veil halftone-paper"
                style={{
                  left: "-3rem",
                  right: "-1.5rem",
                  top: frame.top + frame.height + 4,
                  bottom: 0,
                }}
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

      <figcaption className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t-2 border-spot bg-ink px-4 py-2">
        <span className="label tabular text-spot">
          {stamp && span
            ? `${stamp} · windowed at chars ${span.start.toLocaleString()}–${span.end.toLocaleString()}`
            : `${text.length.toLocaleString()} characters · nothing windowed`}
        </span>
        {sample ? (
          <span className="label bg-paper px-2 py-1 text-ink">
            Sample — not a real contract
          </span>
        ) : null}
      </figcaption>
    </figure>
  );
}
