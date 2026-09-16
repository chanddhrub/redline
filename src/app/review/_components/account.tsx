"use client";

/**
 * The account, on screen, sitting at the head of the red lines it keeps.
 *
 * It is here rather than in the rail because it is not a way in — the whole
 * product works signed out. It is one promise about one list, made in the
 * place that list is typed, so the reader can see what signing in buys and
 * what it does not.
 *
 * Every state says plainly whether the lines are being kept. The state that
 * matters most is the one with no Supabase project behind it: it says the
 * lines are not kept and why, rather than hiding a control and leaving the
 * reader to assume.
 */

import { useState } from "react";
import type { Account } from "@/lib/account/use-account";

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
}: {
  account: Account;
  keeping: Keeping;
}) {
  const [email, setEmail] = useState("");
  const { state } = account;

  return (
    <div className="border-2 border-spot">
      <p className="label border-b-2 border-spot bg-spot px-3 py-2 text-ink">
        {state.kind === "signed-in" ? "Kept for your account" : "Kept in this tab only"}
      </p>
      <div className="space-y-3 px-4 py-4">
        {state.kind === "unavailable" ? (
          <>
            <p className="max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-paper">
              This copy of Redline has no account set up, so there is nowhere to
              keep your red lines. They last as long as this tab. Close it and
              you will type them again.
            </p>
            <p className="max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-paper/80">
              Everything else works: read a document, run the analysis, ask it
              questions.
            </p>
          </>
        ) : null}

        {state.kind === "checking" ? (
          <p className="label text-paper/70" role="status">
            Checking whether you are signed in
          </p>
        ) : null}

        {state.kind === "signed-out" ? (
          <>
            <p className="max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-paper">
              Your red lines last as long as this tab. Sign in and they are
              waiting the next time you open a contract.
            </p>
            {/* The limit of the promise, said before they sign in rather than
                discovered afterwards. */}
            <p className="max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-paper/80">
              Red lines are all an account holds. Your document is not stored,
              here or anywhere. It is read in this browser and it stays
              there.
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
                className="min-w-0 flex-1 border-2 border-spot bg-paper px-3 py-2 font-voice text-[0.9375rem] text-ink placeholder:text-ink/45"
              />
              <button
                type="submit"
                disabled={!email.trim() || account.sending}
                className="slug label slug-on-ink disabled:cursor-not-allowed disabled:border-paper/30 disabled:bg-transparent disabled:text-paper/45"
              >
                <span>{account.sending ? "Sending" : "Send me a link"}</span>
              </button>
              <p id="account-note" className="label w-full text-paper/60">
                We email you a link. There is no password to invent.
              </p>
            </form>
          </>
        ) : null}

        {state.kind === "link-sent" ? (
          <>
            <p
              className="max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-paper"
              role="status"
            >
              The link is on its way to {state.email}. Open it and you are
              signed in. It works once, and it stops working after an hour.
            </p>
            <p className="max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-paper/80">
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
            <p className="max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-paper">
              Signed in as {state.email}. Your red lines are kept, and they are
              yours alone.
            </p>
            <p className="max-w-[62ch] font-voice text-[0.9375rem] leading-relaxed text-paper/80">
              Nothing else is kept. Your document is read in this browser and
              never uploaded or stored, and closing this tab ends it.
            </p>
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
            className="max-w-[62ch] border-2 border-paper/40 px-3 py-2 font-voice text-[0.9375rem] leading-relaxed text-paper"
            role="status"
          >
            {account.trouble}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function KeepingNote({ keeping }: { keeping: Keeping }) {
  if (keeping.kind === "idle") return null;
  if (keeping.kind === "saving") {
    return (
      <p className="label text-paper/70" role="status">
        Keeping
      </p>
    );
  }
  if (keeping.kind === "saved") {
    return (
      <p className="label text-paper/70" role="status">
        Kept
      </p>
    );
  }
  if (keeping.kind === "unreachable") {
    return (
      <p className="label max-w-[40ch] leading-relaxed text-spot" role="status">
        Your kept red lines could not be read. What is on this screen is still
        here, and Redline has not written over what you have kept.
      </p>
    );
  }
  return (
    <p className="label max-w-[40ch] leading-relaxed text-spot" role="status">
      That change did not reach your account. It is still on this screen.
    </p>
  );
}
