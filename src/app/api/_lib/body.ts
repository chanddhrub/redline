/**
 * The `AnalysisRequest` as a route body, checked rather than trusted.
 *
 * Both model-backed routes take the same object — the analysis takes it alone,
 * the question box takes it with a question — and both are reachable by things
 * that are not our page. One declaration so the two cannot drift: a jurisdiction
 * the browser would have refused must not become acceptable by arriving at the
 * other route.
 *
 * **Neither route takes a file, and this is where that is visible.** The
 * document is parsed in the browser and only its text is stored (CLAUDE.md,
 * ADR 0001). The body is JSON, read with `request.json()`; there is no
 * multipart branch to disable, because the enforcement is that the
 * file-accepting route does not exist.
 *
 * An underscore-prefixed folder, so Next's router does not treat it as a route
 * segment (`node_modules/next/dist/docs/01-app/…/routing/colocation`).
 */

import { z } from "zod";
import { isUsState, type UsState } from "@/lib/intake/analysis-request";

const sentenceSchema = z.object({
  text: z.string(),
  start: z.number().int().min(0),
  end: z.number().int().min(0),
});

export const analysisBodySchema = z.object({
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

/** The JSON body, or a `Response` already written for the reader's browser. */
export async function readBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<{ ok: true; value: T } | { ok: false; response: Response }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      ok: false,
      response: Response.json({ error: "malformed-body" as const }, { status: 400 }),
    };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      response: Response.json(
        { error: "invalid-request" as const, detail: parsed.error.issues },
        { status: 400 },
      ),
    };
  }
  return { ok: true, value: parsed.data };
}
