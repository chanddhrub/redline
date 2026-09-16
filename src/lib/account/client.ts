/**
 * The Supabase client, or nothing.
 *
 * Nothing is a working state, not a failure: with the two variables absent the
 * product runs and the account features say they are not set up. So this
 * returns `null` rather than throwing, and there is no second implementation
 * standing in for a real one.
 *
 * `createBrowserClient` keeps the session in cookies rather than in web
 * storage. That is not incidental. A magic link opens in a new tab, and the
 * PKCE verifier written when the link was requested has to be readable from
 * that tab, which rules out `sessionStorage`; and the cookie belongs to the
 * account, not to the reader's document, which is what the session-only rule
 * in intake protects. The document's text still never leaves the tab.
 */

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { accountConfig } from "./config";

export function accountClient(): SupabaseClient | null {
  const config = accountConfig();
  if (!config) return null;
  // `createBrowserClient` returns the same client on every call in a browser,
  // so this is safe to ask for from anywhere that needs it.
  return createBrowserClient(config.url, config.anonKey);
}
