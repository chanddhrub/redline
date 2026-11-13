"use client";

/**
 * The account, on screen, sitting at the head of the red lines it keeps.
 *
 * It is here rather than in the rail because it is not a way in — the whole
 * product works signed out. It is a promise made where the list is typed, so
 * the reader can see what signing in buys and what it does not, and the choice
 * to keep a document is made here for the same reason.
 *
 * Every state says plainly whether the lines are being kept. The state that
 * matters most is the one with no Supabase project behind it: it says the
 * lines are not kept and why, rather than hiding a control and leaving the
 * reader to assume.
 */

import { useState } from "react";
import type { Account } from "@/lib/account/use-account";

/**
 * What the account holds of the reader's document (ADR 0007). Read before
 * anything is offered: a row that could not be read is not an empty one, and
 * must not be written over as if it were.
 */
export type KeptStatus =
  | { kind: "checking" }
  | { kind: "none" }
  | {
      kind: "kept";
      text: string;
      filename: string;
      /** The reader opened this document or chose to keep it, and it has not
       *  left the screen since. This, never matching text, is what lets a
       *  change be written over the row: the same words on screen can be a
       *  bare copy with none of the analysis the row holds. */
      open: boolean;
      writing: "idle" | "saving" | "saved" | "failed";
    }
  | { kind: "deleting"; filename: string | null }
  | { kind: "delete-failed"; filename: string | null }
  | { kind: "unreachable" };

export interface KeptControls {
  status: KeptStatus;
  /** The document on screen, if there is one. */
  onScreen: string | null;
  /** Whether the document on screen is the one the account holds. */
  isThisOne: boolean;
  /** Something the reader has to be told about what came back or went. */
  note: string | null;
  onKeep: () => void;
  onOpen: () => void;
  /** Reads the account again after a read that failed. */
  onReread: () => void;
  onDelete: () => void;
  onRetry: () => void;
}

/** Whether the last change reached the account. The last two are the ones the
 *  reader has to see: their lines are on the screen and are not in their
 *  account, and only they can decide what to do about that. */
export type Keeping =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "failed" }
  /** Their kept lines could not be read back at all. */
  | { kind: "unreachable" };

export function AccountPanel({
  account,
  keeping,
  kept,
}: {
  account: Account;
  keeping: Keeping;
  kept: KeptControls;
}) {
  const [email, setEmail] = useState("");
  const { state } = account;

  return (
    <div className="border border-rule overflow-hidden rounded-2xl">
      <p className="label border-b border-rule bg-wash px-3 py-2 text-graphite">
        {state.kind === "signed-in" ? "Kept for your account" : "Kept in this tab only"}
      </p>
      <div className="space-y-3 px-4 py-4">
        {state.kind === "unavailable" ? (
          <>
            <p className="max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-graphite">
              This copy of Redline has no account set up, so there is nowhere to
              keep your red lines. They last as long as this tab. Close it and
              you will type them again.
            </p>
            <p className="max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-soft">
              Everything else works: read a document, run the analysis, ask it
              questions.
            </p>
          </>
        ) : null}

        {state.kind === "checking" ? (
          <p className="label text-soft" role="status">
            Checking whether you are signed in
          </p>
        ) : null}

        {state.kind === "signed-out" ? (
          <>
            <p className="max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-graphite">
              Your red lines last as long as this tab. Sign in and they are
              waiting the next time you open a contract.
            </p>
            {/* The limit of the promise, said before they sign in rather than
                discovered afterwards. */}
            <p className="max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-soft">
              An account keeps your red lines. It can keep a document&rsquo;s
              text and analysis too, but only if you choose to. The original
              file is never stored, here or anywhere.
            </p>
            <form
              className="flex flex-wrap gap-3 pt-1"
              onSubmit={(e) => {
                e.preventDefault();
                void account.signIn(email);
              }}
            >
              <label htmlFor="account-email" className="sr-only">
                Your email address
              </label>
              <input
                id="account-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                aria-describedby="account-note"
                className="min-w-0 flex-1 border border-[#a9afb7] bg-white px-3 py-2 font-voice text-[0.9375rem] text-graphite placeholder:text-soft"
              />
              <button
                type="submit"
                disabled={!email.trim() || account.sending}
                className="slug label"
              >
                <span>{account.sending ? "Sending" : "Send me a link"}</span>
              </button>
              <p id="account-note" className="label w-full text-soft">
                We email you a link. There is no password to invent.
              </p>
            </form>
          </>
        ) : null}

        {state.kind === "link-sent" ? (
          <>
            <p
              className="max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-graphite"
              role="status"
            >
              The link is on its way to {state.email}. Open it and you are
              signed in. It works once, and it stops working after an hour.
            </p>
            <p className="max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-soft">
              Leave this tab open. Your document and everything you have typed
              are still here.
            </p>
            <button
              type="button"
              onClick={() => void account.signIn(state.email)}
              disabled={account.sending}
              className="mark"
            >
              Send it again
            </button>
          </>
        ) : null}

        {state.kind === "signed-in" ? (
          <>
            <p className="max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-graphite">
              Signed in as {state.email}. Your red lines are kept, and they are
              yours alone.
            </p>
            <KeptDocumentPanel kept={kept} />
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
              <button type="button" onClick={() => void account.signOut()} className="mark">
                Sign out
              </button>
              <KeepingNote keeping={keeping} />
            </div>
          </>
        ) : null}

        {account.trouble ? (
          <p
            className="max-w-[62ch] border border-rule px-3 py-2 font-voice text-[0.9375rem] leading-relaxed text-graphite overflow-hidden rounded-2xl"
            role="status"
          >
            {account.trouble}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The reader's choice about their document, made here because this is where
 * they are told what an account holds. Nothing is kept until they press the
 * button, and every state says what is and is not in their account.
 */
function KeptDocumentPanel({ kept }: { kept: KeptControls }) {
  const { status, onScreen, isThisOne, note } = kept;
  const body = "max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-soft";
  const held =
    status.kind === "kept" || status.kind === "deleting" || status.kind === "delete-failed"
      ? status.filename
      : null;

  return (
    <div className="space-y-3 border-t border-rule pt-3">
      <p className="label text-graphite">Your document</p>

      {status.kind === "checking" ? (
        <p className="label text-soft" role="status">
          Checking what your account holds
        </p>
      ) : null}

      {status.kind === "unreachable" ? (
        <p className={body} role="status">
          What your account holds could not be read. Redline has not written
          over it.
        </p>
      ) : null}

      {status.kind === "deleting" ? (
        <p className="label text-soft" role="status">
          Deleting
        </p>
      ) : null}

      {status.kind === "delete-failed" ? (
        <p className="label max-w-[40ch] leading-relaxed text-graphite" role="status">
          Deleting did not go through. It is still in your account.
        </p>
      ) : null}

      {status.kind === "kept" && isThisOne ? (
        <>
          <p className={body}>
            {status.filename} is kept in your account: its text, its analysis and
            the questions you asked. It will be here when you sign in again. The
            original file was never stored.
          </p>
          {status.writing === "saving" ? (
            <p className="label text-soft" role="status">
              Keeping
            </p>
          ) : null}
          {status.writing === "saved" ? (
            <p className="label text-soft" role="status">
              Kept
            </p>
          ) : null}
          {status.writing === "failed" ? (
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
              <p className="label max-w-[40ch] leading-relaxed text-graphite" role="status">
                The latest change did not reach your account. It is still on
                this screen.
              </p>
              <button type="button" onClick={kept.onRetry} className="mark">
                Try again
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      {status.kind === "kept" && !isThisOne ? (
        <p className={body}>
          Your account holds {status.filename}. Opening it replaces what is on
          this screen.
        </p>
      ) : null}

      {status.kind === "none" && !onScreen ? (
        <p className={body}>
          Read a document and you can choose to keep its text and analysis here.
        </p>
      ) : null}

      {onScreen && !isThisOne && (status.kind === "none" || status.kind === "kept") ? (
        <>
          <p className={body}>
            Save the text and analysis of {onScreen} to your account, with the
            questions you ask about it, so they are here when you come back. The
            original file is never stored.
            {status.kind === "kept"
              ? ` Your account holds one document, so this replaces ${status.filename}.`
              : ""}
          </p>
          <button type="button" onClick={kept.onKeep} className="slug label">
            <span>Save the text and analysis</span>
          </button>
        </>
      ) : null}

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        {status.kind === "kept" && !isThisOne ? (
          <button type="button" onClick={kept.onOpen} className="mark">
            Open {status.filename}
          </button>
        ) : null}
        {status.kind === "unreachable" ? (
          <button type="button" onClick={kept.onReread} className="mark">
            Try again
          </button>
        ) : null}
        {status.kind === "kept" || status.kind === "delete-failed" || status.kind === "unreachable" ? (
          <button type="button" onClick={kept.onDelete} className="mark">
            {held ? `Delete ${held} from my account` : "Delete it from my account"}
          </button>
        ) : null}
      </div>

      {note ? (
        <p
          className="max-w-[62ch] border border-rule px-3 py-2 font-voice text-[0.9375rem] leading-relaxed text-graphite overflow-hidden rounded-2xl"
          role="status"
        >
          {note}
        </p>
      ) : null}
    </div>
  );
}

function KeepingNote({ keeping }: { keeping: Keeping }) {
  if (keeping.kind === "idle") return null;
  if (keeping.kind === "saving") {
    return (
      <p className="label text-soft" role="status">
        Keeping
      </p>
    );
  }
  if (keeping.kind === "saved") {
    return (
      <p className="label text-soft" role="status">
        Kept
      </p>
    );
  }
  if (keeping.kind === "unreachable") {
    return (
      <p className="label max-w-[40ch] leading-relaxed text-graphite" role="status">
        Your kept red lines could not be read. What is on this screen is still
        here, and Redline has not written over what you have kept.
      </p>
    );
  }
  return (
    <p className="label max-w-[40ch] leading-relaxed text-graphite" role="status">
      That change did not reach your account. It is still on this screen.
    </p>
  );
}
