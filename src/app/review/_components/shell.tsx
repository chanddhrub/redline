"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addRedLine,
  editRedLine,
  emptyRequest,
  isReady,
  removeRedLine,
  setDocument,
  setJurisdiction,
  toAnalysisRequest,
  US_STATES,
  whatIsMissing,
  type AnalysisRequestState,
  type UsState,
} from "@/lib/intake/analysis-request";
import {
  parseDocument,
  type ParsedDocument,
  type Refusal,
} from "@/lib/intake/parse-document";
import { findings, paragraphs, SAMPLE_LETTER } from "@/app/_demo/sample";

type Phase =
  | { kind: "idle" }
  | { kind: "parsing"; filename: string }
  | { kind: "refused"; refusal: Refusal; filename: string }
  | { kind: "ready"; filename: string; source: "yours" | "sample" };

/** Refusal copy is product surface, not an error string: what happened, why
 *  the standard exists, and what to do instead. */
const REFUSAL_COPY: Record<
  Refusal["kind"],
  { what: string; why: string; instead: string }
> = {
  "no-text-layer": {
    what: "This document has no readable text — it is a scan or a photograph.",
    why: "Reading a picture of text means guessing at it, and a quoted sentence that was misread on the way in is worse than no quote at all, because it still looks checkable.",
    instead: "Ask whoever sent it for the original Word or PDF file, or paste the text in directly.",
  },
  encrypted: {
    what: "This PDF is password-protected, so its text cannot be opened here.",
    why: "Your file is parsed in your browser and never uploaded, so there is nowhere to send a password.",
    instead: "Save an unprotected copy from your PDF reader, or paste the text in directly.",
  },
  "unsupported-format": {
    what: "This file format is not one Redline reads yet.",
    why: "Right now Redline reads plain text. PDF and Word support are being built, and shipping a half-working reader would put quotes on screen that were never checked.",
    instead: "Paste the text of your offer letter in directly, or save it as a .txt file.",
  },
  unreadable: {
    what: "This file could not be read at all.",
    why: "The bytes in it are not text Redline can decode, so there is nothing it could quote from honestly.",
    instead: "Try another copy of the file, or paste the text in directly.",
  },
  empty: {
    what: "This file is empty.",
    why: "There is no text in it to read.",
    instead: "Check you picked the right file, or paste the text in directly.",
  },
};

/** The sample contract, assembled the way intake would store it. */
const SAMPLE_TEXT = paragraphs
  .map((p) => p.runs.map((r) => r.text).join(" "))
  .join("\n\n");

export function Shell() {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [request, setRequest] = useState<AnalysisRequestState>(emptyRequest());
  const [activeFinding, setActiveFinding] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState<string | null>(null);
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const source = phase.kind === "ready" ? phase.source : null;
  const sample = source === "sample";

  const ingest = useCallback(async (bytes: ArrayBuffer, filename: string) => {
    setPhase({ kind: "parsing", filename });
    setActiveFinding(null);
    const result = await parseDocument(bytes, filename);
    if (!result.ok) {
      setRequest((s) => setDocument(s, null));
      setPhase({ kind: "refused", refusal: result.refusal, filename });
      return;
    }
    setRequest((s) => setDocument(s, result.document));
    setPhase({ kind: "ready", filename, source: "yours" });
  }, []);

  const onFiles = useCallback(
    async (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      await ingest(await file.arrayBuffer(), file.name);
    },
    [ingest],
  );

  const loadSample = useCallback(async () => {
    const bytes = new TextEncoder().encode(SAMPLE_TEXT);
    setPhase({ kind: "parsing", filename: SAMPLE_LETTER.filename });
    const result = await parseDocument(
      bytes.buffer.slice(0) as ArrayBuffer,
      SAMPLE_LETTER.filename,
    );
    if (!result.ok) return;
    setRequest((s) => setDocument(s, result.document));
    setPhase({ kind: "ready", filename: SAMPLE_LETTER.filename, source: "sample" });
    setActiveFinding(findings[0]?.id ?? null);
  }, []);

  const clear = useCallback(() => {
    setRequest((s) => setDocument(s, null));
    setPhase({ kind: "idle" });
    setActiveFinding(null);
    setAsked(null);
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  // Only the two things the reader typed survive an accidental in-page
  // navigation. sessionStorage, never localStorage: a shared machine must not
  // keep someone's offer letter.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("redline.intake");
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        jurisdiction: UsState | null;
        redLines: { id: string; text: string }[];
      };
      setRequest((s) => ({
        ...s,
        jurisdiction: saved.jurisdiction ?? null,
        redLines: saved.redLines ?? [],
      }));
    } catch {
      /* a blocked or cleared store is a working state, not an error */
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        "redline.intake",
        JSON.stringify({
          jurisdiction: request.jurisdiction,
          redLines: request.redLines,
        }),
      );
    } catch {
      /* ignore */
    }
  }, [request.jurisdiction, request.redLines]);

  const doc: ParsedDocument | null = request.document;
  const missing = whatIsMissing(request);
  const ready = isReady(request);

  const located = useMemo(() => {
    if (!sample || !doc) return [];
    return findings
      .map((f) => ({ finding: f, span: doc.locate(f.sentence) }))
      .filter((x) => x.span !== null) as {
      finding: (typeof findings)[number];
      span: { start: number; end: number };
    }[];
  }, [sample, doc]);

  const activeSpan =
    located.find((l) => l.finding.id === activeFinding)?.span ?? null;

  return (
    <div className="min-h-screen bg-ink text-paper lg:flex">
      <Rail ready={ready} sample={sample} />

      <main className="min-w-0 flex-1 lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* ── The document. The fixed thing on the screen. ───────────── */}
        <section
          id="document"
          aria-label="Your document"
          className="min-w-0 border-b-2 border-spot lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:overflow-hidden lg:border-b-0 lg:border-r-2"
        >
          <PaneHead
            title={phase.kind === "idle" ? "Your document" : phase.kind === "ready" ? phase.filename : "Your document"}
            note={
              phase.kind === "ready" && doc
                ? `${doc.text.length.toLocaleString()} characters · ${doc.sentences.length} sentences · parsed in your browser`
                : "Parsed in your browser. The file never leaves this machine."
            }
            action={
              phase.kind === "ready" ? (
                <button type="button" onClick={clear} className="mark">
                  Replace
                </button>
              ) : null
            }
          />

          <div className="flex min-h-0 flex-col p-4 sm:p-6 lg:flex-1">
            {phase.kind === "idle" && !pasting ? (
              <Dropzone
                dragging={dragging}
                setDragging={setDragging}
                onFiles={onFiles}
                fileRef={fileRef}
                onPaste={() => setPasting(true)}
                onSample={loadSample}
              />
            ) : null}

            {phase.kind === "idle" && pasting ? (
              <form
                className="border-2 border-spot bg-ink"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const bytes = new TextEncoder().encode(pasted);
                  await ingest(bytes.buffer.slice(0) as ArrayBuffer, "pasted-text.txt");
                  setPasting(false);
                }}
              >
                <label htmlFor="paste" className="mark block border-b-2 border-spot px-3 py-2">
                  Paste the text of your document
                </label>
                <textarea
                  id="paste"
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                  rows={12}
                  className="document w-full resize-y bg-paper px-4 py-3 text-[0.9375rem] text-ink outline-none"
                  placeholder="Paste here…"
                />
                <div className="flex flex-wrap gap-3 border-t-2 border-spot p-3">
                  <button type="submit" className="slug label slug-on-ink">
                    <span>Read this text</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPasting(false)}
                    className="mark"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : null}

            {phase.kind === "parsing" ? (
              <p className="label flex items-center gap-3 text-spot">
                <span className="sev-bar w-10 animate-pulse" aria-hidden="true" />
                Reading {phase.filename}…
              </p>
            ) : null}

            {phase.kind === "refused" ? (
              <RefusalPanel
                refusal={phase.refusal}
                filename={phase.filename}
                onRetry={clear}
                onPaste={() => {
                  clear();
                  setPasting(true);
                }}
              />
            ) : null}

            {phase.kind === "ready" && doc ? (
              <DocumentSheet
                text={doc.text}
                span={activeSpan}
                stamp={
                  activeFinding && sample
                    ? located.find((l) => l.finding.id === activeFinding)?.finding.code ?? null
                    : null
                }
              />
            ) : null}
          </div>
        </section>

        {/* ── Findings, questions, red lines: peers, never modals. ───── */}
        <section className="min-w-0">
          <Jurisdiction
            value={request.jurisdiction}
            onChange={(v) => setRequest((s) => setJurisdiction(s, v))}
          />

          <Findings
            sample={sample}
            phase={phase.kind}
            located={located}
            active={activeFinding}
            setActive={setActiveFinding}
            onSample={loadSample}
            missing={missing}
            ready={ready}
          />

          <QuestionBox
            enabled={phase.kind === "ready"}
            value={question}
            setValue={setQuestion}
            asked={asked}
            onAsk={() => setAsked(question)}
          />

          <RedLines
            lines={request.redLines}
            draft={draft}
            setDraft={setDraft}
            editing={editing}
            setEditing={setEditing}
            onAdd={() => {
              setRequest((s) => addRedLine(s, draft));
              setDraft("");
            }}
            onSave={() => {
              if (editing) setRequest((s) => editRedLine(s, editing.id, editing.text));
              setEditing(null);
            }}
            onRemove={(id) => setRequest((s) => removeRedLine(s, id))}
          />

          <ReadyBar missing={missing} ready={ready} request={request} />
        </section>
      </main>
    </div>
  );
}

/* ── Chrome ──────────────────────────────────────────────────────────── */

function Rail({ ready, sample }: { ready: boolean; sample: boolean }) {
  const marks = [
    { href: "#document", label: "Document" },
    { href: "#findings", label: "Findings" },
    { href: "#questions", label: "Questions" },
    { href: "#redlines", label: "Red lines" },
  ];
  return (
    <div className="sticky top-0 z-20 flex items-center gap-4 border-b-2 border-ink bg-spot px-4 py-3 text-ink lg:h-screen lg:w-56 lg:flex-col lg:items-stretch lg:gap-6 lg:border-b-0 lg:border-r-2 lg:px-4 lg:py-5">
      <a href="/" className="display mark-ink shrink-0 border-2 border-ink px-2 py-1 text-xl">
        Redline
      </a>
      <nav className="flex min-w-0 flex-1 gap-4 overflow-x-auto lg:flex-col lg:gap-1 lg:overflow-visible">
        {marks.map((m) => (
          <a key={m.href} href={m.href} className="mark mark-ink shrink-0 px-1 py-0.5 lg:py-1">
            {m.label}
          </a>
        ))}
      </nav>
      {/* Reserved: the saved library takes the position below this rule when
          it arrives. Deferred by ADR 0002 — nothing is designed or shown. */}
      <p className="label hidden text-burnt lg:mt-auto lg:block">
        {sample ? "Sample loaded" : ready ? "Ready to analyse" : "Session only · nothing saved"}
      </p>
    </div>
  );
}

function PaneHead({
  title,
  note,
  action,
}: {
  title: string;
  note?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b-2 border-spot px-4 py-3 sm:px-6">
      <h2 className="label text-spot">{title}</h2>
      {action}
      {note ? <p className="label w-full text-paper/70">{note}</p> : null}
    </div>
  );
}

function SectionHead({ id, title, note }: { id: string; title: string; note?: string }) {
  return (
    <div
      id={id}
      className="scroll-mt-[4.75rem] border-b-2 border-spot px-4 py-3 sm:px-6 lg:scroll-mt-4"
    >
      <h2 className="label text-spot">{title}</h2>
      {note ? <p className="label mt-1 text-paper/70">{note}</p> : null}
    </div>
  );
}

/* ── Intake ──────────────────────────────────────────────────────────── */

function Dropzone({
  dragging,
  setDragging,
  onFiles,
  fileRef,
  onPaste,
  onSample,
}: {
  dragging: boolean;
  setDragging: (v: boolean) => void;
  onFiles: (f: FileList | null) => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onPaste: () => void;
  onSample: () => void;
}) {
  return (
    <div className="lg:flex lg:flex-1 lg:flex-col lg:justify-center">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          onFiles(e.dataTransfer.files);
        }}
        className={`border-2 border-dashed px-5 py-12 text-center transition-colors duration-200 sm:py-16 ${
          dragging ? "border-spot bg-spot/15" : "border-paper/45"
        }`}
      >
        <p className="display text-2xl text-paper sm:text-3xl">
          Drop your offer letter here
        </p>
        <p className="mx-auto mt-3 max-w-[52ch] font-voice text-[0.9375rem] leading-relaxed text-paper/80">
          Plain text for now — PDF and Word are being built. Your file is read
          in this browser and never uploaded; only the text is kept, and only
          until you close the tab.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="slug label slug-on-ink"
          >
            <span>Choose a file</span>
          </button>
          <button type="button" onClick={onPaste} className="mark">
            Paste text instead
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".txt,text/plain"
          className="sr-only"
          onChange={(e) => onFiles(e.target.files)}
        />
      </div>

      <p className="mt-4 font-voice text-sm leading-relaxed text-paper/70">
        Want to see what comes back first?{" "}
        <button
          type="button"
          onClick={onSample}
          className="mark underline decoration-2"
        >
          Load a sample contract
        </button>{" "}
        — a synthetic offer letter, not a real one.
      </p>
    </div>
  );
}

function RefusalPanel({
  refusal,
  filename,
  onRetry,
  onPaste,
}: {
  refusal: Refusal;
  filename: string;
  onRetry: () => void;
  onPaste: () => void;
}) {
  const copy = REFUSAL_COPY[refusal.kind];
  return (
    <div className="border-2 border-spot">
      <p className="label border-b-2 border-spot bg-spot px-4 py-2 text-ink">
        Not read · {filename}
      </p>
      <div className="space-y-3 px-4 py-4">
        <p className="font-voice text-lg leading-relaxed text-paper">{copy.what}</p>
        <p className="max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-paper/80">
          {copy.why}
        </p>
        <p className="max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-paper">
          {copy.instead}
        </p>
        <div className="flex flex-wrap gap-3 pt-1">
          <button type="button" onClick={onPaste} className="slug label slug-on-ink">
            <span>Paste the text instead</span>
          </button>
          <button type="button" onClick={onRetry} className="mark">
            Try another file
          </button>
        </div>
      </div>
    </div>
  );
}

function DocumentSheet({
  text,
  span,
  stamp,
}: {
  text: string;
  span: { start: number; end: number } | null;
  stamp: string | null;
}) {
  const before = span ? text.slice(0, span.start) : text;
  const cited = span ? text.slice(span.start, span.end) : "";
  const after = span ? text.slice(span.end) : "";
  const citedRef = useRef<HTMLSpanElement>(null);
  const scrollerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const cited = citedRef.current;
    const scroller = scrollerRef.current;
    if (!span || !cited || !scroller) return;
    if (!window.matchMedia("(min-width: 1024px)").matches) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scroller.scrollTo({
      top: Math.max(0, cited.offsetTop - scroller.clientHeight * 0.35),
      behavior: reduce ? "auto" : "smooth",
    });
  }, [span]);

  return (
    <figure
      ref={scrollerRef}
      className="sheet sheet-scroll relative flex min-h-0 max-h-[70vh] flex-1 flex-col overflow-y-auto border-2 border-spot bg-paper lg:max-h-none"
    >
      <pre className="document whitespace-pre-wrap px-5 py-5 text-[0.9375rem] text-ink sm:px-7 sm:text-base">
        {span ? (
          <>
            <span className="opacity-[0.62]">{before}</span>
            <span ref={citedRef} className="cited">
              {cited}
            </span>
            <span className="opacity-[0.62]">{after}</span>
          </>
        ) : (
          text
        )}
      </pre>
      {stamp ? (
        <figcaption className="label sticky bottom-0 border-t-2 border-ink bg-ink px-4 py-2 text-spot">
          {stamp} · windowed in your document
        </figcaption>
      ) : null}
    </figure>
  );
}

/* ── Where you work ──────────────────────────────────────────────────── */

function Jurisdiction({
  value,
  onChange,
}: {
  value: UsState | null;
  onChange: (v: UsState) => void;
}) {
  return (
    <>
      <SectionHead
        id="jurisdiction"
        title="Where you work"
        note="Asked because the same clause carries different weight in different states"
      />
      <div className="px-4 py-4 sm:px-6">
        <p className="max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-paper/80">
          This is shown back to you as a separate, labelled layer — never mixed
          into the sentences quoted from your document, and it never changes a
          flag&rsquo;s severity.
        </p>
        <label htmlFor="state" className="mark mt-4 block">
          US state
        </label>
        <select
          id="state"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value as UsState)}
          className="mt-2 w-full max-w-xs border-2 border-spot bg-paper px-3 py-2 font-voice text-[0.9375rem] text-ink"
        >
          <option value="" disabled>
            Choose your state…
          </option>
          {US_STATES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {value ? (
          <p className="label mt-2 text-spot">In use: {value}</p>
        ) : null}
      </div>
    </>
  );
}

/* ── Findings ────────────────────────────────────────────────────────── */

function Findings({
  sample,
  phase,
  located,
  active,
  setActive,
  onSample,
  missing,
  ready,
}: {
  sample: boolean;
  phase: Phase["kind"];
  located: { finding: (typeof findings)[number]; span: { start: number; end: number } }[];
  active: string | null;
  setActive: (id: string) => void;
  onSample: () => void;
  missing: string[];
  ready: boolean;
}) {
  return (
    <>
      <SectionHead
        id="findings"
        title="Findings"
        note={sample ? "Ranked by escapability, then money" : undefined}
      />
      <div className="px-4 py-4 sm:px-6">
        {sample ? (
          <>
            <ul className="border-t-2 border-spot">
              {located.map(({ finding, span }) => {
                const isActive = finding.id === active;
                return (
                  <li key={finding.id} className="border-b border-spot/40">
                    <button
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => setActive(finding.id)}
                      className={`block w-full px-3 py-3 text-left transition-colors duration-200 ${
                        isActive ? "bg-spot text-ink" : "text-paper hover:bg-spot/15"
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <span className="label tabular">{finding.code}</span>
                        <span
                          className="sev-bar"
                          style={{ width: finding.severity === "Critical" ? 40 : 20 }}
                          aria-hidden="true"
                        />
                        <span className="label">{finding.severity}</span>
                      </span>
                      <span className="mt-1.5 block font-voice text-[1.0625rem] font-semibold leading-snug">
                        {finding.title}
                      </span>
                      <span
                        className={`label tabular mt-1.5 block ${
                          isActive ? "text-ink/75" : "text-paper/60"
                        }`}
                      >
                        Quote located · chars {span.start.toLocaleString()}–
                        {span.end.toLocaleString()}
                      </span>
                    </button>

                    {isActive ? (
                      <div className="space-y-4 bg-spot/10 px-3 pb-4 pt-3">
                        <div className="border-2 border-spot bg-paper lg:hidden">
                          <p className="label border-b-2 border-spot px-3 py-1.5 text-ink">
                            From your document · chars{" "}
                            {span.start.toLocaleString()}–{span.end.toLocaleString()}
                          </p>
                          <p className="document px-3 py-2.5 text-[0.9375rem] text-ink">
                            {finding.sentence}
                          </p>
                        </div>

                        <dl className="tabular grid gap-x-8 sm:grid-cols-2">
                          {finding.measures.map((m) => (
                            <div key={m.label} className="border-b border-spot/35 py-1.5">
                              <dt className="label text-paper/60">{m.label}</dt>
                              <dd className="mt-0.5 font-voice text-sm font-semibold text-paper">
                                {m.value}
                              </dd>
                            </div>
                          ))}
                        </dl>
                        <p className="max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-paper">
                          {finding.meaning}
                        </p>
                        <div className="border-t-2 border-spot pt-3">
                          <p className="label text-spot">Counter-offer to send back</p>
                          <p className="mt-1.5 max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-paper">
                            {finding.counter}
                          </p>
                        </div>
                        <div className="border-2 border-dashed border-spot">
                          <p className="label border-b-2 border-dashed border-spot px-3 py-1.5 text-spot">
                            Not from your document · general context
                          </p>
                          <div className="flex items-stretch">
<div className="halftone-ink w-7 shrink-0 border-r-2 border-dashed border-spot" aria-hidden="true" />
<p className="px-3 py-2 font-voice text-sm leading-relaxed text-paper">
                            Enforceability for your state is a separate layer and is
                            not built yet. It will sit here, labelled, and it will
                            never change the severity above.
                          </p>
</div>
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <p className="label mt-3 text-paper/60">
              All {located.length} quotes matched the stored text. None dropped.
            </p>
          </>
        ) : (
          <div className="border-2 border-dashed border-paper/40 px-4 py-6">
            <p className="font-voice text-[1.0625rem] leading-relaxed text-paper">
              {phase === "ready"
                ? "Your document is read and the text above is exactly what would be analysed. The analysis itself is not built yet."
                : `Nothing to rank yet — still missing ${missing.join(" and ")}.`}
            </p>
            <p className="mt-3 max-w-[62ch] font-voice text-sm leading-relaxed text-paper/75">
              When it runs, every flag here will quote a sentence from the panel
              beside it, and any flag whose sentence cannot be found in your
              stored text will be dropped before you see it.
            </p>
            {phase === "ready" && ready ? (
              <p className="label mt-3 text-spot">
                Intake complete — the analysis request is assembled.
              </p>
            ) : null}
            <button type="button" onClick={onSample} className="mark mt-4 underline decoration-2">
              See it on a sample contract
            </button>
          </div>
        )}
      </div>
    </>
  );
}

/* ── Question box ────────────────────────────────────────────────────── */

function QuestionBox({
  enabled,
  value,
  setValue,
  asked,
  onAsk,
}: {
  enabled: boolean;
  value: string;
  setValue: (v: string) => void;
  asked: string | null;
  onAsk: () => void;
}) {
  return (
    <>
      <SectionHead
        id="questions"
        title="Ask about your document"
        note="Answered only from the text you gave it"
      />
      <div className="px-4 py-4 sm:px-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (value.trim()) onAsk();
          }}
        >
          <label htmlFor="q" className="sr-only">
            Your question
          </label>
          <input
            id="q"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={!enabled}
            placeholder={
              enabled ? "How long does the non-compete last?" : "Read a document first"
            }
            className="w-full border-2 border-spot bg-paper px-3 py-2 font-voice text-[0.9375rem] text-ink placeholder:text-ink/45 disabled:cursor-not-allowed disabled:border-paper/30 disabled:bg-transparent disabled:text-paper/50 disabled:placeholder:text-paper/55"
          />
          <button
            type="submit"
            disabled={!enabled || !value.trim()}
            className="slug label slug-on-ink mt-3 disabled:cursor-not-allowed disabled:border-paper/30 disabled:bg-transparent disabled:text-paper/45"
          >
            <span>Ask</span>
          </button>
        </form>

        {asked ? (
          <div className="mt-4 border-2 border-spot">
            <p className="label border-b-2 border-spot px-3 py-1.5 text-spot">
              Your question
            </p>
            <p className="px-3 py-2 font-voice text-[0.9375rem] leading-relaxed text-paper">
              {asked}
            </p>
            <p className="label border-t-2 border-spot px-3 py-1.5 text-spot">
              No answer yet
            </p>
            <p className="px-3 py-2 font-voice text-sm leading-relaxed text-paper/80">
              The question box is not wired to anything yet. When it is, it will
              answer from your document alone and say so plainly when the text
              does not answer you, rather than reaching for general knowledge.
            </p>
          </div>
        ) : null}
      </div>
    </>
  );
}

/* ── Red lines ───────────────────────────────────────────────────────── */

function RedLines({
  lines,
  draft,
  setDraft,
  editing,
  setEditing,
  onAdd,
  onSave,
  onRemove,
}: {
  lines: { id: string; text: string }[];
  draft: string;
  setDraft: (v: string) => void;
  editing: { id: string; text: string } | null;
  setEditing: (v: { id: string; text: string } | null) => void;
  onAdd: () => void;
  onSave: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <>
      <SectionHead
        id="redlines"
        title="Your red lines"
        note="What you will not sign, in your own words"
      />
      <div className="px-4 py-4 sm:px-6">
        <p className="max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-paper/80">
          A red line moves a matching flag to the top of the list and names the
          line it crossed. It never hides anything, and it never moves a flag
          down.
        </p>

        <form
          className="mt-4 flex flex-wrap gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            onAdd();
          }}
        >
          <label htmlFor="rl" className="sr-only">
            Add a red line
          </label>
          <input
            id="rl"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="I will not sign an IP assignment covering personal projects"
            className="min-w-0 flex-1 border-2 border-spot bg-paper px-3 py-2 font-voice text-[0.9375rem] text-ink placeholder:text-ink/45"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="slug label slug-on-ink disabled:cursor-not-allowed disabled:border-paper/30 disabled:bg-transparent disabled:text-paper/45"
          >
            <span>Add</span>
          </button>
        </form>

        {lines.length === 0 ? (
          <p className="label mt-4 text-paper/60">
            None set. The analysis runs without them.
          </p>
        ) : (
          <ul className="mt-4 border-t-2 border-spot">
            {lines.map((line) => (
              <li key={line.id} className="border-b border-spot/40 py-2.5">
                {editing?.id === line.id ? (
                  <form
                    className="flex flex-wrap gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      onSave();
                    }}
                  >
                    <input
                      value={editing.text}
                      onChange={(e) => setEditing({ id: line.id, text: e.target.value })}
                      className="min-w-0 flex-1 border-2 border-spot bg-paper px-2 py-1 font-voice text-[0.9375rem] text-ink"
                      autoFocus
                    />
                    <button type="submit" className="mark">
                      Save
                    </button>
                    <button type="button" onClick={() => setEditing(null)} className="mark">
                      Cancel
                    </button>
                  </form>
                ) : (
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                    <p className="min-w-0 flex-1 font-voice text-[0.9375rem] leading-relaxed text-paper">
                      {line.text}
                    </p>
                    <button
                      type="button"
                      onClick={() => setEditing({ id: line.id, text: line.text })}
                      className="mark"
                    >
                      Edit
                    </button>
                    <button type="button" onClick={() => onRemove(line.id)} className="mark">
                      Delete
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

/* ── Readiness ───────────────────────────────────────────────────────── */

function ReadyBar({
  missing,
  ready,
  request,
}: {
  missing: string[];
  ready: boolean;
  request: AnalysisRequestState;
}) {
  const assembled = toAnalysisRequest(request);
  return (
    <div className="border-t-2 border-spot px-4 py-4 sm:px-6">
      {ready && assembled ? (
        <>
          <p className="label text-spot">Ready to analyse</p>
          <p className="mt-2 max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-paper/80">
            {assembled.sentences.length} sentences, {assembled.jurisdiction},{" "}
            {assembled.redLines.length === 0
              ? "no red lines"
              : `${assembled.redLines.length} red line${assembled.redLines.length === 1 ? "" : "s"}`}
            . The analysis is the next thing to be built; nothing has been sent
            anywhere.
          </p>
        </>
      ) : (
        <>
          <p className="label text-paper/70">Not ready yet</p>
          <p className="mt-2 font-voice text-[0.9375rem] leading-relaxed text-paper/80">
            Still needed: {missing.join(" and ")}.
          </p>
        </>
      )}
    </div>
  );
}
