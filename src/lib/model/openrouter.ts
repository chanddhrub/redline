/**
 * The one transport. Every model call in the product goes through here.
 *
 * Server only, structurally: `server-only` resolves to a throwing module in a
 * client bundle, so importing this file from a client component fails the
 * build rather than shipping `OPENROUTER_API_KEY` to a browser. The key is also
 * read from a non-`NEXT_PUBLIC_` variable, which Next never inlines into client
 * code, so there are two independent reasons it cannot leak.
 *
 * The model id is read from `OPENROUTER_MODEL` at call time and appears nowhere
 * in this repository — not as a default, not as a fallback, not in a comment a
 * later session could copy. Its absence is an error naming the variable.
 */

import "server-only";

import type {
  ModelClient,
  ModelFailure,
  ModelResult,
  StructuredRequest,
} from "./client";

export const OPENROUTER_ENDPOINT =
  "https://openrouter.ai/api/v1/chat/completions";

/**
 * Pinned on every request. One provider, no silent substitution: a fallback
 * provider is a different model serving the same call, and "the same document
 * ranks the same way every time" (PRD §4 T3) does not survive that.
 * `require_parameters` makes the provider refuse the call rather than quietly
 * drop the structured-output constraint.
 */
export const PINNED_PROVIDER = {
  order: ["fireworks"],
  allow_fallbacks: false,
  require_parameters: true,
} as const;

export const REASONING = { effort: "low" } as const;

/** How much of an error body is kept for diagnostics. */
const DETAIL_LIMIT = 500;

export interface OpenRouterOptions {
  /** Defaults to `process.env`. Injected so tests never touch real config. */
  env?: Record<string, string | undefined>;
  /** Defaults to the global `fetch`. Stubbing this is stubbing the network. */
  fetch?: typeof globalThis.fetch;
  endpoint?: string;
}

export interface OpenRouterRequestBody {
  model: string;
  messages: { role: "system" | "user"; content: string }[];
  provider: typeof PINNED_PROVIDER;
  reasoning: typeof REASONING;
  response_format: {
    type: "json_schema";
    json_schema: {
      name: string;
      strict: true;
      schema: Record<string, unknown>;
    };
  };
}

/** Exported so a test can assert the wire shape without a network stub. */
export function buildRequestBody<T>(
  model: string,
  request: StructuredRequest<T>,
): OpenRouterRequestBody {
  return {
    model,
    messages: [
      { role: "system", content: request.system },
      { role: "user", content: request.user },
    ],
    provider: PINNED_PROVIDER,
    reasoning: REASONING,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: request.schema.name,
        strict: true,
        schema: request.schema.jsonSchema,
      },
    },
  };
}

export function createOpenRouterClient(
  options: OpenRouterOptions = {},
): ModelClient {
  const endpoint = options.endpoint ?? OPENROUTER_ENDPOINT;

  return {
    async complete<T>(
      request: StructuredRequest<T>,
    ): Promise<ModelResult<T>> {
      // Read at call time, not at module load: a server that starts before its
      // configuration is in place should fail the call, not the boot.
      const env = options.env ?? (process.env as Record<string, string | undefined>);
      const model = required(env, "OPENROUTER_MODEL");
      if (!model.ok) return model;
      const key = required(env, "OPENROUTER_API_KEY");
      if (!key.ok) return key;

      const doFetch = options.fetch ?? globalThis.fetch;

      let response: Response;
      try {
        response = await doFetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key.value}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(buildRequestBody(model.value, request)),
        });
      } catch (cause) {
        return fail({ kind: "unreachable", detail: message(cause) });
      }

      if (!response.ok) {
        return fail({
          kind: "rejected",
          status: response.status,
          detail: truncate(await safeText(response)),
        });
      }

      let envelope: unknown;
      try {
        envelope = JSON.parse(await response.text());
      } catch (cause) {
        return fail({
          kind: "unusable-response",
          reason: "not-json",
          detail: `envelope: ${message(cause)}`,
        });
      }

      const content = extractContent(envelope);
      if (content === null) {
        return fail({
          kind: "unusable-response",
          reason: "no-content",
          detail: "no message content on the first choice",
        });
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch (cause) {
        return fail({
          kind: "unusable-response",
          reason: "not-json",
          detail: message(cause),
        });
      }

      // The declared schema is the last word. Nothing below coerces, fills in
      // or repairs — a payload that failed here never becomes a value.
      const outcome = request.schema.parse(parsed);
      if (!outcome.ok) {
        return fail({
          kind: "unusable-response",
          reason: "off-schema",
          detail: outcome.detail,
        });
      }

      return { ok: true, value: outcome.value };
    },
  };
}

function required(
  env: Record<string, string | undefined>,
  variable: string,
): { ok: true; value: string } | { ok: false; failure: ModelFailure } {
  const value = env[variable];
  if (value && value.trim()) return { ok: true, value };
  return { ok: false, failure: { kind: "missing-configuration", variable } };
}

function fail<T>(failure: ModelFailure): ModelResult<T> {
  return { ok: false, failure };
}

function extractContent(envelope: unknown): string | null {
  if (typeof envelope !== "object" || envelope === null) return null;
  const choices = (envelope as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const first = choices[0] as { message?: { content?: unknown } } | undefined;
  const content = first?.message?.content;
  return typeof content === "string" && content.length > 0 ? content : null;
}

async function safeText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function truncate(text: string): string {
  return text.length > DETAIL_LIMIT ? `${text.slice(0, DETAIL_LIMIT)}…` : text;
}

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
