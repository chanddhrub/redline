"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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
  type RedLine,
  type UsState,
} from "@/lib/intake/analysis-request";
import { mergeRedLines, sameRedLines } from "@/lib/account/red-lines";
import { useAccount, type Account } from "@/lib/account/use-account";
import {
  parseDocument,
  type ParsedDocument,
  type Refusal,
} from "@/lib/intake/parse-document";
import { paragraphs, SAMPLE_LETTER } from "@/app/_demo/sample";
import {
  interpretFailure,
  parseAnalysis,
  parseAnswer,
  stampCodes,
  type RunFailure,
  type WireAnalysis,
  type WireAnswer,
  type WireSpan,
} from "../_lib/wire";
import { AccountPanel, type Keeping } from "./account";
import { DocumentSheet } from "./sheet";
import {
  AnswerPanel,
  Failed,
  Result,
  Running,
  type RunReason,
  type Selection,
} from "./result";

/**
 * Where the analysis has got to. `idle` is not "nothing happened" — it is the
 * state a reader is in before they have asked for anything, and it has its own
 * surface. Every other state is a surface too; none of them is a spinner or an
 * error string.
 */
type Run =
  | { kind: "idle" }
  | { kind: "running"; reason: RunReason; startedAt: number }
  | { kind: "done"; analysis: WireAnalysis }
  | { kind: "failed"; failure: RunFailure };

/**
 * Where a question has got to. The question the reader asked is carried on
 * every state, because the box is cleared the moment it is submitted and the
 * answer has to say what it is an answer to — including when what comes back
 * is that the document does not address it.
 */
type Ask =
  | { kind: "idle" }
  | { kind: "asking"; question: string }
  | { kind: "answered"; question: string; answer: WireAnswer }
  | { kind: "failed"; question: string; failure: RunFailure };

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
  const [run, setRun] = useState<Run>({ kind: "idle" });
  const [selected, setSelected] = useState<Selection>(null);
  const [elapsed, setElapsed] = useState(0);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [question, setQuestion] = useState("");
  const [ask, setAsk] = useState<Ask>({ kind: "idle" });
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState("");
  const [dragging, setDragging] = useState(false);
  const [restored, setRestored] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const account = useAccount();
  /**
   * Where the keeping of red lines has got to, tied to the reader it belongs
   * to. Carrying the id means signing out — or signing in as somebody else —
   * makes the whole thing stale at once, rather than needing an effect to go
   * round clearing up after it. `adopted` is what releases the saving below:
   * a first sitting has nothing kept, so nothing on screen changes, and the
   * lines just typed would otherwise never be written.
   */
  const [sync, setSync] = useState<{
    userId: string;
    adopted: boolean;
    keeping: Keeping;
  } | null>(null);
  /** What the account is believed to hold, and whose. A change is measured
   *  against this, so a re-render is not a write. */
  const kept = useRef<{ userId: string; lines: RedLine[] } | null>(null);
  /** The reader whose lines are being read back right now, so two loads do
   *  not run at once. */
  const adopting = useRef<string | null>(null);
  /** Only the newest run may write a result. A reader who edits a red line
   *  twice must not be shown the first run's answer because it came back
   *  second. */
  const runToken = useRef(0);
  /** The same discipline for questions: a reader who asks twice must not be
   *  shown the first answer because it came back second. */
  const askToken = useRef(0);

  const source = phase.kind === "ready" ? phase.source : null;
  const sample = source === "sample";
  // Memoised because the session-save effect depends on it. A fresh object
  // every render would make that effect run every render, rewriting
  // sessionStorage continuously for a value that had not changed.
  const origin: IntakeOrigin | null = useMemo(
    () =>
      phase.kind === "ready"
        ? { filename: phase.filename, source: phase.source }
        : null,
    [phase],
  );

  const ingest = useCallback(async (bytes: ArrayBuffer, filename: string) => {
    setPhase({ kind: "parsing", filename, progress: 0 });
    // A new document is a new subject. The previous analysis quoted offsets
    // into text that is about to be replaced, so it goes rather than hanging
    // over the new one.
    setRun({ kind: "idle" });
    setSelected(null);
    runToken.current += 1;
    // The previous answer quoted offsets into text that is about to be
    // replaced, so it goes with the analysis rather than hanging over the new
    // document pointing at nothing.
    setAsk({ kind: "idle" });
    askToken.current += 1;
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
    setRun({ kind: "idle" });
    setSelected(null);
    runToken.current += 1;
    setAsk({ kind: "idle" });
    askToken.current += 1;
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
  }, []);

  const clear = useCallback(() => {
    setRequest((s) => setDocument(s, null));
    setPhase({ kind: "idle" });
    setRun({ kind: "idle" });
    setSelected(null);
    runToken.current += 1;
    setAsk({ kind: "idle" });
    askToken.current += 1;
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  /**
   * One run. The route takes the assembled request and answers with an
   * analysis or with a failure; both are data, and both are surfaces here.
   *
   * The body is put through `parseAnalysis` rather than cast. The brand that
   * makes a `Citation` unforgeable does not survive JSON, so what arrives is a
   * shape, and a shape is checked. A body that does not check out is shown as
   * a failure rather than rendered half way: a partial result reads exactly
   * like a whole one.
   */
  const analyse = useCallback(
    async (reason: RunReason, state: AnalysisRequestState) => {
    const assembled = toAnalysisRequest(state);
    if (!assembled) return;

    const token = (runToken.current += 1);
    setRun({ kind: "running", reason, startedAt: Date.now() });
    setElapsed(0);

    let response: Response;
    try {
      response = await fetch("/api/analysis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(assembled),
      });
    } catch {
      if (token === runToken.current) {
        setRun({ kind: "failed", failure: { kind: "no-connection" } });
      }
      return;
    }

    const body: unknown = await response.json().catch(() => null);
    if (token !== runToken.current) return;

    if (!response.ok) {
      setRun({ kind: "failed", failure: interpretFailure(response.status, body) });
      return;
    }

    const analysis = parseAnalysis(body);
    if (!analysis) {
      setRun({ kind: "failed", failure: { kind: "unusable" } });
      return;
    }

    setRun({ kind: "done", analysis });
    // The window lands on the top-ranked flag without travelling: the first
    // paint jumps (DESIGN.md). On a clean document nothing is cropped, because
    // there is nothing to point at.
    setSelected(
      analysis.flags.length
        ? { kind: "flag", id: analysis.flags[0].flag.id }
        : analysis.summary.claims.length
          ? { kind: "claim", index: 0 }
          : null,
    );
    },
    [],
  );

  /**
   * One question. The route takes the same assembled request the analysis
   * takes, plus the question, and answers with one of two states or with a
   * failure — all three are data and all three are surfaces here.
   *
   * A failure is never rendered as "your document does not address this".
   * Telling someone their contract is silent because a rate limit was hit
   * would be a claim about their document that nobody made.
   */
  const askQuestion = useCallback(
    async (text: string, state: AnalysisRequestState) => {
      const asked = text.trim();
      const assembled = toAnalysisRequest(state);
      if (!asked || !assembled) return;

      const token = (askToken.current += 1);
      setAsk({ kind: "asking", question: asked });
      setQuestion("");

      let response: Response;
      try {
        response = await fetch("/api/answer", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...assembled, question: asked }),
        });
      } catch {
        if (token === askToken.current) {
          setAsk({ kind: "failed", question: asked, failure: { kind: "no-connection" } });
        }
        return;
      }

      const body: unknown = await response.json().catch(() => null);
      if (token !== askToken.current) return;

      if (!response.ok) {
        setAsk({
          kind: "failed",
          question: asked,
          failure: interpretFailure(response.status, body),
        });
        return;
      }

      const answer = parseAnswer(body);
      if (!answer) {
        setAsk({ kind: "failed", question: asked, failure: { kind: "unusable" } });
        return;
      }

      setAsk({ kind: "answered", question: asked, answer });
      // The window lands on the first sentence the answer rests on, the way it
      // lands on the top-ranked flag. On a refusal there is nothing to point
      // at, so the crop is left where the reader had it.
      if (answer.kind === "answered") setSelected({ kind: "answer", index: 0 });
    },
    [],
  );

  /**
   * A red line edited after the analysis re-runs it, and so does a change of
   * state — both are inputs the ranking and the second layer read. PRD §3.3
   * requires the re-run; without it a red line is decoration.
   *
   * The re-run hangs off the edit itself rather than off a watcher on the
   * state. An effect comparing the request to the last one it ran would have
   * to decide what counts as a change, and would re-run on a restore from
   * `sessionStorage` — which is not an edit, and which the reader did not ask
   * for.
   */
  const applyAndRerun = (next: AnalysisRequestState, reason: RunReason) => {
    if (next === request) return;
    setRequest(next);
    if (run.kind !== "idle" && toAnalysisRequest(next)) void analyse(reason, next);
  };

  // The elapsed count on the running surface is a real one. There is no
  // progress to report from a single model call, so none is invented.
  useEffect(() => {
    if (run.kind !== "running") return;
    const startedAt = run.startedAt;
    const tick = setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAt) / 1000)),
      1000,
    );
    return () => clearInterval(tick);
  }, [run]);

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

  // What is on screen at this instant, for the two account effects below. A
  // list read back after an await must be the list the reader has now, not the
  // one they had when the request went out.
  const latest = useRef(request);
  useEffect(() => {
    latest.current = request;
  });

  /** Who is signed in, if anyone, and how far their keeping has got. A sync
   *  belonging to somebody else is no sync at all. */
  const signedInAs = account.state.kind === "signed-in" ? account.state.userId : null;
  const mine = sync && sync.userId === signedInAs ? sync : null;
  const keeping: Keeping = mine?.keeping ?? { kind: "idle" };

  /**
   * Signing in brings the reader's kept lines back.
   *
   * Neither list is thrown away: what was kept comes first, and anything typed
   * in this sitting that is not already among them follows. That merge changes
   * the inputs to the ranking, so it re-runs an analysis that has already
   * happened, exactly as typing a line does (PRD §3.3).
   *
   * It waits for the session restore. Merging against an empty first render
   * would drop whatever the reader had typed before the tab reloaded.
   */
  useEffect(() => {
    const store = account.store;
    if (!store || !signedInAs || !restored) return;
    const userId = signedInAs;
    if (mine || adopting.current === userId) return;

    adopting.current = userId;
    let live = true;
    void (async () => {
      let theirs: RedLine[];
      try {
        theirs = await store.load();
      } catch {
        // Their lines are unreachable, not gone. What is on screen stays, the
        // note says so, and nothing is written over what is kept on the
        // strength of a failed read.
        if (live) {
          setSync({ userId, adopted: false, keeping: { kind: "unreachable" } });
        }
        return;
      }
      if (!live) return;
      kept.current = { userId, lines: theirs };
      setSync({ userId, adopted: true, keeping: { kind: "idle" } });
      const current = latest.current;
      const merged = mergeRedLines(theirs, current.redLines);
      if (!sameRedLines(merged, current.redLines)) {
        applyAndRerun({ ...current, redLines: merged }, "red-lines");
      }
    })();

    return () => {
      live = false;
      adopting.current = null;
    };
    // `applyAndRerun` is rebuilt every render and this must run once per
    // reader; `latest` is what keeps the merge reading current state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.store, signedInAs, mine, restored]);

  /**
   * And every change after that is kept.
   *
   * Only a real change is written — the same lines in the same order are not
   * an edit — and only once their kept lines have been read, so a first
   * sitting cannot overwrite what is stored with whatever happens to be on
   * screen.
   */
  useEffect(() => {
    const store = account.store;
    if (!store || !signedInAs || !mine?.adopted) return;
    const held = kept.current;
    if (held?.userId !== signedInAs) return;
    const lines = request.redLines;
    if (sameRedLines(held.lines, lines)) return;

    let live = true;
    setSync({ userId: signedInAs, adopted: true, keeping: { kind: "saving" } });
    store
      .save(lines)
      .then(() => {
        kept.current = { userId: signedInAs, lines };
        if (live) {
          setSync({ userId: signedInAs, adopted: true, keeping: { kind: "saved" } });
        }
      })
      .catch(() => {
        // Said on screen rather than swallowed: the line is in front of them
        // and not in their account, and only they can decide what to do about
        // that.
        if (live) {
          setSync({ userId: signedInAs, adopted: true, keeping: { kind: "failed" } });
        }
      });
    return () => {
      live = false;
    };
  }, [account.store, signedInAs, mine, request.redLines]);

  const doc: ParsedDocument | null = request.document;
  const missing = whatIsMissing(request);
  const ready = isReady(request);

  const analysis = run.kind === "done" ? run.analysis : null;

  /**
   * What the window is cropped to. Every selectable thing on the right-hand
   * column is a citation, so every one of them can drive the crop — a flag, a
   * summary claim, the governing-law sentence. The span is the analysis's own,
   * an offset into the very text rendered in the sheet.
   */
  const crop = useMemo((): { span: WireSpan; stamp: string } | null => {
    if (!selected) return null;
    // An answer is a peer of the analysis, not part of it: a reader can ask a
    // question before they run one, so this branch comes first and does not
    // depend on there being a result.
    if (selected.kind === "answer") {
      if (ask.kind !== "answered" || ask.answer.kind !== "answered") return null;
      const citation = ask.answer.citations[selected.index];
      return citation ? { span: citation.span, stamp: "Answer" } : null;
    }
    if (!analysis) return null;
    if (selected.kind === "flag") {
      const index = analysis.flags.findIndex((r) => r.flag.id === selected.id);
      if (index === -1) return null;
      return {
        span: analysis.flags[index].flag.citation.span,
        stamp: stampCodes(analysis.flags)[index],
      };
    }
    if (selected.kind === "claim") {
      const claim = analysis.summary.claims[selected.index];
      return claim ? { span: claim.citation.span, stamp: "Summary" } : null;
    }
    return analysis.governingLaw
      ? { span: analysis.governingLaw.span, stamp: "Governing law" }
      : null;
  }, [analysis, ask, selected]);

  return (
    <div className="min-h-screen bg-ink text-paper lg:flex">
      <Rail
        ready={ready}
        missing={missing}
        sample={sample}
        jurisdiction={request.jurisdiction}
        signedIn={account.state.kind === "signed-in"}
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
          className="min-w-0 scroll-mt-[4.75rem] border-b-2 border-spot lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:overflow-hidden lg:border-b-0 lg:border-r-2 lg:scroll-mt-0"
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
                span={crop?.span ?? null}
                stamp={crop?.stamp ?? null}
                sample={sample}
              />
            ) : null}
          </div>
        </section>

        {/* ── Findings, questions, red lines: peers, never modals. ───── */}
        <section className="min-w-0">
          <Jurisdiction
            value={request.jurisdiction}
            onChange={(v) => applyAndRerun(setJurisdiction(request, v), "state")}
          />

          <Analysis
            run={run}
            elapsed={elapsed}
            selected={selected}
            onSelect={setSelected}
            onRun={() => void analyse(run.kind === "idle" ? "first" : "again", request)}
            missing={missing}
            ready={ready}
            sentences={doc?.sentences.length ?? 0}
            jurisdiction={request.jurisdiction}
            redLines={request.redLines.length}
          />

          <QuestionBox
            enabled={phase.kind === "ready"}
            value={question}
            setValue={setQuestion}
            ask={ask}
            onAsk={(text) => void askQuestion(text, request)}
            selected={selected}
            onSelect={setSelected}
          />

          <RedLines
            account={account}
            keeping={keeping}
            lines={request.redLines}
            draft={draft}
            setDraft={setDraft}
            editing={editing}
            setEditing={setEditing}
            onAdd={() => {
              applyAndRerun(addRedLine(request, draft), "red-lines");
              setDraft("");
            }}
            onSave={() => {
              if (editing) {
                applyAndRerun(
                  editRedLine(request, editing.id, editing.text),
                  "red-lines",
                );
              }
              setEditing(null);
            }}
            onRemove={(id) => applyAndRerun(removeRedLine(request, id), "red-lines")}
            reruns={run.kind !== "idle"}
          />
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
  signedIn,
}: {
  ready: boolean;
  missing: string[];
  sample: boolean;
  jurisdiction: UsState | null;
  signedIn: boolean;
}) {
  const marks = [
    { href: "#document", label: "Document" },
    { href: "#findings", label: "Findings" },
    { href: "#questions", label: "Questions" },
    { href: "#redlines", label: "Red lines" },
  ];
  return (
    <div className="sticky top-0 z-20 flex items-center gap-4 border-b-2 border-ink bg-spot px-4 py-3 text-ink lg:h-screen lg:w-56 lg:flex-col lg:items-stretch lg:gap-6 lg:border-b-0 lg:border-r-2 lg:px-4 lg:py-5">
      <Link href="/" className="display mark-ink shrink-0 border-2 border-ink px-2 py-1 text-xl">
        Redline
      </Link>
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
        {/* True either way, and it has to stay true: signing in keeps the red
            lines and nothing else, so the document's own line does not change
            when somebody signs in. */}
        <p className="label mt-1 text-ink/70">
          Your document stays in this tab. Close it and it is gone.
        </p>
        <p className="label mt-1 text-ink/70">
          {signedIn ? "Your red lines are kept." : "So are your red lines."}
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

/* ── Question box ────────────────────────────────────────────────────── */

/**
 * The question box. A peer of the finding stack, in the same column as it, not
 * a modal and not a corner of the document pane.
 *
 * It sits here rather than at the foot of the document for three reasons. The
 * document pane is the fixed thing on the screen and the window that travels
 * inside it is the product's primary mechanic; a text field and a three-state
 * answer growing under it would push the cropped sentence below reading size,
 * which the shell brief rules out. A citation in an answer recrops that window,
 * and a control that moves the window cannot live inside the window without
 * scrolling out from under the reader as they use it. And every other control
 * that recrops — a flag, a summary claim, the governing-law sentence — is in
 * this column already, so the box keeps company with its peers rather than
 * becoming the one exception.
 *
 * It is available as soon as a document is read. The analysis is not a
 * prerequisite: someone with a deadline may well want one sentence out of the
 * contract before they want a reading of the whole thing.
 */
function QuestionBox({
  enabled,
  value,
  setValue,
  ask,
  onAsk,
  selected,
  onSelect,
}: {
  enabled: boolean;
  value: string;
  setValue: (v: string) => void;
  ask: Ask;
  onAsk: (text: string) => void;
  selected: Selection;
  onSelect: (selection: Selection) => void;
}) {
  return (
    <>
      <SectionHead
        id="questions"
        title="Ask about your document"
        note="Answered from the sentences in your document"
      />
      <div className="px-4 py-4 sm:px-6">
        <p className="max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-paper">
          Ask anything the text beside this could settle. Where your document
          says it, the answer comes back with the sentence it came from. Where
          your document is silent, you are told that.
        </p>

        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (value.trim()) onAsk(value);
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
            disabled={!enabled || !value.trim() || ask.kind === "asking"}
            className="slug label slug-on-ink mt-3 disabled:cursor-not-allowed disabled:border-paper/30 disabled:bg-transparent disabled:text-paper/45"
          >
            <span>{ask.kind === "asking" ? "Reading" : "Ask"}</span>
          </button>
        </form>

        {ask.kind === "asking" ? (
          <div className="mt-4 border-2 border-spot" role="status" aria-live="polite">
            <p className="label border-b-2 border-spot bg-spot px-3 py-2 text-ink">
              Looking through your document
            </p>
            <div className="space-y-3 px-3 py-3">
              <p className="max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-paper">
                &ldquo;{ask.question}&rdquo;
              </p>
              <p className="max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-paper/80">
                Nothing reaches this panel until the sentences behind it have
                been found in the copy you are looking at.
              </p>
              <div className="h-[3px] w-full overflow-hidden bg-spot/25" aria-hidden="true">
                <span className="sweep block h-full w-1/3 bg-spot" />
              </div>
            </div>
          </div>
        ) : null}

        {ask.kind === "answered" ? (
          <div className="mt-4">
            <AnswerPanel
              question={ask.question}
              answer={ask.answer}
              selected={selected}
              onSelect={onSelect}
            />
          </div>
        ) : null}

        {ask.kind === "failed" ? (
          <div className="mt-4">
            {/* The box is cleared on submit, so the retry carries the question
                the reader actually asked rather than whatever is in the field
                now — which is usually nothing. */}
            <Failed
              failure={ask.failure}
              onRetry={() => onAsk(ask.question)}
              heading="No answer"
            />
          </div>
        ) : null}
      </div>
    </>
  );
}

/* ── Red lines ───────────────────────────────────────────────────────── */

function RedLines({
  account,
  keeping,
  lines,
  draft,
  setDraft,
  editing,
  setEditing,
  onAdd,
  onSave,
  onRemove,
  reruns,
}: {
  account: Account;
  keeping: Keeping;
  lines: { id: string; text: string }[];
  draft: string;
  setDraft: (v: string) => void;
  editing: { id: string; text: string } | null;
  setEditing: (v: { id: string; text: string } | null) => void;
  onAdd: () => void;
  onSave: () => void;
  onRemove: (id: string) => void;
  /** Whether an analysis exists, so a change here re-runs it. Said on screen
   *  before the reader types, because an edit that silently re-reads their
   *  document is a surprise. */
  reruns: boolean;
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
        {/* Where these lines live, said next to where they are typed. The one
            thing an account holds is this list, so the promise is made here
            rather than at a door the reader never has to walk through. */}
        <div className="mt-4">
          <AccountPanel account={account} keeping={keeping} />
        </div>
        {/* Ticket criterion, not a nicety: a reader who expects a red line to
            filter the output has been misled by us. */}
        <p className="mt-3 max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-paper/80">
          When a flag matches one of your red lines, Redline moves that flag to
          the top and names the line it crossed. You still see every flag
          either way. A red line never hides one, and never ranks one lower
          than it would have been on its own.
        </p>
        {reruns ? (
          <p className="label mt-3 max-w-[62ch] leading-relaxed text-spot">
            Adding, editing or deleting a line here reads the document again.
          </p>
        ) : null}

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


/* ── The analysis ────────────────────────────────────────────────────── */

/**
 * The whole right-hand column between intake and the question box: the control
 * that starts a run, every state a run can be in, and the result itself.
 *
 * Each state is a surface with something to say. Idle explains what is about
 * to happen to the text and what will be refused; running says what standard
 * is being applied to whatever comes back; failure says what it means for the
 * reader's document and whether trying again is worth anything; and a finished
 * analysis leads with the summary, or on a clean document with the receipt.
 */
function Analysis({
  run,
  elapsed,
  selected,
  onSelect,
  onRun,
  missing,
  ready,
  sentences,
  jurisdiction,
  redLines,
}: {
  run: Run;
  elapsed: number;
  selected: Selection;
  onSelect: (selection: Selection) => void;
  onRun: () => void;
  missing: string[];
  ready: boolean;
  sentences: number;
  jurisdiction: UsState | null;
  redLines: number;
}) {
  return (
    <>
      <SectionHead
        id="findings"
        title="The analysis"
        note={
          run.kind === "done"
            ? "Every claim below shows the sentence it came from"
            : "Nothing is sent anywhere until you ask for it"
        }
      />

      <div className="px-4 py-4 sm:px-6">
        {run.kind === "idle" ? (
          <div className="border-2 border-spot px-4 py-4">
            <p className="max-w-[62ch] font-voice text-[1.0625rem] leading-relaxed text-paper">
              {ready
                ? "Your document is read. The text beside this is exactly what gets analysed, and nothing has been sent anywhere yet."
                : `Nothing to analyse yet — still missing ${missing.join(" and ")}.`}
            </p>
            <p className="mt-3 max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-paper/80">
              Every flag that comes back quotes a sentence from that panel. A
              flag whose sentence cannot be found in your stored text is
              dropped before it reaches you.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={onRun}
                disabled={!ready}
                className="slug label slug-on-ink"
              >
                <span>Analyse this document</span>
              </button>
            </div>
            {ready ? (
              <p className="label tabular mt-3 text-paper/70">
                {sentences.toLocaleString()} sentences · {jurisdiction} ·{" "}
                {redLines === 0
                  ? "no red lines"
                  : `${redLines} red line${redLines === 1 ? "" : "s"}`}
              </p>
            ) : null}
          </div>
        ) : null}

        {run.kind === "running" ? (
          <Running
            reason={run.reason}
            elapsed={elapsed}
            sentences={sentences}
            jurisdiction={jurisdiction ?? "no state set"}
            redLines={redLines}
          />
        ) : null}

        {run.kind === "failed" ? <Failed failure={run.failure} onRetry={onRun} /> : null}
      </div>

      {run.kind === "done" ? (
        <Result
          analysis={run.analysis}
          selected={selected}
          onSelect={onSelect}
          jurisdiction={jurisdiction}
        />
      ) : null}
    </>
  );
}
