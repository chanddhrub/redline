"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addRedLine,
  editRedLine,
  emptyRequest,
  INTAKE_SESSION_KEY,
  isReady,
  isUsState,
  removeRedLine,
  restoreIntake,
  serialiseIntake,
  setDocument,
  setJurisdiction,
  toAnalysisRequest,
  US_STATES,
  whatIsMissing,
  type AnalysisRequestState,
  type IntakeOrigin,
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
  | { kind: "parsing"; filename: string; progress: number }
  | { kind: "refused"; refusal: Refusal; filename: string }
  | { kind: "ready"; filename: string; source: "yours" | "sample" };

interface RefusalCopy {
  what: string;
  why: string;
  instead: string;
}

/**
 * Refusal copy is product surface, not an error string. Every kind says three
 * things: what happened, why Redline holds the standard, and what the reader
 * can do next. A refusal with no next step is a dead end, and a refusal that
 * apologises invites the reader to wait for the gap to be filled.
 *
 * `no-text-layer` is the one that must not read as a limitation. OCR is
 * excluded permanently (ADR 0001): a citation is worthless when the text it
 * points at was misread, and a misread sentence in quotation marks is harder
 * to catch than no sentence at all.
 */
function refusalCopy(refusal: Refusal): RefusalCopy {
  switch (refusal.kind) {
    case "no-text-layer":
      return {
        what:
          "This PDF is a picture of a document, a scan or a photo, so there is no text in it to read. " +
          "A few words may have come through, a header or a page number, but not the contract.",
        why:
          "Redline will never run text recognition over a picture, and that is a permanent decision. " +
          "A guessed sentence still arrives in quotation marks, and you would have no way to tell it " +
          "from one that was really in your contract.",
        instead:
          "Ask whoever sent it for the Word or PDF original, or paste the text in here.",
      };
    case "encrypted":
      return {
        what: "This PDF is password-protected, so nothing inside it can be opened here.",
        why:
          "Your file is read in your own browser and never uploaded, and Redline has nowhere to take " +
          "a password. The file has to be unlocked before it gets this far.",
        instead:
          "Open it in your PDF reader with the password and save an unprotected copy, or paste the " +
          "text in here.",
      };
    case "unsupported-format":
      return refusal.detected === "rtf"
        ? {
            what: "This is an RTF file. Redline reads PDF, .docx and plain text.",
            why:
              "Rich text keeps its formatting inline with its words, and sentences pulled back out of " +
              "it come apart often enough that a quote could not be trusted to be what your contract says.",
            instead:
              "Open it in Word or TextEdit, save it again as a .docx or a PDF, or paste the text in here.",
          }
        : {
            what:
              "This is a .doc file, the Word format from before 2007. Redline reads PDF, .docx and " +
              "plain text.",
            why:
              "Text pulled out of the old format comes back garbled often enough that a quoted sentence " +
              "could not be trusted to be what your contract says.",
            instead:
              "Open it in Word, save it again as a .docx or a PDF, or paste the text in here.",
          };
    case "unreadable":
      return {
        what: "This file could not be read at all. It looks damaged.",
        why:
          "Nothing whole came out of it, and half a contract read wrongly is worse than no reading at all.",
        instead: "Download it again, ask for another copy, or paste the text in here.",
      };
    case "empty":
      return {
        what: "There is nothing in this file.",
        why: "It holds no text, so there is nothing to quote from.",
        instead: "Check you picked the right file, or paste the text in here.",
      };
  }
}

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
  const [restored, setRestored] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const source = phase.kind === "ready" ? phase.source : null;
  const sample = source === "sample";
  const origin: IntakeOrigin | null =
    phase.kind === "ready" ? { filename: phase.filename, source: phase.source } : null;

  const ingest = useCallback(async (bytes: ArrayBuffer, filename: string) => {
    setPhase({ kind: "parsing", filename, progress: 0 });
    setActiveFinding(null);
    // Reading hands the thread back as it goes, so a long contract repaints
    // its way through instead of freezing the page.
    const result = await parseDocument(bytes, filename, {
      onProgress: (progress) =>
        setPhase((p) => (p.kind === "parsing" ? { ...p, progress } : p)),
    });
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
    setPhase({ kind: "parsing", filename: SAMPLE_LETTER.filename, progress: 0 });
    const result = await parseDocument(
      bytes.buffer.slice(0) as ArrayBuffer,
      SAMPLE_LETTER.filename,
      {
        onProgress: (progress) =>
          setPhase((p) => (p.kind === "parsing" ? { ...p, progress } : p)),
      },
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

  // Everything the reader has entered survives an accidental in-page
  // navigation: the document text, the state, the red lines. sessionStorage,
  // never localStorage — a shared machine must not keep someone's offer
  // letter. The serialising is the seam's, not this component's, so the round
  // trip is tested without a DOM.
  useEffect(() => {
    let live = true;
    (async () => {
      let raw: string | null = null;
      try {
        raw = sessionStorage.getItem(INTAKE_SESSION_KEY);
      } catch {
        /* a blocked or cleared store is a working state, not an error */
      }
      const { state, origin } = await restoreIntake(raw);
      if (!live) return;
      // A reader who started typing while the session was being read back
      // keeps what they typed; the restore yields to them.
      setRequest((current) =>
        current.document || current.jurisdiction || current.redLines.length
          ? current
          : state,
      );
      if (state.document && origin) {
        setPhase((p) =>
          p.kind === "idle"
            ? { kind: "ready", filename: origin.filename, source: origin.source }
            : p,
        );
        if (origin.source === "sample") {
          setActiveFinding((a) => a ?? findings[0]?.id ?? null);
        }
      }
      setRestored(true);
    })();
    return () => {
      live = false;
    };
  }, []);

  // Held until the restore has finished, or the empty first render would
  // write over the session it is in the middle of reading back.
  useEffect(() => {
    if (!restored) return;
    try {
      sessionStorage.setItem(INTAKE_SESSION_KEY, serialiseIntake(request, origin));
    } catch {
      /* a full or blocked store costs the restore, not the session */
    }
  }, [restored, request, origin]);

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
      <Rail
        ready={ready}
        missing={missing}
        sample={sample}
        jurisdiction={request.jurisdiction}
      />

      {/* Everything past the rail is an ink plate, and a 3px ink outline on
          an ink ground is an outline nobody can see. `.on-ink` switches the
          focus outline to spot for the whole pane; globals.css hands ink back
          inside the cream sheet, where spot would be the invisible one. */}
      <main className="on-ink min-w-0 flex-1 lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
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
                  className="document w-full resize-y bg-paper px-4 py-3 text-[0.9375rem] text-ink"
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
              <Reading filename={phase.filename} progress={phase.progress} />
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

function Rail({
  ready,
  missing,
  sample,
  jurisdiction,
}: {
  ready: boolean;
  missing: string[];
  sample: boolean;
  jurisdiction: UsState | null;
}) {
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
      {/* The state in use, wherever the reader has scrolled to: the
          enforceability layer is keyed to it, so it is never out of sight. */}
      <a
        href="#jurisdiction"
        className="mark mark-ink shrink-0 whitespace-nowrap border-2 border-ink px-2 py-1 lg:mt-auto lg:whitespace-normal"
      >
        {jurisdiction ? (
          <>
            <span className="hidden lg:inline">Working in </span>
            {jurisdiction}
          </>
        ) : (
          "State not set"
        )}
      </a>
      {/* Reserved: the saved library takes the position below this rule when
          it arrives. Deferred by ADR 0002 — nothing is designed or shown. */}
      <div className="hidden lg:block">
        {/* The reason a control is not available yet, kept in sight from
            wherever the reader has scrolled to. */}
        <p className="label text-burnt">
          {sample
            ? "Sample loaded"
            : ready
              ? "Ready to analyse"
              : `Still needed: ${missing.join(" and ")}`}
        </p>
        <p className="label mt-1 text-ink/70">
          Everything stays in this tab. Close it and it is gone.
        </p>
      </div>
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
          PDF, Word or plain text. Your file is read in this browser and never
          uploaded. Only the text is kept, and only until you close the tab.
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

/** Reading reports how far it has got. A long contract hands the thread back
 *  as it goes, so this number moves rather than sitting at nothing while the
 *  page looks frozen. */
function Reading({ filename, progress }: { filename: string; progress: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, progress)) * 100);
  return (
    <div className="border-2 border-spot px-4 py-4">
      <p className="label text-spot">Reading {filename}</p>
      <div
        role="progressbar"
        aria-label={`Reading ${filename}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="mt-3 h-3 w-full border-2 border-spot"
      >
        <span
          className="block h-full bg-spot transition-[width] duration-200 ease-out motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="label tabular mt-2 text-paper/70">
        {pct}% read · in this browser
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
  const copy = refusalCopy(refusal);
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
    <div>
      <SectionHead
        id="jurisdiction"
        title="Where you work"
        note="Asked because the same clause carries different weight in different states"
      />
      <div className="px-4 py-4 sm:px-6">
        <p
          id="jurisdiction-why"
          className="max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-paper"
        >
          The same clause does not mean the same thing in every state, and a
          finding that is accurate about your contract can still be no use to
          you without that. Where you work decides which context Redline shows.
          That context sits beside the findings on its own labelled panel: it is
          never mixed into the sentences quoted from your document, and it never
          changes a flag&rsquo;s severity.
        </p>

        <label htmlFor="state" className="label mt-6 block text-paper/70">
          State you work in
        </label>
        <span className="state-field mt-2">
          <select
            id="state"
            required
            autoComplete="address-level1"
            aria-describedby="jurisdiction-why"
            value={value ?? ""}
            onChange={(e) => {
              if (isUsState(e.target.value)) onChange(e.target.value);
            }}
            className="state-select"
          >
            <option value="" disabled>
              Choose a state
            </option>
            {US_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </span>

        {value ? (
          <div className="mt-4">
            <p className="label state-stamp">In use: {value}</p>
            <p className="mt-3 max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-paper/80">
              Every enforceability note you are shown is keyed to {value}. You
              can change it whenever you like, to fix a mistake or to see how
              the same contract reads somewhere else.
            </p>
          </div>
        ) : (
          <p className="mt-4 max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-paper/80">
            It is the only question Redline asks before it reads your document.
          </p>
        )}
      </div>
    </div>
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
        <p className="max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-paper">
          A red line is something you have already decided you will not sign.
          Write it the way you would say it out loud.
        </p>
        {/* Ticket criterion, not a nicety: a reader who expects a red line to
            filter the output has been misled by us. */}
        <p className="mt-3 max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-paper/80">
          When a flag matches one of your red lines, Redline moves that flag to
          the top and names the line it crossed. You still see every flag
          either way. A red line never hides one, and never ranks one lower
          than it would have been on its own.
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
            aria-describedby="rl-blank"
            className="min-w-0 flex-1 border-2 border-spot bg-paper px-3 py-2 font-voice text-[0.9375rem] text-ink placeholder:text-ink/45"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="slug label slug-on-ink disabled:cursor-not-allowed disabled:border-paper/30 disabled:bg-transparent disabled:text-paper/45"
          >
            <span>Add</span>
          </button>
          <p id="rl-blank" className="label w-full text-paper/60">
            Blank and space-only lines are not kept, because there would be
            nothing for a flag to match.
          </p>
        </form>

        {lines.length === 0 ? (
          <p className="label mt-4 text-paper/60">
            None set. The analysis runs the same way without them.
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
                      aria-label={`Edit red line: ${line.text}`}
                      className="min-w-0 flex-1 border-2 border-spot bg-paper px-2 py-1 font-voice text-[0.9375rem] text-ink"
                      autoFocus
                    />
                    {/* Blank is rejected by the seam either way. Saying so on
                        the control beats letting the typing silently revert. */}
                    <button
                      type="submit"
                      disabled={!editing.text.trim()}
                      className="mark"
                    >
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
                      aria-label={`Edit red line: ${line.text}`}
                      className="mark"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(line.id)}
                      aria-label={`Delete red line: ${line.text}`}
                      className="mark"
                    >
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
