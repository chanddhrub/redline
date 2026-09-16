/**
 * The analysis route. One POST, one JSON body, one `Analysis` back.
 *
 * **It takes text, and it will never take a file.** The document is parsed in
 * the browser and only its text is stored (CLAUDE.md, ADR 0001), so there is no
 * multipart branch here to disable and no upload handler to secure. The body is
 * read with `request.json()` and nothing else; a `FormData` post fails at the
 * first line. The enforcement is that the file-accepting route does not exist,
 * and the way to keep that true is not to write one.
 *
 * The body is validated rather than trusted — the same standard the browser
 * applies, applied again, because a route is reachable by things that are not
 * our page. The schema is shared with the question box's route (`../_lib/body`)
 * so the two cannot drift apart.
 *
 * Server only: the model client reads `OPENROUTER_API_KEY`, and `openrouter.ts`
 * imports `server-only`, so this file cannot be pulled into a client bundle.
 *
 * The enforceability notes for the state in the body are looked up here and
 * passed in. They are the one thing this product says that the document does
 * not, they carry no span because nothing in the document supports them, and
 * the pipeline takes them as an argument so that it cannot consult them while
 * ranking.
 */

import { analyse } from "@/lib/analysis/analyse";
import { enforceabilityNotes } from "@/lib/analysis/enforceability";
import { createOpenRouterClient } from "@/lib/model/openrouter";
import { analysisBodySchema, readBody } from "../_lib/body";

export async function POST(request: Request): Promise<Response> {
  const body = await readBody(request, analysisBodySchema);
  if (!body.ok) return body.response;

  // The second layer is assembled here and handed in, rather than reached for
  // inside the pipeline. Keeping it an argument is what makes "running with the
  // layer and running without it produce the same flags" a thing a caller can
  // actually do, and a thing the tests do on every run (ADR 0005).
  const outcome = await analyse(body.value, createOpenRouterClient(), {
    context: enforceabilityNotes(body.value.jurisdiction),
  });

  if (!outcome.ok) {
    // The failure goes back as data, the way the model client hands it over.
    // The interface writes its own copy; a transport's error message is not
    // something to show a reader (ADR 0004 on register, `client.ts` on shape).
    const status = outcome.failure.kind === "unreadable-document" ? 422 : 502;
    return Response.json({ error: outcome.failure }, { status });
  }

  return Response.json(outcome.analysis);
}
