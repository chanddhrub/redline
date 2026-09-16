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
 * The body is validated rather than trusted. A jurisdiction is checked against
 * the list of US states, red lines against their two fields, sentences against
 * their offsets — the same standard the browser applies, applied again, because
 * a route is reachable by things that are not our page.
 *
 * Server only: the model client reads `OPENROUTER_API_KEY`, and `openrouter.ts`
 * imports `server-only`, so this file cannot be pulled into a client bundle.
 */

import { z } from "zod";
import { analyse } from "@/lib/analysis/analyse";
import { isUsState, type UsState } from "@/lib/intake/analysis-request";
import { createOpenRouterClient } from "@/lib/model/openrouter";

const sentenceSchema = z.object({
  text: z.string(),
  start: z.number().int().min(0),
  end: z.number().int().min(0),
});

const bodySchema = z.object({
  text: z.string().min(1),
  sentences: z.array(sentenceSchema),
  // `z.custom` rather than a refined string, so the parsed value is a
  // `UsState` and nothing downstream has to cast one back.
  jurisdiction: z.custom<UsState>(
    (value) => typeof value === "string" && isUsState(value),
    "not a US state",
  ),
  redLines: z.array(z.object({ id: z.string(), text: z.string() })),
});

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "malformed-body" as const },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid-request" as const, detail: parsed.error.issues },
      { status: 400 },
    );
  }

  const outcome = await analyse(parsed.data, createOpenRouterClient());

  if (!outcome.ok) {
    // The failure goes back as data, the way the model client hands it over.
    // The interface writes its own copy; a transport's error message is not
    // something to show a reader (ADR 0004 on register, `client.ts` on shape).
    const status = outcome.failure.kind === "unreadable-document" ? 422 : 502;
    return Response.json({ error: outcome.failure }, { status });
  }

  return Response.json(outcome.analysis);
}
