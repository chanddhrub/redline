/**
 * Whether this copy of Redline has an account behind it at all.
 *
 * The account is not a toll gate (spec, "The account"). With the two variables
 * absent the app starts, intake works, an analysis runs and the question box
 * answers; only the keeping of red lines is gone, and the interface says so.
 * So the question "is there a Supabase project" has to be answerable anywhere
 * in the interface without throwing, and this module is the one place that
 * answers it.
 *
 * Nothing here invents a fallback. There is no development mode that pretends
 * a project exists, because a pretend account would produce a reader who
 * believes their red lines are kept and finds them gone.
 */

export interface AccountConfig {
  url: string;
  anonKey: string;
}

/**
 * Read from a plain record so the decision can be tested without a build.
 *
 * Absent, empty and whitespace-only are the same answer: no account. A half
 * configuration — a URL and no key — is also no account rather than a client
 * that throws on its first call, because a reader cannot act on a thrown
 * error and can act on "signing in is not set up here".
 */
export function readAccountConfig(env: {
  url: string | undefined;
  anonKey: string | undefined;
}): AccountConfig | null {
  const url = env.url?.trim();
  const anonKey = env.anonKey?.trim();
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

/**
 * The configuration this build was compiled with.
 *
 * Both reads are written out in full rather than looked up through a variable,
 * because `NEXT_PUBLIC_` values are substituted into the bundle at build time
 * by name. `process.env[key]` would compile to a lookup on an object that is
 * empty in the browser, and the account would be permanently absent in
 * production for a reason nobody could see.
 */
export function accountConfig(): AccountConfig | null {
  return readAccountConfig({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}
