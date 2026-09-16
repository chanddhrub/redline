import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createOpenRouterClient, OPENROUTER_ENDPOINT } from "./openrouter";
import { modelSchema } from "./schema";
import type { StructuredRequest } from "./client";

const ENV = {
  OPENROUTER_MODEL: "vendor-from-the-environment/model-from-the-environment",
  OPENROUTER_API_KEY: "sk-test-not-a-real-key",
};

const schema = modelSchema(
  "verdictless-test-payload",
  z.object({
    headline: z.string(),
    quotes: z.array(z.string()),
    note: z.string().nullable(),
  }),
);

const call: StructuredRequest<{
  headline: string;
  quotes: string[];
  note: string | null;
}> = {
  operation: "analysis",
  system: "Quote the document.",
  user: "Section 5 binds you for eighteen months.",
  schema,
};

/** What OpenRouter sends back when it works. */
function chatResponse(payload: unknown): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { content: JSON.stringify(payload) } }] }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

type Captured = { url: string; init: RequestInit };

function capturing(response: () => Response) {
  const captured: Captured[] = [];
  const fetchStub: typeof globalThis.fetch = async (url, init) => {
    captured.push({ url: String(url), init: init ?? {} });
    return response();
  };
  return { captured, fetchStub };
}

function bodyOf(captured: Captured) {
  return JSON.parse(String(captured.init.body));
}

describe("the OpenRouter transport — the request it builds", () => {
  it("posts to the chat completions endpoint with the pinned provider and low reasoning effort", async () => {
    const { captured, fetchStub } = capturing(() =>
      chatResponse({ headline: "ok", quotes: [], note: null }),
    );
    const client = createOpenRouterClient({ env: ENV, fetch: fetchStub });

    await client.complete(call);

    expect(captured).toHaveLength(1);
    expect(captured[0].url).toBe(OPENROUTER_ENDPOINT);
    expect(captured[0].init.method).toBe("POST");

    const body = bodyOf(captured[0]);
    expect(body.provider).toEqual({
      order: ["fireworks"],
      allow_fallbacks: false,
      require_parameters: true,
    });
    expect(body.reasoning).toEqual({ effort: "low" });
    expect(body.messages).toEqual([
      { role: "system", content: call.system },
      { role: "user", content: call.user },
    ]);
  });

  it("takes the model id from OPENROUTER_MODEL rather than from code", async () => {
    const { captured, fetchStub } = capturing(() =>
      chatResponse({ headline: "ok", quotes: [], note: null }),
    );
    const env = { ...ENV, OPENROUTER_MODEL: "some-other-vendor/some-other-model" };

    await createOpenRouterClient({ env, fetch: fetchStub }).complete(call);

    expect(bodyOf(captured[0]).model).toBe("some-other-vendor/some-other-model");
  });

  it("asks for strict JSON against the caller's schema, closed to extra keys", async () => {
    const { captured, fetchStub } = capturing(() =>
      chatResponse({ headline: "ok", quotes: [], note: null }),
    );

    await createOpenRouterClient({ env: ENV, fetch: fetchStub }).complete(call);

    const format = bodyOf(captured[0]).response_format;
    expect(format.type).toBe("json_schema");
    expect(format.json_schema.strict).toBe(true);
    expect(format.json_schema.name).toBe("verdictless-test-payload");
    expect(format.json_schema.schema.additionalProperties).toBe(false);
    expect(format.json_schema.schema.required.sort()).toEqual([
      "headline",
      "note",
      "quotes",
    ]);
    expect(format.json_schema.schema.$schema).toBeUndefined();
  });

  it("sends the key as a bearer token and never in the body", async () => {
    const { captured, fetchStub } = capturing(() =>
      chatResponse({ headline: "ok", quotes: [], note: null }),
    );

    await createOpenRouterClient({ env: ENV, fetch: fetchStub }).complete(call);

    const headers = captured[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${ENV.OPENROUTER_API_KEY}`);
    expect(String(captured[0].init.body)).not.toContain(ENV.OPENROUTER_API_KEY);
  });
});

describe("the OpenRouter transport — what it does with the answer", () => {
  it("returns the parsed payload when the response satisfies the schema", async () => {
    const payload = {
      headline: "Eighteen months, whole industry",
      quotes: ["Section 5 binds you for eighteen months."],
      note: null,
    };
    const { fetchStub } = capturing(() => chatResponse(payload));

    const result = await createOpenRouterClient({ env: ENV, fetch: fetchStub }).complete(
      call,
    );

    expect(result).toEqual({ ok: true, value: payload });
  });

  it("fails rather than coerces when the payload breaks the schema", async () => {
    const { fetchStub } = capturing(() =>
      chatResponse({ headline: 42, quotes: "not a list", note: null }),
    );

    const result = await createOpenRouterClient({ env: ENV, fetch: fetchStub }).complete(
      call,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.kind).toBe("unusable-response");
    if (result.failure.kind !== "unusable-response") return;
    expect(result.failure.reason).toBe("off-schema");
    expect(result.failure.detail).toContain("headline");
  });

  it("fails when the model returns something that is not JSON at all", async () => {
    const { fetchStub } = capturing(
      () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "Here is my analysis: ..." } }],
          }),
          { status: 200 },
        ),
    );

    const result = await createOpenRouterClient({ env: ENV, fetch: fetchStub }).complete(
      call,
    );

    expect(result.ok).toBe(false);
    if (result.ok || result.failure.kind !== "unusable-response") {
      throw new Error("expected an unusable response");
    }
    expect(result.failure.reason).toBe("not-json");
  });

  it("reports a non-2xx response as a rejection carrying the status", async () => {
    const { fetchStub } = capturing(
      () =>
        new Response(JSON.stringify({ error: { message: "rate limited" } }), {
          status: 429,
        }),
    );

    const result = await createOpenRouterClient({ env: ENV, fetch: fetchStub }).complete(
      call,
    );

    expect(result.ok).toBe(false);
    if (result.ok || result.failure.kind !== "rejected") {
      throw new Error("expected a rejection");
    }
    expect(result.failure.status).toBe(429);
    expect(result.failure.detail).toContain("rate limited");
  });

  it("reports a network failure as unreachable, not as a rejection", async () => {
    const fetchStub: typeof globalThis.fetch = async () => {
      throw new TypeError("fetch failed");
    };

    const result = await createOpenRouterClient({ env: ENV, fetch: fetchStub }).complete(
      call,
    );

    expect(result).toEqual({
      ok: false,
      failure: { kind: "unreachable", detail: "fetch failed" },
    });
  });
});

describe("the OpenRouter transport — configuration", () => {
  it("names the missing variable when the model id is absent", async () => {
    const { captured, fetchStub } = capturing(() =>
      chatResponse({ headline: "ok", quotes: [], note: null }),
    );

    const result = await createOpenRouterClient({
      env: { OPENROUTER_API_KEY: ENV.OPENROUTER_API_KEY },
      fetch: fetchStub,
    }).complete(call);

    expect(result).toEqual({
      ok: false,
      failure: { kind: "missing-configuration", variable: "OPENROUTER_MODEL" },
    });
    // No silent fallback: nothing was sent at all.
    expect(captured).toHaveLength(0);
  });

  it("names the missing variable when the key is absent", async () => {
    const { captured, fetchStub } = capturing(() =>
      chatResponse({ headline: "ok", quotes: [], note: null }),
    );

    const result = await createOpenRouterClient({
      env: { OPENROUTER_MODEL: ENV.OPENROUTER_MODEL },
      fetch: fetchStub,
    }).complete(call);

    expect(result).toEqual({
      ok: false,
      failure: { kind: "missing-configuration", variable: "OPENROUTER_API_KEY" },
    });
    expect(captured).toHaveLength(0);
  });

  it("treats a blank variable as absent rather than sending it", async () => {
    const { captured, fetchStub } = capturing(() =>
      chatResponse({ headline: "ok", quotes: [], note: null }),
    );

    const result = await createOpenRouterClient({
      env: { ...ENV, OPENROUTER_MODEL: "   " },
      fetch: fetchStub,
    }).complete(call);

    expect(result.ok).toBe(false);
    if (result.ok || result.failure.kind !== "missing-configuration") {
      throw new Error("expected a configuration failure");
    }
    expect(result.failure.variable).toBe("OPENROUTER_MODEL");
    expect(captured).toHaveLength(0);
  });
});

describe("no model id is written into the source", () => {
  // The fragments are split so that this file does not itself contain the
  // strings it is scanning for. A model id in `src/` is what turns
  // OPENROUTER_MODEL into decoration, so this is a standing check rather than
  // something a reviewer has to remember.
  const VENDOR_HINTS = [
    "clau" + "de-",
    "gp" + "t-4",
    "gp" + "t-5",
    "lla" + "ma",
    "son" + "net",
    "ha" + "iku",
    "op" + "us-",
    "mist" + "ral",
    "gem" + "ini",
  ];

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return sourceFiles(path);
      return /\.(ts|tsx|mts|json)$/.test(entry.name) ? [path] : [];
    });
  }

  it("has no model id anywhere under src/", () => {
    const root = join(__dirname, "..", "..");
    const offenders: string[] = [];
    for (const file of sourceFiles(root)) {
      const contents = readFileSync(file, "utf8").toLowerCase();
      for (const hint of VENDOR_HINTS) {
        if (contents.includes(hint)) offenders.push(`${file}: ${hint}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
