"use client";

/**
 * The account, as the interface sees it.
 *
 * Five states and no sixth, because every one of them has something different
 * to say to the reader — including `unavailable`, which is this build with no
 * Supabase project behind it and is a surface rather than a hidden control.
 *
 * Nothing here has a pretend mode. There is no flag that produces a signed-in
 * reader without a session, because the only thing sign-in buys is that red
 * lines are kept, and a reader who believes they are kept when they are not
 * has been lied to about the one thing.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { accountClient } from "./client";
import { supabaseRedLineStore, type RedLineStore } from "./store";

export type AccountState =
  /** No project is configured for this build. Sign-in is not on offer. */
  | { kind: "unavailable" }
  /** Reading back whatever session the browser already holds. */
  | { kind: "checking" }
  | { kind: "signed-out" }
  /** A link has gone to this address and has not been used yet. */
  | { kind: "link-sent"; email: string }
  | { kind: "signed-in"; email: string; userId: string };

export interface Account {
  state: AccountState;
  /** Something the reader needs to know about, already in their words. Never a
   *  raw message from the service. */
  trouble: string | null;
  sending: boolean;
  /** Present exactly when somebody is signed in. The one thing an account
   *  buys. */
  store: RedLineStore | null;
  signIn: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export function useAccount(): Account {
  const client = useMemo(() => accountClient(), []);
  const [state, setState] = useState<AccountState>(
    client ? { kind: "checking" } : { kind: "unavailable" },
  );
  const [trouble, setTrouble] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!client) return;
    let live = true;

    // A link that has already been used, or has sat in an inbox too long,
    // comes back here as parameters on the address rather than as a session.
    // Reading them is what turns a silent nothing-happened into a sentence.
    const failure = linkFailure(window.location.href);
    if (failure) clearAuthParams();

    void client.auth.getSession().then(({ data }) => {
      if (!live) return;
      setState(fromSession(data.session));
      // Said only if it is still true. A reader who already has a session,
      // and reloaded a stale link into the tab, is signed in and does not
      // need to be told something went wrong.
      if (failure && !data.session) setTrouble(failure);
    });

    const { data: subscription } = client.auth.onAuthStateChange((_event, session) => {
      if (!live) return;
      setState(fromSession(session));
      if (session) setTrouble(null);
    });

    return () => {
      live = false;
      subscription.subscription.unsubscribe();
    };
  }, [client]);

  const signIn = useCallback(
    async (address: string) => {
      const email = address.trim();
      if (!client || !email) return;
      setSending(true);
      setTrouble(null);
      const { error } = await client.auth.signInWithOtp({
        email,
        options: {
          // Back to the page they were on, with everything they had typed
          // still in the tab they left it in.
          emailRedirectTo: `${window.location.origin}/review`,
        },
      });
      setSending(false);
      if (error) {
        setTrouble(troubleWith(error));
        return;
      }
      setState({ kind: "link-sent", email });
    },
    [client],
  );

  const signOut = useCallback(async () => {
    if (!client) return;
    const { error } = await client.auth.signOut();
    if (error) {
      setTrouble("Signing out did not go through. Try it again.");
      return;
    }
    setState({ kind: "signed-out" });
  }, [client]);

  const store = useMemo(
    () =>
      client && state.kind === "signed-in"
        ? supabaseRedLineStore(client, state.userId)
        : null,
    [client, state],
  );

  return {
    state,
    trouble,
    sending,
    store,
    signIn,
    signOut,
  };
}

type Session = Awaited<
  ReturnType<SupabaseClient["auth"]["getSession"]>
>["data"]["session"];

function fromSession(session: Session): AccountState {
  if (!session?.user) return { kind: "signed-out" };
  return {
    kind: "signed-in",
    email: session.user.email ?? "your account",
    userId: session.user.id,
  };
}

/**
 * What a failed link left on the address.
 *
 * Supabase puts it in the fragment on some flows and the query string on
 * others, so both are read. Only the cases a reader can act on get their own
 * sentence; anything else keeps the service's own description rather than
 * being flattened into a wrong guess.
 */
function linkFailure(href: string): string | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const code = url.searchParams.get("error_code") ?? hash.get("error_code");
  const error = url.searchParams.get("error") ?? hash.get("error");
  const described =
    url.searchParams.get("error_description") ?? hash.get("error_description");
  if (!code && !error && !described) return null;

  if (code === "otp_expired") {
    return "That link has expired. Links last an hour and work once, so ask for a new one below.";
  }
  if (code === "access_denied" || error === "access_denied") {
    return "That link did not work. It may already have been used, so ask for a new one below.";
  }
  return described
    ? `Signing in did not go through: ${described.replace(/\+/g, " ")}`
    : "Signing in did not go through. Ask for a new link below.";
}

function clearAuthParams() {
  const url = new URL(window.location.href);
  for (const key of ["error", "error_code", "error_description"]) {
    url.searchParams.delete(key);
  }
  url.hash = "";
  window.history.replaceState(window.history.state, "", url.toString());
}

function troubleWith(error: { message: string; status?: number }): string {
  if (error.status === 429) {
    return "That is several links in a short time. Wait a minute, then ask again.";
  }
  if (/email/i.test(error.message) && /invalid/i.test(error.message)) {
    return "That address does not look like an address. Check it and try again.";
  }
  return "The link could not be sent. Your red lines stay in this tab either way.";
}
