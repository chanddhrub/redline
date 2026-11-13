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
import {
  opensOverScreen,
  snapshotKey,
  type DocumentSnapshot,
  type KeptDocument,
} from "@/lib/account/kept-document";
import { readAgain } from "@/lib/account/read-again";
import { serialWriter, type SerialWriter } from "@/lib/account/serial-writer";
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
  type Exchange,
  type RunFailure,
  type WireAnalysis,
  type WireAnswer,
  type WireSpan,
} from "../_lib/wire";
import { AccountPanel, type KeptControls, type KeptStatus, type Keeping } from "./account";
import { DocumentSheet } from "./sheet";
import {
  AnswerPanel,
  Failed,
  Result,
  Running,
  ShowInDocument,
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
  /** `redLines` are the ones this analysis ranked against. */
  | { kind: "done"; analysis: WireAnalysis; redLines: RedLine[] }
  | { kind: "failed"; failure: RunFailure };

/** A document and everything kept with it, on its way to the account. `null`
 *  deletes the row, and goes through the same queue so a delete cannot be
 *  overtaken by a save that started first. */
type KeptWrite = { key: string; snapshot: DocumentSnapshot | null };

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

/** The window lands on the top-ranked flag without travelling: the first paint
 *  jumps (DESIGN.md). On a clean document nothing is cropped, because there is
 *  nothing to point at. */
function firstSelection(analysis: WireAnalysis): Selection {
  if (analysis.flags.length) return { kind: "flag", id: analysis.flags[0].flag.id };
  return analysis.summary.claims.length ? { kind: "claim", index: 0 } : null;
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
  /** Every question answered about this document, oldest first. */
  const [thread, setThread] = useState<readonly Exchange[]>([]);
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState("");
  const [dragging, setDragging] = useState(false);
  const [restored, setRestored] = useState(false);
  /** Whether the document panel is open once an analysis is on screen. Before
   *  that the document is the work, so it is always shown. */
  const [docOpen, setDocOpen] = useState(false);
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
  /** What the account holds of the document. Unset until it has been read. */
  const [keptStatus, setKeptStatus] = useState<KeptStatus | null>(null);
  /** Something to tell the reader about what came back or went. */
  const [keptNote, setKeptNote] = useState<string | null>(null);
  /** Bumped by "Try again", which is a write with no change behind it. */
  const [keepRetry, setKeepRetry] = useState(0);
  /** The queue a document's writes go through. */
  const documentWriter = useRef<{ userId: string; writer: SerialWriter<KeptWrite> } | null>(null);
  /** The contents of a document just read back, so opening it is not a write. */
  const openedKey = useRef<string | null>(null);
  /** Whether the document on screen is safe in the account. */
  const keptOnScreen = useRef(false);
  /** The run and thread on screen now, for code running after an await. */
  const screen = useRef<{ run: Run; thread: readonly Exchange[] }>({
    run: { kind: "idle" },
    thread: [],
  });
  /** Whose red lines are being written, and the queue they go through. */
  const redLineWriter = useRef<{ userId: string; writer: SerialWriter<RedLine[]> } | null>(null);
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
    setThread([]);
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
    setThread([]);
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
    setThread([]);
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

    setRun({ kind: "done", analysis, redLines: state.redLines });
    setSelected(firstSelection(analysis));
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
      const turn = screen.current.thread.length;
      setThread((earlier) => [...earlier, { question: asked, answer }]);
      // The window lands on the first sentence the answer rests on, the way it
      // lands on the top-ranked flag. On a refusal there is nothing to point
      // at, so the crop is left where the reader had it.
      if (answer.kind === "answered") setSelected({ kind: "answer", turn, index: 0 });
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
    screen.current = { run, thread };
  });

  /**
   * Puts a kept document back on screen, whole. It has already been through
   * `keptDocumentFrom`, so what is shown here has been checked against its text.
   * A red line changed since means the stored ranking is out of date, and that
   * re-runs it exactly as typing the line would have (PRD §3.3).
   */
  const openKept = useCallback(
    (found: KeptDocument, lines: RedLine[]) => {
      runToken.current += 1;
      askToken.current += 1;
      const next: AnalysisRequestState = {
        document: found.document,
        jurisdiction: found.jurisdiction ?? latest.current.jurisdiction,
        redLines: lines,
      };
      openedKey.current = snapshotKey({
        text: found.document.text,
        origin: found.origin,
        jurisdiction: next.jurisdiction,
        analysis: found.analysis,
        analysedRedLines: found.analysis ? found.analysedRedLines : [],
        exchanges: found.exchanges,
      });
      setRequest(next);
      setPhase({
        kind: "ready",
        filename: found.origin.filename,
        source: found.origin.source,
      });
      setPasting(false);
      setAsk({ kind: "idle" });
      setThread(found.exchanges);
      setKeptStatus({
        kind: "kept",
        text: found.document.text,
        filename: found.origin.filename,
        open: true,
        writing: "idle",
      });
      setKeptNote(
        found.dropped
          ? "Part of what you kept could not be checked against your document's text, so it is not shown. Run the analysis or ask the question again."
          : null,
      );
      if (found.analysis) {
        setRun({ kind: "done", analysis: found.analysis, redLines: found.analysedRedLines });
        setSelected(firstSelection(found.analysis));
        if (!sameRedLines(found.analysedRedLines, lines)) void analyse("red-lines", next);
      } else {
        setRun({ kind: "idle" });
        setSelected(null);
      }
    },
    [analyse],
  );

  /** What a kept document coming back would land on. */
  const screenNow = () => ({
    text: latest.current.document?.text ?? null,
    untouched: screen.current.run.kind === "idle" && screen.current.thread.length === 0,
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
   *
   * A kept document comes back with them, unless the reader is already looking
   * at a different one: that is theirs, so it stays and the panel offers the
   * kept one instead.
   */
  useEffect(() => {
    const store = account.store;
    const documents = account.documents;
    if (!store || !documents || !signedInAs || !restored) return;
    const userId = signedInAs;
    if (mine || adopting.current === userId) return;

    adopting.current = userId;
    let live = true;
    void (async () => {
      const [lines, held] = await Promise.allSettled([
        readAgain(() => store.load()),
        readAgain(() => documents.load()),
      ]);
      if (!live) return;

      const found = held.status === "fulfilled" ? held.value : null;
      setKeptStatus(
        held.status === "rejected"
          ? { kind: "unreachable" }
          : found
            ? {
                kind: "kept",
                text: found.document.text,
                filename: found.origin.filename,
                open: false,
                writing: "idle",
              }
            : { kind: "none" },
      );

      const current = latest.current;
      let merged = current.redLines;
      if (lines.status === "rejected") {
        // Their lines are unreachable, not gone. What is on screen stays, the
        // note says so, and nothing is written over what is kept on the
        // strength of a failed read.
        setSync({ userId, adopted: false, keeping: { kind: "unreachable" } });
      } else {
        kept.current = { userId, lines: lines.value };
        setSync({ userId, adopted: true, keeping: { kind: "idle" } });
        merged = mergeRedLines(lines.value, current.redLines);
      }

      if (found && opensOverScreen(found.document.text, screenNow())) {
        openKept(found, merged);
        return;
      }

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
  }, [account.store, account.documents, signedInAs, mine, restored]);

  /**
   * And every change after that is kept.
   *
   * Only a real change is written — the same lines in the same order are not
   * an edit — and only once their kept lines have been read, so a first
   * sitting cannot overwrite what is stored with whatever happens to be on
   * screen.
   *
   * This depends on `adopted`, never on the sync object. A write updates that
   * object, so depending on it makes every write start the next one. Writes
   * queue in the writer rather than here, so a change made during a write
   * cannot start a second one.
   */
  const adopted = mine?.adopted ?? false;
  useEffect(() => {
    const store = account.store;
    if (!store || !signedInAs || !adopted) return;
    const held = kept.current;
    if (held?.userId !== signedInAs) return;
    const userId = signedInAs;
    if (redLineWriter.current?.userId !== userId) {
      redLineWriter.current = {
        userId,
        writer: serialWriter<RedLine[]>(
          (lines) => store.save(lines),
          (event) => {
            if (event.kind === "saved") kept.current = { userId, lines: event.value };
            // A failure is said on screen rather than swallowed: the line is in
            // front of them and not in their account, and only they can decide
            // what to do about that.
            setSync({ userId, adopted: true, keeping: { kind: event.kind } });
          },
        ),
      };
    }
    const { writer } = redLineWriter.current;
    const lines = request.redLines;
    if (sameRedLines(writer.wanted() ?? held.lines, lines)) return;
    writer.push(lines);
  }, [account.store, signedInAs, adopted, request.redLines]);

  const doc: ParsedDocument | null = request.document;
  const keptHere =
    keptStatus?.kind === "kept" && keptStatus.open && doc?.text === keptStatus.text;

  // Once it leaves the screen it stays closed, even if the same text comes
  // back: that copy has none of what the row holds, and must not replace it.
  if (keptStatus?.kind === "kept" && keptStatus.open && doc?.text !== keptStatus.text) {
    setKeptStatus({ ...keptStatus, open: false });
  }

  /**
   * Signing out ends everything tied to the reader, so signing in again in this
   * tab reads their account afresh. Adjusted during render rather than in an
   * effect, so no frame shows the last reader's state.
   */
  const [wasSignedIn, setWasSignedIn] = useState(false);
  if (wasSignedIn !== Boolean(signedInAs)) {
    setWasSignedIn(Boolean(signedInAs));
    if (!signedInAs) {
      setSync(null);
      setKeptStatus(null);
      setKeptNote(null);
    }
  }

  /**
   * A document safe in the account leaves the screen too: a shared machine
   * should not go on showing it. One that failed to save stays, because this
   * tab holds the only copy of the latest changes.
   */
  useEffect(() => {
    if (signedInAs) return;
    if (keptOnScreen.current) clear();
    kept.current = null;
    redLineWriter.current = null;
    documentWriter.current = null;
    openedKey.current = null;
  }, [signedInAs, clear]);

  useEffect(() => {
    keptOnScreen.current =
      keptHere && keptStatus?.kind === "kept" && keptStatus.writing !== "failed";
  });

  /** One queue per reader, shared by saving and deleting. */
  const writerFor = useCallback(
    (userId: string, documents: NonNullable<Account["documents"]>) => {
      if (documentWriter.current?.userId !== userId) {
        documentWriter.current = {
          userId,
          writer: serialWriter<KeptWrite>(
            ({ snapshot }) => (snapshot ? documents.save(snapshot) : documents.remove()),
            (event) =>
              setKeptStatus((status) => {
                if (status?.kind === "deleting") {
                  if (event.kind === "failed") {
                    return { kind: "delete-failed", filename: status.filename };
                  }
                  return event.kind === "saved" && event.value.snapshot === null
                    ? { kind: "none" }
                    : status;
                }
                return status?.kind === "kept" ? { ...status, writing: event.kind } : status;
              }),
          ),
        };
      }
      return documentWriter.current.writer;
    },
    [],
  );

  /**
   * A kept document stays current: a question asked, a new analysis, a changed
   * state. Only the one the reader chose to keep is ever written. A run in
   * progress waits, so the analysis is not saved as missing half way through.
   */
  useEffect(() => {
    const documents = account.documents;
    if (!documents || !signedInAs || !keptHere || !doc || !origin) return;
    if (run.kind === "running") return;
    const snapshot: DocumentSnapshot = {
      text: doc.text,
      origin,
      jurisdiction: request.jurisdiction,
      analysis: run.kind === "done" ? run.analysis : null,
      analysedRedLines: run.kind === "done" ? run.redLines : [],
      exchanges: [...thread],
    };
    const key = snapshotKey(snapshot);
    const writer = writerFor(signedInAs, documents);
    if ((writer.wanted()?.key ?? openedKey.current) === key) return;
    writer.push({ key, snapshot });
  }, [
    account.documents,
    signedInAs,
    keptHere,
    doc,
    origin,
    run,
    request.jurisdiction,
    thread,
    keepRetry,
    writerFor,
  ]);

  const keptControls: KeptControls = {
    status: keptStatus ?? { kind: "checking" },
    onScreen: phase.kind === "ready" ? phase.filename : null,
    isThisOne: keptHere,
    note: keptNote,
    onKeep: () => {
      if (!doc || phase.kind !== "ready") return;
      openedKey.current = null;
      setKeptNote(null);
      setKeptStatus({
        kind: "kept",
        text: doc.text,
        filename: phase.filename,
        open: true,
        writing: "idle",
      });
    },
    onOpen: () => {
      const documents = account.documents;
      if (!documents) return;
      void documents
        .load()
        .then((found) => {
          if (found) openKept(found, latest.current.redLines);
          else setKeptStatus({ kind: "none" });
        })
        .catch(() => setKeptStatus({ kind: "unreachable" }));
    },
    onReread: () => {
      const documents = account.documents;
      if (!documents) return;
      setKeptStatus({ kind: "checking" });
      void readAgain(() => documents.load())
        .then((found) => {
          if (!found) setKeptStatus({ kind: "none" });
          else if (opensOverScreen(found.document.text, screenNow())) {
            openKept(found, latest.current.redLines);
          } else {
            setKeptStatus({
              kind: "kept",
              text: found.document.text,
              filename: found.origin.filename,
              open: false,
              writing: "idle",
            });
          }
        })
        .catch(() => setKeptStatus({ kind: "unreachable" }));
    },
    onDelete: () => {
      const documents = account.documents;
      if (!documents || !signedInAs) return;
      const filename =
        keptStatus?.kind === "kept" || keptStatus?.kind === "delete-failed"
          ? keptStatus.filename
          : null;
      setKeptStatus({ kind: "deleting", filename });
      setKeptNote(
        keptHere
          ? "Deleted from your account. It stays on this screen until you close the tab."
          : null,
      );
      writerFor(signedInAs, documents).push({ key: "", snapshot: null });
    },
    onRetry: () => setKeepRetry((n) => n + 1),
  };

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
      const answer = thread[selected.turn]?.answer;
      if (answer?.kind !== "answered") return null;
      const citation = answer.citations[selected.index];
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
  }, [analysis, thread, selected]);

  /* Once there is an analysis, the findings are the work and the document is
     one click away rather than always taking half the screen. Before that, the
     document is what the reader is checking, so it stays open. */
  const analysed = run.kind === "done";
  const showDoc = !analysed || docOpen;
  const showInDocument = () => {
    setDocOpen(true);
    // On a phone the document sits above the findings; take the reader to it.
    // On a wide screen it is a sticky panel beside them and already in view.
    if (!window.matchMedia("(min-width: 1024px)").matches) {
      requestAnimationFrame(() =>
        document.getElementById("document")?.scrollIntoView({
          block: "start",
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
        }),
      );
    }
  };

  const jurisdictionSection = (
    <Jurisdiction
      value={request.jurisdiction}
      onChange={(v) => applyAndRerun(setJurisdiction(request, v), "state")}
    />
  );

  return (
    <ShowInDocument.Provider value={showInDocument}>
      <div className="calm min-h-screen lg:flex">
        <Rail
          ready={ready}
          missing={missing}
          sample={sample}
          jurisdiction={request.jurisdiction}
          signedIn={account.state.kind === "signed-in"}
          documentKept={keptHere}
          onDocument={showInDocument}
          stateLast={analysed}
          filename={phase.kind === "ready" ? phase.filename : null}
        />

        <div
          className={`flex min-w-0 flex-1 flex-col lg:grid ${
            showDoc ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)]" : "lg:grid-cols-1"
          }`}
        >
        {/* ── The document. Open while it is the work; a panel after. ── */}
        {showDoc ? (
        <section
          id="document"
          aria-label="Your document"
          className="order-1 min-w-0 scroll-mt-[4.25rem] border-b border-rule bg-ground lg:order-2 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:overflow-hidden lg:border-b-0 lg:border-l lg:scroll-mt-0"
        >
          <PaneHead
            title={phase.kind === "ready" ? phase.filename : "Your document"}
            note={
              phase.kind === "ready" && doc
                ? `${doc.text.length.toLocaleString()} characters · ${doc.sentences.length} sentences · read in your browser`
                : "Read in your browser. The file never leaves this machine."
            }
            action={
              phase.kind === "ready" ? (
                <span className="flex gap-4">
                  <button type="button" onClick={clear} className="mark">
                    Replace
                  </button>
                  {analysed ? (
                    <button type="button" onClick={() => setDocOpen(false)} className="mark">
                      Hide document
                    </button>
                  ) : null}
                </span>
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
                className="border border-rule bg-ground overflow-hidden rounded-2xl"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const bytes = new TextEncoder().encode(pasted);
                  await ingest(bytes.buffer.slice(0) as ArrayBuffer, "pasted-text.txt");
                  setPasting(false);
                }}
              >
                <label htmlFor="paste" className="mark block border-b border-rule px-3 py-2">
                  Paste the text of your document
                </label>
                <textarea
                  id="paste"
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                  rows={12}
                  className="document w-full resize-y bg-quote px-4 py-3 text-[0.9375rem] text-graphite"
                  placeholder="Paste here…"
                />
                <div className="flex flex-wrap gap-3 border-t border-rule p-3">
                  <button type="submit" className="slug label">
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
        ) : null}

        {/* ── Findings, questions, red lines: peers, never modals. ───── */}
        <main className="order-2 min-w-0 lg:order-1">
          <div className="@container mx-auto max-w-[56rem] pb-16">
          {/* Asked first, because nothing runs without it; once there are
              findings it moves below them, set and out of the way. */}
          {analysed ? null : jurisdictionSection}

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
            thread={thread}
            onAsk={(text) => void askQuestion(text, request)}
            selected={selected}
            onSelect={setSelected}
          />

          <RedLines
            account={account}
            keeping={keeping}
            kept={keptControls}
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
          {analysed ? jurisdictionSection : null}
          </div>
        </main>
        </div>
      </div>
    </ShowInDocument.Provider>
  );
}

/* ── Chrome ──────────────────────────────────────────────────────────── */

function Rail({
  ready,
  missing,
  sample,
  jurisdiction,
  signedIn,
  documentKept,
  onDocument,
  filename,
  stateLast,
}: {
  ready: boolean;
  missing: string[];
  sample: boolean;
  jurisdiction: UsState | null;
  signedIn: boolean;
  documentKept: boolean;
  /** Opens the document panel, which may be closed once there are findings. */
  onDocument: () => void;
  filename: string | null;
  /** Once there are findings, where-you-work sits below them on the page, and
   *  the menu follows the page. */
  stateLast: boolean;
}) {
  const steps = stateLast
    ? [...STEPS.filter((step) => step.id !== "jurisdiction"), STEPS[1]]
    : STEPS;
  const current = useCurrentStep(steps.map((step) => step.id));
  return (
    <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-rule bg-ground px-4 py-2.5 lg:h-screen lg:w-60 lg:shrink-0 lg:flex-col lg:items-stretch lg:gap-0 lg:border-b-0 lg:border-r lg:px-0 lg:py-0">
      <div className="min-w-0 shrink-0 lg:border-b lg:border-rule lg:px-5 lg:py-5">
        <Link
          href="/"
          className="text-[1.0625rem] font-bold tracking-[-0.01em] text-graphite hover:text-act"
        >
          Redline
        </Link>
        {filename ? (
          <p className="mt-0.5 hidden truncate text-[0.8125rem] text-soft lg:block">{filename}</p>
        ) : null}
      </div>
      <nav aria-label="Steps" className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] lg:overflow-visible lg:py-3">
        <ol className="flex gap-1 lg:flex-col lg:gap-0">
          {steps.map((step, index) => (
            <li key={step.id} className="shrink-0">
              <a
                href={`#${step.id}`}
                aria-current={current === step.id ? "true" : undefined}
                onClick={step.id === "document" ? onDocument : undefined}
                className="step-link flex items-center gap-2.5 whitespace-nowrap px-2.5 py-1.5 text-[0.875rem] text-soft transition-colors duration-150 hover:text-graphite lg:mx-3 lg:px-3 lg:py-2.5 lg:text-[0.9375rem]"
              >
                <span
                  className="step-dot tabular hidden h-5 w-5 shrink-0 place-items-center rounded-full border border-rule text-[0.6875rem] lg:grid"
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                {step.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      {/* The state in use, wherever the reader has scrolled to: the
          enforceability layer is keyed to it, so it is never out of sight. */}
      <a
        href="#jurisdiction"
        className="shrink-0 whitespace-nowrap text-[0.8125rem] font-semibold text-graphite hover:text-act lg:mx-5 lg:mb-3 lg:mt-auto"
      >
        {jurisdiction ? (
          <>
            <span className="hidden font-normal text-soft lg:inline">Working in </span>
            {jurisdiction}
          </>
        ) : (
          "State not set"
        )}
      </a>
      {/* Reserved: the saved library takes the position below this rule when
          it arrives. Deferred by ADR 0002 — nothing is designed or shown. */}
      <div className="hidden space-y-1.5 border-t border-rule px-5 py-4 text-[0.8125rem] leading-snug text-soft lg:block">
        {/* The reason a control is not available yet, kept in sight from
            wherever the reader has scrolled to. */}
        <p className="font-semibold text-graphite">
          {sample
            ? "Sample loaded"
            : ready
              ? "Ready to analyse"
              : `Still needed: ${missing.join(" and ")}`}
        </p>
        {/* True either way, and it has to stay true: signing in keeps the red
            lines. The document's own line only changes when the reader has
            chosen to keep it (ADR 0007). */}
        <p>
          {documentKept
            ? "The text and analysis of this document are kept in your account."
            : "Your document stays in this tab. Close it and it is gone."}
        </p>
        <p>{signedIn ? "Your red lines are kept." : "So are your red lines."}</p>
        <p>Not legal advice.</p>
      </div>
    </div>
  );
}

const STEPS = [
  { id: "document", label: "Your document" },
  { id: "jurisdiction", label: "Where you work" },
  { id: "findings", label: "Findings" },
  { id: "questions", label: "Ask the document" },
  { id: "redlines", label: "Your red lines" },
] as const;

/**
 * The step whose section the reader is in: the last one whose top has passed
 * a line a third of the way down the screen. Recomputed as they scroll, so the
 * menu always says where they are.
 */
function useCurrentStep(ids: readonly string[]): string | null {
  const [current, setCurrent] = useState<string | null>(null);
  const key = ids.join(",");
  useEffect(() => {
    const list = key.split(",");
    let frame = 0;
    const measure = () => {
      frame = 0;
      const line = window.innerHeight / 3;
      let found: string | null = null;
      for (const id of list) {
        const el = document.getElementById(id);
        if (!el) continue;
        // On a wide screen the document is a sticky panel beside the findings,
        // so its top never passes the line; it counts only where it scrolls.
        if (id === "document" && getComputedStyle(el).position === "sticky") continue;
        if (el.getBoundingClientRect().top <= line) found = id;
      }
      setCurrent(found ?? list.find((id) => document.getElementById(id)) ?? null);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [key]);
  return current;
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
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule px-4 py-3 sm:px-6">
      <h2 className="min-w-0 truncate text-[0.9375rem] font-semibold text-graphite">{title}</h2>
      {action}
      {note ? <p className="tabular w-full text-[0.8125rem] text-soft">{note}</p> : null}
    </div>
  );
}

/** A section of the main column: a real heading and one plain line under it
 *  saying what the section is for. More space above than below. */
function SectionHead({ id, title, note }: { id: string; title: string; note?: string }) {
  return (
    <div id={id} className="scroll-mt-[4.25rem] px-4 pt-10 sm:px-8 lg:scroll-mt-6">
      <h2 className="text-[1.375rem] font-bold leading-tight tracking-[-0.01em] text-graphite">
        {title}
      </h2>
      {note ? <p className="mt-1 max-w-[62ch] text-[0.9375rem] text-soft">{note}</p> : null}
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
        className={`rounded-3xl border border-dashed px-5 py-12 text-center transition-colors duration-200 sm:py-16 ${
          dragging ? "border-act bg-wash" : "border-[#c9c9c9] bg-white"
        }`}
      >
        <p className="display text-2xl text-graphite sm:text-3xl">
          Drop your offer letter here
        </p>
        <p className="mx-auto mt-3 max-w-[52ch] font-voice text-[0.9375rem] leading-relaxed text-soft">
          PDF, Word or plain text. Your file is read in this browser and never
          uploaded. Only the text is kept, and only until you close the tab,
          unless you sign in and choose to keep it.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="slug label"
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
          /* Every format `parseDocument` reads. This list is a filter on the
             chooser, not the check: format is detected from magic bytes, so a
             renamed file is still read as what it actually is, and anything
             this list lets through that we cannot read gets a refusal rather
             than a degraded reading. */
          accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          className="sr-only"
          onChange={(e) => onFiles(e.target.files)}
        />
      </div>

      <p className="mt-4 font-voice text-sm leading-relaxed text-soft">
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
    <div className="border border-rule px-4 py-4 overflow-hidden rounded-2xl">
      <p className="label text-graphite">Reading {filename}</p>
      <div
        role="progressbar"
        aria-label={`Reading ${filename}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="mt-3 h-3 w-full border border-rule overflow-hidden rounded-2xl"
      >
        <span
          className="block h-full bg-wash transition-[width] duration-200 ease-out motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="label tabular mt-2 text-soft">
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
    <div className="border border-rule overflow-hidden rounded-2xl">
      <p className="label border-b border-rule bg-wash px-4 py-2 text-graphite">
        Not read · {filename}
      </p>
      <div className="space-y-3 px-4 py-4">
        <p className="font-voice text-lg leading-relaxed text-graphite">{copy.what}</p>
        <p className="max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-soft">
          {copy.why}
        </p>
        <p className="max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-graphite">
          {copy.instead}
        </p>
        <div className="flex flex-wrap gap-3 pt-1">
          <button type="button" onClick={onPaste} className="slug label">
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
      <div className="px-4 pb-6 pt-4 sm:px-8">
        <p
          id="jurisdiction-why"
          className="max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-graphite"
        >
          The same clause does not mean the same thing in every state, and a
          finding that is accurate about your contract can still be no use to
          you without that. Where you work decides which context Redline shows.
          That context sits beside the findings on its own labelled panel: it is
          never mixed into the sentences quoted from your document, and it never
          changes a flag&rsquo;s severity.
        </p>

        <label htmlFor="state" className="label mt-6 block text-soft">
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
            <p className="mt-3 max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-soft">
              Every enforceability note you are shown is keyed to {value}. You
              can change it whenever you like, to fix a mistake or to see how
              the same contract reads somewhere else.
            </p>
          </div>
        ) : (
          <p className="mt-4 max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-soft">
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
  thread,
  onAsk,
  selected,
  onSelect,
}: {
  enabled: boolean;
  value: string;
  setValue: (v: string) => void;
  ask: Ask;
  thread: readonly Exchange[];
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
      <div className="px-4 pb-6 pt-4 sm:px-8">
        <p className="max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-graphite">
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
            className="w-full border border-[#a9afb7] bg-white px-3 py-2 font-voice text-[0.9375rem] text-graphite placeholder:text-soft disabled:cursor-not-allowed disabled:border-rule disabled:bg-wash disabled:text-soft disabled:placeholder:text-soft"
          />
          <button
            type="submit"
            disabled={!enabled || !value.trim() || ask.kind === "asking"}
            className="slug label slug-mt-3"
          >
            <span>{ask.kind === "asking" ? "Reading" : "Ask"}</span>
          </button>
        </form>

        {ask.kind === "asking" ? (
          <div className="mt-4 border border-rule overflow-hidden rounded-2xl" role="status" aria-live="polite">
            <p className="label border-b border-rule bg-wash px-3 py-2 text-graphite">
              Looking through your document
            </p>
            <div className="space-y-3 px-3 py-3">
              <p className="max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-graphite">
                &ldquo;{ask.question}&rdquo;
              </p>
              <p className="max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-soft">
                Nothing reaches this panel until the sentences behind it have
                been found in the copy you are looking at.
              </p>
              <div className="h-[3px] w-full overflow-hidden bg-rule" aria-hidden="true">
                <span className="sweep block h-full w-1/3 bg-wash" />
              </div>
            </div>
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

        {/* Newest first, so the answer just asked for sits under the box. */}
        {thread
          .map((exchange, turn) => ({ exchange, turn }))
          .reverse()
          .map(({ exchange, turn }) => (
            <div key={turn} className="mt-4">
              <AnswerPanel
                turn={turn}
                question={exchange.question}
                answer={exchange.answer}
                selected={selected}
                onSelect={onSelect}
              />
            </div>
          ))}
      </div>
    </>
  );
}

/* ── Red lines ───────────────────────────────────────────────────────── */

function RedLines({
  account,
  keeping,
  kept,
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
  kept: KeptControls;
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
      <div className="px-4 pb-6 pt-4 sm:px-8">
        <p className="max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-graphite">
          A red line is something you have already decided you will not sign.
          Write it the way you would say it out loud.
        </p>
        {/* Where these lines live, said next to where they are typed. The
            promise is made here rather than at a door the reader never has to
            walk through. */}
        <div className="mt-4">
          <AccountPanel account={account} keeping={keeping} kept={kept} />
        </div>
        {/* Ticket criterion, not a nicety: a reader who expects a red line to
            filter the output has been misled by us. */}
        <p className="mt-3 max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-soft">
          When a flag matches one of your red lines, Redline moves that flag to
          the top and names the line it crossed. You still see every flag
          either way. A red line never hides one, and never ranks one lower
          than it would have been on its own.
        </p>
        {reruns ? (
          <p className="label mt-3 max-w-[62ch] leading-relaxed text-graphite">
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
            className="min-w-0 flex-1 border border-[#a9afb7] bg-white px-3 py-2 font-voice text-[0.9375rem] text-graphite placeholder:text-soft"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="slug label"
          >
            <span>Add</span>
          </button>
          <p id="rl-blank" className="label w-full text-soft">
            Blank and space-only lines are not kept, because there would be
            nothing for a flag to match.
          </p>
        </form>

        {lines.length === 0 ? (
          <p className="label mt-4 text-soft">
            None set. The analysis runs the same way without them.
          </p>
        ) : (
          <ul className="mt-4 border-t border-rule">
            {lines.map((line) => (
              <li key={line.id} className="border-b border-rule py-2.5">
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
                      className="min-w-0 flex-1 border border-[#a9afb7] bg-white px-2 py-1 font-voice text-[0.9375rem] text-graphite"
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
                    <p className="min-w-0 flex-1 font-voice text-[0.9375rem] leading-relaxed text-graphite">
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
        title="Findings"
        note={
          run.kind === "done"
            ? "Every claim below shows the sentence it came from"
            : "Nothing is sent anywhere until you ask for it"
        }
      />

      {run.kind === "done" ? null : (
      <div className="px-4 pb-6 pt-4 sm:px-8">
        {run.kind === "idle" ? (
          <div className="border border-rule px-4 py-4 overflow-hidden rounded-2xl">
            <p className="max-w-[62ch] font-voice text-[1.0625rem] leading-relaxed text-graphite">
              {ready
                ? "Your document is read. The text beside this is exactly what gets analysed, and nothing has been sent anywhere yet."
                : `Nothing to analyse yet — still missing ${missing.join(" and ")}.`}
            </p>
            <p className="mt-3 max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-soft">
              Every flag that comes back quotes a sentence from that panel. A
              flag whose sentence cannot be found in your stored text is
              dropped before it reaches you.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={onRun}
                disabled={!ready}
                className="slug label"
              >
                <span>Analyse this document</span>
              </button>
            </div>
            {ready ? (
              <p className="label tabular mt-3 text-soft">
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
      )}

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
