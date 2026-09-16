/**
 * The question box's route. One POST, one JSON body, one `Answer` back.
 *
 * **It takes the question and the request as JSON, and it will never take a
 * file.** Same constraint as the analysis route and the same enforcement: the
 * document was parsed in the browser, only its text is stored, and the route
 * that would accept an upload does not exist (CLAUDE.md, ADR 0001).
 *
 * What goes back over the wire is the two states and nothing else. The
 * citations lose their brand crossing JSON — a `unique symbol` key does not
 * survive `JSON.stringify` — so the browser checks the shape it was sent rather
 * than casting it back (`../../review/_lib/wire`). `dropped` is not serialised:
 * it is the count that tells a paraphrasing model from a silent document, and
 * it belongs in the server's logs, never in front of the reader.
 *
 * Server only: the model client reads `OPENROUTER_API_KEY`, and `openrouter.ts`
 * imports `server-only`, so this file cannot be pulled into a client bundle.
 */

import { z } from "zod";
import { answer } from "@/lib/analysis/answer";
import { createOpenRouterClient } from "@/lib/model/openrouter";
import { analysisBodySchema, readBody } from "../_lib/body";

const bodySchema = analysisBodySchema.extend({
  question: z.string().min(1),
});

export async function POST(request: Request): Promise<Response> {
  const body = await readBody(request, bodySchema);
  if (!body.ok) return body.response;

  const { question, ...analysisRequest } = body.value;

  const outcome = await answer(
    question,
    analysisRequest,
    createOpenRouterClient(),
  );

  if (!outcome.ok) {
    // `no-question` is our own fault: the browser disables the control on an
    // empty box, so a request without one was built badly rather than asked
    // badly. It goes back as a 400 with the other malformed bodies.
    if (outcome.failure.kind === "no-question") {
      return Response.json({ error: "invalid-request" as const }, { status: 400 });
    }
    const status = outcome.failure.kind === "unreadable-document" ? 422 : 502;
    return Response.json({ error: outcome.failure }, { status });
  }

  // Only the two states cross the wire. A `not-addressed` answer carries no
  // fields, because there is nothing about the reader's document to say.
  return Response.json(
    outcome.answer.kind === "answered"
      ? {
          kind: "answered" as const,
          text: outcome.answer.text,
          citations: outcome.answer.citations.map((citation) => ({
            text: citation.text,
            span: citation.span,
          })),
        }
      : { kind: "not-addressed" as const },
  );
}
