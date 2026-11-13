"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useAccount } from "@/lib/account/use-account";

/**
 * Sign-in from the landing page's masthead.
 *
 * The same account and the same emailed link as the review screen: the link
 * always lands on `/review`, where the work is, so nothing about sign-in is
 * duplicated here except the form that asks for an address. A build with no
 * account behind it shows nothing, rather than a control that cannot work.
 *
 * A disclosure, not a modal: it opens under the masthead, keeps the page
 * behind it usable, and closes on Escape or a click elsewhere.
 */
export function HomeAccount() {
  const account = useAccount();
  const { state } = account;
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLInputElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  useEffect(() => {
    if (open && state.kind === "signed-out") fieldRef.current?.focus();
  }, [open, state.kind]);

  // No account in this build, or the session is still being read: say
  // nothing rather than flash a control that might be wrong.
  if (state.kind === "unavailable" || state.kind === "checking") return null;

  if (state.kind === "signed-in") {
    return (
      <div className="flex items-baseline gap-4">
        <span className="hidden max-w-[22ch] truncate text-[0.8125rem] text-soft sm:inline">
          Signed in as {state.email}
        </span>
        <button type="button" onClick={() => void account.signOut()} className="mark">
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="mark"
      >
        Sign in
      </button>

      {open ? (
        <div
          id={panelId}
          className="absolute right-0 top-full z-30 mt-3 w-[min(22rem,calc(100vw-2.5rem))] border border-rule bg-white p-4 shadow-[0_8px_24px_rgba(31,35,40,0.12)] overflow-hidden rounded-2xl"
        >
          {state.kind === "signed-out" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (email.trim()) void account.signIn(email);
              }}
            >
              <p className="text-[0.9375rem] font-bold text-graphite">Sign in to Redline</p>
              <p className="mt-1 text-[0.875rem] leading-relaxed text-soft">
                An account keeps your red lines. It can keep a document&rsquo;s text
                and analysis too, but only if you choose to. The original file is
                never stored.
              </p>
              <label
                htmlFor={`${panelId}-email`}
                className="mt-3 block text-[0.8125rem] font-semibold text-graphite"
              >
                Your email address
              </label>
              <input
                ref={fieldRef}
                id={`${panelId}-email`}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                aria-describedby={`${panelId}-note`}
                className="mt-1 w-full border border-[#a9afb7] bg-white px-3 py-2 text-[1rem] text-graphite placeholder:text-soft"
              />
              <button
                type="submit"
                disabled={!email.trim() || account.sending}
                className="slug mt-3 w-full justify-center"
              >
                <span>{account.sending ? "Sending" : "Send me a link"}</span>
              </button>
              <p id={`${panelId}-note`} className="mt-2 text-[0.8125rem] text-soft">
                We email you a link. There is no password to invent.
              </p>
            </form>
          ) : null}

          {state.kind === "link-sent" ? (
            <div role="status">
              <p className="text-[0.9375rem] font-bold text-graphite">Check your email</p>
              <p className="mt-1 text-[0.875rem] leading-relaxed text-graphite">
                The link is on its way to {state.email}. Open it and you land on
                the review screen, signed in. It works once, and it stops working
                after an hour.
              </p>
              <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-2">
                <button
                  type="button"
                  onClick={() => void account.signIn(state.email)}
                  disabled={account.sending}
                  className="mark"
                >
                  Send it again
                </button>
                <Link href="/review" className="mark">
                  Go to the review screen
                </Link>
              </div>
            </div>
          ) : null}

          {account.trouble ? (
            <p className="mt-3 border border-rule px-3 py-2 text-[0.875rem] leading-relaxed text-graphite overflow-hidden rounded-2xl" role="status">
              {account.trouble}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
